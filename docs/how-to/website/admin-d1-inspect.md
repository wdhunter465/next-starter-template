---
Doc Type: How-To
Audience: LGFC operators, maintainers, and AI implementation agents
Authority Level: Operational Procedure
Owns: D1 inspect diagnostic procedure for operators
Does Not Own: D1 migrations, production data repair, or schema design
Canonical Reference: /docs/reference/architecture/access-model.md
Related issues: #1258, #1565, #1119, #2157
Last Reviewed: 2026-07-04
---

# Admin D1 Inspect

## Purpose

Use `/admin/d1-test` to inspect D1 table counts, schemas, and sample rows without direct SQL console access.

This is the planned operator surface for **`photos.is_matchup_eligible`** curation (`0` unreviewed, `1` approved club use, `-1` excluded). Editing that flag is deferred to an upcoming PMO program; today the page is inspect-only.

## Scope

Route: `/admin/d1-test`

API: `/api/admin/d1-inspect`

## Steps

1. Sign in as admin (session gate).
2. Open **D1 Inspect**; the table list loads automatically.
3. Select a table; load schema and sample rows.
4. For photo curation prep: open the **`photos`** table and review `is_matchup_eligible` values (default `0` for new/synced rows).

## Procedure

### Access

1. Navigate to **D1 Inspect**. Table list loads automatically for a signed-in admin member — no token step.
2. Choose table from the selector.
3. Run inspect; review counts and sample JSON.

### Photo eligibility inspection

1. Click **`photos`** in the table list.
2. Confirm schema includes `is_matchup_eligible` (`INTEGER NOT NULL DEFAULT 0`).
3. Review sample rows: `0` = unreviewed, `1` = approved, `-1` = excluded.
4. Do not mutate rows from this page until the PMO curation program adds a write path.

Canonical semantics: `/docs/reference/platform/Backblaze_B2.md`.

## Fail-closed expectations

- Missing `DB` binding → API `503`.
- No admin session → API `401`.
- Valid session but not an admin member → API `403`.
- UI remains session-gated like other `/admin/**` routes.

## Safety

- Do not paste production tokens into shared screens.
- Sample rows may contain operational data — handle per LGFC privacy policy.
- Schema inspection supports debugging; structural changes belong in authorized migration tasks.
- Eligibility changes today require authorized migrations or ops channels until curation UI ships.

## Verification

- Manual: inspect loads only with a valid admin session.
- Cross-check `docs/reference/architecture/access-model.md` access model table.

## Closeout Criteria

D1 inspect session is complete when the operator recorded the diagnostic finding and escalated data fixes through authorized migration/ops channels if needed.
