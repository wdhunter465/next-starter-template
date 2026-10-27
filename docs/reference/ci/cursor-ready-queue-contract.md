---
Doc Type: Reference
Audience: Human + AI
Authority Level: Reference
Owns: The Cursor ready-queue file, the queries it holds, what a Cursor tick does with them, and the rule for when Cursor may go quiet
Does Not Own: Runtime selection (docs/governance/standards/CURSOR-RUNTIME-ROUTING.md), the shared execution law, queue-state label definitions, or the local poller implementation
Canonical Reference: /docs/governance/AGENT-EXECUTION.md
Related Issues: #4982, #4362, #4966
Last Reviewed: 2026-10-27
---

# Cursor ready-queue contract

## Purpose

Keep the Cursor local agent working without a task list from Product Authority. The repository says what is ready (`status:ready` and the other queue-state labels). The local poller asks GitHub on every tick. Cursor is idle only when GitHub has nothing for it.

## Scope

This file specifies one local file on the Cursor host and what each tick does with it. It does not define the labels (`docs/governance/WORK-QUEUES-AND-COLLABORATION.md`, Queue-state labels), the session lifecycle (`docs/governance/AGENT-EXECUTION.md`), or how Cursor is started (`docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`).

## Current known truth

- The wake tick and poll are keepalives. They keep the session connected and never stop work (`docs/governance/AGENT-EXECUTION.md`, Assigned-queue continuation).
- Before this contract the poller's `nextExecutable` pointer came from a host-side list. It did not read `status:ready`, so a ready Issue could sit on GitHub while Cursor reported that nothing was ready.
- The host file below is outside the repository. This document is its source of truth, so the file can be restored on any machine or session.
- Status: specified. Cursor installs the file on its host and records that on #4982.

## The file

Path: `~/.cursor/lgfc-ready-queue.txt`. One GitHub issue-search query per line, in priority order. A line starting with `#` is a comment. The poller adds `repo:wdhunter465/next-starter-template` to each query.

```text
# 1 Operations interrupt. Handle before anything else.
is:issue is:open label:team:operations label:ops:priority:1,ops:priority:2,ops:priority:3,ops:priority:4
# 2 Cursor's own post-merge exceptions.
is:issue is:open label:post-merge-failure label:agent:cursor
# 3 Assigned and ready.
is:issue is:open label:agent:cursor label:status:ready
# 3b Assigned and in progress across several pull requests.
is:issue is:open label:agent:cursor label:status:active
# 4 Ready and unclaimed.
is:issue is:open label:status:ready -label:agent:cursor -label:agent:claude
# 5 Unassigned and not yet reviewed, primary queues.
is:issue is:open label:team:operations,team:governance -label:agent:cursor -label:agent:claude -label:status:ready -label:wait:product -label:wait:review -label:wait:dependency -label:status:hold
# 6 Unassigned and not yet reviewed, secondary queues.
is:issue is:open label:team:engineering,team:pmo -label:agent:cursor -label:agent:claude -label:status:ready -label:wait:product -label:wait:review -label:wait:dependency -label:status:hold -label:pmo:task
```

Cursor's own open pull requests are checked on every tick as well: a failing gate is work.

## What a tick does

1. Run the queries in order. Write each result count and the first Issue numbers to `~/.cursor/lgfc-wake-poll-inbox.json` under `readyQueue`. The inbox stays a keepalive record. The queue itself is GitHub.
2. Work the first non-empty query, one Issue at a time. Query 1 interrupts everything. Queries 5 and 6 mean review the Issue and take ownership: claim it and resolve it, complete its package if the missing parts are within Cursor's roles, or label it `wait:product` and name the one decision missing.
3. Check Cursor's open pull requests and fix any failing gate.
4. Report the tick in one line. Do not report "nothing to do" while any step above found work.

## When Cursor may go quiet

Only when all of these hold at the same moment:

- every query returns nothing;
- no authored pull request has a failing or pending gate that Cursor owns;
- no Operations interrupt is open.

Going quiet means staying connected and doing nothing until the next tick. It never means ending the session.

## Intended final state

A new `status:ready` label wakes Cursor from the GitHub side (the dispatch trigger, tracked on #4982), and the poller finds the same Issue on its next tick. The two keepalives agree because they read the same labels.

## Restore

If the file is missing, copy the block above to `~/.cursor/lgfc-ready-queue.txt`, make the poller read it, and record the date on #4982.
