---
title: "How to Test ProxySQL Read/Write Split with sysbench"
subtitle: Getting Accurate Results with Percona XtraDB Cluster
categories: [mysql, proxysql]
tags: [mysql, proxysql, pxc, galera, read-write-split, sysbench]
header_type: image
header_img: /assets/img/gallery/sysbench-proxysql.jpg
---

You've configured ProxySQL with read/write splitting. You fire up sysbench to verify it works and... all queries go to the writer hostgroup. The rules are correct, sysbench is running, but the split isn't happening.

This post explains why sysbench doesn't work out-of-the-box with ProxySQL read/write split, and how to configure both tools properly for accurate testing.

## The Setup

Three-node PXC cluster behind ProxySQL with Galera-aware hostgroups:

- **Hostgroup 1**: Writer (single node)
- **Hostgroup 2**: Readers (backup writers promoted by `writer_is_also_reader=2`)
- **Hostgroup 3**: Backup writers

Query rules configured to route `SELECT` to readers, writes to the writer:

```sql
SELECT rule_id, active, match_digest, destination_hostgroup, apply 
FROM runtime_mysql_query_rules;
```

```
+---------+--------+----------------------+-----------------------+-------+
| rule_id | active | match_digest         | destination_hostgroup | apply |
+---------+--------+----------------------+-----------------------+-------+
| 1       | 1      | ^SELECT.* FOR UPDATE | 1                     | 1     |
| 2       | 1      | ^SELECT.*            | 2                     | 1     |
+---------+--------+----------------------+-----------------------+-------+
```

Rules look correct. Let's run sysbench and check where queries land:

```bash
sysbench --db-driver=mysql \
  --mysql-host=127.0.0.1 \
  --mysql-port=6033 \
  --mysql-user=sysbench \
  --mysql-password=sysbench123 \
  --mysql-db=sbtest \
  --tables=10 \
  --table-size=10000 \
  --threads=4 \
  --time=60 \
  /usr/share/sysbench/oltp_read_write.lua run
```

```sql
SELECT hostgroup, srv_host, srv_port, Queries 
FROM stats_mysql_connection_pool;
```

```
+-----------+-----------+----------+----------+
| hostgroup | srv_host  | srv_port | Queries  |
+-----------+-----------+----------+----------+
| 1         | 127.0.0.1 | 3307     | 60110087 |
| 2         | 127.0.0.1 | 3308     | 0        |
| 2         | 127.0.0.1 | 3309     | 0        |
+-----------+-----------+----------+----------+
```

60 million queries to hostgroup 1, zero to hostgroup 2. What's going on?

## The Problem: Transaction Persistence

By default, ProxySQL users have `transaction_persistent=1`:

```sql
SELECT username, default_hostgroup, transaction_persistent FROM mysql_users;
```

```
+----------+-------------------+------------------------+
| username | default_hostgroup | transaction_persistent |
+----------+-------------------+------------------------+
| sysbench | 1                 | 1                      |
+----------+-------------------+------------------------+
```

When `transaction_persistent=1`, ProxySQL keeps **all queries within a transaction on the same hostgroup**. Since sysbench's `oltp_read_write` workload wraps all queries in `BEGIN...COMMIT`, every query—including SELECTs—stays on whatever hostgroup handled the `BEGIN`, which is the writer (hostgroup 1).

## Understanding Multiplexing vs Routing

This is where it gets confusing. ProxySQL has two separate concepts:

**Multiplexing** = Can multiple frontend sessions share the same backend connection?

**Routing** = Which hostgroup does a query go to?

These are independent! Here's what happens during a transaction:

| Scenario | Multiplexing | Routing |
|----------|--------------|---------|
| Normal (no transaction) | Enabled | Enabled |
| Inside BEGIN...COMMIT | **Disabled** | Still enabled! |
| Inside BEGIN...COMMIT + `transaction_persistent=1` | Disabled | **Disabled** |

