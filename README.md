---
Doc Type: Entry / Orientation
Audience: Human + AI contributors
Authority Level: Navigation
Owns: Repository overview, contributor entrypoints, local orientation
Does Not Own: Product design, route authority, auth model, implementation scope, PR governance, deployment secrets
Canonical Reference: /AGENTS.md
Last Reviewed: 2026-11-26
---

# Lou Gehrig Fan Club — Website Repository

This repository holds the source for the fan club's public website, its member area, and the admin tools used to run them.

It is a Next.js App Router application built as a static export for Cloudflare Pages. Runtime behavior (sign-in, membership, member actions, data reads and writes) is handled by Cloudflare Pages Functions under `functions/api/**`.

## Platform

| Area | Implementation |
| --- | --- |
| Framework | Next.js App Router, TypeScript, React |
| Hosting | Cloudflare Pages |
| Runtime APIs | Cloudflare Pages Functions (`functions/api/**`) |
| Build output | Static export to `out/` |
| Database | Cloudflare D1 (schema in `migrations/`) |
| Media storage | S3-compatible object storage for images and other media |
| Automation | GitHub Actions for checks, scheduled jobs and deployment support |

This is not a static-only site. Pages are exported by Next.js, but sign-in, membership, content reads and member actions depend on Pages Functions and the database.

## Start Here

Read these in order:

1. `AGENTS.md` is the mandatory entrypoint and authority-routing file for all AI and agent work.
2. `context.md` gives the repository purpose, stack, route summary and design-source links.
3. `docs/reference/design/LGFC-Production-Design-and-Standards.md` is the canonical source for production behavior, routes, navigation and data-model references.
4. `docs/reference/design/auth-model.md` is the canonical authentication, session and redirect model.

For any repository work, do not stop at this README. Follow the full chain in `AGENTS.md`, which includes:

- `docs/governance/REPOSITORY-AUTHORITY.md` (who decides what).
- `docs/governance/AGENT-TEAM.md` (current role holders).
- `docs/ops/ai/CORE-RULES.md` and the rule file for your role under `docs/ops/ai/`.
- The source GitHub issue and any design, architecture or implementation-plan files it links.
- `.agents/skills/lgfc-pr-governance/SKILL.md` for pull request, issue, label, review and merge work, and the other `.agents/skills/*/SKILL.md` files that apply.
- `.github/pull_request_template.md` and the governance documents under `docs/governance/`.

## Roles

This repository is run by roles, not by named individuals. The roles and what each may decide are defined in `docs/governance/REPOSITORY-AUTHORITY.md`; who currently holds each role is in `docs/governance/AGENT-TEAM.md`.

- **Product Authority** decides product behavior, dates, rights and privacy questions, public announcements, and approves protected changes.
- **Engineering** builds and tests changes.
- **Operations** runs scheduled jobs, monitoring and deployment support.
- **AI agents** work inside the role they are assigned and follow the same rules as everyone else.

Merge authority is tiered. The rules for which pull requests need Product Authority approval are in `docs/governance/REPOSITORY-AUTHORITY.md`.

## Authority Model

This README is an orientation document only. It does not define product behavior, routes, navigation, authentication, implementation scope, pull request acceptance or deployment policy.

Document precedence is set by `docs/governance/standards/document-authority-hierarchy_MASTER.md`:

1. Governance.
2. Standards.
3. Operations as-built (`_MASTER`).
4. Project reference (`_INCOMPLETE`).
5. Project intent (`_DRAFT`).

If documents disagree, governance and `_MASTER` documents override lower-authority material. Use `AGENTS.md` as the active routing entrypoint and follow the full task-specific chain it defines.

For active work, GitHub issues and pull requests are the operational source of truth. Historical tracker and status files may exist, but they are not the normal source of truth unless an issue explicitly scopes tracker maintenance.

## Product Scope

The repository supports four logical areas:

- The public site.
- The member area.
- Admin surfaces.
- Links to an external store.

Routes, navigation, redirects, header and footer rules, homepage section order, member-area behavior and store handling are defined in `docs/reference/design/LGFC-Production-Design-and-Standards.md`. Do not use this README as a route source of truth.

## Authentication

The canonical reference is `docs/reference/design/auth-model.md`. In summary:

- Members sign in with a server-side session held in a cookie and stored in the database.
- A new member verifies their email address through a single-use emailed link before first entering the member area.
- Member-area routes are protected by that session; admin tools additionally require an admin role.

