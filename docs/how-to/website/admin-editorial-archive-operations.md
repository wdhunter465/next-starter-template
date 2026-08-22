---
Doc Type: How-To
Audience: LGFC editors, operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: `/admin/editorial` operator alignment with approved content inventory
Does Not Own: Content strategy, seed design, or `#1256` program scope
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related issues: #1258, #1565, #1123, #1256, #1689
Last Reviewed: 2026-08-22
---

# Admin Editorial Archive Operations

## Purpose

Operate `/admin/editorial` in alignment with the approved `content_inventory` model
(`#1123` / T45). Editorial authority remains with Program `#1256`; `#1258` covers
operator alignment only.

## Scope

Route: `/admin/editorial`

APIs: `functions/api/admin/editorial/**`

Related editorial how-tos (submission → review → publish):

- [Add content story](./add-content-story.md)
- [Review content submission](./review-content-submission.md)
- [Publish or update content](./publish-update-content.md)
- [Add content media](./add-content-media.md)
- [Member content submission](./member-content-submission.md) (member intake → this queue)

## Steps

1. Sign in as an admin member.
2. Open **Editorial Archive**.
3. Load inventory or queue views exposed by the page.
4. Perform review, merge, or publish actions per linked editorial how-tos.
5. Confirm no parallel content store is introduced outside `content_inventory`.

## Procedure

### Open editorial admin

1. Navigate to **Editorial Archive**; lists load automatically for a signed-in admin member.
2. Refresh lists (inventory, submissions, or review queues per UI).

### Review and publish

Follow the editorial how-to chain for human approval, canonical checks, media
associations, and placement fields. The admin UI implements `#1256` inventory
fields — do not bypass required review steps.

### Member submission queue entry

1. Member submissions from `/fanclub/submit` arrive as `submission_queue` rows with
   `status = pending`.
2. Process them with [Review content submission](./review-content-submission.md).
3. Do not publish directly from the queue; convert approved items to
   `content_inventory` per publish how-to.
4. Legacy `photos` catalog rows remain separate operator-managed content; promoting
   queue submissions into `photos` requires explicit editorial action in a later
   implementation task.

### Ops alignment checks

- Editorial publish uses the same dual gate as other admin lanes.
- Media associations must reference approved photo/inventory records.
- Defer public surface QA to `#1259` when production validation is required.

## Verification

- `tests/admin-editorial-archive.test.tsx`
- Cross-check field names against `docs/reference/website/content-inventory-model.md`.

## Closeout Criteria

Editorial ops action is complete when inventory records reflect approved editorial
state and linked how-to closeout criteria are met.
