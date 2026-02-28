---
title: "Foreign Keys and Schema Changes: The Constraint You Didn't Plan For"
subtitle: "What dbsafe surfaces when your tables have referential constraints"
description: "MySQL foreign key constraints extend metadata locks to related tables and eliminate gh-ost for DDL. dbsafe surfaces the full FK impact before you alter."
categories: [mysql, tools]
tags: [mysql, ddl, foreign-keys, schema-changes, dbsafe, pt-online-schema-change]
header_type: hero
header_img: /assets/img/gallery/fk-impact-hero.jpg
---

You added a foreign key constraint when you designed the schema, verified referential integrity, and moved on. Two years later, you need to modify a column on the child table. You run `dbsafe plan` and the output shows a section you weren't expecting: a FK listing with the constraint name, the referenced table, and `ON DELETE CASCADE`. What does that mean for your ALTER TABLE?

Foreign key constraints surface in two places during schema changes: in the metadata locks MySQL acquires for the duration of the DDL, and in the tool selection available to you. Understanding both before you run is exactly what `dbsafe plan` is for.

> **This is the fifth post in the dbsafe series.** [Introducing dbsafe](/mysql/tools/2026/02/14/introducing-dbsafe-know-before-you-alter.html) covers installation and the full feature overview. [When MySQL Rebuilds Your Table: Understanding COPY Algorithm DDL](/mysql/tools/2026/02/22/copy-algorithm-mysql-dbsafe.html) covers the operations that require a full table rebuild — the context you need before this post.

## What dbsafe Detects

