---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, the Cursor startup contract, background-service definitions, continuous-workflow orientation, and the keepalive statement
Does Not Own: Agent-team policy, role assignment, PMO lifecycle, shared execution law, merge authority, or approval authority
Canonical Reference: /docs/governance/AGENT-EXECUTION.md
Related Issues: #3825, #4449, #4596, #4676, #4716, #4783, #4928, #4982, #4994, #5012, #5016, #5034, #5379, #3188, #5383, #5408, #5426, #5432
Last Reviewed: 2026-11-21
---

# CURSOR-RULES.md

## Purpose

Cursor follows `docs/governance/AGENT-EXECUTION.md`, `docs/governance/AGENT-TEAM.md`, and `docs/governance/REPOSITORY-AUTHORITY.md`. This file does not restate that law. Where this file and those documents differ, those documents win.

A Cursor workaround is denied unless Product Authority has approved that workaround in writing. This file does not add one.

## Local source of truth (#5383)

The **local repository checkout** is the source of truth for Cursor Local orientation:

| Source | Role |
| --- | --- |
| Repo checkout (`docs/ops/ai/CURSOR-RULES.md`, `.cursor/rules/*.mdc`, `scripts/cursor-wake/*`) | Authority. Read these first. |
| Host install under `~/.cursor/` (via `scripts/cursor-wake/install.sh`) | Installs, pointers to the repo, and runtime state only (wake scripts, tick prompt, ready-queue file, host hooks). Must match the checkout manifest (`scripts/cursor-wake/verify.sh`). Drift is corrected by reinstall from the repo. The host is not a second rulebook: no skills, no rules, no `AGENTS.md` copy. |
| Chat transcript / prior-session memory | Not authority. Do not treat a past explanation as the contract. |
| Product Authority chat instructions | Interrupt / Go / takeover only. They do not replace this file or shared law. |

Always-applied Local rule cards under `.cursor/rules/` load from the checkout for every new session. Do not install skills or rules under `~/.cursor/`; those live only in the repository.

## Standing approval: shell command allowlist (Product Authority, 2026-07-31; recorded in the repo 2026-11-21, #5432)

