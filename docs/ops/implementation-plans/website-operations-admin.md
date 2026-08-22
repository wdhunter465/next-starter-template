---
Doc Type: Implementation Plan
Audience: ChatGPT, Bill, LGFC maintainers, implementation agents, and reviewers
Authority Level: Operational Plan
Owns: Completed build issue sequence and verification record for Website Operations Admin under #1258
Does Not Own: Runtime implementation, issue creation before approval, D1 migrations before child issues, or final operator policy decisions
Status: complete
Task 001 complete: docs/ops/reports/website-operations-admin-as-built-gap-analysis.md (PR `#1531`)
Task 002 complete: docs/reference/architecture/access-model.md (PR `#1533`)
Task 003 complete: Fan Club operational workflows verification (`#1118` / T40; PR `#1536`)
Task 004 complete: Admin shell and member operations delta (`#1119` / T41; PR `#1542`)
Task 005 complete: Moderation and review workflow delta (`#1120` / T42; PR `#1551` merged `3509bbb`)
Task 006 complete: CMS and page content admin delta (`#1121` / T43; PR `#1572`)
Task 007 complete: Media assets and B2 sync operations (`#1122` / T44; PR `#1571`)
Task 008 complete: Editorial archive admin operations alignment (`#1123` / T45; PR `#1582`)
Task 009 complete: Events calendar administration delta (`#1124` / T46; PR `#1596`)
Task 010 complete: Fundraiser and campaign admin delta (`#1125` / T47; PR `#1646`)
Task 011 complete: Matchup administration delta (`#1126` / T48; PR `#1648`)
Task 012 complete: Audit, reporting, and export delta (`#1127` / T49; PR `#1651`)
Task 013 complete: Operator runbooks and legacy disposition documentation (PR `#1652` merged `1aa9d3d`)
Next task: none — project closed complete; successor `#1259`
Project: website-operations-admin
Owner: ChatGPT
Execution Mode: orchestrated-after-approval
Source Issue: 1258
Related Program Issue: 1255
Canonical Reference: /docs/ops/implementation-plans/README.md
Related Issues: #1255, #1256, #1258, #1259, #1053, #1118, #1119, #1120, #1121, #1122, #1123, #1124, #1125, #1126, #1127, #1500
Last Reviewed: 2026-06-11
---

# Website Operations Admin Implementation Plan

## Purpose

Define the completed Phase 4 task sequence, verification evidence, and handoff
status for Program #1255 child project `#1258` (Website Operations Admin).

## Status

Phase 4 implementation for `#1258` is **complete** on `main`. Tasks 001–013 merged
(PRs `#1531` through `#1652`). Operator runbooks and legacy disposition package
published in Task 013. project status: **closed complete**. Successor:
`#1259` — Website QA / Production Validation (Phase 3 planning active).

## Source of truth

| Field | Value |
| --- | --- |
| Parent program | `#1255` — Website Implementation and Content Operations |
| Source issue | `#1258` — Website Operations Admin |
| Predecessor project | `#1256` — Content Strategy / Editorial Inventory (**closed complete**) |
| Follow-on project | `#1259` — Website QA / Production Validation (**Phase 3 planning active**) |
| Out of scope | `#1500` — CI Post-Merge Closeout Reliability (**queued**; not current execution) |
| Legacy coordination tree | `#1053` — subordinated; historical T-task map only |
| Phase 0 reconciliation | `docs/ops/reports/program-2-website-phase0-reconciliation.md` |
| Legacy issue table | `docs/ops/reports/website-operations-admin-legacy-issue-reconciliation.md` |
| Task 001 gap analysis | `docs/ops/reports/website-operations-admin-as-built-gap-analysis.md` |
| Task 002 access model | `docs/reference/architecture/access-model.md` |
| Task 003 Fan Club verification | PR `#1536` — `tests/fanclub-operations.test.tsx` + `/fanclub/**` hardening |
| Task 004 admin shell verification | PR `#1542` — `AdminStatusText`, D1 inspect token UX, `tests/admin-operations.test.tsx` |
| Task 005 moderation verification | PR `#1551` — merge `3509bbb`; `AdminStatusText` on moderation hub; FAQ `AdminTokenPanel` / `adminJson`; `tests/admin-moderation.test.tsx` |

