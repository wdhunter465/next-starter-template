---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, the Cursor startup contract, and the keepalive statement
Does Not Own: Agent-team policy, role assignment, PMO lifecycle, shared execution law, merge authority, or approval authority
Canonical Reference: /docs/governance/AGENT-EXECUTION.md
Related Issues: #3825, #4314, #4449, #4596, #4676, #4716, #4783, #4928, #4966
Last Reviewed: 2026-10-27
---

# CURSOR-RULES.md

## Purpose

Cursor follows `docs/governance/AGENT-EXECUTION.md`, `docs/governance/AGENT-TEAM.md`, and `docs/governance/REPOSITORY-AUTHORITY.md`. This file does not restate that law. Where this file and those documents differ, those documents win.

A Cursor workaround is denied unless Product Authority has approved that workaround in writing. This file does not add one.

## Wake tick

The local wake tick only keeps this Cursor session connected to the repository. The GitHub Actions runner does the same from the repository side for this same session. The tick is not a new assignment and it is not a queue ranking. Work follows `docs/governance/AGENT-EXECUTION.md`.

A tick whose poll has no new events still has a follow-up when this session has unfinished accepted work. That follow-up is the next unfinished item Product Authority named for this session, or the accepted assignment already in progress. Reporting the poll and ending the turn is a stop. A tick must not stop that work. The poll's `nextExecutable` field is not a new assignment.

## Startup contract

`docs/governance/AGENT-EXECUTION.md` (Product startup framework) requires this file to carry the Cursor `run startup` contract. The shared steps in that framework are the contract. This section adds the connection check that framework names. It does not replace the framework or the session lifecycle.

1. Report wake status. Run `~/.cursor/lgfc-wake-ctl.sh startup --session <this chat uuid>`, then `status`. Do not rebind. Do not stop another session's loop. Do not start a second loop. If a live session is recorded and the loop is stopped or stalled, report it and leave the loop stopped. Read `~/.cursor/lgfc-wake-poll-inbox.json` as a keepalive record only.
2. Read the authority chain from the doctor `repo_root`, in the order `Agent.md` gives, including this file. `docs/ops/ai/CORE-RULES.md` is a pointer, not the contract.
3. Report each file as read.
4. Report Cursor's roles from `docs/governance/AGENT-TEAM.md`.
5. Declare product Cursor and operating mode orientation only.
6. Report that startup authorizes no Issue, pull request, or file edit.
7. Stop startup. Continue with the session lifecycle in `docs/governance/AGENT-EXECUTION.md`.

Host bind is not startup and is not an assignment.

## Reporting bound (#4314)

`docs/governance/AGENT-EXECUTION.md` places Cursor's operator-facing reporting bound here. A status report may name only:

- Issues assigned to Cursor, or Issues Product Authority named as this session's work;
- open pull requests that implement those Issues;
- Cursor-owned `post-merge-failure` exceptions for those pull requests;
- parent or child Issues in that same assigned graph when they are required to explain the assigned item.

`agent:cursor` alone is not assignment. This bound does not add a stop and does not change which work the session lifecycle allows.

## Where Cursor reads the queue

`docs/governance/AGENT-EXECUTION.md` says each product names where it reads the resume queue. Cursor reads that queue from GitHub: assigned Issues, authored open pull requests and their checks, its own `post-merge-failure` Issues, and its active claims. The wake inbox is not that queue.
