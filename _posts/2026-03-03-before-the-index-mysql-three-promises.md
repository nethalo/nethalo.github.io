---
title: "Before the Index, Before the Schema: MySQL Makes Three Promises"
subtitle: And understanding them changes how you work
description: "What is a database actually supposed to do? A framework of three core promises that applies whether you're a DBA, developer, or ops engineer."
categories: [mysql, fundamentals]
tags: [mysql, fundamentals, architecture, dba]
header_type: hero
header_img: /assets/img/gallery/what-databases-do-hero.png
---

Most people, when asked what a database does, say something like: "it stores data."

That's like saying a restaurant "stores food."

Technically true. Completely misses the point.

A restaurant has to cook fast, serve many tables at once, and not poison anyone. Fail any one of those three and it doesn't matter how good the kitchen looks. A database has the same problem — except the stakes are your production system at 2am.

A few years ago I gave a talk at Percona Live in Denver where I tried to answer this properly. Not from a features list. Not from a vendor slide deck. From first principles: what does a database *have* to do?

Three things. Everything else — every configuration parameter, every architecture decision, every incident you've ever fought — falls into one of them.

---

## Execute Queries

![MySQL query execution flow through InnoDB — buffer pool, redo log, and doublewrite buffer working together](/assets/img/gallery/what-databases-do-execute.jpg)

A restaurant has one core job: take an order and bring food to the table. Fast, correct, and for as many tables as possible simultaneously.

A database has the same job. Answer questions about data. Record changes. As fast as possible, as many as possible, without corrupting anything in the process.

That last part is the one that gets sacrificed first when you're optimizing for speed. InnoDB's entire machinery — the buffer pool, the redo log, the doublewrite buffer — exists to make sure "fast" and "correct" happen at the same time. ACID isn't a marketing term. It's the contract the database makes with every query it executes.

The tension is real. Disabling `foreign_key_checks` before a bulk load makes the operation faster. It also removes a correctness guarantee while it's disabled. That tradeoff isn't inherently wrong — but you can only make it deliberately if you understand what you're trading. If you're curious about the hidden consequences of foreign keys, I covered one particularly dangerous scenario in [the ON DELETE CASCADE blind spot in MySQL's binary log](/mysql/tools/2026/02/25/mysql-fk-cascade-blind-spot.html).

When a query is slow, the reflex is to reach for indexes. Sometimes that's right. But a query can also be slow because lock contention is serializing execution, because the working set stopped fitting in the buffer pool, or because something upstream is flooding the connection pool. Same symptom, completely different root causes, completely different solutions. Knowing the responsibility narrows the search. Understanding [InnoDB semaphore contention](/mysql/innodb/2024/09/01/innodb-semaphore-contention.html) is one way to tell lock contention apart from other causes.

---

## Relationships

![Database relationships — users, replicas, and dev/ops teams all depend on the database](/assets/img/gallery/what-databases-do-relationships.jpg)

No database is an island.

Think of it like a person who has three very different kinds of relationships in their life — and does a bad job with any one of them at their own peril.

**With users**, the relationship is trust and boundaries. Who gets in, what they can see, what they can touch. MySQL's account model — hosts, privileges, roles — is the entire machinery for this. When someone asks why the application can't just run as root, this is why. The database has a responsibility to protect data from people and systems that shouldn't have it. That responsibility doesn't disappear because setting it up is inconvenient.

**With other databases**, the relationship is coordination. A replica trusts that the primary is sending it a faithful copy of reality. A PXC node trusts that the other nodes in the cluster will agree on the same writes. When `wsrep_local_recv_queue` starts climbing, the cluster is telling you a relationship is under stress — one node can't keep up with what the others are sending. It's a relationship problem before it's a performance problem. Treating it as a performance problem first is how you end up chasing the wrong metric.

**With dev and ops teams**, the relationship is communication. Logs, status variables, Performance Schema — this is how the database talks. When you skip configuring the slow query log because it adds overhead, you're choosing silence. You'll regret that choice during the next incident, when you're flying blind trying to reconstruct what happened. Tools like [PMM Query Analytics](/mysql/postgresql/pmm/percona/monitoring/2024/09/19/pmm-query-analytics-clickhouse.html) exist precisely to bridge this communication gap.

A database that executes queries correctly but can't communicate its state, can't cooperate with peers, and can't enforce who has access — is a ticking clock.

---

## Survive

![Database survival — CPU, memory, and disk as physical constraints the database must negotiate](/assets/img/gallery/what-databases-do-survive.jpg)

This is the one nobody talks about at conferences, and it's the one that kills you.

A database doesn't run in the cloud. It runs on a machine. A machine with a CPU that can be saturated, memory that can be exhausted, and a disk that fills up and then — not slowly degrades, but **stops**. Full disk doesn't slow MySQL down. It stops it cold.

Think of it like a tenant who has to know the rules of the building they live in. The landlord — the OS — controls memory allocation, file descriptors, I/O scheduling. The tenant can push their luck, but only so far before the landlord intervenes. An OOM kill at 3am is the landlord evicting a tenant who was using more than their share.

`innodb_buffer_pool_size` is the most important negotiation a MySQL server has with its host machine. Too low and you're leaving performance on the table. Too high on a box running other processes and you're gambling that the OS won't reclaim that memory mid-write. That configuration parameter isn't a performance knob. It's a survival decision.

Disk is more insidious. A table that grows 100MB per day doesn't look dangerous today. In six months it's 18GB. The database won't warn you. It will just stop one day. The monitoring that watches disk growth trends and alerts before the cliff — that's not operational overhead. That's the database fulfilling its responsibility to survive the physical world it lives in. Setting up [smart alerting with dynamic thresholds](/monitoring/prometheus/2024/09/10/smart-alerting-dynamic-thresholds.html) is how you catch these slow-moving threats.

Backups live here too. A database that can't be recovered after a failure didn't survive. Full stop.

---

## Why This Framework Matters

![The three promises as a diagnostic framework — locating a problem before solving it](/assets/img/gallery/what-databases-do-framework.jpg)

These three categories won't tell you how to fix anything. They're not a checklist. What they give you is a way to locate a problem before you start solving it — and that matters more than most people admit.

Replica falling behind? Three possible zip codes:

- **Execute Queries** — the primary is running queries so heavy that the replica can't replay them fast enough
- **Relationships** — the network between primary and replica can't carry the replication stream
- **Survive** — the replica's disk I/O is the bottleneck

Same symptom. Three completely different tools. If you go straight to tuning queries when the real problem is disk throughput on the replica, you will waste hours.

The framework doesn't solve the problem. It tells you which drawer to open first.

Every decision you make as a DBA is in service of one of these three things. Execute queries correctly and fast. Manage relationships with users, peers, and teams. Survive the physical constraints of the machine it runs on.

That's the whole job.

---

*I first presented this framework at Percona Live in Denver. The talk was aimed at DBAs, but I've always believed that database fundamentals should be explainable to anyone — and that explaining them clearly forces a deeper understanding than talking only to specialists.*
