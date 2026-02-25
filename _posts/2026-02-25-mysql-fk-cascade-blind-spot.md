---
title: "ON DELETE CASCADE: The Foreign Key Change MySQL Doesn't Log"
subtitle: "Invisible to the binlog, the audit plugin, and triggers. All at once."
description: "MySQL InnoDB's ON DELETE CASCADE bypasses the binlog, audit plugins, and triggers — the three blind spots explained plus a trigger-based workaround for 8.x."
categories: [mysql, innodb]
tags: [mysql, innodb, binlog, replication, foreign-keys, cdc, audit]
header_type: hero
header_img: /assets/img/gallery/fk-cascade-hero.jpg
---

You've set `binlog_format=ROW` and `binlog_row_image=FULL`. Every row change is in the binlog, right? Triggers, stored procedures, LOAD DATA, all of it — every effect is captured as row events.

Mostly yes. But there's one case where MySQL is completely silent: **foreign key cascades**.

And the silence isn't just in the binlog. It's in the audit plugin and in your triggers too. Three blind spots, same root cause.

---

## What ROW + FULL actually captures

When you use row-based logging, the server records the *effect* of every DML operation — not the statement itself. The [MySQL docs on stored program binary logging](https://dev.mysql.com/doc/refman/8.0/en/stored-programs-logging.html) are clear about this:

> For stored procedures, the CALL statement is not logged. For stored functions, row changes made within the function are logged, not the function invocation.

The same applies to triggers and events. The code doesn't appear in the binlog — the row changes do. That's good. With `binlog_row_image=FULL`, each row event contains every column of the row, before and after the change.

So for direct DML, stored procedures, triggers, stored functions, prepared statements, LOAD DATA INFILE, and Event Scheduler events — you're fully covered.

Foreign key cascades are the exception.

---

## The cascade blind spot

When you delete a row from a parent table and InnoDB cascades that delete to child rows, only the parent deletion appears in the binlog. The child table deletions are nowhere to be found.

This is [documented as a known limitation](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html) in the MySQL 8.0 Reference Manual, section 15.1.20.5.

Here's what the binlog actually shows for a cascaded delete:

```
| binlog.000003 | 354 | Table_map    | table_id: 90 (orders)      |
| binlog.000003 | 410 | Delete_rows  | table_id: 90               |
| binlog.000003 | 459 | Xid          | COMMIT                     |
```

If `orders` has a child table `order_items` with `ON DELETE CASCADE`, every deletion in `order_items` is missing from that output. The binlog tells you the parent row is gone, and nothing else.

The reason is architectural. InnoDB handles cascade enforcement entirely inside the storage engine. When InnoDB processes a `DELETE` on the parent table, it finds the matching child rows and removes them internally — without ever surfacing those operations back to the SQL layer. The binary log is written by the SQL layer. If the SQL layer doesn't see it, the binlog doesn't record it.

This behavior is the same whether you're using statement-based or row-based replication. Changing `binlog_format` doesn't help.

---

## And it gets worse: triggers don't fire either

Before reaching for triggers as a workaround, there's a second problem. Triggers on the child table also don't fire when rows are deleted by a cascade.

The [MySQL 8.0 Reference Manual section on CREATE TRIGGER](https://dev.mysql.com/doc/refman/8.0/en/create-trigger.html) states this directly:

> Cascaded foreign key actions do not activate triggers.

The same sentence appears in the [FOREIGN KEY Constraints section](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html) and has been consistent across every MySQL version from 5.5 to 8.4. It was first reported as [bug #11472](https://bugs.mysql.com/bug.php?id=11472) back in 2005 and remains open as of MySQL 8.x.

So if you had a `AFTER DELETE` trigger on `order_items` to write to an audit table — it won't fire when the cascade removes rows. It will only fire if rows are deleted directly with an explicit `DELETE` statement.

---

## And the audit plugin too

The MySQL Enterprise Audit plugin, the Percona Audit Log plugin, and MariaDB-based audit plugins all intercept events at the SQL layer — the same layer the binlog is written at. Since cascade operations never reach the SQL layer, they are invisible to every audit plugin as well.

The complete picture in MySQL 8.x:

| Mechanism | Sees direct DML | Sees FK cascade effects |
|---|---|---|
| Binlog (ROW + FULL) | ✅ | ❌ confirmed |
| Audit plugin | ✅ | ❌ confirmed |
| Triggers on child table | ✅ | ❌ confirmed |
| `general_log` | ✅ | ❌ confirmed |
| `events_statements_*` | ✅ | ❌ confirmed |
| `table_io_waits_summary_by_table` | ✅ | ⚠️ likely blind spot |

The first five are confirmed blind spots — all operate at or above the SQL layer, and the cascade never reaches them.

The last one is more nuanced. `table_io_waits_summary_by_table` instruments the `wait/io/table/sql/handler` instrument, which hooks into the handler API (`ha_delete_row`, `ha_write_row`, etc.) at a lower level than statements. In theory, if InnoDB called `ha_delete_row` for each cascaded row, Performance Schema would count it. But in practice, InnoDB's cascade implementation calls internal row deletion functions directly, bypassing the standard handler interface that Performance Schema instruments. The architectural expectation is that this is also a blind spot, but I haven't found explicit documentation confirming it for this specific table — and it's worth verifying empirically in your environment before relying on it for anything compliance-related.

The only layer with complete visibility into cascade operations is InnoDB itself — in the undo log and the tablespace pages.

---

## Verifying it yourself

You can confirm this in minutes. Set up a simple parent/child relationship and watch the binlog:

```sql
CREATE TABLE orders (
  id INT PRIMARY KEY
) ENGINE=InnoDB;

CREATE TABLE order_items (
  id INT PRIMARY KEY,
  order_id INT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT INTO orders VALUES (1);
INSERT INTO order_items VALUES (1, 1), (2, 1), (3, 1);

-- Now delete the parent
DELETE FROM orders WHERE id = 1;
```

Then check what made it into the binlog:

```bash
mysqlbinlog --base64-output=DECODE-ROWS -v /var/lib/mysql/binlog.000001
```

You'll see one `Delete_rows` event for `orders`. Nothing for `order_items`, even though those three rows are gone.

---

## The workaround: move the cascade to the SQL layer

The only clean solution in MySQL 8.x is to stop letting InnoDB handle the cascade and do it explicitly in the SQL layer instead. You keep the foreign key for referential integrity, but change the action to `RESTRICT`, and add a `BEFORE DELETE` trigger on the parent that performs the deletion on children explicitly:

```sql
-- Step 1: Change the FK to RESTRICT (no cascade)
ALTER TABLE order_items
  DROP FOREIGN KEY order_items_ibfk_1,
  ADD CONSTRAINT order_items_ibfk_1
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

-- Step 2: Add a trigger on the parent that does the deletion
DELIMITER //
CREATE TRIGGER before_order_delete
BEFORE DELETE ON orders
FOR EACH ROW
BEGIN
  DELETE FROM order_items WHERE order_id = OLD.id;
END //
DELIMITER ;
```

Now when you delete from `orders`, the trigger fires, issues an explicit `DELETE` on `order_items`, and that statement goes through the full SQL layer: it appears in the binlog, it fires any `AFTER DELETE` triggers on `order_items`, and the audit plugin captures it.

**This comes with a tradeoff.** InnoDB's native cascade is highly optimized — it uses a depth-first search on the FK index and deletes child rows in a single internal pass. When you replace it with a trigger-based `DELETE`, that statement goes through the full SQL engine execution path. For tables with millions of child rows per parent, this can be measurably slower. Test it against your actual data volumes before deploying.

---

## Data forensics when you can't prevent it

If cascades already happened and you need to reconstruct what was deleted from child tables, it's possible — but only if you have a backup predating the event.

The cascade is deterministic. Given the parent row's primary key and the FK definition, you know exactly which child rows InnoDB would have removed. The process:

1. Parse the binlog to extract the PK values of deleted parent rows and their timestamps
2. Restore your last backup to a separate instance
3. Apply the binlog up to just before the delete event
4. Query the child tables filtering by the FK column — those results are exactly what the cascade removed
5. Repeat recursively if you have multi-level FK chains

If you don't have a backup, the only path is low-level InnoDB recovery: `undrop-for-innodb` or manual tablespace page parsing. That's a different category of work entirely and not guaranteed to succeed.

---

## MySQL 9.6 finally fixes this

MySQL 9.6, released January 2026, addresses the root cause. Oracle moved foreign key enforcement and cascade execution from the InnoDB storage engine to the SQL engine layer. Now when a cascade fires, the SQL engine generates discrete DML statements for the child table operations, and those statements are logged to the binlog normally.

The same `DELETE FROM orders WHERE id = 1` that previously produced one binlog event now produces events for both the parent deletion and all child table deletions — and audit plugins and triggers on child tables finally see them too.

For MySQL 8.x and Percona Server 8.x, this fix is not available. The architectural change is deep enough that a backport to 8.4 LTS would be a major engineering effort, and there's no indication Percona plans to do it.

If you're running Percona XtraDB Cluster 8.x and this gap matters for your compliance or CDC requirements, the trigger-based workaround described above is your best option today.

---

## Summary

In MySQL 8.x, `ON DELETE CASCADE` and `ON UPDATE CASCADE` with InnoDB are handled entirely inside the storage engine, invisible to every observability layer that operates at or above the SQL layer:

- The binlog only records the parent table operation
- Audit plugins miss the child table changes entirely
- Triggers on child tables do not fire

The trigger-based workaround — replacing cascade FKs with `RESTRICT` and doing explicit child deletions in a `BEFORE DELETE` trigger on the parent — is the only way to get full visibility on MySQL 8.x. It's more verbose and potentially slower at scale, but it makes the cascade operations first-class citizens in your binlog and audit logs.

MySQL 9.6 solves this at the architecture level. Until you get there, document the gap explicitly and design around it.

---

*References:*
- *[MySQL 8.0 Docs: FOREIGN KEY Constraints §15.1.20.5](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html)*
- *[MySQL 8.0 Docs: CREATE TRIGGER §15.1.22](https://dev.mysql.com/doc/refman/8.0/en/create-trigger.html)*
- *[MySQL 8.0 Docs: Stored Program Binary Logging §27.7](https://dev.mysql.com/doc/refman/8.0/en/stored-programs-logging.html)*
- *[MySQL Bug #32506: Foreign key cascades do not appear when binlog_format = 'ROW'](https://bugs.mysql.com/bug.php?id=32506)*
- *[MySQL Bug #11472: Triggers not executed following foreign key updates/deletes](https://bugs.mysql.com/bug.php?id=11472)*
- *[Oracle MySQL Blog: No More Hidden Changes: How MySQL 9.6 Transforms Foreign Key Management](https://blogs.oracle.com/mysql/no-more-hidden-changes-how-mysql-9-6-transforms-foreign-key-management)*
