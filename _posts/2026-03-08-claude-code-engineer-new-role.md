---
title: "The Claude Code Engineer"
subtitle: Ship more, type less
description: "Meet the Claude Code Engineer: a new role where QA, product thinking, and AI coordination matter more than writing code. How agentic tools reshape teams."
categories: [engineering]
tags: [claude-code, ai, engineering, workflow, devops]
header_type: hero
header_img: /assets/img/gallery/claude-code-engineer-hero.jpg
---

There is a new type of job showing up. Maybe it already exists and nobody named it yet. But the pattern is clear, and I think it deserves a name: **Claude Code Engineer**.

This is not a developer. Not exactly. Not a project manager either. And definitely not a prompt engineer (that term needs to retire already). The Claude Code Engineer is the person who sits between the backlog and production, and their main tool is not an IDE. It's an agentic coding assistant.

## The loop

Here's what a Claude Code Engineer does, every day:

1. **Picks up issues.** From GitHub, Jira, Linear, wherever. They tell Claude Code to read the issue and come up with a plan.
2. **Reviews the plan.** They don't approve blindly. They read the plan, understand the trade-offs, and leave a comment on the ticket explaining why they approved, changed, or rejected it. This means the engineer needs to understand the code *and* the business.
3. **Enforces documentation.** Every issue must produce or update documentation. No exceptions.
4. **Enforces testing.** Unit tests, integration tests, regression tests, e2e. The engineer decides what coverage the change needs and makes sure Claude Code generates it.
5. **Runs the tests and does QA.** They run the full test suite, review the output, and do manual QA. Last checkpoint before merge.
6. **Manages the git workflow.** Worktrees, pull requests, clean commit history. The engineer handles the merge when everything is green.

That's the loop. Issue, plan, review, docs, tests, QA, merge. Every day. Multiple issues in parallel.

<!-- TODO: Diagram showing the loop as a cycle: Issue → Plan → Review → Docs → Tests → QA → Merge → back to Issue. Clean, minimal style. Could be a simple flowchart or circular diagram. -->
![The Claude Code Engineer loop: from issue to merge](/assets/img/gallery/claude-code-engineer-loop.jpg)

## Why QA is the main skill

If I had to rank the skills needed for this role: QA first, product second, dev third.

Claude Code can write code. It can also write tests, but it will write the tests that pass, not the tests that *should* pass. The difference between those two is the whole point of quality assurance.

The Claude Code Engineer needs to think about edge cases the LLM didn't consider and how the change interacts with what already exists. They need to be the person who says "what happens when the input is null and the user is unauthenticated and the database is in read-only mode?" and then makes Claude Code write that test.

This is not a junior role. This is someone who has broken enough things in production to know where things break.

## Why git worktrees, not just branches

Quick detour: a git repo only has one working directory. If Claude Code is halfway through a feature, you can't switch branches and start another task. You're stuck waiting.