## Scope

**Website Operations Admin** for this repository means the operator-facing
surfaces and APIs required to run LGFC after launch:

- **Admin operating shell** — dashboard, navigation, protected `/admin/**` routes
- **Member and join operations** — join requests, member operations, worklist
- **Moderation and review** — FAQ queue, Ask moderation, reports, review queues
- **Content operations** — CMS blocks, page content, editorial archive admin
  (aligned with `#1256` `content_inventory` authority)
- **Media operations** — media asset inventory, B2 sync, photo read contracts
- **Events and calendar administration** — event CRUD, seed, public read-path stability
- **Charity / fundraiser administration** — campaign preview and spotlight alignment
- **Matchup administration** — active matchup lifecycle controls
- **Audit and reporting** — admin export, stats, report list/close flows
- **Fan Club operational workflows** — member photo/submit/chat operational paths
- **D1/B2 operational surfaces** — D1 inspect, fail-closed admin API behavior
- **Static export / Pages Functions boundary** — admin UI in `src/app/admin/**`,
  privileged writes in `functions/api/admin/**`

This project does **not** own final production QA (`#1259`), CI reliability
(`#1500`), or net-new content strategy design (`#1256`).

## Current known truth

Assessment date: **2026-06-10** (`main` after `#1256` terminal closeout).

### Admin UI routes (`src/app/admin/**`)

| Route | File | Notes |
| --- | --- | --- |
| `/admin` | `src/app/admin/page.tsx` | Dashboard via `AdminDashboard` |
| `/admin/moderation` | `src/app/admin/moderation/page.tsx` | Moderation queue |
| `/admin/audit` | `src/app/admin/audit/page.tsx` | Audit & reporting |
| `/admin/faq` | `src/app/admin/faq/page.tsx` | FAQ moderation queue |
| `/admin/content` | `src/app/admin/content/page.tsx` | Page content editor |
| `/admin/cms` | `src/app/admin/cms/page.tsx` | CMS blocks |
| `/admin/editorial` | `src/app/admin/editorial/page.tsx` | Editorial archive (`content_inventory`) |
| `/admin/events` | `src/app/admin/events/page.tsx` | Event administration |
| `/admin/matchup` | `src/app/admin/matchup/page.tsx` | Matchup admin |
| `/admin/fundraiser-preview` | `src/app/admin/fundraiser-preview/page.tsx` | Fundraiser preview |
| `/admin/join-requests` | `src/app/admin/join-requests/page.tsx` | Join request queue |
| `/admin/worklist` | `src/app/admin/worklist/page.tsx` | Team worklist |
| `/admin/member-operations` | `src/app/admin/member-operations/page.tsx` | Member operations |
| `/admin/media-assets` | `src/app/admin/media-assets/page.tsx` | Media inventory + B2 sync |
| `/admin/d1-test` | `src/app/admin/d1-test/page.tsx` | D1 diagnostic |

Navigation source: `src/components/admin/AdminNav.tsx` (15 operational links).

### Admin protection model (as-built, updated `#3547`)

- **UI gate:** `src/app/admin/layout.tsx` uses `useMemberSession({ redirectTo: '/', requireAdmin: true })` — session cookie + `role === 'admin'` from `/api/session/me`.
- **API gate:** `functions/_lib/auth.ts` `requireAdmin()` delegates to `requireAdminMember()` (`functions/_lib/session.ts`) — requires a signed-in admin member session; no shared-secret fallback. Returns `401` unauthenticated, `403` non-admin, `503` if `DB` is unbound.
- **Client:** All admin pages call `/api/admin/**` via `src/lib/adminClient.ts`, which sends only the browser's `lgfc_session` cookie (`credentials: 'include'`). There is no admin-token UI anywhere under `src/app/admin/**` or `src/components/admin/**`.

**Access model documentation:** `docs/reference/architecture/access-model.md` was
reconciled in Task 002 (PR `#1533`) to dual gating (session UI + `ADMIN_TOKEN` API),
then updated again under `#3547` (2026-08-22) to remove `ADMIN_TOKEN` entirely and
describe session-only authorization. `footer-quotes` admin UI remains deferred.

