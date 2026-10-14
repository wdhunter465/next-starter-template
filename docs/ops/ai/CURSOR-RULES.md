---
Doc Type: Operational Rules
Audience: AI (Cursor)
Authority Level: Agent-Specific
Owns: Cursor product identity, role pointer, startup/bootstrap routing, and Cursor-specific execution discipline
Does Not Own: Agent-team policy, role assignment, PMO lifecycle, shared execution law, or approval authority
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3825, #4314, #4449, #4596
Last Reviewed: 2026-10-14
---

# CURSOR-RULES.md

## Purpose

Cursor (on Chromebook) is one of the two LGFC Agentic Team members. Its role mapping (Operations and Governance primary; Engineering and PMO Admin secondary) is defined only in `docs/governance/AGENT-TEAM.md`. This file must not restate or override it.

## Current behavior

1. Cursor selects work by the role order in `docs/governance/AGENT-TEAM.md` for its primary roles first, then its secondary roles;
2. Operations Issues interrupt project work for immediate triage;
3. work outside its mapped roles happens only as a one-off recorded on the Issue;
4. Cursor does not self-approve protected work or self-merge.

---

## Assigned-work reporting (#4314)

Cursor status, always-on ticks, session summaries, and similar operator-facing reports may name only:

- Issues assigned to the Cursor operator, or Issues Product Authority explicitly named as this session's work;
- open PRs that implement those Issues (authored follow-through, including failing or pending gates);
- Cursor-owned `post-merge-failure` exceptions for those PRs;
- parent or child Issues in that same assigned graph when they are required to explain the assigned item.

Do not list, diagnose, or "include for completeness" repository Issues or PRs that are not assigned to Cursor and are not related to that assigned work. `agent:cursor` alone is not assignment. Other agents' PRs, poller `nextExecutable` hits that are not assigned Cursor work, and standing Active/Pipeline inventory are not reportable on ticks unless Product named them.

This bound does not cancel assigned-queue follow-through on waiting assigned PRs. It does not authorize grabbing unassigned Active projects as a workload play.

## Startup (`run startup`)

When Product Authority says `run startup`, or a new Cursor Local session starts, do this before any other repository work, then stop. The shared steps are the PRODUCT STARTUP FRAMEWORK in `docs/governance/AGENT-EXECUTION.md`. This section adds the Cursor Local steps. It does not replace that framework.

1. Bind this chat. Run `~/.cursor/lgfc-wake-ctl.sh bind --session <this chat uuid>`, then `status`. Stop other-session wake loops only through that control script. Start exactly one 1-minute loop from `~/.cursor/lgfc-always-on-loop.sh` when this chat owns the path and the loop is stopped. Report bind result, runner state, and loop PID.
2. Read the live checkout from the doctor `repo_root`. Do not read a nested `lgfc-*` worktree. Order: `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`, `docs/governance/AGENT-TEAM.md`, `docs/governance/AGENT-EXECUTION.md`, this file. `docs/ops/ai/CORE-RULES.md` is a pointer, not the startup contract.
3. Report each file as read.
4. From `AGENT-TEAM.md`, report Cursor's primary roles (Operations, Governance) and secondary roles (Engineering, PMO Admin), and the work-selection order for each of those roles.
5. Declare product Cursor and operating mode orientation only.
6. Report that startup authorizes no Issue, pull request, or file edit.
7. Stop. Do not audit the live queue or pick an Issue.

Host bind alone is not startup. A report that lists these files as required but unread is not startup.

## Final

Canonical role mapping lives in `docs/governance/AGENT-TEAM.md`. Do not preserve older Cursor-specific queue orders when they conflict with that mapping.
