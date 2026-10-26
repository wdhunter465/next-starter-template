---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, implementation agents, and reviewers
Authority Level: Controlled
Owns: Task 002 backend and data-surface reconciliation for Website Completion / Fan Club Product Buildout
Does Not Own: Application code changes, D1 migrations, B2 configuration, issue closure, labels, or merge approval
Canonical Reference: /docs/ops/implementation-plans/website-completion-fan-club-product-buildout.md
Related issues: #1687, #1685, #1686
Last Reviewed: 2026-06-23
---

# Website Completion / Fan Club Product Buildout — Backend and Data-Surface Reconciliation

## Purpose

This report is the Task 002 deliverable for source issue `#1687`.

It inventories current D1, B2, API, admin, and member read/write surfaces for the
Priority #1 Fan Club product buildout, classifies required backend/data deltas, and
hands evidence to Tasks 003–006 without inferring requirements from chat history.

## Scope

Writable scope for this task:

- `docs/ops/reports/**`
- `docs/reference/architecture/**`
- `docs/reference/website/**`

Read-only inspection scope used for this report:

- `functions/api/**`
- `src/lib/**`
- `migrations/**`
- `tests/**`

Out of scope:

- backend/API implementation changes;
- D1 migration changes;
- B2 or vendor configuration changes;
- application route/component changes;
- workflow YAML changes;
- issue closure, relabeling, merge, or approval actions.

## Source authority cross-check

| Source | Role in this report |
| --- | --- |
| `docs/ops/reports/website-completion-fan-club-product-gap-review.md` | Task 001 gap table and Task 002 evidence handoff list |
| `docs/ops/implementation-plans/website-completion-fan-club-product-buildout.md` | Task 002 acceptance criteria and successor expectations |
| `docs/reference/design/LGFC-Production-Design-and-Standards.md` | Data-model invariants for `members`, `photos`, `content_inventory`, and auth |
| `docs/reference/website/content-inventory-model.md` | Editorial inventory, submission queue, and media association requirements |
| `docs/ops/implementation-plans/website-operations-admin.md` | Existing admin/backend surface evidence |

## Classification key

| Classification | Meaning for Task 006 and later |
| --- | --- |
| `accepted` | A bounded backend/API/D1 delta is justified by design authority and Task 001/002 evidence; implement only when a later task issue scopes it. |
| `rejected` | The proposed delta conflicts with design authority or duplicates an existing satisfied surface; do not implement. |
| `deferred` | Document current behavior; defer schema or API work to a later program or explicit design decision. |
| `duplicate` | Existing implementation already satisfies the need; preserve and verify only. |
| `blocked` | Requires Task 004 content-workflow reconciliation or explicit design authority before implementation. |

## D1 table inventory (Fan Club–relevant)

| Table | Migration evidence | Primary role | Member read | Member write | Admin write |
| --- | --- | --- | --- | --- | --- |
| `members` | `0019_members.sql` | Auth role registry (`email`, `role`) | via session | no direct member API | `functions/api/admin/**` |
| `member_sessions` | `0029_member_sessions.sql` | Session persistence | via `session/me` | login/join flows | admin inspect |
| `join_requests` | `0001_join_requests.sql`, `0020_join_requests_profile_fields.sql` | Join intake + profile fields | via `fanclub/profile` | via `fanclub/profile` POST | `admin/join-requests/list` |
| `membership_card_content` | `0022_membership_card_content.sql` | Card instructions markdown | `content/membercard` | no | `admin/membership-card` |
| `photos` | `0003_photos.sql`, `0007_photos_metadata.sql` | Photo/memorabilia catalog | `fanclub/photos`, `fanclub/memorabilia` | no | admin media/editorial |
| `content_inventory` | `0035_editorial_archive.sql`, `0036_content_inventory_schema_delta.sql` | Published editorial stories | `fanclub/library`, search, related | no | `admin/editorial/**` |
| `content_inventory_media` | `0038_content_inventory_media_association.sql` | Story–photo links | indirect via inventory | no | `admin/editorial/media-associations` |
| `library_entries` | `0002_library_entries.sql` | Legacy library fallback | `fanclub/library` fallback | no | legacy/admin paths |
| `submission_queue` | `0035`, `0037_submission_queue_workflow_delta.sql` | Member submission intake | `library/submit` POST | yes (member) | `admin/editorial/review` |
| `page_content` | `0008_page_content.sql` | CMS copy blocks per slug/section | `content/get`, `cms/get` | no | `admin/content/**`, `admin/cms/**` |
| `discussions` | `0017_discussions.sql` | Member discussion posts | `discussions/**` | `discussions/create` | admin moderation |
| `events` | `0014_events.sql` | Event calendar data | `events/**` | no | `admin/events/**` |
| `milestones` | `0015_milestones.sql` | Timeline content | `milestones/list` | no | admin content |
| `friends` | `0016_friends.sql` | Partners/friends list | `friends/list` | no | admin |
| `media_assets` | `0010_media_assets.sql` | B2 asset registry | admin list/sync | no | `admin/media-assets/**` |

Detailed API-to-table mapping lives in
`docs/reference/architecture/fan-club-data-surface-inventory.md`.

