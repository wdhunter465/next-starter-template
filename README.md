---
Doc Type: Entry / Orientation
Audience: Human + AI contributors
Authority Level: Navigation
Owns: Repository overview, contributor entrypoints, local orientation
Does Not Own: Product design, route authority, auth model, implementation scope, PR governance, deployment secrets
Canonical Reference: /Agent.md
Last Reviewed: 2026-06-23
---

# Lou Gehrig Fan Club (LGFC) — Website Repository

This repository contains the official Lou Gehrig Fan Club website and FanClub member area for `www.lougehrigfanclub.com`.

The codebase is a Next.js App Router application built as a Cloudflare Pages static export, with runtime read/write behavior handled by Cloudflare Pages Functions under `functions/api/**`.

## Current Platform

| Area | Current implementation |
| --- | --- |
| Framework | Next.js App Router + TypeScript |
| UI runtime | React |
| Hosting | Cloudflare Pages |
| Runtime APIs | Cloudflare Pages Functions (`functions/api/**`) |
| Build output | Static export to `out/` |
| Database | Cloudflare D1 |
| Media storage | Backblaze B2 for image/media assets |
| Production domain | `www.lougehrigfanclub.com` |

This is not a pure static-only site. Static pages are exported by Next.js, but authentication, membership flows, CMS/data reads, discussion/member actions, D1-backed content, and API behavior depend on Cloudflare Pages Functions.

## Start Here

For orientation, read:

1. `Agent.md` — mandatory entrypoint and authority-routing file for all AI and agent work.
2. `context.md` — high-level repository purpose, stack, route summary, and design-source links.
3. `docs/reference/design/LGFC-Production-Design-and-Standards.md` — canonical production behavior, route/navigation rules, data model references, and homepage order.
4. `docs/reference/design/auth-model.md` — canonical authentication/session/redirect model.

For any repository work, do not stop at this README. Follow the full mandatory chain in `Agent.md`, including:

- `docs/ops/ai/LGFC-AI-TEAM-OPERATING-MODEL.md`.
- `docs/ops/ai/SHARED-AGENT-RULES.md`.
- `docs/ops/ai/CORE-RULES.md`.
- The applicable agent-specific rule file under `docs/ops/ai/`.
- The source GitHub issue and task-linked design, architecture, governance, or implementation-plan files.
- `.agents/skills/lgfc-pr-governance/SKILL.md` when PR, issue, label, lifecycle, review, or merge-readiness work is involved.
- `.github/pull_request_template.md`.
- Applicable governance docs under `docs/governance/`.
- Applicable `.agents/skills/*/SKILL.md` files for the task.

## Authority Model

This README is an orientation document only. It does not define product behavior, routes, navigation, authentication, implementation scope, PR acceptance, or deployment policy.

Document precedence is defined by `docs/governance/standards/document-authority-hierarchy_MASTER.md`:

1. Governance.
2. Standards.
3. Operations As-Built (`_MASTER`).
4. Project Reference (`_INCOMPLETE`).
5. Project Intent (`_DRAFT`).

If documents disagree, governance and `_MASTER` documents override lower-authority materials. Within that framework, use `Agent.md` as the active routing entrypoint for repository work and follow the full task-specific authority chain it defines.

For active repository work, GitHub issues and PRs are the operational source of truth. Historical tracker/status files may exist, but they are not the normal source of truth unless a source issue explicitly scopes tracker governance, tracker reconciliation, or status-index maintenance.

## Product Scope

The repository supports four logical website areas:

- Public site.
- FanClub member area.
- Admin surfaces.
- External Store link behavior.

The canonical route list, navigation behavior, redirect behavior, header rules, mobile hamburger rules, footer rules, homepage section order, FanClub behavior, and Store handling are defined in `docs/reference/design/LGFC-Production-Design-and-Standards.md`.

Do not use this README as a route source of truth.

## Authentication Model

Canonical auth reference: `docs/reference/design/auth-model.md`.

Current Day 1 auth uses:

- Cookie-backed session: `lgfc_session`.
- D1 session table: `member_sessions`.
- D1 member table: `members`.
- Session lookup endpoint: `/api/session/me`.
- Join/Login canonical page: `/join`.
- Login tab entry point: `/join?mode=login`.
- FanClub route protection for `/fanclub` and `/fanclub/**`.

