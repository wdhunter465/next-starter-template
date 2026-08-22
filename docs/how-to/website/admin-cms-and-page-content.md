---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: CMS blocks and page content admin procedures
Does Not Own: Editorial inventory strategy (#1256) or public page layout design
Canonical Reference: /docs/reference/website/content-inventory-model.md
Related issues: #1258, #1565, #1121, #1256, #1689
Last Reviewed: 2026-08-22
---

# Admin CMS and Page Content

## Purpose

List, edit, save, and publish CMS blocks and page content (`#1121` / T43).

## Scope

Routes:

- `/admin/cms` — reusable CMS blocks
- `/admin/content` — page content records

APIs: `functions/api/admin/cms/**`, `functions/api/admin/content/**`.

## Steps

1. Sign in as an admin member.
2. Open **CMS Blocks** or **Page Content**.
3. Load the list; select the target record.
4. Edit fields; save draft changes.
5. Publish when content is approved for public surfaces.

## Procedure

### CMS blocks

1. Open **CMS Blocks**.
2. Refresh the block list.
3. Edit block JSON or structured fields per page guidance.
4. Save; confirm success status.
5. Publish when ready for public consumption.

### Page content

1. Open **Page Content**.
2. Load records for the target public route or slug.
3. Edit title/body/metadata fields exposed by the editor.
4. Save draft; publish through the publish control when approved.
5. Verify public page separately (static export may require deploy).

### Boundaries with editorial inventory

`content_inventory` editorial workflows are owned by Program `#1256`. Use
[Editorial archive operations](./admin-editorial-archive-operations.md) for
inventory records; use this runbook for CMS blocks and page content tables.

### Club Home module boundary

Authenticated Club Home (`/fanclub`) mixes module types:

| Module | Use CMS / page content | Use `content_inventory` |
| --- | --- | --- |
| Masthead copy, static module labels | yes (`page_content` slug sections) | no |
| Lead story, secondary rail, archive spotlight | no | yes (`club_home` in `allowed_sections`) |
| Photo/memorabilia feature card | no (catalog/`photos` + associations) | optional linked story |
| Submission CTA | route only (`/fanclub/submit`) | intake via `submission_queue`, not CMS |

See `docs/reference/website/unified-content-workflow.md` and
`docs/reference/website/editorial-placement-and-rotation.md` (Club Home slot map).

## Verification

- `tests/admin-cms-content.test.tsx`
- Manual: list/save/publish fail closed without an authenticated admin session.

## Closeout Criteria

CMS/content change is complete when save or publish succeeds and public eligibility
is confirmed per editorial policy.