## Member API inventory

| Route | Handler | Auth | Tables touched (read) | Tables touched (write) | Fail-closed behavior |
| --- | --- | --- | --- | --- | --- |
| `GET/POST /api/fanclub/profile` | `functions/api/fanclub/profile.ts` | member | `join_requests`, `members` | `join_requests`, `members` (ensure row) | 401 without session |
| `GET /api/content/membercard` | `functions/api/content/membercard.ts` | member | `membership_card_content` | none | returns `content: null` when empty |
| `GET /api/fanclub/photos` | `functions/api/fanclub/photos.ts` | member | `photos` | none | empty `items` when no rows |
| `GET /api/fanclub/memorabilia` | `functions/api/fanclub/memorabilia.ts` | member | `photos`, `content_inventory`/`library_entries` | none | empty items + related arrays |
| `GET /api/fanclub/library` | `functions/api/fanclub/library.ts` | member | `content_inventory`, `library_entries` | none | inventory preferred; legacy fallback |
| `POST /api/library/submit` | `functions/api/library/submit.ts` | member | `submission_queue` | `submission_queue` | 400 on missing fields |
| `GET/POST /api/discussions/*` | `functions/api/discussions/**` | member | `discussions` | `discussions` on create | member gate |
| `GET /api/session/me` | `functions/api/session/me.ts` | optional | `member_sessions`, `members` | none | unauth returns guest shape |
| `POST /api/join` | `functions/api/join.ts` | public | `join_requests` | `join_requests`, `members`, `join_email_log` | 409 duplicate email |

Public read paths used by Fan Club integration (`search`, `milestones/list`,
`events/**`, `footer-quote`) are inventoried in the architecture reference doc.

## B2 and media mapping

| Surface | Schema / lib evidence | Resolution path |
| --- | --- | --- |
| Photo thumbnails | `photos.url`, `photos.photo_id` | `functions/_lib/photo-url.ts` `normalizePhotoUrl` with `PUBLIC_B2_BASE_URL` |
| Media asset registry | `media_assets` table | `admin/media-assets/list`, `sync-from-b2` |
| Story media links | `content_inventory_media` | joins `content_inventory.id` to `photos.id` with role + attribution |
| Legacy inventory JSON media | `content_inventory.media` JSON column | backfill to `content_inventory_media` via `0038` migration |

No new B2 bucket or vendor configuration delta is accepted for Priority #1.

## Task 001 blocked-item reconciliation

### G-006 — Extra Fan Club routes (`/fanclub/membercard`, `/fanclub/submit`, `/fanclub/chat`)

| Field | Finding |
| --- | --- |
| Classification | `deferred` (route authority), `duplicate` (API/data paths exist) |
| API dependencies | `content/membercard`, `library/submit`, `discussions/**` |
| Disposition | Keep routes operational. Migration `0032` already corrects membership card copy to `/fanclub/myprofile`. Task 007 needs design authority before removing or promoting routes. No backend delta required in Task 006. |

### G-008 — My Profile data source (`members` vs `join_requests`)

| Field | Finding |
| --- | --- |
| Classification | `accepted` (profile field ownership reconciliation) |
| As-built | `members` stores `email` + `role` only. Editable profile fields live in `join_requests`. `join.ts` creates both on first join. `profile.ts` ensures `members` row but reads/writes `join_requests`. |
| Design authority | Production design data model expects member profile on `members` table per member. |
| Accepted delta for Task 006 | Add profile columns to `members` (or approved profile view), migrate reads/writes in `fanclub/profile.ts`, and preserve `join_requests` as join-audit intake only. Until migrated, Task 003 may consume current API shape with documented variance. |
| Rejected alternative | Rebuilding profile storage in a new table. |

### G-011 — Club Home dynamic content contract

| Field | Finding |
| --- | --- |
| Classification | `blocked` for full contract; `accepted` for composition inventory |
| Available sources | `content_inventory` (published, section-filtered), `photos` (featured/filtered), `page_content` (slug sections), `milestones/list`, `events/next`, `discussions/list`, `friends/list`, `campaignSpotlight` lib (passive) |
| Missing contract | No API aggregates lead story, secondary rail, photo feature, archive spotlight, event callout, recognition tile, or submission CTA for `/fanclub`. |
| Disposition | Task 004 must define editorial placement rules. Task 005 may compose existing read APIs client-side or via a thin read aggregator in Task 006 if explicitly scoped. No greenfield tables without Task 004 evidence. |

### G-014 — Photo approval/source state

| Field | Finding |
| --- | --- |
| Classification | `deferred` (schema), `duplicate` (editorial path for new content) |
| As-built | `photos` has no `status` or approval column. `fanclub/photos.ts` documents catalog-as-approved. New member content flows through `submission_queue` → editorial publish → potential inventory/photo promotion. |
| Disposition | Do not add `photos.status` in Task 006 unless Task 004 explicitly requires it. Document legacy catalog rows as operator-managed approved content. Photo upload binary intake remains deferred (text-only `library/submit` today). |

### G-019 — Member submissions path