Do not reintroduce localStorage as the member auth source of truth, external auth providers, magic-link auth, `ADMIN_EMAILS` as the primary member auth gate, or hybrid cookie/localStorage member-auth narratives in active docs or implementation. This does not prohibit documented admin-token browser storage flows that are governed separately by the access-model documentation.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `src/app/` | Next.js App Router pages, layouts, and route-level UI. |
| `src/components/` | Shared UI components and feature components. |
| `src/hooks/` | Client hooks, including session/auth helpers. |
| `functions/api/` | Cloudflare Pages Functions API endpoints. |
| `functions/_lib/` | Shared Cloudflare Function helpers. |
| `migrations/` | Cloudflare D1 schema/data migrations. |
| `data/` | Seed/reference data and local content assets used by tooling or tests. |
| `public/` | Static public assets. |
| `tests/` | Vitest and Playwright tests. |
| `scripts/` | CI, verification, migration, sync, assessment, and operational scripts. |
| `docs/` | DIATAXIS documentation, design authority, governance, reports, and how-to material. |
| `.agents/` | Repository-scoped agent skills and checks. |
| `.github/` | GitHub Actions, templates, governance maps, and PR/issue automation. |

## Local Development

Use Node 22.x.

```bash
npm install
npm run dev
```

Cloudflare Pages local preview after build:

```bash
npm run build
npm run dev:cf
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run build` | Clean static build into `out/` and copy `_routes.json`. |
| `npm run build:cf` | Cloudflare Pages build alias. |
| `npm run dev` | Start Next.js local dev server. |
| `npm run dev:cf` | Run Cloudflare Pages local dev against `out/`. |
| `npm run typecheck` | Run TypeScript type checking. |
| `npm run test` | Run Vitest unit/component tests. |
| `npm run test:e2e` | Run Playwright tests. |
| `npm run verify:invariants` | Run LGFC invariant verification. |
| `npm run launch-readiness` | Run launch-readiness orchestration. |
| `npm run deploy:prod` | Build and deploy `out/` through Wrangler Pages. |

## Deployment Model

Cloudflare configuration is in `wrangler.toml`.

Key constraints:

- Pages build output is `./out`.
- D1 binding name is `DB`.
- Production D1 database name is `lgfc_lite`; Preview/Development D1 is `lgfc-litedev` (#3357).
- Node compatibility is enabled for the Cloudflare runtime.
- Next.js image optimization is disabled because Cloudflare Pages does not provide the Node.js image optimizer for this export model.

Do not change deployment configuration casually. Deployment, runtime, D1, B2, or Cloudflare behavior changes must be scoped through a source issue and validated against the Cloudflare/static-export skill and governance docs.

## Data Model References

The canonical Day 1 data references are defined in `docs/reference/design/LGFC-Production-Design-and-Standards.md` and related architecture/reference docs.

Important D1 concepts include:

- `members`.
- `member_sessions`.
- `join_requests`.
- `photos`.
- `library_entries`.
- `content_inventory`.
- `submission_queue`.
- `membership_card_content`.

Implementation-level schema definitions and migrations live outside this README. Use migrations, D1 docs, and canonical design/reference docs for schema work.

## Governance and PR Workflow

All repository changes require scoped issue and PR accounting unless Bill explicitly authorizes an exception.

Required discipline:

- One task → one issue → one PR.
- No mixed intent.
- No scope expansion.
- Changed files must match the PR allowlist.
- PR body must match the final diff.
- Documentation-only changes must remain documentation-only.
- Reviewer comments, bot comments, review threads, and post-merge closeout expectations must be accounted for before merge readiness is claimed.

For PR work, read and follow:

- `Agent.md`.
- `.agents/skills/lgfc-pr-governance/SKILL.md`.
- `.github/pull_request_template.md`.
- `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`.
- `docs/governance/PR_GOVERNANCE.md`.
- `docs/reference/governance/troubleshooting-data-surface-requirements.md`.

## Design and UX Invariants

The locked design and behavior authority is `docs/reference/design/LGFC-Production-Design-and-Standards.md`.

Preserve these invariants unless a source issue explicitly scopes a change:

- Canonical public, FanClub, Admin, and external Store route behavior.
- Join/Login behavior.
- FanClub auth gating.
- Header and mobile hamburger rules.
- Footer link set and behavior.
- Homepage section order.
- Floating logo scope and behavior.
- Store remains an external Bonfire link; no `/store` route exists unless the canonical design changes.

## License

This repository is source-available for transparency and reference. Reuse, redistribution, or creation of derivative works is prohibited without explicit written permission from the Lou Gehrig Fan Club.

See `LICENSE` for the full license terms.
