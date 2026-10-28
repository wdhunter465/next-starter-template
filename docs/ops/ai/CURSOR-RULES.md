---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, the Cursor startup contract, and the keepalive statement
Does Not Own: Agent-team policy, role assignment, PMO lifecycle, shared execution law, merge authority, or approval authority
Canonical Reference: /docs/governance/AGENT-EXECUTION.md
Related Issues: #3825, #4314, #4449, #4596, #4676, #4716, #4783, #4928, #4982, #4994, #5016
Last Reviewed: 2026-10-28
---

# CURSOR-RULES.md

## Purpose

Cursor follows `docs/governance/AGENT-EXECUTION.md`, `docs/governance/AGENT-TEAM.md`, and `docs/governance/REPOSITORY-AUTHORITY.md`. This file does not restate that law. Where this file and those documents differ, those documents win.

A Cursor workaround is denied unless Product Authority has approved that workaround in writing. This file does not add one.

## Wake tick

The local wake tick and the GitHub Actions runner are the two keepalives for this same session. What a tick means, the queue order, the skip, cycle and repeat rules and when to go quiet are in `docs/governance/AGENT-EXECUTION.md` (Assigned-queue continuation). Cursor's mechanics: on every tick run the queries in `~/.cursor/lgfc-ready-queue.txt`, then check open pull requests (`docs/reference/ci/cursor-ready-queue-contract.md`). The poll inbox is a keepalive record. The queue is GitHub.

## Startup contract

`docs/governance/AGENT-EXECUTION.md` (Product startup framework) requires this file to carry the Cursor `run startup` contract. The shared steps in that framework are the contract. This section adds the connection check that framework names. It does not replace the framework or the session lifecycle.

1. Report wake status. Run `~/.cursor/lgfc-wake-ctl.sh startup --session <this chat uuid>`, then `status`. From the doctor `repo_root`, run `scripts/cursor-wake/verify.sh` and report each file as match or drift. Do not rebind. Do not stop another session's loop. Do not start a second loop. If a live session is recorded and the loop is stopped or stalled, report it and leave the loop stopped. Read `~/.cursor/lgfc-wake-poll-inbox.json` as a keepalive record only.
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

`agent:cursor` with `status:ready` is an assignment. `agent:cursor` alone is a claim marker and is not an assignment. This bound does not add a stop and does not change which work the session lifecycle allows.

## Where Cursor reads the queue

Cursor reads the queue from GitHub through the ready-queue file above, in the order the shared law defines. The wake inbox is not that queue.
