---
title: Contention in MySQL InnoDB
subtitle: Useful info from the semaphores section
categories: [mysql,innodb]
tags: [innodb, mysql, contention, semaphores]
header_type: image
header_img: /assets/img/gallery/a-magnifier.png
---

## Identifying Contention Points in MySQL Using InnoDB Semaphores

In a high concurrency environment, contention is inevitable. This guide explores how to identify contention points using the SEMAPHORES section from the `SHOW ENGINE INNODB STATUS` command output.

## Understanding SEMAPHORES

The SEMAPHORES section in InnoDB status output provides metrics related to InnoDB waits. It contains two types of data:
1. Event counters
2. A list of current waits

### Current Waits

This section should ideally be empty unless your MySQL instance is experiencing high concurrency. If you see lines like "Thread <num> was waited...", it indicates contention.

Example output:

```
----------
SEMAPHORES
----------
OS WAIT ARRAY INFO: reservation count 1744351
--Thread 139964395677440 has waited at btr0cur.cc line 5889 for 0 seconds the semaphore:
S-lock on RW-latch at 0x7f4c3d73c150 created in file buf0buf.cc line 1433
a writer (thread id 139964175062784) has reserved it in mode exclusive
number of readers 0, waiters flag 1, lock_word: 0
Last time read locked in file btr0sea.cc line 1121
Last time write locked in file /mnt/workspace/percona-server-5.7-redhat-binary-rocks-new/label_exp/min-centos-7-x64/test/rpmbuild/BUILD/percona-server-5.7.28-31/percona-server-5.7.28-31/storage/innobase/btr/btr0sea.cc line 1121
OS WAIT ARRAY INFO: signal count 1483499
RW-shared spins 0, rounds 314940, OS waits 77827
RW-excl spins 0, rounds 205078, OS waits 7540
RW-sx spins 4357, rounds 47820, OS waits 949
Spin rounds per wait: 314940.00 RW-shared, 205078.00 RW-excl, 10.98 RW-sx
```

## Analyzing Contention

To monitor this section, you can use the following command:

```bash
while true; do mysql -N -e"show engine innodb status\G" | sed -n '/SEMAPHORES/,/TRANSACTIONS/p'; sleep 1; done
```

### Key Information to Extract

From the current waits, focus on:
1. The exact version of MySQL (and flavor: Percona Server, Oracle's MySQL, MariaDB)
2. Filename
3. File line

## Investigating the Code

Once you have the necessary information, follow these steps to investigate the code:

1. Find the correct repository (e.g., https://github.com/percona/percona-server/ for Percona Server)
2. Locate the specific release/version
3. Navigate the code tree (usually under `storage/innobase/`)
4. Examine the relevant files and line numbers

## Case Study: Analyzing Contention

In our example:

1. MySQL version: Percona Server 5.7.28-31
2. Files and lines of interest:

```
- btr0cur.cc line 5889
- buf0buf.cc line 1433
- btr0sea.cc line 1121
```  

## Looking Inside the Code

Once you have identified the files and line numbers of interest, you can investigate the code without downloading the source. Here's how:

### Finding the Repository

1. Navigate to the appropriate GitHub repository (e.g., https://github.com/percona/percona-server/ for Percona Server).
2. Ensure you're looking at the correct version of the code.

### Finding the Release

1. Click on the "Releases" link on the repository page.
2. Locate the specific version you're investigating (e.g., 5.7.28-31 for Percona Server).
3. Click on the tag link to view the code at that specific release point.

### Navigating the Code Tree

The relevant part of the code tree is typically:

```
-root
---storage
------innobase
```

The InnoDB storage engine code is inside the "innobase" directory. To find the correct subdirectory:

1. Look at the filename (e.g., btr0cur.cc).
2. The directory name is the part before the zero (e.g., "btr" for btr0cur.cc).

### Examining the Files

Once you've found the correct files, you can view them directly on GitHub. For example:

- https://github.com/percona/percona-server/blob/Percona-Server-5.7.28-31/storage/innobase/btr/btr0sea.cc#L1121
- https://github.com/percona/percona-server/blob/Percona-Server-5.7.28-31/storage/innobase/buf/buf0buf.cc#L1433
- https://github.com/percona/percona-server/blob/Percona-Server-5.7.28-31/storage/innobase/btr/btr0cur.cc#L5889

Each file typically has a description at the top:
```
- btr0sea.cc: "The index tree adaptive search" (Adaptive Hash Index - AHI)
- buf0buf.cc: "The database buffer buf_pool" (InnoDB Buffer Pool)
- btr0cur.cc: "The index tree cursor" (B-Tree where data exists in InnoDB)
```

By examining these files and the specific lines mentioned in the SEMAPHORES output, you can gain insight into what operations were causing contention.

### What's Happening?

- btr0cur.cc: Estimating the number of rows in an index range
- buf0buf.cc: Creating a lock over a buffer pool block
- btr0sea.cc: Using the Adaptive Hash Index (AHI) for search

The analysis reveals contention on the AHI. However, the wait time is 0 seconds, indicating that the contention disappeared quickly and only occurred once during the monitored period.

## Conclusion

The InnoDB code is well-documented, making it possible to identify contention spots. While not every situation is immediately evident, understanding the code can be invaluable in diagnosing issues.

If contention issues persist, consider:
1. Increasing the buffer pool size
2. Increasing the number of AHI partitions
3. Disabling the AHI entirely

Remember to test thoroughly before implementing any changes in a production environment.