| Field | Finding |
| --- | --- |
| Classification | `duplicate` (queue intake), `blocked` (photo/binary upload) |
| As-built | `POST /api/library/submit` accepts title, content, source_name, source_url, credit_line, media_reference with `pending` status. Aligns with `content-inventory-model.md` queue requirements after `0037` migration. |
| Disposition | Task 004 owns workflow documentation. Task 006 implements upload/B2 deltas only if Task 004 accepts binary intake scope. |

### G-022 — Events/recognition modules on Club Home

| Field | Finding |
| --- | --- |
| Classification | `deferred` (recognition automation), `accepted` (read-path inventory) |
| As-built | `events/next`, `events/month`, `friends/list` provide public/member-readable data. No Club Home consumer exists. |
| Disposition | Task 003 may add fail-closed UI slots. Task 005 wires reads. Recognition automation stays out of scope. |

## Backend delta register (Task 006 input)

| ID | Area | Classification | Evidence | Recommended action | Predecessor |
| --- | --- | --- | --- | --- | --- |
| B-001 | Profile field ownership | accepted | G-008; `profile.ts`, `join.ts`, `0019`, `0020` | Migrate editable profile fields to `members`; update `fanclub/profile.ts`; keep `join_requests` as join audit | Task 004 optional |
| B-002 | Club Home read aggregator | blocked | G-011 | Add read-only aggregator endpoint or documented client composition contract after Task 004 placement rules | Task 004 |
| B-003 | Photo tag enumeration API | accepted | G-013; `fanclub/photos.ts` supports `tags` query param | Optional `GET` facet for distinct tags from `photos.tags`; UI-only deferral acceptable for Task 003 | none |
| B-004 | Library server-side search | accepted | G-016; `fanclub/library.ts` already accepts `q` | UI should pass `q` to API; no schema change | none |
| B-005 | Memorabilia related-story render | duplicate | G-018; API returns `related_library_entries` | Task 005 UI renders existing API fields | none |
| B-006 | Photo approval column | deferred | G-014 | Document legacy catalog; use editorial queue for new content | Task 004 |
| B-007 | Binary photo upload pipeline | blocked | G-019 | Defer until Task 004 scopes media intake | Task 004 |
| B-008 | Membership card route fold | rejected (backend) | G-007; `membership_card_content` API sufficient | UI-only fold in Task 003; migration `0032` already updated copy links | none |
| B-009 | `content_inventory` attribution triggers | duplicate | `0036` publish triggers | Preserve; no delta | none |
| B-010 | `content_inventory_media` associations | duplicate | `0038` | Use for story–photo linkage in Task 005 | none |
| B-011 | Extra route removal | deferred | G-006 | No API removal until Task 007 design authority | Task 007 |
| B-012 | Campaign/fundraiser backend | rejected | G-021 | Out of Priority #1 scope | n/a |
| B-013 | B2/vendor configuration | rejected | readiness boundary | No production secret or bucket changes in this program | n/a |

## Admin and editorial surfaces (reconciliation summary)

Existing admin paths satisfy editorial review and publication for Priority #1
without greenfield rebuild:

- `functions/api/admin/editorial/list|review|publish|inventory|media-associations`
- `functions/api/admin/content/**` and `admin/cms/**` for page copy
- `functions/api/admin/membership-card.ts` for card instructions
- `functions/api/admin/media-assets/**` for B2 registry

Task 006 should extend these paths only when a delta row is `accepted` above.

## Handoff to successor tasks

| Task | Use this report |
| --- | --- |
| Task 003 — Fan Club home shell | B-002 blocked for dynamic wiring; use static fail-closed shell. B-008 UI-only for membership card. |
| Task 004 — Content workflow | G-014, G-019, B-006, B-007 need workflow decisions before schema/API expansion. |
| Task 005 — Dynamic content integration | B-005, B-010, B-004; compose `content_inventory`, `photos`, related-story APIs. |
| Task 006 — Backend/API deltas | Implement only B-001, B-003, and B-002 if unblocked by Task 004. |
| Task 007 — Navigation hardening | B-011 route authority for extra Fan Club routes. |
| Task 008 — Operator handoff | Convert accepted/deferred table into runbooks. |
| Task 009 — Program closeout | Reconcile delta register against merged PR evidence. |

## File inventory evidence

Read-only files inspected for this report include:

- `functions/api/fanclub/profile.ts`, `photos.ts`, `library.ts`, `memorabilia.ts`
- `functions/api/content/membercard.ts`, `functions/api/library/submit.ts`
- `functions/api/join.ts`, `functions/_lib/content-inventory-public.ts`, `functions/_lib/photo-url.ts`
- `migrations/0019_members.sql` through `0038_content_inventory_media_association.sql`
- `src/lib/fanclubApi.ts`, `src/lib/pageContent.ts`, `src/lib/campaignSpotlight.ts`
- `tests/fanclub-operations.test.tsx`, `tests/content-inventory-public.test.ts`

No application, Functions, migration, or test files were modified.

## Validation notes

Changed docs must pass the repository documentation header check. This report does
not change application code, Functions code, tests, workflows, migrations,
runtime configuration, or issue state.