### Admin API surface (`functions/api/admin/**`)

Representative endpoints present on `main`:

| Area | Paths |
| --- | --- |
| Stats / export / worklist | `stats.ts`, `export.ts`, `worklist.ts` |
| CMS / content | `cms/list.ts`, `cms/save.ts`, `cms/publish.ts`, `content/list.ts`, `content/save.ts`, `content/publish.ts` |
| Editorial (`#1256` overlap) | `editorial/list.ts`, `editorial/inventory.ts`, `editorial/review.ts`, `editorial/publish.ts`, `editorial/media-associations.ts` |
| FAQ / Ask moderation | `faq/*.ts`, `ask/*.ts` |
| Events | `events/list.ts`, `events/create.ts`, `events/update.ts`, `events/seed-next10.ts` |
| Matchup | `matchup/list.ts`, `matchup/create.ts`, `matchup/update.ts`, `matchup/close-active.ts` |
| Media assets | `media-assets/list.ts`, `media-assets/sync-from-b2.ts` |
| Reports | `reports/list.ts`, `reports/close.ts` |
| Join requests | `join-requests/list.ts` |
| D1 diagnostic | `d1-inspect.ts` |
| Config surfaces | `footer-quotes.ts`, `membership-card.ts`, `welcome-email.ts` |

Public/member APIs supporting Fan Club ops: `functions/api/fanclub/**`,
`functions/api/discussions/**`, `functions/api/library/**`, `functions/api/photos/**`,
`functions/api/reports/**`.

### Legacy T40–T49 merge evidence

Substantial implementation merged 2026-06-02 through 2026-06-03 per Phase 0
reconciliation. GitHub issue labels for `#1118`–`#1127` remain stale (`pr-draft`,
`post-merge-verify`, `status:failed` on several). **Remaining `#1258` work is
gap analysis, hardening, documentation alignment, and issue hygiene — not
greenfield rebuilds** unless Task 001 identifies a concrete delta.

| Legacy issue | Task | Merge evidence (documented) |
| --- | --- | --- |
| `#1118` | T40 Fan Club ops | PR `#1171` |
| `#1119` | T41 Admin shell | PR `#1174` |
| `#1120` | T42 Moderation | PR `#1176` |
| `#1121` | T43 CMS/content | PR `#1186` |
| `#1122` | T44 Media admin | PR `#1188` |
| `#1123` | T45 Editorial/archive | PR `#1192` |
| `#1124` | T46 Events admin | PR `#1205` |
| `#1125` | T47 Fundraiser admin | PR `#1211` |
| `#1126` | T48 Matchup admin | PR `#1212` |
| `#1127` | T49 Audit/reporting | PR `#1216` |

### `#1256` predecessor completion

Child project `#1256` (Tasks 001–009) is **closed complete**. Editorial archive
admin (`/admin/editorial`, `functions/api/admin/editorial/**`) and
`content_inventory` authority are owned by `#1256` deliverables. `#1258` must
**verify alignment** and harden operator workflows without reopening content
strategy design.

## Intended final state

Before `#1259` final QA may start:

1. Every legacy ops/admin issue (`#1053`, `#1118`–`1127`) has a documented
   disposition under `#1258` (see reconciliation report).
2. As-built admin/ops behavior is documented against design authority with a
   classified gap table (satisfied / needs delta / needs docs / ChatGPT decision).
3. Admin access model documentation matches runtime (session UI + token API).
4. Operator runbooks exist for each admin surface in approved how-to/reference paths.
5. Serial child implementation issues are approved but **not yet created** until
   ChatGPT/Bill authorize Phase 4.
6. No stale `status:failed` or conflicting lifecycle labels block operator trust
   in queue state (disposition batch may be separate authorized pass).

## Non-goals

Explicitly excluded from this plan and from the planning PR:

- `#1500` CI post-merge reliability program
- `#1259` final production validation and scheduled launch-readiness CI
- Fundraiser/product strategy changes beyond admin preview alignment
- Unrelated homepage redesign or public route expansion
- Broad auth redesign unless required to reconcile the access model doc
- Application code, D1 migrations, or workflow YAML in the planning PR
- Creating implementation child issues before Phase 3 exit criteria pass
- Closing or relabeling GitHub issues (unless a future task explicitly authorizes it)

