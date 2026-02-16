---
layout: default
title: About
subtitle: Database performance insights from the field
permalink: /about
include_on_search: true
show_breadcrumb: true
show_sociallinks: false
show_comments: false
---

## What is Rendiment?

**Rendiment** is a technical blog dedicated to database performance optimization, with a focus on **MySQL** and **PostgreSQL**. The name comes from the Catalan word for "performance" or "yield"—a fitting tribute to the pursuit of extracting maximum efficiency from database systems.

This blog exists to share practical, battle-tested knowledge from real-world database administration. Every post is grounded in actual production experience: debugging slow queries, optimizing schemas, managing high-traffic clusters, and navigating the trade-offs between consistency, availability, and performance.

## What You'll Find Here

**Deep Technical Content**
- MySQL and PostgreSQL performance tuning
- InnoDB internals and troubleshooting
- Replication topologies (Galera, PXC, Group Replication)
- Query optimization and execution plan analysis
- Schema design and DDL safety

**Tools and Techniques**
- Database monitoring (PMM, Coroot, Prometheus/Grafana)
- Benchmarking methodologies (sysbench, ProxySQL testing)
- Custom tooling ([dbsafe](https://github.com/nethalo/dbsafe) for DDL analysis)
- Performance profiling and FlameGraphs
- Alerting strategies and dynamic thresholds

**Real-World Scenarios**
- Production debugging war stories
- Capacity planning for high-concurrency workloads
- Zero-downtime schema migrations
- Cluster failover testing
- Search optimization with pg_trgm and pgvector

## About the Author

**Daniel Guzman Burgos** is a database administrator and performance engineer based in Colombia. With years of experience managing production MySQL and PostgreSQL deployments, Daniel specializes in troubleshooting performance bottlenecks, designing resilient replication architectures, and building tools that make DBAs' lives easier.

When not diving into InnoDB source code or profiling query execution, Daniel contributes to open-source database tools and shares knowledge with the DBA community.

**Open Source Work:**
- [dbsafe](https://github.com/nethalo/dbsafe) - Analyze MySQL ALTER TABLE statements before running them
- Contributions to database monitoring and tooling projects

## Why This Blog Exists

Too often, database performance advice is either too theoretical (academic papers that don't translate to production) or too shallow (quick tips that don't explain the "why"). Rendiment aims to bridge that gap.

Every post here is:
- **Practical** - Tested in real environments, not just theory
- **Detailed** - Explains the underlying mechanisms, not just commands to run
- **Honest** - Includes failures and lessons learned, not just success stories

The goal is simple: help DBAs, developers, and infrastructure engineers make informed decisions about their databases.

## Topics & Expertise

**Databases:**
- MySQL (Percona Server, Oracle MySQL, MariaDB)
- PostgreSQL
- Percona XtraDB Cluster (PXC)
- MySQL Group Replication

**Focus Areas:**
- Performance tuning and optimization
- High availability and replication
- Monitoring and observability
- Schema design and migrations
- Troubleshooting and debugging
- Load testing and capacity planning

**Technologies:**
- ProxySQL, HAProxy
- PMM (Percona Monitoring and Management)
- Grafana, Prometheus, VictoriaMetrics
- Coroot (eBPF-based monitoring)
- Docker, Kubernetes operators

## Get in Touch

Have questions about database performance? Want to discuss a specific optimization challenge? Reach out:

- **Email:** [contact@rendiment.io](mailto:contact@rendiment.io)
- **LinkedIn:** [Daniel Guzman Burgos](https://www.linkedin.com/in/danielmauricioguzman/)
- **GitHub:** [@nethalo](https://github.com/nethalo)

Comments are enabled on all blog posts via [Giscus](https://giscus.app/) (GitHub Discussions). Feel free to ask questions, share your own experiences, or suggest topics for future posts.

## Support This Work

All content on Rendiment is **free and open**. If you find these posts helpful, the best way to support this work is:

- ⭐ Star [dbsafe](https://github.com/nethalo/dbsafe) or other open-source projects
- 🔗 Share posts with colleagues who might benefit
- 💬 Comment with your own experiences and insights
- 📧 Suggest topics you'd like to see covered

---

**Latest posts are on the [Blog](/blog/) page. For topic-specific content, browse by [Categories](/categories) or [Tags](/tags).**