When analyzing a table, dbsafe queries [`information_schema.KEY_COLUMN_USAGE`](https://dev.mysql.com/doc/refman/8.0/en/information-schema-key-column-usage-table.html) and [`information_schema.REFERENTIAL_CONSTRAINTS`](https://dev.mysql.com/doc/refman/8.0/en/information-schema-referential-constraints-table.html) to surface every FK relationship involving the target table. The output shows the referenced tables and columns that the target table depends on.

Here's `dbsafe plan` on `order_items`, a child table with a FK pointing to `orders`:

```bash
dbsafe plan -H 127.0.0.1 -P 23306 -u dbsafe -d demo \
  "ALTER TABLE order_items ADD COLUMN note_text VARCHAR(500)"
```

![dbsafe plan output for ALTER TABLE order_items ADD COLUMN note_text showing INSTANT algorithm, SAFE risk level, and FK refs line showing 2 references to orders.id and products.id](/assets/img/gallery/fk-child-table.png)

The `FK refs` line in the output shows the count and the referenced tables and columns — `orders.id` and `products.id`. At a glance you can see which parent tables this child depends on. Surfacing this requires querying `information_schema` separately; dbsafe includes it automatically in every analysis.

FK metadata appears regardless of the DDL algorithm. Even an INSTANT operation like `ADD COLUMN` surfaces the FK relationships, so you understand the full constraint context before changing anything.

## Metadata Locks Extend to Related Tables

The [MySQL documentation on metadata locking](https://dev.mysql.com/doc/refman/8.0/en/metadata-locking.html) states:

> "Metadata locks are extended, as necessary, to tables related by a foreign key constraint to prevent conflicting DML and DDL operations from executing concurrently on the related tables. When updating a parent table, a metadata lock is taken on the child table while updating foreign key metadata. Foreign key metadata is owned by the child table."

The [FOREIGN KEY Constraints reference](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html) adds the lock type detail:

> "If a table is locked explicitly with LOCK TABLES, any tables related by a foreign key constraint are opened and locked implicitly. For foreign key checks, a shared read-only lock (LOCK TABLES READ) is taken on related tables. For cascading updates, a shared-nothing write lock (LOCK TABLES WRITE) is taken on related tables that are involved in the operation."

In practice:

- **ALTER TABLE on the child table** acquires a metadata lock on the parent table for the duration of the DDL. Any transaction on the parent that hasn't committed must complete first. New transactions that need to modify the parent must wait.
- **ALTER TABLE on the parent table** works in reverse: the lock protects the child table's FK references from being invalidated while the parent schema is changing.

The [Online DDL Operations reference](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html) documents the specific wait conditions that arise from CASCADE and SET NULL rules:

> "An ALTER TABLE on the child table could wait for another transaction to commit, if a change to the parent table causes associated changes in the child table through an ON UPDATE or ON DELETE clause using the CASCADE or SET NULL parameters."

And in the other direction:

> "In the same way, if a table is the parent table in a foreign key relationship, even though it does not contain any FOREIGN KEY clauses, it could wait for the ALTER TABLE to complete if an INSERT, UPDATE, or DELETE statement causes an ON UPDATE or ON DELETE action in the child table."

The practical consequence: an ALTER TABLE on `order_items` can block or be blocked by concurrent DML on `orders`, and vice versa — even though you're only changing one table. On high-write systems this lock interaction can cause visible application latency during the DDL window. dbsafe's FK section makes this non-obvious relationship explicit before you schedule the operation.

## The COPY Algorithm on FK-Constrained Tables

When the DDL algorithm is COPY — a full table rebuild — the FK relationship adds a validation layer to every row written into the shadow table.

InnoDB enforces FK constraints on every write operation. With `foreign_key_checks` set to `ON` (the default), every row inserted into the shadow table during the COPY phase is subject to the same referential validity check that applies to any `INSERT` against the table. The [Online DDL Operations documentation](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html) captures the dependency between FK enforcement and the algorithm available:

> "The INPLACE algorithm is supported when foreign_key_checks is disabled. Otherwise, only the COPY algorithm is supported."

This is stated in the context of `ADD FOREIGN KEY`, but it reflects the general principle: FK enforcement and COPY algorithm are coupled. On a child table with millions of rows and a FK pointing to a large parent, the COPY phase performs a referential validity check alongside every row copy.

The [FOREIGN KEY Constraints reference](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html) describes what disabling `foreign_key_checks` actually bypasses:

> "When foreign_key_checks is disabled, foreign key constraints are ignored, with the following exceptions: [recreating a dropped table must still conform to FK definitions referencing it; incorrectly formed FK definitions still return errors; dropping an index required by a FK constraint requires removing the FK first]."

Disabling `foreign_key_checks` removes referential integrity enforcement for the duration of the operation. On large tables where the validation overhead is measurable, it's a tradeoff: faster rebuild, no constraint protection if the operation is interrupted or if concurrent DML inserts during the rebuild window.

## gh-ost Does Not Support FK-Constrained Tables

This is where the FK impact is most operationally significant: **gh-ost refuses to operate on tables involved in FK relationships by default**.

The [gh-ost requirements and limitations documentation](https://github.com/github/gh-ost/blob/master/doc/requirements-and-limitations.md) is explicit:

> "Foreign key constraints are not supported. They may be supported in the future, to some extent."

The restriction applies in both directions:

- **Child-side**: a table that has a `FOREIGN KEY ... REFERENCES` clause — like `order_items` with its FK to `orders`
- **Parent-side**: a table that is referenced by other tables' FK constraints — like `orders` referenced by `order_items`

Both cause gh-ost to abort. Two escape hatches exist: `--skip-foreign-key-checks` (bypasses the detection check entirely, with a logged warning) and `--discard-foreign-keys` (allows child-side FK tables if you accept that the FK constraint will be dropped on the ghost table and not recreated). Neither is appropriate for production use when referential integrity must be maintained.

**The operational result**: any table involved in a FK relationship requires pt-osc. dbsafe detects FK constraints and routes the tool recommendation accordingly.

Here's `dbsafe plan` on the parent `orders` table, which is referenced by `order_items`:

```bash
dbsafe plan -H 127.0.0.1 -P 23306 -u dbsafe -d demo \
  "ALTER TABLE orders MODIFY COLUMN total_amount DECIMAL(14,4)"
```

![dbsafe plan output for ALTER TABLE orders MODIFY COLUMN total_amount showing COPY algorithm, DANGEROUS risk level, FK section listing order_items as a referencing child table, and a pt-osc recommendation with --preserve-triggers flag](/assets/img/gallery/fk-parent-table.png)

The output surfaces two reasons gh-ost is excluded: the `orders` table has triggers (`trg_orders_after_update`, `trg_orders_after_delete`) — [covered in the COPY algorithm post](/mysql/tools/2026/02/22/copy-algorithm-mysql-dbsafe.html) — and it is referenced by FK constraints in child tables. Either condition alone is sufficient to exclude gh-ost. pt-osc is the only viable tool.

## pt-osc and --alter-foreign-keys-method

When pt-osc alters a parent table, the rename swap at the end creates a problem: child tables still have FK constraints that reference the original table name. After the rename, those constraints point to a non-existent table.

The [pt-online-schema-change documentation](https://docs.percona.com/percona-toolkit/pt-online-schema-change.html) describes three modes for `--alter-foreign-keys-method`:

**`rebuild_constraints`** — the safe default:

> "This method uses ALTER TABLE to drop and re-add foreign key constraints that reference the new table. This is the preferred technique, unless one or more of the 'child' tables is so large that the ALTER would take too long."

Note from the pt-osc docs: "Due to a limitation in MySQL, foreign keys will not have the same names after the ALTER that they did prior to it." The names get an underscore prefix. If your application or monitoring refers to FK constraint names explicitly, update those references after the migration.

**`drop_swap`** — faster, but riskier:

> "Disable foreign key checks (FOREIGN_KEY_CHECKS=0), then drop the original table before renaming the new table into its place. This is different from the normal method of swapping the old and new table, which uses an atomic RENAME that is undetectable to client applications."

Between the drop and the rename, the original table does not exist. Queries against it fail during that window. If the rename fails, the original table is gone. The pt-osc docs describe this as riskier for exactly these two reasons.

**`none`** — requires manual follow-up:

> "This method is like drop_swap without the 'swap'. Any foreign keys that referenced the original table will now reference a nonexistent table."

This is explicitly for administrators who intend to handle FK re-pointing manually. The resulting state after the migration is broken until that manual step is performed.

When dbsafe generates a pt-osc command for a parent table COPY operation, `rebuild_constraints` is the right default unless the child tables are so large that the secondary `ALTER TABLE` to drop/recreate FKs falls outside your maintenance window. In that case, `drop_swap` trades a brief availability gap for faster completion — a deliberate tradeoff, not a safe shortcut.

## A Note on ON DELETE CASCADE During the Migration Window

If the parent table has `ON DELETE CASCADE` relationships to child tables, there is an additional consideration during the migration window. When pt-osc runs:

1. pt-osc installs `AFTER INSERT`, `AFTER UPDATE`, and `AFTER DELETE` triggers on the original table to capture DML and replay it on the ghost table.
2. When a row is deleted from `orders`, the trigger fires and pt-osc replicates the delete to the ghost table — correctly.
3. But the `ON DELETE CASCADE` to `order_items` fires inside the InnoDB storage engine, below the SQL layer, and therefore **below pt-osc's triggers**. The cascaded deletions on `order_items` are invisible to pt-osc's change tracking on `orders`.

This is the same architectural limitation documented in [ON DELETE CASCADE: The Foreign Key Change MySQL Doesn't Log](/mysql/innodb/2026/02/25/mysql-fk-cascade-blind-spot.html). In the context of a parent table migration, pt-osc's tracking of `orders` is complete; it's the shadow `order_items` data that may drift if CASCADE fires during the copy phase.

Whether this matters depends on your schema. If you're only migrating `orders` and `order_items` is not being migrated simultaneously, the drift affects data in `order_items` (the real table) — not the shadow table being built for `orders`. In most cases this is informational. But if you're orchestrating coordinated schema changes across both tables at once, sequencing and the migration window need careful planning.

## Practical Workflow for FK-Constrained Tables

**1. Run `dbsafe plan` on every table in the FK relationship**, not just the one you're altering. The metadata lock extension means the parent table's DDL window affects child table DML and vice versa. Knowing both sides before scheduling is necessary for accurate impact assessment.

**2. Accept that gh-ost is unavailable** for any table with FK relationships. pt-osc is the tool. This is not a dbsafe preference — it reflects gh-ost's documented limitation.

**3. Check the algorithm.** If INSTANT, the FK impact is limited to the MDL extension discussed above. If COPY, FK constraint validation adds overhead to the row copy phase. The larger the tables involved, the more significant the overhead.

**4. Review `--alter-foreign-keys-method` for parent table changes.** The `rebuild_constraints` default is safe. Before using `drop_swap`, verify you can tolerate the brief availability gap. Never use `none` unless you have a manual FK repair step ready to run immediately after the migration completes.

**5. For type changes that cascade through FK columns** — such as migrating `INT` primary keys to `BIGINT` — each table in the FK chain requires its own migration. The child FK column type must match the parent PK type. Plan each migration separately, verify referential integrity between steps, and do not attempt both simultaneously.

## Summary

1. **dbsafe surfaces FK relationships automatically** from `information_schema.KEY_COLUMN_USAGE` and `information_schema.REFERENTIAL_CONSTRAINTS`. The FK section appears in every analysis regardless of DDL algorithm.

2. **MySQL extends metadata locks to FK-related tables** for the duration of the DDL. The [metadata locking documentation](https://dev.mysql.com/doc/refman/8.0/en/metadata-locking.html) and the [Online DDL Operations reference](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html) document specific wait conditions for CASCADE and SET NULL rules — wait conditions that affect both the child table DDL and the parent table DDL.

3. **COPY algorithm + FK constraints** means InnoDB applies its standard FK enforcement to every row written into the shadow table during the rebuild. Disabling `foreign_key_checks` removes that overhead but also removes referential integrity protection for the duration.

4. **gh-ost refuses FK-constrained tables** by default — both parent-side and child-side. The [gh-ost documentation](https://github.com/github/gh-ost/blob/master/doc/requirements-and-limitations.md) is explicit: "Foreign key constraints are not supported." pt-osc is required for any table in a FK relationship.

5. **For parent table migrations with pt-osc**, `--alter-foreign-keys-method` controls how child FK references are updated after the rename swap. `rebuild_constraints` is the safe default. `drop_swap` is faster but introduces a brief window where the original table does not exist. `none` leaves child FKs pointing to a non-existent table until manually repaired.

## References

**MySQL Official Documentation:**
- [Metadata Locking — MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/metadata-locking.html)
- [FOREIGN KEY Constraints — MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/create-table-foreign-keys.html)
- [Online DDL Operations — MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/innodb-online-ddl-operations.html)
- [INFORMATION_SCHEMA KEY_COLUMN_USAGE Table — MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/information-schema-key-column-usage-table.html)
- [INFORMATION_SCHEMA REFERENTIAL_CONSTRAINTS Table — MySQL 8.0](https://dev.mysql.com/doc/refman/8.0/en/information-schema-referential-constraints-table.html)

**Tools:**
- [pt-online-schema-change — Percona Toolkit](https://docs.percona.com/percona-toolkit/pt-online-schema-change.html)
- [gh-ost Requirements and Limitations](https://github.com/github/gh-ost/blob/master/doc/requirements-and-limitations.md)
- [dbsafe — GitHub Repository](https://github.com/nethalo/dbsafe)

**Related Posts:**
- [Introducing dbsafe: Know Before You ALTER](/mysql/tools/2026/02/14/introducing-dbsafe-know-before-you-alter.html)
- [When MySQL Rebuilds Your Table: Understanding COPY Algorithm DDL](/mysql/tools/2026/02/22/copy-algorithm-mysql-dbsafe.html)
- [ON DELETE CASCADE: The Foreign Key Change MySQL Doesn't Log](/mysql/innodb/2026/02/25/mysql-fk-cascade-blind-spot.html)