## Legacy issue reconciliation

Summary disposition for `#1053` and `#1118`–`#1127`. Full evidence table:
`docs/ops/reports/website-operations-admin-legacy-issue-reconciliation.md`.

| issue | Disposition |
| --- | --- |
| `#1053` | **Subordinated** — retain as historical T-task index; planning authority is `#1255` / `#1258`. ChatGPT/Bill decision: body update vs later closeout. |
| `#1118` T40 | **Satisfied on main** — verification/hardening under Task 003; issue label cleanup deferred. |
| `#1119` T41 | **Satisfied on main** — verification/hardening under Task 004. |
| `#1120` T42 | **Satisfied on main** — verification/hardening under Task 005. |
| `#1121` T43 | **Satisfied on main** — CMS delta review under Task 006; content authority owned by `#1256`. |
| `#1122` T44 | **Satisfied on main** — media/B2 hardening under Task 007. |
| `#1123` T45 | **Satisfied on main** — editorial ops alignment under Task 008; scope boundary with `#1256` requires ChatGPT confirmation. |
| `#1124` T46 | **Satisfied on main** — events admin hardening under Task 009; erroneous `status:failed` label stale. |
| `#1125` T47 | **Satisfied on main** — fundraiser admin under Task 010; closed with stale `status:failed`. |
| `#1126` T48 | **Satisfied on main** — matchup admin under Task 011. |
| `#1127` T49 | **Satisfied on main** — audit/reporting under Task 012; erroneous `status:failed` label stale. |

## Proposed child task sequence

**issue titles only.** Phase 4 tasks execute as scoped PRs under `#1258`; child
issues are not auto-created without explicit authorization.

Operating rule: **inventory before delta.** Task 001 must complete before area
tasks claim gaps. Area tasks may close as gap-only (docs/verification only) if
Task 001 classifies the lane as already satisfied.

### Task 001 — Ops/Admin As-Built Inventory and Gap Analysis

| Field | Value |
| --- | --- |
| **Title** | Task 001 — Ops/Admin as-built inventory and gap analysis |
| **Objective** | Document current admin routes, APIs, components, and data dependencies against design authority; classify gaps. |
| **Allowed files/areas** | `docs/reference/website/**`, `docs/ops/reports/**`, `docs/reference/architecture/access-model.md`; read-only inspection of `src/app/admin/**`, `src/components/admin/**`, `functions/api/admin/**`, `functions/api/fanclub/**` |
| **Non-goals** | Runtime changes; issue closure; D1 migrations |
| **Acceptance criteria** | Gap table published; every `#1118`–`#1127` lane mapped to file evidence; access-model drift recorded |
| **Verification** | `./scripts/ci/docs_check_headers.sh` on changed docs; `npm run typecheck` optional read-only |
| **Dependencies** | `#1256` closed complete; this planning plan approved |

### Task 002 — Admin Access Model Documentation Reconciliation

| Field | Value |
| --- | --- |
| **Title** | Task 002 — Admin access model documentation reconciliation |
| **Objective** | Align `access-model.md` with session UI gate + `ADMIN_TOKEN` API gate; document operator login flow. |
| **Allowed files/areas** | `docs/reference/architecture/access-model.md`, `docs/ops/implementation-plans/website-operations-admin.md`, `active_tasklist.md` |
| **Non-goals** | Broad auth redesign; OAuth/provider changes; code or workflow YAML changes |
| **Acceptance criteria** | Access doc matches as-built; operator steps documented; security boundary explicit; follow-up gaps listed |
| **Verification** | Manual: unauthenticated `/admin` redirect; API 401 without token; docs header check |
| **Dependencies** | Task 001 (PR `#1531` merged) |
| **Status** | Complete (PR `#1533` merged) |

### Task 003 — Fan Club Operational Workflows Verification Pack

