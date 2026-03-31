---
title: "PostgreSQL Internals for the MySQL DBA"
subtitle: You already know how a database works. This is about how a different database works.
description: "PostgreSQL internals explained for MySQL DBAs. MVCC, heap vs clustered index, VACUUM, WAL, and replication, all mapped to their InnoDB equivalents."
categories: [postgresql, mysql]
tags: [postgresql, mysql, internals, mvcc, vacuum, replication, architecture]
header_type: hero
header_img: /assets/img/gallery/pg-internals-hero.jpg
---

I've been a MySQL DBA for 20 years. InnoDB internals, replication topologies, fleet management at scale. My entire mental model of how a relational database works was built on MySQL.

I've also been using PostgreSQL for about six years now. But using it and [understanding its internals](/postgresql/2026/01/21/pgtrgm-pgvector-music.html) are different things. I knew how to write queries and stand up a server. I didn't have a clear picture of what Postgres was actually doing under the hood, or why it made the design choices it made. So I decided to dig in. And I found that every explanation out there falls into one of two buckets: either it's a "Postgres vs MySQL" comparison written by someone who clearly picked a side, or it's a Postgres tutorial that starts from "what is a table." Neither is useful when you already know what a clustered index is and you want to understand why Postgres doesn't have one.

This post is what I wish existed when I started: PostgreSQL internals explained from the perspective of someone who already knows MySQL. Every concept mapped to its InnoDB equivalent. No fanboy energy. Just the architecture.

---

## MVCC: Two philosophies, same goal

Both InnoDB and PostgreSQL implement MVCC. Readers don't block writers, writers don't block readers. Same goal. Completely different implementations.

**What you already know from InnoDB:**

When you run an UPDATE, InnoDB modifies the row **in-place** in the buffer pool page. The previous version gets copied to the **undo log** (rollback segment). The modified page is marked dirty and eventually flushed to the tablespace by a checkpoint or background flushing. The redo log guarantees durability before the flush happens. If another transaction needs the old version, InnoDB follows the pointer chain in the undo log until it finds the right one. When no active transaction needs those old versions anymore, the **purge thread** cleans them up quietly in the background.

The key insight: the table (the clustered index) always contains only the latest version. History lives elsewhere.

**How PostgreSQL does it:**

Postgres does the opposite. When you run an UPDATE, the original row stays untouched. Postgres writes a **brand new copy** of the entire row into the same table. The old row gets metadata that says "I was killed by transaction Y." The new row gets metadata that says "I was born in transaction Y."

Every row (Postgres calls them "tuples") carries two internal fields: `xmin` (the transaction that created it) and `xmax` (the transaction that deleted or updated it). A live row has an `xmin` but no effective `xmax`. A dead row has both.

So the table itself is a graveyard of versions. Current rows, dead rows, all mixed together in the same physical structure. When a transaction needs to read data, it checks each tuple's `xmin` and `xmax` against its own snapshot to decide: "can I see this version?"

Think of it this way. In InnoDB, the undo log is an archive in the basement. The table is the office, and it always has the current document on the desk. In Postgres, there is no basement. Every version of every document, current and historical, is piled on the same desk. Each one has a sticky note that says when it was valid.

---

## The heap: why there's no clustered index

In InnoDB, the primary key index **is** the table. The B+Tree leaf nodes contain the actual row data, physically sorted by the primary key. This is the [clustered index](/mysql/fundamentals/2026/03/03/before-the-index-mysql-three-promises.html). When you do a SELECT by PK, InnoDB walks the tree and lands directly on the data. A secondary index stores the PK value as a pointer, so a secondary index lookup means: find the PK in the secondary index, then look up the PK in the clustered index to get the row.

