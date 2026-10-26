---
Doc Type: Reference
Audience: Bill, Governance, Cursor, LGFC maintainers, database implementers, and AI agents
Authority Level: Controlled
Owns: Fan Club program API-to-data-surface inventory and read/write boundary map for Program #1685
Does Not Own: Runtime implementation, D1 migrations, B2 configuration, or merge approval
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #1687, #1685, #1686
Last Reviewed: 2026-10-26
---

# Fan Club Data-Surface Inventory

## Purpose

Provide a durable reference map of Fan Club–relevant API handlers, D1 tables, and
read/write boundaries reconciled during Program #1685 Task 002.

This document supports Tasks 003–006 without requiring agents to re-walk the full
`functions/api/**` tree.

## Scope

This reference inventories:

- member-gated Fan Club APIs;
- supporting public read APIs consumed by Fan Club surfaces;
- primary D1 tables and migration files;
- B2/media resolution helpers;
- `src/lib/**` client adapters.

This reference does not authorize schema changes or production configuration edits.

## Member-gated Fan Club APIs

| HTTP route | File | D1 tables (read) | D1 tables (write) | Notes |
| --- | --- | --- | --- | --- |
| `GET /api/fanclub/profile` | `functions/api/fanclub/profile.ts` | `join_requests`, `members` | `members` (ensure) | Profile fields sourced from `join_requests` |
| `POST /api/fanclub/profile` | same | `join_requests` | `join_requests`, `members` | Upsert profile fields |
| `GET /api/content/membercard` | `functions/api/content/membercard.ts` | `membership_card_content` | none | Latest `posted` row |
| `GET /api/fanclub/photos` | `functions/api/fanclub/photos.ts` | `photos` | none | Excludes `is_memorabilia = 1` |
| `GET /api/fanclub/memorabilia` | `functions/api/fanclub/memorabilia.ts` | `photos`, `content_inventory`, `library_entries` | none | Memorabilia = tagged photos view |
| `GET /api/fanclub/library` | `functions/api/fanclub/library.ts` | `content_inventory`, `library_entries` | none | Inventory preferred |
| `POST /api/library/submit` | `functions/api/library/submit.ts` | `submission_queue` | `submission_queue` | Member submission intake |
| `GET /api/discussions/list` | `functions/api/discussions/list.ts` | `discussions` | none | Club Home feed source |
| `POST /api/discussions/create` | `functions/api/discussions/create.ts` | `discussions` | `discussions` | Member post creation |

## Supporting public and session APIs

| HTTP route | File | Fan Club use |
| --- | --- | --- |
| `GET /api/session/me` | `functions/api/session/me.ts` | Auth state for layout gates |
| `POST /api/join` | `functions/api/join.ts` | Creates `join_requests` + `members` |
| `POST /api/login` | `functions/api/login.ts` | Session creation |
| `POST /api/logout` | `functions/api/logout.ts` | Session end |
| `GET /api/search` | `functions/api/search.ts` | Cross-surface search including library destinations |
| `GET /api/milestones/list` | `functions/api/milestones/list.ts` | Club Home timeline candidate |
| `GET /api/events/next` | `functions/api/events/next.ts` | Event callout candidate |
| `GET /api/events/month` | `functions/api/events/month.ts` | Calendar data |
| `GET /api/friends/list` | `functions/api/friends/list.ts` | Recognition/partner candidate |
| `GET /api/content/get` | `functions/api/content/get.ts` | `page_content` blocks |
| `GET /api/content-inventory/related` | `functions/api/content-inventory/related.ts` | Related stories for memorabilia |

## Admin APIs (editorial and operations)

| Area | Route prefix | Primary tables |
| --- | --- | --- |
| Editorial review | `/api/admin/editorial/*` | `content_inventory`, `submission_queue`, `content_inventory_media` |
| Page/CMS copy | `/api/admin/content/*`, `/api/admin/cms/*` | `page_content`, `cms_content_blocks` |
| Membership card | `/api/admin/membership-card` | `membership_card_content` |
| Media registry | `/api/admin/media-assets/*` | `media_assets`, `photos` |
| Join requests | `/api/admin/join-requests/list` | `join_requests` |
| Events | `/api/admin/events/*` | `events` |

## D1 migration chain (Fan Club–relevant)

| Migration | Adds or changes |
| --- | --- |
| `0001_join_requests.sql` | Join intake table |
| `0002_library_entries.sql` | Legacy library content |
| `0003_photos.sql`, `0007_photos_metadata.sql` | Photo catalog + metadata |
| `0008_page_content.sql` | CMS slug/section copy |
| `0010_media_assets.sql` | B2 asset registry |
| `0017_discussions.sql` | Discussion posts |
| `0019_members.sql` | Member role registry |
| `0020_join_requests_profile_fields.sql` | Profile columns on join_requests |
| `0022_membership_card_content.sql` | Card instructions content |
| `0029_member_sessions.sql` | Session persistence |
| `0032_fix_membership_card_route_to_profile.sql` | Route copy correction in card content |
| `0035_editorial_archive.sql` | `content_inventory`, initial `submission_queue` |
| `0036_content_inventory_schema_delta.sql` | Summary fields + publish attribution triggers |
| `0037_submission_queue_workflow_delta.sql` | Expanded queue workflow states |
| `0038_content_inventory_media_association.sql` | `content_inventory_media` join table |

## Client library adapters

| File | Role |
| --- | --- |
| `src/lib/fanclubApi.ts` | Builds Fan Club photo/memorabilia API URLs |
| `src/lib/pageContent.ts` | Fetches `page_content` blocks |
| `src/lib/api.ts` | Shared fetch helpers |
| `src/lib/campaignSpotlight.ts` | Passive campaign read helper (fundraiser boundary) |

## B2 resolution

Photo and memorabilia thumbnails resolve through `functions/_lib/photo-url.ts`
using `photos.url` or `photos.photo_id` with optional `PUBLIC_B2_BASE_URL`.
Admin B2 sync is at `functions/api/admin/media-assets/sync-from-b2.ts`.

## Read/write boundary summary

| Actor | May write | May read |
| --- | --- | --- |
| Anonymous public | join/login forms only | public routes, health, FAQ, events, milestones |
| Authenticated member | `join_requests` profile fields, `submission_queue`, `discussions` | all member-gated Fan Club APIs above |
| Admin | editorial, CMS, events, media, membership card, join-request list | admin namespace |

Member APIs do not write to `photos`, `content_inventory`, or `content_inventory_media`
directly; publication flows through admin editorial paths.