| Field | Value |
| --- | --- |
| **Title** | Task 003 — Fan Club operational workflows verification (`#1118` / T40) |
| **Objective** | Verify `/fanclub` operational paths (photo, submit, chat/discussions) for empty/error/auth states. |
| **Allowed files/areas** | `src/app/fanclub/**`, `functions/api/fanclub/**`, `functions/api/discussions/**`, `functions/api/library/**`, `functions/api/photos/**`, `tests/**` (scoped to touched surfaces only) |
| **Non-goals** | Public homepage changes; new Fan Club features |
| **Acceptance criteria** | Scoped routes pass manual verification; gaps fixed or documented as `#1259` deferrals |
| **Verification** | `npm run typecheck`; targeted tests if present; manual route checklist |
| **Dependencies** | Tasks 001–002 complete (PRs `#1531`, `#1533`, `#1534`) |
| **Status** | Complete (PR `#1536` merged) |
| **Task 003 verification notes** | Session `credentials: 'include'` on Fan Club operational fetches; chat post errors surfaced; expanded `tests/fanclub-operations.test.tsx`; PDF upload pipeline deferred to `#1259` |

### Task 004 — Admin Shell and Member Operations Delta

| Field | Value |
| --- | --- |
| **Title** | Task 004 — Admin shell and member operations delta (`#1119` / T41) |
| **Objective** | Harden dashboard, join-requests, member-operations, worklist, stats surfaces. |
| **Allowed files/areas** | `src/app/admin/page.tsx`, `src/app/admin/join-requests/**`, `src/app/admin/member-operations/**`, `src/app/admin/worklist/**`, `src/components/admin/**`, `functions/api/admin/stats.ts`, `functions/api/admin/worklist.ts`, `functions/api/admin/join-requests/**`, `functions/api/admin/welcome-email.ts`, `functions/api/admin/membership-card.ts` |
| **Non-goals** | New admin modules; public route changes |
| **Acceptance criteria** | Admin nav complete; empty/error states safe; join/member ops actionable |
| **Verification** | `npm run typecheck`; manual admin smoke |
| **Dependencies** | Tasks 002–003 complete |
| **Status** | Complete (PR `#1542` merged) |
| **Task 004 verification notes** | Accessible error alerts on shell pages via `AdminStatusText`; D1 test unified with `AdminTokenPanel` / `localStorage`; expanded `tests/admin-operations.test.tsx`; `footer-quotes` UI still deferred |

### Task 005 — Moderation and Review Workflow Delta

| Field | Value |
| --- | --- |
| **Title** | Task 005 — Moderation and review workflow delta (`#1120` / T42) |
| **Objective** | Verify moderation, FAQ, Ask, and reports approve/reject/archive/close paths. |
| **Allowed files/areas** | `src/app/admin/moderation/**`, `src/app/admin/faq/**`, `functions/api/admin/faq/**`, `functions/api/admin/ask/**`, `functions/api/admin/reports/**`, `functions/api/reports/**` |
| **Non-goals** | Public FAQ/Ask behavior changes |
| **Acceptance criteria** | Queues render; transitions auditable; admin-only enforced |
| **Verification** | `npm run typecheck`; manual moderation checklist |
| **Dependencies** | Task 004 complete (PR `#1542`) |
| **Status** | Complete (PR `#1551` merged; closeout 2026-06-11) |
| **Task 005 verification notes** | Accessible error alerts via `AdminStatusText` on moderation hub; FAQ page unified with `AdminTokenPanel` / `adminJson`; expanded `tests/admin-moderation.test.tsx` for queue failure and FAQ token gating; reviewer lifecycle and design allowlist gates passed on PR `#1551` |

### Task 006 — CMS and Page Content Admin Delta

| Field | Value |
| --- | --- |
| **Title** | Task 006 — CMS and page content admin delta (`#1121` / T43) |
| **Objective** | Verify CMS/content list/save/publish; gap-only if already satisfied. |
| **Allowed files/areas** | `src/app/admin/cms/**`, `src/app/admin/content/**`, `functions/api/admin/cms/**`, `functions/api/admin/content/**` |
| **Non-goals** | Duplicating `#1256` editorial inventory design |
| **Acceptance criteria** | CMS/content workflows match design authority or gaps assigned |
| **Verification** | `npm run typecheck`; manual CMS smoke |
| **Dependencies** | Task 001 |

