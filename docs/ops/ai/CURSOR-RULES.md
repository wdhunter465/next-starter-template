---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, the Cursor startup contract, and the keepalive statement
Does Not Own: Agent-team policy, role assignment, PMO lifecycle, shared execution law, merge authority, or approval authority
Canonical Reference: /docs/governance/AGENT-EXECUTION.md
Related Issues: #3825, #4449, #4596, #4676, #4716, #4783, #4928, #4982, #4994, #5012, #5016, #5034
Last Reviewed: 2026-11-19
---

# CURSOR-RULES.md

## Purpose

Cursor follows `docs/governance/AGENT-EXECUTION.md`, `docs/governance/AGENT-TEAM.md`, and `docs/governance/REPOSITORY-AUTHORITY.md`. This file does not restate that law. Where this file and those documents differ, those documents win.

A Cursor workaround is denied unless Product Authority has approved that workaround in writing. This file does not add one.

## Wake tick

The local wake tick and the GitHub Actions runner are the two keepalives for this same session. What a tick means, the queue order, the skip, cycle and repeat rules and when to go quiet are in `docs/governance/AGENT-EXECUTION.md` (Assigned-queue continuation) — including skip-any-block (#4994) and continuous pass / owner restarts one wake loop (#5012). Cursor's mechanics: on every tick run the queries in `~/.cursor/lgfc-ready-queue.txt`, then check open pull requests (`docs/reference/ci/cursor-ready-queue-contract.md`). The poll inbox is a keepalive record. The queue is GitHub. Do not restate the skip rule here; follow the shared law.

## Startup contract

`docs/governance/AGENT-EXECUTION.md` (Product startup framework) requires this file to carry the Cursor `run startup` contract. The shared steps in that framework are the contract. This section adds the connection check that framework names. It does not replace the framework or the session lifecycle.

1. Report wake status. Run `~/.cursor/lgfc-wake-ctl.sh startup --session <this chat uuid>`, then `status`. From the doctor `repo_root`, run `scripts/cursor-wake/verify.sh` and report each file as match or drift. Do not rebind. Do not stop another session's loop. Do not start a second loop. If a live session is recorded and the loop is stopped or stalled, report it. Continue the open-Issue pass anyway (Assigned-queue continuation). When nothing can move and this chat is the recorded owner, start exactly one loop and report its PID (#5012). When that owner is another chat, stay on standby for the loop, name the next command, and do not run it: `resume` when halted, then `rebind --session <this chat uuid>`. Read `~/.cursor/lgfc-wake-poll-inbox.json` as a keepalive record only.
2. Read the authority chain from the doctor `repo_root`, in the order `Agent.md` gives, including this file. `docs/ops/ai/CORE-RULES.md` is a pointer, not the contract.
3. Report each file as read.
4. Report Cursor's roles from `docs/governance/AGENT-TEAM.md`.
5. Declare product Cursor and operating mode orientation only.
6. Report that startup authorizes no Issue, pull request, or file edit.
7. End startup. Continue with the session lifecycle in `docs/governance/AGENT-EXECUTION.md` in the same turn (#5012).

Host bind is not startup and is not an assignment.

## Wake commands (#5034)

Product Authority phrases, and the command each one runs:

- "Close prior sessions, only this session is primary" (and the same idea under other wording) means four steps in order: `~/.cursor/lgfc-wake-ctl.sh halt`, then `resume`, then `rebind --session <this chat uuid>`, then start exactly one wake loop in this chat and report its PID. Running `halt` alone is wrong: it stops the loop until `resume` and `rebind`, and it does not start this chat's loop.
- "Take over" is the same sequence when another chat still holds the recorded owner: `resume` when `~/.cursor/lgfc-wake-halt` exists, then `rebind --session <this chat uuid>`, then start this chat's loop. Startup never runs this sequence.

Each control command in one sentence:

- `stop` kills matching wake processes and leaves the recorded owner in place.
- `halt` stops the loop and the watchdog, clears the owner, and refuses a new loop until `resume`.
- `release` stops the wake processes and clears the owner when this chat still owns the session.
- `rebind` stops other wake processes and binds this chat. It is the takeover command, and it is not a startup step.

## Where Cursor reads the queue

Cursor reads the queue from GitHub through the ready-queue file above, in the order the shared law defines. The wake inbox is not that queue. Status reports may name any Issue in that queue order when it explains the pass; there is no separate Cursor-only reporting bound (#4314 removed under #5012).