Worktrees fix this. Multiple working directories, each on its own branch, all sharing the same repo history. No cloning the repo five times. Claude Code has [built-in worktree support](https://code.claude.com/docs/en/common-workflows): `claude --worktree feature-auth` and you're running. The team at incident.io [wrote about their experience](https://incident.io/blog/shipping-faster-with-claude-code-and-git-worktrees) running four or five Claude agents at the same time this way. It's what makes the Claude Code Engineer role possible: one person coordinating multiple parallel AI sessions, each working on a different issue.

<!-- TODO: Diagram showing one engineer with 3-4 parallel worktrees, each on a different branch/issue. Shows the "one person, multiple AI sessions" concept visually. -->
![One engineer running multiple parallel worktrees, each working on a different issue](/assets/img/gallery/claude-code-engineer-worktrees.jpg)

## The Issue Architect

Someone has to create those issues. The **Issue Architect** has a product/infrastructure/architecture profile. They think in milestones and epics. They break down big initiatives into small, well-scoped issues that can be worked on independently and **in parallel**.

Why parallel? Because if the issues are well-structured, there's no reason you can't have multiple worktrees running at the same time. The bottleneck is no longer "how fast can we type code." The bottleneck is "how well did we define the work."

The Issue Architect's value is in knowing how to split things up. How to break a large feature into independent pieces that don't create merge conflicts and can be tested on their own. That skill becomes 10x more valuable when your execution speed goes way up.

## The Toolsmith

The **Claude Code Toolsmith** builds custom plugins, skills, CLAUDE.md files, and hooks that put the team's knowledge into Claude Code's workflow: code review checklists, database safety rules, changelog validation, naming conventions, QA templates built from real production incidents.

They make sure that when Claude Code writes code for *your* company, it writes it the way *your* company writes code. Not generic code. Not "best practices from Stack Overflow" code. *Your* code.

## What about the people who aren't developers?

I'm a DBA. I don't write great code. I know databases, a lot, and some adjacent stuff: devops, linux, monitoring. So when I look at these roles, I ask myself: where do I fit?

AI can write a migration. It can generate an `ALTER TABLE` that looks perfectly fine. But it has no idea that your table has 500 million rows and that ALTER will lock it for 20 minutes during peak traffic. It doesn't know that your replication topology means that DDL needs to run through `pt-online-schema-change`, not as a direct statement. It doesn't know that `ON DELETE CASCADE` on that particular table will [silently wipe half your data](/mysql/tools/2026/02/25/mysql-fk-cascade-blind-spot.html) if someone deletes the wrong parent row. The DBA knows that.

In this model, the specialist becomes the most important kind of Toolsmith. The DBA builds the skill that flags DDL on tables over 10M rows. The SRE builds the hook that validates resource limits. The security engineer builds the check that scans for hardcoded secrets.

And yes, I see the irony. I'm building [dbsafe](https://github.com/nethalo/dbsafe) that does exactly this: it checks DDL and DML for dangerous patterns so that developers (and AI) don't [blow up the database](/mysql/tools/2026/02/14/introducing-dbsafe-know-before-you-alter.html). I'm literally teaching the machine everything I know. At some point, someone will say "if the tool catches all the problems, why do we need the DBA?"

It's uncomfortable. But Terraform exists and infrastructure engineers didn't disappear. Kubernetes exists and SREs didn't disappear. The tool automates the execution, but someone still has to decide *what* to execute and *why*.

dbsafe started by detecting DDL algorithms and warning about table locks. Then I had to add topology awareness for PXC clusters. Then [foreign key impact analysis](/mysql/tools/2026/02/28/foreign-key-impact-ddl-dbsafe.html). Then [Aurora and RDS support](/mysql/tools/2026/03/06/dbsafe-cloud-aurora-rds-tls.html). Each one was a new guardrail that only existed because production taught me a new lesson.

And then there's work no tool covers. Migrating a fleet of MySQL master-slave clusters to Percona XtraDB Cluster with ProxySQL: months of planning, fixing tables with no primary key, building monitoring dashboards, writing failover runbooks, dealing with the 15 things that go wrong that you didn't plan for. Could Claude Code help with parts of that? Probably yes. Could it plan and execute the whole thing? No. Half of it is judgment calls that depend on knowing your specific infrastructure.

The tool catches what you taught it to catch. It doesn't catch what you haven't seen yet. I'd rather be the person who built the guardrail than the person who gets called at 3 AM because nobody did.

## The elephant in the room: what about juniors?

Salesforce announced it would halt junior hiring for 2025, saying AI made them productive enough. Then they [reversed course](https://codeconductor.ai/blog/future-of-junior-developers-ai/) when the strategy failed. That reversal matters.

Still, the landscape is not great. A [Stanford/ADP study](https://digitaleconomy.stanford.edu/wp-content/uploads/2025/08/Canaries_BrynjolfssonChandarChen.pdf) found developers aged 22-25 lost nearly 20% of their jobs since late 2022. [SignalFire](https://www.signalfire.com/blog/signalfire-state-of-talent-report-2025) shows new grad hiring at the top 15 tech companies is down over 50% from pre-pandemic levels. [LeadDev](https://leaddev.com/the-ai-impact-report-2025) found 54% of engineering leaders expect junior hiring to go down because of AI tools.

But that logic has a problem: **if you don't hire juniors today, you won't have seniors tomorrow.** As the [Stack Overflow blog](https://stackoverflow.blog/2025/12/26/ai-vs-gen-z/) put it: "if you don't hire junior developers, you'll someday never have senior developers."

The Claude Code Engineer role is a new entry point. Instead of "write this CRUD endpoint," it becomes "review this CRUD endpoint that Claude Code wrote, check the edge cases, make sure the docs match." Different skill. Learnable. And I'd say it teaches engineering judgment faster than writing boilerplate ever did.

## The other elephant: what about seniors?

"If a mid-level person can review AI output, why are we paying senior salaries?"

Some companies will try this. They will fire seniors, hire cheaper people to "operate" AI tools, and call it efficiency. It will blow up.

The Claude Code Engineer reviews the output. But someone has to define the architecture, build the skills and plugins (the Toolsmith), break down the roadmap into good issues (the Issue Architect), and make the call when the AI proposes something that breaks a constraint only 10 years of production experience would catch. That's the senior.

The senior's value goes up in this model. Their architecture decisions shape every feature that every Claude Code Engineer ships. Their output is no longer measured in lines of code. It's measured in how many bad decisions they prevented the AI from making.

Companies that cut seniors will ship fast and break things. Companies that keep seniors and give them leverage will ship fast and break less.

## What this looks like in practice

Imagine a team of five:

- **1 Issue Architect** who breaks down the roadmap into well-scoped parallel issues
- **2 Claude Code Engineers** who each run 3-5 parallel worktrees, reviewing plans, enforcing quality, and merging
- **1 Toolsmith** who builds the internal skills and safety checks
- **1 senior engineer** who handles system design, incident response, performance tuning, security reviews

That team of five ships what used to require fifteen. Not because the other ten got fired, but because the work changed shape.

<!-- TODO: Team structure diagram showing the 5 roles: Issue Architect at top feeding issues down, 2 Claude Code Engineers in the middle each with multiple worktree lines, Toolsmith on the side feeding skills/hooks into the workflow, Senior Engineer as the architectural foundation. -->
![A five-person team structure: Issue Architect, two Claude Code Engineers, Toolsmith, and senior engineer](/assets/img/gallery/claude-code-engineer-team.jpg)

## The inevitable objection

"But what if Claude Code gets good enough that you don't need the Engineer?"

Maybe. Eventually. But the answer to "will we still need someone to verify the work?" has always been yes. We automated deployments and still need SREs. We automated testing and still need QA engineers. We automated monitoring and still need on-call rotations.

The tools change. The responsibility doesn't.

The backlog is infinite. It always has been.