Postgres doesn't have this concept. The table data lives in a structure called the **heap**. It's a file where tuples are written in whatever order they arrive, page by page. Pages are 8KB (vs InnoDB's 16KB). No sorting by any key. No tree structure. Just pages with tuple slots, filled wherever there's room.

When you create any index in Postgres, including the primary key index, it's a **separate B-Tree** that points to the physical location of the tuple in the heap. The pointer is a `ctid` (a page number and slot offset, like "page 42, slot 7"). Every index in Postgres is essentially what InnoDB would call a secondary index, except instead of pointing to a PK value, it points to a physical address.

The consequences for operations you already understand:

**Range scans on the PK.** In InnoDB, a range scan on the PK is a sequential read through contiguous leaf pages. Fast, because the data is physically ordered. In Postgres, even if you scan the PK index in order, each tuple you find could be anywhere in the heap. You're doing random I/O into the heap for each row. Postgres has a "bitmap heap scan" optimization that collects all the heap addresses first and then reads them in physical order, but it's still fundamentally different from InnoDB's clustered access pattern.

**UPDATEs and indexes.** In InnoDB, when you update a non-indexed column, only the clustered index page changes. Secondary indexes still point to the same PK, which still points to the same row (now updated in place). In Postgres, because an UPDATE creates a new tuple at a new physical location, **every index** on that table needs a new entry pointing to the new location. This is expensive. Postgres mitigates this with HOT (Heap-Only Tuple) updates: if the new tuple fits in the same heap page and you didn't change any indexed column, Postgres can skip the index updates and chain the old tuple to the new one within the page. But the moment you change an indexed column or the page is full, you pay the full cost.

**The CLUSTER command.** Postgres has a `CLUSTER` command that physically reorders the heap to match an index, once. It doesn't maintain the order over time. After a few thousand inserts and updates, the heap is scattered again. It's not a clustered index. It's a one-time defragmentation.

---

## VACUUM: the price of keeping history in the table

In InnoDB, the purge thread runs automatically in the background. It cleans up undo log entries that no active transaction needs. You almost never think about it. The worst case is when a very long-running transaction holds back the purge (the [history list length grows](/mysql/innodb/2024/09/01/innodb-semaphore-contention.html)), but even then the problem is contained to the undo tablespace.

In Postgres, the equivalent is **VACUUM**. Because dead tuples live in the table itself, someone has to come along and mark that space as reusable. That someone is VACUUM (or autovacuum, the background process that triggers it automatically).

VACUUM scans the table, identifies tuples that are invisible to all current transactions, and marks their space as available for new inserts. It doesn't return the space to the OS by default. The table file stays the same size, but the free space inside it gets reused. This is why Postgres tables can "bloat": if VACUUM can't keep up, or if something prevents it from cleaning (like a long-running transaction holding back the visibility horizon), dead tuples accumulate and the table grows beyond what the live data needs.

The closest InnoDB analogy is imagining that the undo log didn't exist as a separate structure, and instead old row versions accumulated directly inside the `.ibd` file. And then the purge thread had to walk the entire file to find and reclaim the dead ones. That's basically what VACUUM does.

**VACUUM FULL** is the nuclear option. It rewrites the entire table into a new file, copying only live tuples. Reclaims all the space. But it takes an `ACCESS EXCLUSIVE` lock, which means nothing can read or write the table while it runs. On a busy production table, this is rarely an option.

There's a parameter called `idle_in_transaction_session_timeout` that you'll want to know about. A session that starts a transaction and then idles holds back the visibility horizon for the entire database, preventing VACUUM from cleaning any tuples created after that transaction started. It's the Postgres equivalent of a long-running transaction inflating the history list length in InnoDB, except the consequences are worse because the bloat is inside every table.

---

## WAL and logical decoding: the Postgres binlog

The WAL (Write-Ahead Log) is the Postgres equivalent of the redo log and binlog combined. Every change is written to WAL before it's applied to the data files. It handles crash recovery (like the redo log) and replication (like the binlog).

For CDC and change data capture, what matters is **logical decoding**. This is the mechanism that reads WAL records and converts them into logical change events (INSERT, UPDATE, DELETE with row data). You consume these events through a **replication slot** with an **output plugin** (`pgoutput`, `wal2json`, `test_decoding`).

The replication slot tells Postgres: "don't discard WAL segments past this point, I have a consumer that hasn't caught up yet." Same concept as MySQL retaining binary logs until all replicas have consumed them.

### REPLICA IDENTITY: the Postgres binlog_row_image

In MySQL, `binlog_row_image` controls what data gets written to the binlog for each row event. FULL writes all columns before and after. MINIMAL writes only what's needed to identify and apply the change.

Postgres has `REPLICA IDENTITY`, which is set per table:

- **DEFAULT**: Uses the primary key columns as the row identifier. For UPDATEs, you get all new column values plus only the PK as the "old key." For DELETEs, you get only the PK of the deleted row.
- **FULL**: The entire old row is included. All columns, before and after. This is what you need if you want complete before/after images for CDC.
- **USING INDEX**: Uses a specific unique index as the identifier instead of the PK.
- **NOTHING**: No row identification. UPDATEs and DELETEs can't be replicated.

The comparison to `binlog_row_image` is not exact. `binlog_row_image` controls what gets logged for all purposes. `REPLICA IDENTITY` is specifically about how the subscriber (or CDC consumer) identifies which row was affected. But the practical effect for building a change stream is similar.

### TOAST: the large-value problem

Here's something that has no direct parallel in the binlog world. Postgres pages are 8KB. A tuple can't span pages. So when a column value exceeds roughly 2KB, Postgres moves it to a separate **TOAST table** (The Oversized-Attribute Storage Technique) and leaves a pointer in the main tuple.

Think of it like InnoDB's overflow pages for BLOB/TEXT columns with DYNAMIC row format, where large values get stored off-page.

The CDC implication: when you do an UPDATE that doesn't touch a TOASTed column, Postgres doesn't include that column's value in the WAL event. Your CDC consumer gets a placeholder that means "unchanged." With `REPLICA IDENTITY FULL`, the old values including TOAST are included, but at the cost of more WAL volume and I/O.

In MySQL with `binlog_row_image=FULL`, every column is always included regardless of size. No special handling needed. One less thing to worry about.

---

## Replication: why the standby can't have its own MVCC

This is where the architectural difference between MySQL and Postgres replication becomes most visible.

### Physical replication

Postgres streaming replication works by shipping WAL records to a standby server, which applies them byte by byte. The standby's data files become a physical copy of the primary. When a WAL record says "write these bytes to page 42 of table X", the standby does exactly that.

If you enable `hot_standby = on`, you can run read queries against the standby. Those queries need MVCC to get a consistent snapshot. Here's the problem: the standby doesn't have its own MVCC machinery. It doesn't generate its own tuple versions. It just replays what the primary did.

In MySQL, a replica applies relay log events using InnoDB. InnoDB on the replica generates its own undo log, manages its own buffer pool, handles its own MVCC. The replica is a sovereign database engine that happens to receive instructions from the primary. The purge thread on the primary can clean up whatever it wants, and the replica doesn't care because it has its own undo log for its own read queries.

In Postgres, the standby has no independent version management. When a read query on the standby needs to see a tuple that was alive at time T, it relies on that tuple still existing in the heap. But if the primary ran VACUUM and removed that tuple, and the WAL replay applied that VACUUM to the standby, the tuple is gone. The query fails with a replication conflict.

Postgres resolves this in one of three ways:

1. Cancel the query on the standby (the default).
2. Delay WAL replay to give standby queries time to finish (`max_standby_streaming_delay`).
3. Have the standby report its oldest needed xmin to the primary with `hot_standby_feedback = on`, so the primary delays VACUUM for those tuples.

Option 3 sounds good until you realize it means slow queries on the standby can cause bloat on the primary. A read query 3,000 miles away can prevent VACUUM from running on your primary server. In MySQL, this problem literally cannot exist because the replica's MVCC is independent.

### Logical replication

Postgres also has logical replication, which decodes the WAL into logical changes (INSERT, UPDATE, DELETE) and sends them to a subscriber. This is conceptually closer to MySQL's row-based replication. The subscriber has its own tables, its own heap, its own MVCC. It applies the changes as regular SQL operations.

A logical replication slot retains WAL segments until the consumer catches up. If the consumer is down or lagging, WAL accumulates on disk. The slot also holds a `catalog_xmin` that prevents VACUUM from cleaning dead tuples in the **system catalog tables** (pg_class, pg_attribute, etc.) because the logical decoder needs the old catalog state to correctly decode WAL records from the past.

Important distinction: a logical slot's `catalog_xmin` only blocks VACUUM on system catalog tables, not on your user tables. Your regular tables get vacuumed normally. This is different from physical replication slots (with `hot_standby_feedback`), which can block VACUUM on user tables too.

An abandoned logical replication slot causes two problems: unbounded WAL accumulation on disk, and bloat in the system catalogs. In extreme cases, the catalog bloat can become severe enough to threaten transaction ID wraparound. Always monitor your replication slots. Always drop the ones you're not using.

---

## The operational lens

Let me be direct about what I think after studying this.

MySQL's architecture makes the DBA's operational life easier in several specific ways. The purge thread is invisible. The clustered index eliminates a whole class of random I/O problems. The binlog is self-contained and doesn't need to reference the data dictionary to decode events from the past. Replication is logically independent on each node.

Postgres gives the developer more features out of the box. Richer type system, better JSON support, [extensions like PostGIS](/postgresql/2026/01/21/pgtrgm-pgvector-music.html), more standard SQL compliance. For the person writing queries and designing schemas, Postgres often feels more complete.

The trade-off is operational complexity. VACUUM tuning is a real discipline. Bloat monitoring requires active attention. Replication conflicts on hot standbys are a problem MySQL DBAs have never had to think about. TOAST adds a layer of complexity to CDC that doesn't exist with the MySQL binlog.

Neither system is better. They made different [architectural bets](/mysql/fundamentals/2026/03/03/before-the-index-mysql-three-promises.html). Understanding both makes you better at each one, because you stop taking your database's design choices for granted and start seeing them as trade-offs that could have gone the other way.

---

*I'm a MySQL DBA by trade. This is what I found when I stopped using PostgreSQL on autopilot and started reading its source of truth.*