Product Authority issued this approval in a local Cursor session on 2026-07-31 and decided on 2026-11-21 (#5426) that it belongs in the repository. His words: "I am issuing a standing approval to update the allowlist as commands are found to be needed and need to be added to the allowlist. all such occurrences are approved in advance."

**What is approved.** When a shell command that Cursor Local legitimately needs is blocked because it is not on the command allowlist, Cursor may add the matching pattern to `permissions.allow` in `~/.cursor/cli-config.json` and retry, without asking for approval of each command.

**Rules for using it.**

- Add the narrowest pattern that unblocks the need. Prefer one tool (`Shell(tool*)`) over a broad wildcard.
- Never add a pattern to work around repository governance, a secrets boundary, or a destructive-action confirmation that Product Authority would otherwise be asked about.
- Leave `permissions.deny` untouched unless Product Authority instructs otherwise.
- Name every allowlist addition in the session summary, so there is a visible record.

**Limits.** This approval covers Cursor Local's own `cli-config.json` and nothing else. It does not apply to Cursor Cloud, to any other agent, or to files in the repository, and it does not authorize a Production write, a credential, a cost commitment or any protected decision. It is a previously approved exception and authorizes no other workaround.

The allowlist itself is host permission configuration and stays on the host. This section is the authority for changing it; the host holds no copy of this text (see Local source of truth).

## Background services (keepalives only)

These host services keep the Cursor Local chat connected. They are **not** the assignment, not the queue, and not authorization to work or to stop.

| Service | What it is | What it is not |
| --- | --- | --- |
| Always-on wake loop (`lgfc-always-on-loop.sh`, ~60s) | Emits the wake tick so this chat stays connected; each tick runs the GitHub poller | Not the work list; an empty tick does not mean go idle |
| Wake tick / tick prompt | Keepalive message into this chat | Not an assignment and not a stop |
| GitHub poller (`poll-github.mjs`) | Updates the poll inbox / ready-queue snapshot from GitHub | Not continuous workflow itself |
| Poll inbox (`~/.cursor/lgfc-wake-poll-inbox.json`) | Keepalive record of recent polls | Not the queue |
| Wake watchdog (`lgfc-wake-watchdog`) | Restarts a stalled loop after bind grace | Not a task dispatcher |
| `lgfc-wake-ctl.sh` | Bind / status / halt / resume / rebind control for this chat’s loop | Not Issue authorization |
| Self-hosted runner `lgfc-cursor-chromebook` (label `lgfc-cursor`) | Lets `lgfc-cursor-dispatch` reach this host | Not continuous workflow; online/idle does not mean “wait for dispatch” |

Retired and must not be treated as live keepalives: Cursor Local Bridge, standalone `poll-wake-loop` as an execution dependency (`docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`).

## Continuous workflow (the agent's job)

Continuous workflow is Cursor’s job under `docs/governance/AGENT-EXECUTION.md` (Assigned-queue continuation, #5012). It is independent of whether a tick just arrived.

On every turn end, and after answering a person:

1. Run the inbound communication checkpoint (#3188 / #5379) before unrelated queue work.
2. Read the GitHub queue through `~/.cursor/lgfc-ready-queue.txt` (`docs/reference/ci/cursor-ready-queue-contract.md`).
3. Follow queue order, skip-any-block (#4994), and act on the first Issue that can move.
4. When a PR for one Issue waits on independent review or merge, stop *that* Issue only and continue the pass.
5. When nothing can move and this chat is the recorded wake owner, start exactly one loop and report its PID; do not treat a stopped loop as a reason to idle the Issue pass.

Quiet is allowed only when the shared law’s “Going quiet” conditions all hold. An empty tick never satisfies that by itself. Product Authority must not redefine background services versus continuous workflow each session — this file and the always-applied Local cards already do.

### Every-tick card, split gates, and Operations classification (#5408)

The always-applied Local card `.cursor/rules/50-every-tick.mdc` states the positive duty first: run the queue, act on the first Issue that can move, and never report “nothing to do” while a step found work. The one-line tick report must name Operations Issues seen from ready-queue queries 1 and 5, not only Issues claimed by Cursor.

**Split gated tasks.** When a Production Go or other approval is missing for only part of a task, do the part that needs none, record the held part, and label only that held Issue `wait:*`. Do not park the whole task on one wait label.

**Classify on the first pass.** An unclassified open `team:operations` Issue gets an `ops:priority:N` from the Operations holder on the first pass of a tick.

These three points add no Go, approval, or merge authority. The shared law remains `docs/governance/AGENT-EXECUTION.md` (Assigned-queue continuation).

## Wake tick

The local wake tick and the GitHub Actions runner are the two keepalives for this same session. What a tick means, the queue order, the skip, cycle and repeat rules and when to go quiet are in `docs/governance/AGENT-EXECUTION.md` (Assigned-queue continuation) — including skip-any-block (#4994) and continuous pass / owner restarts one wake loop (#5012). Cursor's mechanics: on every tick run the inbound communication checkpoint (#3188 / #5379) before unrelated queue work, then run the queries in `~/.cursor/lgfc-ready-queue.txt`, then check open pull requests (`docs/reference/ci/cursor-ready-queue-contract.md`). The poller writes a `cursor-inbound-communication` block into `readyQueue` for Cursor-targeted unanswered events even when another agent holds the claim label. The poll inbox is a keepalive record. The queue is GitHub. Do not restate the skip rule here; follow the shared law.

## Startup contract

`docs/governance/AGENT-EXECUTION.md` (Product startup framework) requires this file to carry the Cursor `run startup` contract. The shared steps in that framework are the contract. This section adds the connection check that framework names. It does not replace the framework or the session lifecycle.

1. Report wake status. Run `~/.cursor/lgfc-wake-ctl.sh startup --session <this chat uuid>`, then `status`. From the doctor `repo_root`, run `scripts/cursor-wake/verify.sh` and report each file as match or drift. Do not rebind. Do not stop another session's loop. Do not start a second loop. If a live session is recorded and the loop is stopped or stalled, report it. Continue the open-Issue pass anyway (Assigned-queue continuation). When nothing can move and this chat is the recorded owner, start exactly one loop and report its PID (#5012). Owner restart applies to a stopped or aborted loop, not a halted one: a halt stays until Product Authority says resume (or "take over"), then the sequence is `resume`, `rebind --session <this chat uuid>`, start. When that owner is another chat, stay on standby for the loop, name the next command, and do not run it: `resume` when halted, then `rebind --session <this chat uuid>`. Read `~/.cursor/lgfc-wake-poll-inbox.json` as a keepalive record only.
2. Read the authority chain from the doctor `repo_root`, in the order `AGENTS.md` gives, including this file. `docs/ops/ai/CORE-RULES.md` is a pointer, not the contract.
3. Report each file as read.
4. Report Cursor's roles from `docs/governance/AGENT-TEAM.md`.
5. Declare product Cursor and operating mode orientation only.
6. Report that startup authorizes no Issue, pull request, or file edit.
7. End startup. In the same turn (#5012 / #5383): review prior agent transcripts for open Issue/PR context, then begin Session lifecycle phase 2 — the continuous assigned-queue pass. Do not wait for Product Authority to name an Issue in this chat. A new session that only finishes orientation and goes quiet is a failure.

Host bind is not startup and is not an assignment. Project and host hooks may inject the same reminder; they do not replace this contract.

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
