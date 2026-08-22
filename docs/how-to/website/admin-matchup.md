---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: Weekly matchup override/emergency ops and public read-path checks
Does Not Own: Voting model redesign, photo curation UI, or matchup product policy
Canonical Reference: /docs/as-built/weekly-matchup-auto-rotation.md
Related issues: #1258, #1565, #1126, #2157
Last Reviewed: 2026-08-22
---

# Admin Matchup

## Purpose

Inspect and override weekly photo matchups when needed, and compare admin state to public read paths (`#1126` / T48).

Normal weekly rollover is **automatic** via `GET /api/matchup/current` (see `/docs/as-built/weekly-matchup-auto-rotation.md`). Use this page for diagnostics, manual overrides, or closing a week — not for routine Monday pair selection.

Photo club-use tagging (`photos.is_matchup_eligible`: `0` / `1` / `-1`) will be curated on `/admin/d1-test/` under a future PMO program. Until then, D1 Inspect is read-only for that column.

## Scope

Route: `/admin/matchup`

APIs: `functions/api/admin/matchup/**`, public `functions/api/matchup/**`.

## Steps

1. Sign in as an admin member.
2. Open **Matchup**.
3. Load matchup list and active record.
4. Use the public preview panel to compare admin vs live homepage data.
5. Create, activate, or close matchups only when overriding auto-rotation or correcting a bad pair.

## Procedure

### Load matchups

1. Open **Matchup**; the list loads automatically for a signed-in admin member.
2. Review active matchup and historical items.

### Create matchup (override)

1. Enter week start (Monday UTC), photo A ID, photo B ID.
2. Choose activate-on-create if the matchup should go live immediately.
3. Submit; confirm success status and list refresh.

Use only when auto-rotation produced an incorrect pair or when seeding a week before public traffic.

### Close active matchup

1. Use close control for the active record when the voting period ends (or when forcing rollover investigation).
2. Confirm active flag clears and public preview updates.

Auto-rotation closes stale active rows from prior weeks on the next public read of a new week; manual close remains available for operator control.

### Public preview panel

The admin page fetches `/api/matchup/current` and `/api/matchup/results` for operator comparison. Mismatches between admin and public data warrant investigation before leaving an active matchup live.

## Verification

- `tests/admin-matchup.test.tsx`
- `tests/matchup-current-rotation.test.ts`
- Manual: mutations blocked without an authenticated admin session; stale refresh cancelled on sign-out.

## Closeout Criteria

Matchup action is complete when admin and public read paths agree on the active week and vote totals where applicable.
