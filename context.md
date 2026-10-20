---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: Short orientation digest read at startup: this repository's identity, the stack, the vendors and the design and platform authorities at a high level, authority routing, the startup stop boundary, and stable execution discipline
Does Not Own: Product design invariants, authentication rules, vendor status, agent role mapping, PMO priority, PR lifecycle, or any live Issue, PR, branch, or queue state
Canonical Reference: /Agent.md
Related Issues: #2466, #4717
Last Reviewed: 2026-10-20
---

# context.md — Repository orientation (LGFC)

This file orients contributors and agents. It does not define rules. When it disagrees with a canonical document, the canonical document wins. Start at `Agent.md` and follow that file's authority chain.

It is the orientation digest read at startup (`docs/governance/AGENT-EXECUTION.md`, PRODUCT STARTUP FRAMEWORK). It gives the picture at a high level and points to the owner of each detail. Read the owner when a task needs the detail; do not rely on this file for it.

Durable orientation belongs here. Current Issue, PR, branch, queue, watcher, program, implementation, role-holder, vendor-status, and tool-version state does not.

## Repository

This repository is the official Lou Gehrig Fan Club public website and authenticated FanClub member area.

The production objective recorded for this orientation is to complete and production-harden the website for the 2027 fundraiser. Product priority is not a single repository-wide rank. `docs/governance/PMO-PORTFOLIO.md` defines priority as the order among sibling work under the same parent. Bill, as Product Authority, makes the final priority decision.

Repository documents and GitHub Issues and pull requests outrank chat memory, Drive drafts, dashboard snapshots, application UI, and inferred context. Live GitHub and repository evidence controls operational and readiness claims. An assumption is not current state.

## Stack

- Next.js App Router and TypeScript
- Cloudflare Pages static export
- Cloudflare Pages Functions for runtime APIs
- Cloudflare D1
- Backblaze B2 for media

The site is not purely static. Authentication, membership, content, administration, and other data-backed behavior depend on Pages Functions and D1. Member authentication is a session cookie plus D1 session and member records; `localStorage` is not the source of truth.

## Design

The product and design decisions are owned by `docs/governance/PRODUCT-AND-DESIGN.md` (decision, freeze, adjustment and deviation rules). The controlled specifications are under `docs/reference/design/`:

| Need | Start here |
| --- | --- |
| Routes, navigation, footer, homepage order, floating logo, other product invariants | `docs/reference/design/LGFC-Production-Design-and-Standards.md` |
| Authentication, join and login, protected areas, redirects | `docs/reference/design/auth-model.md` |
| Colors | `docs/reference/design/color-standard.md` |
| Visual and writing style | `docs/reference/design/style-guide.md` |

Do not treat a route list or a design statement in this file as that authority. Store stays an external Bonfire destination; there is no `/store` route unless the design authority changes.

## Platform

Platform, environment, credential and deployment boundaries are owned by `docs/governance/PLATFORM-AND-ENVIRONMENT.md`. Delivery and release are owned by `docs/governance/DELIVERY-AND-RELEASE.md`, and Production health, incidents and recovery by `docs/governance/OPERATIONS-AND-RECOVERY.md`. The controlled specifications are under `docs/reference/platform/`:

| Need | Start here |
| --- | --- |
| Cloudflare (Pages, Functions, bindings) | `docs/reference/platform/CLOUDFLARE.md` |
| D1 database design and operations | `docs/reference/platform/LGFC-D1-DATABASE-DESIGN-and-OPERATIONS-GUIDE.md` |
| Backblaze B2 media storage | `docs/reference/platform/Backblaze_B2.md` |
| Environment isolation between component, preview and Production | `docs/reference/platform/component-environment-isolation.md` |
| Owners, environments, dependencies and monitors of each asset | `docs/reference/platform/lgfc-asset-register.md` |

## Vendors

LGFC relies on a small set of vendors: Cloudflare for hosting, Pages Functions and D1; Backblaze B2 for media; GitHub for the repository and its automation; Givebutter for fundraising; Bonfire for the store; MailChannels and Apple iCloud Mail for email; and social platforms for announcements. The coding agents and PR reviewers in use are listed in the same place.

The current list, which vendors are active, inactive or only available, and the notes on each are owned by `docs/reference/architecture/vendor-inventory.md`. Check it before assuming a vendor is in use. Who holds an agent role is owned by `docs/governance/AGENT-TEAM.md`, not by the vendor list.

## Authority and roles

All agent work routes through `Agent.md` and its mandatory documentation chain. `docs/governance/AGENT-TEAM.md` is the only record of role holders, role work order and the Team assignment; this file does not restate them. `docs/governance/REPOSITORY-AUTHORITY.md` is the constitution, including who may approve and merge.

PMO lifecycle terms and pull-request lifecycle states are different systems. PMO portfolio rules are in `docs/governance/PMO-PORTFOLIO.md`. Pull-request states are in `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`.

`READY FOR REVIEW` is not `READY FOR MERGE`. Merge authority is tiered: the implementing agent merges non-production Pull Requests, and only the human approver merges Production-tier ones (`docs/governance/REPOSITORY-AUTHORITY.md`, Merge authority).

## Run startup

`run startup` is an orientation command. Each recognized product identifies itself, reads its own startup contract, reports orientation, and stops. The shared steps and stop boundary are in `docs/governance/AGENT-EXECUTION.md` (PRODUCT STARTUP FRAMEWORK). After startup, task definition and the continuous run follow (`docs/governance/AGENT-EXECUTION.md`, Session lifecycle). The product list is in `Agent.md` and `docs/governance/AGENT-TEAM.md`.

Startup does not authorize a queue audit, inferred next work, GitHub mutation, PMO advance, work packaging, or implementation. Startup completion is not task authorization. A source Issue, its acceptance criteria, an exact file allowlist, and an explicit implementation Go are loaded separately, after startup.

## Execution discipline

- One task, one thread, one deliverable.
- One task, one open source Issue, one pull request.
- No mixed intent, scope expansion, opportunistic cleanup, or routine tracker edits.
- An exact file allowlist is required before implementation.
- Planning notes, merged preparation docs, watcher or poller awareness, and prior chat context do not authorize implementation.
