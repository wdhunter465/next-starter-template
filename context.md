---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: Short orientation to this repository's identity, platform, authority routing, startup stop boundary, and stable execution discipline
Does Not Own: Product design invariants, authentication rules, agent role mapping, PMO priority, PR lifecycle, or any live Issue, PR, branch, or queue state
Canonical Reference: /Agent.md
Related Issues: #2466
Last Reviewed: 2026-09-27
---

# context.md — Repository orientation (LGFC)

This file orients contributors and agents. It does not define rules. When it disagrees with a canonical document, the canonical document wins. Start at `Agent.md` and follow that file's authority chain.

Durable orientation belongs here. Current Issue, PR, branch, queue, watcher, program, implementation, and tool-version state does not.

## Repository

This repository is the official Lou Gehrig Fan Club public website and authenticated FanClub member area.

The production objective recorded for this orientation is to complete and production-harden the website for the 2027 fundraiser. Product priority is not a single repository-wide rank. `docs/governance/PMO-PORTFOLIO.md` defines priority as the order among sibling work under the same parent. Bill, as Product Authority, makes the final priority decision.

Repository documents and GitHub Issues and pull requests outrank chat memory, Drive drafts, dashboard snapshots, application UI, and inferred context. Live GitHub and repository evidence controls operational and readiness claims. An assumption is not current state.

## Platform

- Next.js App Router and TypeScript
- Cloudflare Pages static export
- Cloudflare Pages Functions for runtime APIs
- Cloudflare D1
- Backblaze B2 for media

The site is not purely static. Authentication, membership, content, administration, and other data-backed behavior depend on Pages Functions and D1.

Exact routes, navigation, footer, homepage order, floating logo, and other product invariants live in `docs/reference/design/LGFC-Production-Design-and-Standards.md`. Do not treat a route list in this file as that authority.

## Authentication

Member authentication is the cookie `lgfc_session` plus D1 `member_sessions`. Member identity and role come from D1 `members`. `localStorage` is not the member-auth source of truth.

- `/join` is the canonical join and login page.
- `/join?mode=login` opens the login tab.
- `/fanclub` and `/fanclub/**` are protected.
- `/auth` and `/login` are legacy compatibility routes that redirect to the canonical join flow.

The controlling description is `docs/reference/design/auth-model.md`.

Store stays an external Bonfire destination. There is no `/store` route unless that design authority changes.

## Authority and roles

All agent work routes through `Agent.md` and its mandatory documentation chain. Current role holders are recorded only in `docs/governance/AGENT-TEAM.md`.

Stable boundaries:

- Bill is Product Authority and the default merge approver when available. He decides requirements, priority, gates, and launch authorization.
- Claude Code is Engineering. It may independently review work it did not implement.
- Cursor is Operations during the recorded transition, interim PMO Admin, and an authorized implementer. That mapping is not a completed move into Engineering.
- ChatGPT and Codex are retired. They have no current team role.
- The Governance role has no active product holder until Product Authority records one.
- A builder does not approve its own work.

PMO lifecycle terms and pull-request lifecycle states are different systems. PMO portfolio rules are in `docs/governance/PMO-PORTFOLIO.md`. Pull-request states are in `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`.

`READY FOR REVIEW` is not `READY FOR MERGE`. Only the human operator may merge.

## Run startup

`run startup` is an orientation command. Each recognized product identifies itself, reads its own startup contract, reports orientation, and stops. The shared stop boundary is in `docs/ops/ai/CORE-RULES.md`. The product list is in `Agent.md` and `docs/governance/AGENT-TEAM.md`.

Startup does not authorize a queue audit, inferred next work, GitHub mutation, PMO advance, work packaging, or implementation. Startup completion is not task authorization. A source Issue, its acceptance criteria, an exact file allowlist, and an explicit implementation Go are loaded separately, after startup.

## Execution discipline

- One task, one thread, one deliverable.
- One task, one open source Issue, one pull request.
- No mixed intent, scope expansion, opportunistic cleanup, or routine tracker edits.
- An exact file allowlist is required before implementation.
- Planning notes, merged preparation docs, watcher or poller awareness, and prior chat context do not authorize implementation.