The [ProxySQL documentation](https://proxysql.com/documentation/multiplexing/) states:

> "Note: disabling multiplexing doesn't disable routing, so it might happen that after a CREATE TEMPORARY TABLE is executed, a SELECT query on the same table returns a 'table doesn't exist' error. The reason is that while multiplexing is disabled, routing isn't."

### What does this mean in practice?

**With `transaction_persistent=0`:**

```
BEGIN;                    → goes to hostgroup 1 (writer)
INSERT INTO users (...);  → goes to hostgroup 1 (same connection, multiplexing disabled)
SELECT * FROM users;      → goes to hostgroup 2 (reader!) because routing still works
COMMIT;                   → goes to hostgroup 1
```

See the problem? Your `INSERT` went to the writer, but your `SELECT` went to a reader. The reader hasn't received that data yet (it's not committed, and even after commit there's replication lag). You just read stale data inside your own transaction.

**With `transaction_persistent=1`:**

```
BEGIN;                    → goes to hostgroup 1 (writer)
INSERT INTO users (...);  → goes to hostgroup 1
SELECT * FROM users;      → goes to hostgroup 1 (routing disabled during transaction)
COMMIT;                   → goes to hostgroup 1
```

Now all queries stay on the writer. You see your own writes. This is called "read-your-writes consistency."

### Why does this matter?

For applications that need to read data they just wrote within the same transaction, `transaction_persistent=1` is essential. Most OLTP applications fall into this category.

For applications that don't care about reading their own uncommitted writes (rare), `transaction_persistent=0` allows more aggressive read scaling.

The [ProxySQL FAQ](https://proxysql.com/documentation/frequently-asked-questions/) notes that with `transaction_persistent=1`:

> "it will always use the same host to execute all queries to get more accurate results. Please note that it disables query routing."

A brief note clarifying that the FAQ's statement: "Please note that it disables query routing" is misleading shorthand — **it only disables routing within transactions, not globally.**

## The Solution: transaction_persistent=0 for Testing

For **testing** read/write split (not production!), set `transaction_persistent=0` on your sysbench user:

```sql
UPDATE mysql_users 
SET transaction_persistent = 0 
WHERE username = 'sysbench';

LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL USERS TO DISK;
```

This allows ProxySQL to route individual queries within transactions to different hostgroups based on your query rules. SELECTs go to readers, writes go to the writer—even within the same transaction.

**Warning**: This breaks read-your-writes consistency. Don't use this setting for production users unless you fully understand the implications.

## The Second Problem: Prepared Statements and Monitoring

sysbench uses the MySQL binary protocol (prepared statements) by default. In modern ProxySQL (2.2+), prepared statements are routed correctly—the [documentation](https://proxysql.com/documentation/prepared-statements/) confirms:

> "ProxySQL 2.2.x+: Routing metadata and Query Annotations are automatically updated by ProxySQL internally"

However, there's still a reason to disable prepared statements for testing: **MySQL Performance Schema visibility**. Binary protocol queries show `NULL` in `SQL_TEXT` and `DIGEST_TEXT` columns, making MySQL-side monitoring harder.

Add `--db-ps-mode=disable` to see queries in Performance Schema:

```bash
sysbench --db-driver=mysql \
  --mysql-host=127.0.0.1 \
  --mysql-port=6033 \
  --mysql-user=sysbench \
  --mysql-password=sysbench123 \
  --mysql-db=sbtest \
  --tables=10 \
  --table-size=10000 \
  --threads=4 \
  --time=60 \
  --db-ps-mode=disable \
  /usr/share/sysbench/oltp_read_write.lua run
```

Note: ProxySQL's own stats (`stats_mysql_query_digest`) capture everything regardless of protocol, so this is mainly useful if you also want to analyze queries on the MySQL side.

## Handling Errors During Failover Testing

If you're testing ProxySQL behavior during node failures, sysbench will abort on the first connection error. Add `--mysql-ignore-errors` with error codes relevant to your test:

**For failover/connectivity testing:**

```bash
--mysql-ignore-errors=2013,2006,2055,2027
```

| Code | Error | When It Happens |
|------|-------|-----------------|
| 2013 | Lost connection during query | Node killed mid-query |
| 2006 | MySQL server has gone away | Connection dropped |
| 2055 | Lost connection to server during query | Network interruption |
| 2027 | Malformed packet | Connection state corruption |

These are the errors you'll see during actual failover scenarios—when a node dies or becomes unreachable.

**For general concurrent workload testing:**

```bash
--mysql-ignore-errors=1213,1205
```

| Code | Error | When It Happens |
|------|-------|-----------------|
| 1213 | Deadlock found | Galera certification conflicts, InnoDB deadlocks |
| 1205 | Lock wait timeout | Long-running transactions blocking others |

These aren't failover-specific—they happen during normal concurrent operations, especially with Galera's optimistic locking. Include them if you want sysbench to continue through certification conflicts.

**Combined (for comprehensive chaos testing):**

```bash
--mysql-ignore-errors=1213,1205,2013,2006,2055,2027
```

## The Complete sysbench Command

Here's the recommended command for testing ProxySQL read/write split:

```bash
sysbench --db-driver=mysql \
  --mysql-host=127.0.0.1 \
  --mysql-port=6033 \
  --mysql-user=sysbench \
  --mysql-password=sysbench123 \
  --mysql-db=sbtest \
  --tables=10 \
  --table-size=10000 \
  --threads=4 \
  --time=60 \
  --report-interval=1 \
  --db-ps-mode=disable \
  --mysql-ignore-errors=1213,1205,2013,2006,2055,2027 \
  /usr/share/sysbench/oltp_read_write.lua run
```

Combined with `transaction_persistent=0` on the ProxySQL user, this gives you accurate read/write split testing.

## Verifying the Split

After running sysbench, check the connection pool:

```sql
SELECT hostgroup, srv_host, srv_port, Queries 
FROM stats_mysql_connection_pool 
WHERE Queries > 0;
```

You should now see queries distributed across both hostgroups:

```
+-----------+-----------+----------+----------+
| hostgroup | srv_host  | srv_port | Queries  |
+-----------+-----------+----------+----------+
| 1         | 127.0.0.1 | 3307     | 125000   |
| 2         | 127.0.0.1 | 3308     | 487000   |
| 2         | 127.0.0.1 | 3309     | 492000   |
+-----------+-----------+----------+----------+
```

For detailed query analysis, use ProxySQL's digest stats. Note that ProxySQL's admin interface uses SQLite, so use `substr()` instead of `LEFT()`:

```sql
SELECT 
  hostgroup,
  substr(digest_text, 1, 50) AS query,
  count_star
FROM stats_mysql_query_digest
ORDER BY count_star DESC
LIMIT 10;
```

## Query Rules: Order Matters

While we're here, a quick note on query rule ordering. ProxySQL evaluates rules by `rule_id` in ascending order. As noted in [Pythian's ProxySQL Query Rules guide](https://www.pythian.com/blog/technical-track/proxysql-query-rules-production-notes):

> "Unless different chains were implemented, rules are processed based on the id, from lowest to highest."

Put specific patterns before general ones:

```sql
-- Correct: specific before general
INSERT INTO mysql_query_rules (rule_id, active, match_digest, destination_hostgroup, apply)
VALUES 
  (100, 1, '^SELECT.* FOR UPDATE', 1, 1),      -- Specific
  (101, 1, '^SELECT.* LOCK IN SHARE MODE', 1, 1), -- Specific
  (200, 1, '^SELECT', 2, 1);                   -- General
```

If you put `^SELECT` first, it matches everything (including `SELECT ... FOR UPDATE`), and when no subsequent rule matches with `apply=1`, ProxySQL falls back to the user's `default_hostgroup`.

Always set `apply=1` on your rules unless you're intentionally chaining them with `flagIN/flagOUT`.

## Complete Configuration Checklist

**ProxySQL side:**

```sql
-- 1. Query rules (specific before general, all with apply=1)
INSERT INTO mysql_query_rules (rule_id, active, match_digest, destination_hostgroup, apply)
VALUES 
  (100, 1, '^SELECT.* FOR UPDATE', 1, 1),
  (101, 1, '^SELECT.* LOCK IN SHARE MODE', 1, 1),
  (200, 1, '^SELECT', 2, 1);

-- 2. Test user with transaction_persistent=0
INSERT INTO mysql_users (username, password, default_hostgroup, transaction_persistent, active)
VALUES ('sysbench', 'sysbench123', 1, 0, 1);

-- 3. Production user with transaction_persistent=1 (read-your-writes consistency)
INSERT INTO mysql_users (username, password, default_hostgroup, transaction_persistent, active)
VALUES ('app_user', 'app_password', 1, 1, 1);

LOAD MYSQL QUERY RULES TO RUNTIME;
LOAD MYSQL USERS TO RUNTIME;
SAVE MYSQL QUERY RULES TO DISK;
SAVE MYSQL USERS TO DISK;
```

**sysbench side:**

```bash
sysbench --db-driver=mysql \
  --mysql-host=127.0.0.1 \
  --mysql-port=6033 \
  --mysql-user=sysbench \
  --mysql-password=sysbench123 \
  --mysql-db=sbtest \
  --tables=10 \
  --table-size=10000 \
  --threads=4 \
  --time=60 \
  --report-interval=1 \
  --db-ps-mode=disable \
  --mysql-ignore-errors=1213,1205,2013,2006,2055,2027 \
  /usr/share/sysbench/oltp_read_write.lua run
```

## Summary

To test ProxySQL read/write split with sysbench:

1. **Set `transaction_persistent=0`** on your sysbench user — this allows per-query routing within transactions (breaks read-your-writes consistency, testing only!)

2. **Use `--db-ps-mode=disable`** — text protocol makes queries visible in MySQL Performance Schema (optional, ProxySQL routing works fine with prepared statements in 2.2+)

3. **Add `--mysql-ignore-errors`** — use `2013,2006,2055,2027` for failover testing, add `1213,1205` for concurrent workload resilience

4. **Keep `transaction_persistent=1` for production users** — most applications need read-your-writes consistency

The key insight: sysbench's default behavior (transactions + prepared statements) is actually representative of real applications. The "problem" isn't sysbench—it's that `transaction_persistent=1` is doing exactly what it should for production workloads. For testing, you temporarily relax that constraint to observe query routing.

Happy benchmarking!