### Task 007 — Media Assets and B2 Sync Operations

| Field | Value |
| --- | --- |
| **Title** | Task 007 — Media assets and B2 sync operations (`#1122` / T44) |
| **Objective** | Harden media inventory UI and `sync-from-b2` fail-closed feedback. |
| **Allowed files/areas** | `src/app/admin/media-assets/**`, `functions/api/admin/media-assets/**`, `functions/api/photos/**` |
| **Non-goals** | New media schema without Task 001 gap |
| **Acceptance criteria** | B2 sync visible; missing assets fail closed; public read contract preserved |
| **Verification** | `npm run typecheck`; manual media admin smoke |
| **Dependencies** | Task 001 |

### Task 008 — Editorial Archive Admin Operations Alignment

| Field | Value |
| --- | --- |
| **Title** | Task 008 — Editorial archive admin operations alignment (`#1123` / T45) |
| **Objective** | Align `/admin/editorial` ops with approved `content_inventory` model from `#1256`. |
| **Allowed files/areas** | `src/app/admin/editorial/**`, `functions/api/admin/editorial/**`, `docs/reference/website/content-inventory-model.md` (docs-only if needed) |
| **Non-goals** | Reopening `#1256` content strategy scope |
| **Acceptance criteria** | Editorial admin supports approved inventory fields; no parallel content store |
| **Verification** | Content-inventory tests if touched; manual editorial smoke |
| **Dependencies** | Task 001; `#1256` complete |

### Task 009 — Events Calendar Administration Delta

| Field | Value |
| --- | --- |
| **Title** | Task 009 — Events calendar administration delta (`#1124` / T46) |
| **Objective** | Verify event create/update/seed and public read-path stability. |
| **Allowed files/areas** | `src/app/admin/events/**`, `functions/api/admin/events/**`, `functions/api/events/**` |
| **Non-goals** | Homepage section-order changes |
| **Acceptance criteria** | Admin event CRUD safe; public calendar stable |
| **Verification** | `npm run typecheck`; manual events admin smoke |
| **Dependencies** | Task 001 |

### Task 010 — Fundraiser and Campaign Admin Delta

| Field | Value |
| --- | --- |
| **Title** | Task 010 — Fundraiser and campaign admin delta (`#1125` / T47) |
| **Objective** | Verify fundraiser preview and campaign spotlight alignment. |
| **Allowed files/areas** | `src/app/admin/fundraiser-preview/**`, `src/components/home/CampaignSpotlightSlot.tsx`, `src/components/home/CampaignSpotlightCard.tsx`, `src/lib/campaignSpotlight.ts` |
| **Non-goals** | Payment/donation system |
| **Acceptance criteria** | Preview fails closed; campaign data validated before public exposure |
| **Verification** | `npm run typecheck`; manual preview smoke |
| **Dependencies** | Task 001 |

### Task 011 — Matchup Administration Delta

| Field | Value |
| --- | --- |
| **Title** | Task 011 — Matchup administration delta (`#1126` / T48) |
| **Objective** | Verify matchup create/update/close-active and public vote/results stability. |
| **Allowed files/areas** | `src/app/admin/matchup/**`, `functions/api/admin/matchup/**`, `functions/api/matchup/**` |
| **Non-goals** | Voting model redesign |
| **Acceptance criteria** | Admin matchup controls safe; public read paths unchanged |
| **Verification** | `npm run typecheck`; manual matchup smoke |
| **Dependencies** | Task 001 |

### Task 012 — Audit, Reporting, and Export Delta

| Field | Value |
| --- | --- |
| **Title** | Task 012 — Audit, reporting, and export delta (`#1127` / T49) |
| **Objective** | Verify audit page, report list/close, export, and stats under empty/error conditions. |
| **Allowed files/areas** | `src/app/admin/audit/**`, `functions/api/admin/export.ts`, `functions/api/admin/stats.ts`, `functions/api/admin/reports/**`, `functions/api/reports/**` |
| **Non-goals** | CI/orchestration changes |
| **Acceptance criteria** | Reports listable/closable; export/stats fail closed safely |
| **Verification** | `npm run typecheck`; manual audit smoke |
| **Dependencies** | Task 005 |

