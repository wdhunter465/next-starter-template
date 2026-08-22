---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Media asset inventory and B2 sync operator procedures
Does Not Own: B2 bucket policy, photo schema migrations, or CDN configuration
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1122
Last Reviewed: 2026-06-14
---

# Admin Media Assets

## Purpose

Operate `/admin/media-assets` for D1 media inventory and B2 sync (`#1122` / T44).

## Scope

Route: `/admin/media-assets`

APIs: `functions/api/admin/media-assets/**`, public reads `functions/api/photos/**`.

## Steps

1. Sign in as an admin member.
2. Open **Media Assets**.
3. Load inventory list.
4. Run **Sync from B2** when adding objects from the bucket.
5. Review fail-closed errors for missing bindings or partial sync.

## Procedure

### Inventory review

1. Open **Media Assets**; the inventory list loads automatically for a signed-in admin member.
2. Confirm rows show expected keys, titles, or status fields exposed by the UI.

### B2 sync

1. Click **Sync from B2** (disabled while busy).
2. Wait for completion status.
3. On failure, read `Error:` message — common causes: missing B2 binding, D1 unavailable, expired admin session.
4. Refresh list after successful sync.

### Public read contract

Photo public routes must continue to resolve URLs for synced assets. Spot-check a
known photo URL after large syncs.

## Verification

- `tests/admin-media-assets.test.tsx`
- Manual: sync blocked without an authenticated admin session; errors surfaced in status text.

## Closeout Criteria

Media ops action is complete when inventory reflects B2 state or documented partial
failure is escalated to infrastructure operators.
