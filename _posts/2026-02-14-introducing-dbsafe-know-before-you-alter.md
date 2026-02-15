---
title: "Introducing dbsafe: Know Before You ALTER"
subtitle: A tool that analyzes MySQL schema changes before you run them
categories: [mysql, tools]
tags: [mysql, ddl, schema-changes, dba, tools]
header_type: image
header_img: /assets/img/gallery/dbsafe-hero.jpg
---

You've probably been there: running `ALTER TABLE users ADD COLUMN email VARCHAR(255)` on a production table, expecting it to take a few seconds, and watching it lock the table for 20 minutes instead. Or spending an hour reading MySQL documentation trying to figure out if your `MODIFY COLUMN` will use INSTANT DDL or rebuild the entire table.

The problem with MySQL's `ALTER TABLE` is that you don't know what algorithm it will use, what locks it will take, or how long it will run until you actually execute it. By then, if you guessed wrong, your application is already timing out.

## The Problem: ALTER TABLE is a Black Box

When planning a schema change, these are the questions you need answered:

- Will it use [INSTANT, INPLACE, or COPY algorithm](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html)?
- What locks will it take? Can the table still handle reads/writes?
- How long will it take on a table with 500 million rows?
- Will it work differently on MySQL 8.0.12 vs 8.0.29?
- What about my Galera cluster? Will it block all nodes in TOI mode?
- Can I roll it back if something goes wrong?
- Should I use [gh-ost](https://github.com/github/gh-ost) or pt-online-schema-change instead?

You can test on staging, but staging never has production-scale data. You can read the documentation, but you still need to mentally map your MySQL version, your table structure, and your specific ALTER syntax to figure out what will happen.

There should be a tool that just tells you.

## Enter dbsafe

dbsafe is a command-line tool that connects to your MySQL server, analyzes your DDL or DML statement without running it, and tells you exactly what will happen.

![dbsafe plan output showing INSTANT algorithm and SAFE risk level](/assets/img/gallery/dbsafe-output-safe.png)

<details>
<summary>View code</summary>

```bash
dbsafe plan "ALTER TABLE users ADD COLUMN email VARCHAR(255)"
```

```
Algorithm: INSTANT
Locking: NONE
Risk Level: SAFE
Estimated Time: < 1 second
Table Rebuild: No
Recommended: Native MySQL (no tools needed)

Rollback Plan:
  ALTER TABLE users DROP COLUMN email;
```

</details>

It's read-only analysis. It doesn't modify anything. It just tells you what MySQL would do if you ran that statement.

## The Same Statement, Different Outcomes

Here's what makes schema changes tricky: similar-looking statements can behave completely differently.

![Comparison of safe ADD COLUMN vs dangerous MODIFY COLUMN operations](/assets/img/gallery/dbsafe-safe-vs-dangerous.png)

<details>
<summary>View code</summary>

**Adding a column at the end (SAFE):**

```bash
dbsafe plan "ALTER TABLE users ADD COLUMN phone VARCHAR(20)"
```

```
Algorithm: INSTANT
Locking: NONE
Risk: SAFE
Execution: < 1 second

This operation can run on production right now.
```

**Modifying a column's type (DANGEROUS):**

```bash
dbsafe plan "ALTER TABLE users MODIFY COLUMN name VARCHAR(200)"
```

```
Algorithm: COPY
Locking: EXCLUSIVE
Risk: DANGEROUS
Execution: ~15 minutes (estimated for 50M rows)
Table will be completely locked during operation

Recommended: Use gh-ost or pt-online-schema-change
Estimated gh-ost time: 25 minutes (zero downtime)
```

</details>

The first one is instant, no locks, safe for production. The second one rebuilds the entire table with an exclusive lock ([COPY algorithm](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html) creates a new table and copies all rows). You need to know which is which before you run it.

## Topology Detection

If you're running Percona XtraDB Cluster, dbsafe detects it and adjusts its analysis:

![dbsafe topology detection for Percona XtraDB Cluster](/assets/img/gallery/dbsafe-topology-pxc.png)

<details>
<summary>View code</summary>

```bash
dbsafe connect
```

```
Topology: Percona XtraDB Cluster
Cluster Size: 3 nodes (from wsrep_cluster_size)
Node State: Synced (from wsrep_local_state_comment)
wsrep_OSU_method: TOI

WARNING: DDL in TOI mode will block ALL cluster nodes
A 10-minute ALTER locks all 3 nodes for 10 minutes

Recommendation: Use pt-online-schema-change for large tables
Or switch to RSU (Rolling Schema Upgrade) method for this operation
```

</details>

*In TOI mode, [DDL locks the entire cluster for the duration of the operation](https://docs.percona.com/percona-xtradb-cluster/8.0/toi.html) - all nodes are blocked from accepting writes. Cluster detection uses [wsrep status variables](https://docs.percona.com/percona-xtradb-cluster/8.0/wsrep-status-index.html). For large tables, use [pt-online-schema-change](https://docs.percona.com/percona-toolkit/pt-online-schema-change.html) or [RSU method](https://docs.percona.com/percona-xtradb-cluster/8.0/rsu.html).*

The same ALTER that's safe on standalone MySQL can block your entire cluster for minutes in [TOI (Total Order Isolation) mode](https://docs.percona.com/percona-xtradb-cluster/8.0/toi.html). dbsafe detects:

- Galera/PXC clusters ([wsrep status variables](https://docs.percona.com/percona-xtradb-cluster/8.0/wsrep-status-index.html))
- MySQL Group Replication ([performance_schema.replication_group_members](https://dev.mysql.com/doc/refman/8.0/en/performance-schema-replication-group-members-table.html))
- Async replication topologies ([SHOW REPLICA STATUS](https://dev.mysql.com/doc/refman/8.0/en/show-replica-status.html))
- Semi-sync replication

And adjusts its risk assessment and recommendations accordingly.

## DML Analysis

dbsafe also analyzes DELETE and UPDATE statements:

![DML analysis showing chunked DELETE script generation](/assets/img/gallery/dbsafe-dml-analysis.png)

<details>
<summary>View code</summary>

```bash
dbsafe plan "DELETE FROM orders WHERE created_at < '2023-01-01'"
```

```
Estimated Affected Rows: ~1.2M (45% of table)
Table Size: 2.4GB
Risk: CAUTION - Large bulk operation
Table has 2 triggers (will fire for each row)
Replication lag impact: HIGH

Generated chunked execution script:
  /tmp/dbsafe-chunked-delete-20260215-153022.sh

Script will:
  - Delete in 1000-row chunks
  - Add 2-second delay between chunks
  - Track progress
  - Allow safe stop/resume
  - Estimated total time: ~15 minutes
```

</details>

It uses [`EXPLAIN`](https://dev.mysql.com/doc/refman/8.0/en/explain.html) to estimate affected rows, checks for triggers, and generates a chunked execution script for large operations. The script uses `LIMIT` with `SLEEP()` between batches to avoid replication lag and long-running transactions.

## Version-Specific Features

[MySQL 8.0.12 introduced INSTANT ADD COLUMN](https://dev.mysql.com/blog-archive/mysql-8-0-innodb-now-supports-instant-add-column/) for trailing positions. [MySQL 8.0.29 extended it to any position and added INSTANT DROP COLUMN](https://dev.mysql.com/blog-archive/mysql-8-0-instant-add-and-drop-columns/). dbsafe detects your MySQL version and tells you what's supported.

![Version comparison between MySQL 8.0.11 and 8.0.29+ INSTANT DDL support](/assets/img/gallery/dbsafe-version-comparison.png)

<details>
<summary>View code</summary>

**On MySQL 8.0.11:**

```bash
dbsafe plan "ALTER TABLE users ADD COLUMN bio TEXT"
```

```
Algorithm: INPLACE (INSTANT not available in MySQL 8.0.11)
Requires table rebuild
Consider upgrading to MySQL 8.0.12+ for INSTANT DDL support
```

*Reference: [Online DDL Operations - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html)*

**On MySQL 8.0.29+:**

```bash
dbsafe plan "ALTER TABLE users ADD COLUMN bio TEXT AFTER name"
```

```
Algorithm: INSTANT (any position supported in 8.0.29+)
Locking: NONE
Risk: SAFE
```

</details>

Same statement, different behavior depending on version. You need to know what your specific MySQL version supports.

## Features

**Read-only analysis** - Connects to your database, reads metadata, never modifies data

**Topology detection** - Detects Galera/PXC, Group Replication, async replication, adjusts recommendations

**Version-aware** - Knows feature differences between MySQL 8.0.12, 8.0.29, 8.4 LTS, and Percona variants

**Rollback plans** - Generates undo SQL for every DDL operation

**DML analysis** - Analyzes DELETE/UPDATE statements, generates chunked execution scripts

**Multiple output formats** - Text (colored), Plain (no colors), JSON (for automation), Markdown

**Table metadata** - Shows table size, row count, indexes, foreign keys, triggers

**Tool recommendations** - Tells you when to use [gh-ost](https://github.com/github/gh-ost), pt-online-schema-change, or native MySQL

**CI/CD integration** - JSON output, exit codes for pipeline automation

## Requirements

- MySQL 8.0.x or 8.4 LTS (including Percona Server variants, XtraDB Cluster, Group Replication)
- MySQL 5.7 and MariaDB are NOT supported
- Read-only MySQL user with [SELECT, PROCESS, and REPLICATION CLIENT privileges](https://dev.mysql.com/doc/refman/8.0/en/privileges-provided.html)

## Installation

```bash
# Linux x86_64
VERSION=0.1.2
curl -L https://github.com/nethalo/dbsafe/releases/download/v${VERSION}/dbsafe_${VERSION}_linux_amd64.tar.gz | tar xz
sudo mv dbsafe /usr/local/bin/

# macOS Apple Silicon
VERSION=0.1.2
curl -L https://github.com/nethalo/dbsafe/releases/download/v${VERSION}/dbsafe_${VERSION}_darwin_arm64.tar.gz | tar xz
sudo mv dbsafe /usr/local/bin/

# Create MySQL user for dbsafe (read-only)
mysql -u root -p << 'SQL'
CREATE USER 'dbsafe'@'%' IDENTIFIED BY 'your_password';
GRANT SELECT, PROCESS, REPLICATION CLIENT ON *.* TO 'dbsafe'@'%';
SQL

# Setup configuration
dbsafe config init

# Test connection
dbsafe connect
```

## Quick Start

Create a test database:

```sql
CREATE DATABASE dbsafe_demo;
USE dbsafe_demo;
CREATE TABLE products (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100),
  price DECIMAL(10,2)
) ENGINE=InnoDB;
```

Test a safe change (add `-p` to be prompted for password):

```bash
dbsafe plan "ALTER TABLE products ADD COLUMN description TEXT"
```

Output shows INSTANT algorithm, no locks, safe for production.

Test a dangerous change:

```bash
dbsafe plan "ALTER TABLE products MODIFY COLUMN name VARCHAR(255)"
```

Output shows COPY algorithm, exclusive locks, recommendation to use [gh-ost](https://github.com/github/gh-ost) or pt-online-schema-change.

**Note**: Connection parameters come from `~/.dbsafe/config.yaml`. Use the `-p` flag if you need to enter your password interactively (recommended - don't store passwords in config files).

## Use Cases

**Planning production schema changes** - Analyze before you run, know the impact

**Reviewing migration scripts** - Add to CI/CD pipeline to catch dangerous changes early

**Galera/PXC cluster operations** - Understand TOI blocking behavior before it happens

**Large table operations** - Get realistic time estimates, decide between native MySQL and [gh-ost](https://github.com/github/gh-ost)

**DML safety** - Analyze bulk DELETE/UPDATE, get chunked execution scripts

## How It Works

dbsafe connects to your MySQL server (read-only) and performs the following analysis:

1. **SQL Parsing** - Uses [Vitess sqlparser](https://github.com/vitessio/vitess/tree/main/go/vt/sqlparser) to parse and understand your DDL/DML statement
2. **Topology Detection** - Queries `wsrep_*` variables (Galera/PXC), `performance_schema.replication_group_members` (Group Replication), or runs `SHOW REPLICA STATUS` (async replication)
3. **Metadata Collection** - Gathers table size, row count, indexes, foreign keys, triggers from [`information_schema`](https://dev.mysql.com/doc/refman/8.0/en/information-schema.html)
4. **Version Detection** - Checks MySQL version to determine available INSTANT DDL features
5. **Algorithm Determination** - Maps your operation + MySQL version to execution algorithm (INSTANT/INPLACE/COPY)
6. **Impact Estimation** - Calculates estimated duration, lock requirements, and replication impact
7. **Recommendations** - Suggests [gh-ost](https://github.com/github/gh-ost)/pt-osc for COPY operations on large tables, chunked scripts for bulk DML

All analysis is read-only. No test runs, no locks taken, no data modified.

## Output Formats

**Text** (default) - Colored output for terminal use

**Plain** - No colors, for log files and CI/CD

**JSON** - Machine-readable for automation:

```bash
dbsafe plan --format json "ALTER TABLE users ADD COLUMN email VARCHAR(255)" > analysis.json
```

**Markdown** - For documentation

## Configuration

The `dbsafe config init` command creates `~/.dbsafe/config.yaml` interactively. You can manually edit it for multiple environments:

```yaml
connections:
  default:
    host: localhost
    port: 3306
    user: dbsafe
    database: myapp

  production:
    host: prod.example.com
    port: 3306
    user: dbsafe_ro
    database: production

defaults:
  chunk_size: 10000
  format: text
```

**Important**: Never store passwords in the config file. Use the `-p` flag when running commands to enter the password interactively.

View current configuration:

```bash
dbsafe config show
```

Then run analysis using the default connection:

```bash
dbsafe plan "ALTER TABLE users ADD COLUMN region VARCHAR(50)"
```

## What's Next

This is the first post in a series on safe MySQL schema changes. Upcoming topics:

1. INSTANT DDL operations - MySQL 8.0.12 vs 8.0.29 feature differences
2. INPLACE operations - when MySQL rebuilds indexes without copying the table
3. COPY algorithm - why some operations require full table rebuild
4. Managing schema changes in Galera/PXC clusters
5. Safe bulk DELETE and UPDATE strategies
6. Foreign key impact on DDL performance
7. Trigger warnings for DML operations
8. CI/CD integration patterns

## Links

- [GitHub Repository](https://github.com/nethalo/dbsafe)
- [Report Issues](https://github.com/nethalo/dbsafe/issues)

## References

**MySQL Official Documentation:**
- [ALTER TABLE Statement - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/alter-table.html)
- [Online DDL Operations - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html)
- [InnoDB Storage Engine - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/innodb-storage-engine.html)
- [InnoDB and Online DDL - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl.html)
- [INFORMATION_SCHEMA Tables - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/information-schema.html)
- [Privileges Provided by MySQL](https://dev.mysql.com/doc/refman/8.0/en/privileges-provided.html)
- [EXPLAIN Statement - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/explain.html)
- [SHOW REPLICA STATUS - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/show-replica-status.html)

**MySQL Blog Posts:**
- [MySQL 8.0: InnoDB now supports Instant ADD COLUMN](https://dev.mysql.com/blog-archive/mysql-8-0-innodb-now-supports-instant-add-column/)
- [MySQL 8.0 INSTANT ADD and DROP Column(s)](https://dev.mysql.com/blog-archive/mysql-8-0-instant-add-and-drop-columns/)

**MySQL Group Replication:**
- [performance_schema.replication_group_members Table](https://dev.mysql.com/doc/refman/8.0/en/performance-schema-replication-group-members-table.html)
- [Monitoring Group Replication - MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/group-replication-monitoring.html)

**Percona XtraDB Cluster Documentation:**
- [Total Order Isolation (TOI)](https://docs.percona.com/percona-xtradb-cluster/8.0/toi.html)
- [Rolling Schema Upgrade (RSU)](https://docs.percona.com/percona-xtradb-cluster/8.0/rsu.html)
- [Index of wsrep Status Variables](https://docs.percona.com/percona-xtradb-cluster/8.0/wsrep-status-index.html)
- [Online Schema Upgrade](https://docs.percona.com/percona-xtradb-cluster/8.0/online-schema-upgrade.html)

**Percona Toolkit:**
- [pt-online-schema-change](https://docs.percona.com/percona-toolkit/pt-online-schema-change.html)

**Third-Party Tools:**
- [gh-ost - GitHub's Online Schema Migration Tool](https://github.com/github/gh-ost)
- [Vitess sqlparser](https://github.com/vitessio/vitess/tree/main/go/vt/sqlparser)

---

*Next: [Understanding INSTANT DDL Operations in MySQL 8.0+](#)*