The auth model lists approaches that are not allowed, such as browser storage as the source of truth for membership, external identity providers, and magic-link sign-in as a general method. Read it before changing anything related to sign-in.

## Repository Layout

| Path | Purpose |
| --- | --- |
| `src/app/` | App Router pages, layouts and route-level UI. |
| `src/components/` | Shared and feature components. |
| `src/hooks/` | Client hooks, including session helpers. |
| `src/lib/` | Client-side libraries and helpers. |
| `functions/api/` | Cloudflare Pages Functions API endpoints. |
| `functions/_lib/` | Shared helpers for the Functions. |
| `migrations/` | Database schema and data migrations. |
| `data/`, `seed/` | Seed and reference data used by tooling and tests. |
| `public/` | Static public assets. |
| `tests/` | Vitest and Playwright tests. |
| `scripts/` | CI, verification, migration, sync, reporting and operational scripts. |
| `config/` | Tool and workflow configuration. |
| `site/` | Generated and static support sites, such as the project dashboard. |
| `docs/` | Documentation: design authority, governance, reference, how-to, explanation and reports. |
| `.agents/` | Repository-scoped agent skills and checks. |
| `.github/` | Workflows, templates, governance maps and pull request automation. |

## Local Development

Use Node 22.

```bash
npm install
npm run dev
```

To preview with the Cloudflare Pages runtime after a build:

```bash
npm run build
npm run dev:cf
```

## Common Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Clean static build into `out/`, with the post-build steps. |
| `npm run build:cf` | Cloudflare Pages build alias. |
| `npm run dev:cf` | Run Cloudflare Pages locally against `out/`. |
| `npm run lint` | Lint `src/`. |
| `npm run typecheck` | TypeScript type checking. |
| `npm run test` | Vitest unit and component tests. |
| `npm run test:e2e` | Playwright end-to-end tests. |
| `npm run check:structure` | Check repository structure rules. |
| `npm run verify:invariants` | Verify the repository's locked invariants. |
| `npm run launch-readiness` | Run launch-readiness checks. |
| `npm run deploy:prod` | Build and deploy `out/` with Wrangler Pages (Operations, with approval). |

## Deployment

Cloudflare configuration lives in `wrangler.toml`. Key points:

- The Pages build output is `./out`.
- The database binding is named `DB`, with separate production and non-production databases.
- Node compatibility is enabled for the Functions runtime.
- Next.js image optimization is off, because Cloudflare Pages does not provide the Node.js optimizer for this export model.

Do not change deployment configuration casually. Changes to deployment, runtime, database, object storage or Cloudflare behavior need a source issue and validation against the governance documents. Production changes follow the approval rules in `docs/governance/REPOSITORY-AUTHORITY.md`.

## Data

The data model is described in `docs/reference/design/LGFC-Production-Design-and-Standards.md` and the related architecture and reference documents. In outline it covers members and sessions, join and verification records, photos and other media, library and content records, and submission queues. The exact schema is whatever the migrations in `migrations/` produce; use them and the reference documents for schema work, not this README.

## Governance and Pull Requests

Every change is accounted for by an issue and a pull request, unless Product Authority explicitly authorizes an exception.

- One task, one issue, one pull request.
- No mixed intent and no scope expansion.
- Changed files must match the pull request's allowed-paths list, and its description must match the final diff.
- Documentation-only changes stay documentation-only.
- Review comments, bot findings and review threads are accounted for before a pull request is called ready to merge.

For pull request work, read:

- `AGENTS.md`.
- `.agents/skills/lgfc-pr-governance/SKILL.md`.
- `.github/pull_request_template.md`.
- `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`.
- `docs/governance/PR_GOVERNANCE.md`.
- `docs/reference/governance/troubleshooting-data-surface-requirements.md`.

## Design and UX Invariants

`docs/reference/design/LGFC-Production-Design-and-Standards.md` is the locked authority for design and behavior. Keep these unless an issue explicitly scopes a change:

- The canonical public, member, admin and external-store route behavior.
- Join and login behavior, and member-area access control.
- Header, mobile menu and footer rules.
- Homepage section order and the floating logo.
- The store stays an external link; there is no in-site store route unless the design changes.

## Contributing, Security and Conduct

See `CONTRIBUTING.md`, `SECURITY.md` and `CODE_OF_CONDUCT.md`.

## License

This repository is source-available for transparency and reference. Reuse, redistribution or derivative works are not permitted without the club's written permission. See `LICENSE` for the full terms.
