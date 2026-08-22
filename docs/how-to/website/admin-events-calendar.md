---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Event calendar administration and public read-path stability checks
Does Not Own: Homepage section order, ICS feeds, or ticket integrations
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1124
Last Reviewed: 2026-06-14
---

# Admin Events Calendar

## Purpose

Create, update, and seed events while preserving public calendar read paths
(`#1124` / T46).

## Scope

Route: `/admin/events`

APIs: `functions/api/admin/events/**`, public reads `functions/api/events/**`.

## Steps

1. Sign in as an admin member.
2. Open **Events**.
3. Load the event list.
4. Create or update events; use seed controls only when intentionally backfilling.
5. Verify public `events/next` or month views if a production check is required.

## Procedure

### List and edit

1. Open **Events**; the list loads automatically for a signed-in admin member.
2. Select an event or create a new record with required date/title fields.
3. Save changes; confirm success status.

### Seed next events

1. Use **Seed next 10** (or equivalent control) only per operator policy.
2. Confirm seeded rows appear in the admin list.
3. Treat seed as forward-only; rollback requires explicit D1 operator action outside this UI.

### Public read stability

After material changes, spot-check public endpoints:

- `/api/events/next`
- `/api/events/month` (with a known month parameter)

Defer full production validation to `#1259` when launch CI is required.

## Verification

- `tests/admin-events.test.tsx`
- Manual: CRUD fails closed without an authenticated admin session; `Error:` on API errors.

## Closeout Criteria

Event admin action is complete when admin list reflects intended records and public
reads return expected upcoming events.