### Task 013 — Operator Runbooks and Legacy Disposition Documentation

| Field | Value |
| --- | --- |
| **Title** | Task 013 — Operator runbooks and legacy disposition documentation |
| **Objective** | Publish operator how-tos; document recommended disposition comments for `#1053` and `#1118`–`#1127` (no bulk close in task unless authorized). |
| **Allowed files/areas** | `docs/how-to/website/**`, `docs/ops/reports/**` |
| **Non-goals** | Unauthorized GitHub issue mutation |
| **Acceptance criteria** | Runbooks per major admin surface; disposition package ready for ChatGPT batch |
| **Verification** | `./scripts/ci/docs_check_headers.sh` on new docs |
| **Dependencies** | Tasks 002–012 complete or gap-only accepted |

## Phase 3 exit criteria

Phase 3 planning exit is **met** for bounded Phase 4 execution. The plan remains
`phase-4-active` until ChatGPT/Bill promote it to `production-ready` (full PMO
dependency-map fields still required for that promotion).

| Criterion | State |
| --- | --- |
| Implementation plan approved for Phase 4 task execution | Met — `phase-4-active`; not `production-ready` |
| Proposed child task sequence (Tasks 001–013) | Met — executing per-task under `#1258` |
| Per-task file allowlists | Met — defined in this plan |
| Access/security model (session UI + `ADMIN_TOKEN` API) | Met — Task 002 (`#1533`) |
| D1/B2/admin surface risks reviewed | Met — risk register + Task 001 gap analysis |
| `#1123` / `#1256` editorial boundary | Met — ops alignment only (ChatGPT decision) |
| `#1053` umbrella disposition | Met — historical closeout preferred |
| `#1259` queued | Met — not started |
| `#1500` queued / out of scope | Met — not started |
| Explicit Task 001 authorization | Met — PR `#1531` |

**Authorization model:** Each Phase 4 task runs under explicit scope until Task
005+ authorization is issued. Do not infer open-ended implementation from
`phase-4-active` alone.

## Risk register

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Dual admin gate confusion (session vs token) | Operators blocked or false sense of security | Task 002; update access-model.md |
| `access-model.md` stale vs as-built | Wrong implementation assumptions | Treat repo files as truth; fix docs first |
| D1 write paths without rollback plan | Data corruption on admin error | Forward-only migrations; child-task rollback sections |
| B2 sync partial failure | Silent media drift | Task 007 fail-closed UI; operator runbook |
| Static export vs Pages Functions boundary | Admin API breaks in preview/prod mismatch | Verify `functions/api/admin/**` on deployed target |
| Accidental public route regression | Auth/content leak | Scoped allowlists; no public file touches without explicit scope |
| `#1256` / `#1258` editorial overlap | Duplicate or conflicting content ops | Task 008 boundary; ChatGPT decision on `#1123` |
| Legacy issue label drift | Wrong queue inference | Disposition batch; do not infer from labels alone |
| Workflow drift (`#1500` deferred) | Post-merge closeout failures on ops PRs | Compliant PR bodies; defer CI program to `#1500` |
| Gap-only tasks skipped without verification | False “complete” state | Task 001 required; verification evidence in each task |

## Verification plan

### This planning PR (docs only)

```bash
git status --short
git diff --check
./scripts/ci/docs_check_headers.sh \
  docs/ops/implementation-plans/website-operations-admin.md \
  docs/ops/reports/website-operations-admin-legacy-issue-reconciliation.md
```

### Future implementation PRs (representative)

```bash
npm run typecheck
npx vitest run --config tests/vitest.node.config.ts   # when tests touched
./scripts/ci/docs_check_headers.sh <changed-docs>
```

Manual admin smoke checklist per task (documented in child issue bodies).

## Approval and issue creation hold

Plan status is `phase-4-active` (not `production-ready`).

Phase 3 planning exit is **met** (see table above). Tasks 001–004 are **complete**.
**Task 005+** require explicit per-task authorization before implementation PRs
begin. Child GitHub issues remain held unless ChatGPT/Bill or existing automation
explicitly authorizes creation.
