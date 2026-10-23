---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, role pointer, startup/bootstrap routing, and Cursor-specific execution discipline
Does Not Own: Agent-team policy, role assignment, PMO lifecycle, shared execution law, or approval authority
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3825, #4314, #4449, #4596, #4676, #4716, #4783
Last Reviewed: 2026-10-22
---

# CURSOR-RULES.md

## Purpose

Cursor (on Chromebook) is one of the two LGFC Agentic Team members. Its role mapping (Operations and Governance primary; Engineering and PMO Admin secondary) is defined only in `docs/governance/AGENT-TEAM.md`. This file must not restate or override it.

## Current behavior

1. Cursor selects work by the role order in `docs/governance/AGENT-TEAM.md` for its primary roles first, then its secondary roles;
2. Operations Issues interrupt project work for immediate triage;
3. work outside its mapped roles happens only as a one-off recorded on the Issue;
4. Cursor does not self-approve protected work and does not merge a Production-tier PR (`docs/governance/REPOSITORY-AUTHORITY.md`, Merge authority).

---

## Assigned-work reporting (#4314)

Cursor status, always-on ticks, session summaries, and similar operator-facing reports may name only:

- Issues assigned to the Cursor operator, or Issues Product Authority explicitly named as this session's work;
- open PRs that implement those Issues (authored follow-through, including failing or pending gates);
- Cursor-owned `post-merge-failure` exceptions for those PRs;
- parent or child Issues in that same assigned graph when they are required to explain the assigned item.

Do not list, diagnose, or "include for completeness" repository Issues or PRs that are not assigned to Cursor and are not related to that assigned work. `agent:cursor` alone is not assignment. Other agents' PRs, poller `nextExecutable` hits that are not assigned Cursor work, and standing Active/Pipeline inventory are not reportable on ticks unless Product named them.

This bound does not cancel assigned-queue follow-through on waiting assigned PRs. It does not authorize grabbing unassigned Active projects as a workload play.

## Resume queue (#3605 / #3611)

The shared rule is Assigned-queue continuation in `docs/governance/AGENT-EXECUTION.md`. For Cursor:

- the always-on poller persists the resume queue at `/tmp/lgfc-cursor-resume-queue.json`, with `waiting` and `nextExecutable` fields; `fresh=0` is not permission to stop while that queue is non-empty;
- Cursor's active claims are `agent:cursor` with `status:active`, assigned to Cursor or named by Product Authority as this session's work;
- Cursor-owned `post-merge-failure` exceptions belong to the resume queue;
- do not occupy the session with standing-queue status while other assigned or `agent:cursor` work remains, and keep to the reporting bound above (#4314).

## Startup (`run startup`)

When Product Authority says `run startup`, or a new Cursor Local session starts, do these steps before other repository work, then continue with Session open. The shared steps are the PRODUCT STARTUP FRAMEWORK in `docs/governance/AGENT-EXECUTION.md`. This section adds the Cursor Local steps. It does not replace that framework.

1. Report wake status. Run `~/.cursor/lgfc-wake-ctl.sh startup --session <this chat uuid>`, then `status`. Do not `rebind`. Do not stop another session's loop. Start one 1-minute loop from `~/.cursor/lgfc-always-on-loop.sh` only when `/tmp/lgfc-wake-live-session` is empty, `~/.cursor/lgfc-wake-halt` is absent, and Product Authority has asked for the poll to run. If a live session is recorded and the loop is stopped or stalled, report it and leave the loop stopped. Read the latest poll from `~/.cursor/lgfc-wake-poll-inbox.json`. Report owner, runner state, and loop PID.
2. Read the live checkout from the doctor `repo_root`. Do not read a nested `lgfc-*` worktree. Order: `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`, `docs/governance/AGENT-TEAM.md`, `docs/governance/AGENT-EXECUTION.md`, this file. `docs/ops/ai/CORE-RULES.md` is a pointer, not the startup contract.
3. Report each file as read.
4. From `AGENT-TEAM.md`, report Cursor's primary roles (Operations, Governance) and secondary roles (Engineering, PMO Admin), and the work-selection order for each of those roles.
5. Declare product Cursor and operating mode orientation only.
6. Report that startup authorizes no Issue, pull request, or file edit.
7. Continue with Session open below. Do not pick an Issue during startup.

Host bind alone is not startup. A report that lists these files as required but unread is not startup.

## Session open (#4676)

On every new Cursor Local session, before other repository work, perform this section. It is phase 2 preparation in the Session lifecycle (`docs/governance/AGENT-EXECUTION.md`): steps 4 to 6 are read-only summaries that inform the task list with Product Authority. They are not part of Startup and they claim, edit and start nothing. Product Authority set these tasks on 2026-10-18. `.cursor/rules/40-session-open.mdc` (`alwaysApply: true`) is what puts this section in front of the local agent when the session opens. The rule does not execute the shell itself. The local agent runs the script below.

1. Read `/tmp/lgfc-wake-live-session`. If it names another chat, that chat remains the owner. Do not overwrite it, stop its loop, or summarize that session.
2. Run `~/.cursor/lgfc-wake-ctl.sh startup --session <this chat uuid>`, then `status`. The session-start hook reports that status. It does not take ownership. Do not `rebind`. Do not start a loop unless the live-session file is empty, the halt file is absent, and Product Authority has asked for the poll to run. If the recorded owner's loop is stopped or stalled, report it and leave it stopped. Read `~/.cursor/lgfc-wake-poll-inbox.json` for the latest poll. Do not kill the GitHub Actions runner. Do not stop PipeWire, D-Bus, or sommelier. Stop a dev server left listening by the prior session.
3. Complete Startup steps 2 through 6 above.
4. Summarize a session only when this chat is the recorded owner and that session was closed. Use that session's transcript and `/tmp/lgfc-wake-ctl.log`. Do not summarize a chat that still owns the wake path.
5. Review the Operations queue and summarize its current state. Include open Issues labeled `team:operations`, and open Issues labeled `ops:priority:1` through `ops:priority:4`, `ops:monitoring`, or `ops:hold`. A qualifying interrupt has `team:operations` plus exactly one of those states. Say which Issues are actionable, which are waiting, and which are mislabeled.
6. Suggest how to prioritize in-progress work and the next step, using `docs/governance/AGENT-TEAM.md` and `docs/governance/OPERATIONS-AND-RECOVERY.md`. One Issue, one pull request. Do not merge a Production-tier PR. `handoff:ready` is not website Go.
7. Use the repository agentic documents, the constitution, and the governance procedures. After an assignment is accepted, follow the continuous workflow in `docs/governance/AGENT-EXECUTION.md`.
8. If the next step is ambiguous, or there is no clear next work item, stop and report that to Product Authority in the session prompt. Do not guess a task.

This report is not a queue audit and it does not authorize an Issue, a pull request, or a file edit. `docs/governance/AGENT-EXECUTION.md` remains the shared execution law.

## Final

Canonical role mapping lives in `docs/governance/AGENT-TEAM.md`. Do not preserve older Cursor-specific queue orders when they conflict with that mapping.
