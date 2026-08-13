---
Doc Type: As-Built
Audience: Human + AI
Authority Level: Supporting
Owns: Runtime behavior for D1-backed weekly photo matchup auto-rotation
Does Not Own: Component design, voting policy, photo curation UI
Canonical Reference: /docs/as-built/weekly-matchup-auto-rotation.md
Related issues: #2157, #2230, #2519, #3028, #3030, #3031
Last Reviewed: 2026-08-05
---

# Weekly Photo Matchup auto-rotation

## Purpose

Records how `GET /api/matchup/current` resolves the homepage Weekly Photo Matchup pair from D1 without requiring manual admin action each week, how browser image-load failures are handled under the #3028 mid-week mutation lockdown, and how CI (#3031) snapshots the Monday pair and remediates unauthorized mid-week drift.

## Scope

- Backend resolver (`functions/api/matchup/current.ts`).
- Public repair audit endpoint (`POST /api/matchup/repair` via `functions/api/matchup/repair.ts`) — **log only; no D1 mutation**.
- Authorized mid-week change (`POST /api/admin/matchup/repair`, `POST /api/admin/matchup/update` with `source_issue`).
- Public contract consumed by `src/components/WeeklyMatchup.tsx`.
- Photo club-use curation (`photos.is_matchup_eligible`) is defined in `/docs/reference/platform/Backblaze_B2.md`.
- Admin photo curation UI is planned for `/admin/d1-test/` under a future PMO program; until then, inspect-only.

## Behavior

On each request, the API:

1. Computes the current Monday `week_start` (`YYYY-MM-DD`) with a Monday-inclusive expression: `date('now','-6 days','weekday 1')`.
2. For an existing **active** `weekly_matchups` row for that week:
   - both photos must resolve and remain eligible (`is_matchup_eligible >= 0`);
   - if either photo fails to resolve or is no longer eligible (e.g. retired by the daily B2 deletion-reconcile job below), the API **self-heals**: it falls through to the pair-replacement logic in step 3, which selects a fresh eligible pair and clears that week's votes. This is deliberate — a permanently-excluded photo should not keep blocking the public matchup forever. #3030: this mutation previously had **no audit trail**; it now emits a `matchup_repair_audit` log line with `trigger: "current_get_eligibility"` (before/after pair ids, which slot forced it, `mutated`/`votes_cleared`) before returning;
   - otherwise both object URLs are probed (HEAD, then ranged GET) before return;
   - if either probe fails, the API **does not** mutate the pair (#3028). It returns the existing pair, sets `mutation_blocked`, and emits a structured `matchup_repair_audit` log line with `trigger: "current_get_probe"`.
   - **Distinction:** a probe failure (object temporarily unreachable) is locked and requires an authorized admin repair; an eligibility failure (photo permanently excluded) is self-healed automatically and only audited.
3. Otherwise:
   - closes stale active rows from prior weeks;
   - selects two eligible photos from `photos`;
   - prefers non-memorabilia rows;
   - excludes photo IDs used in the last eight matchups when enough alternatives exist;
   - skips rows where `is_matchup_eligible < 0`;
   - inserts/updates an active row for the current week (handles `UNIQUE` race by re-read);
   - clears that week's votes when the photo pair changes under an **authorized** path;
   - returns the two-photo payload.
4. Fails closed with `ok: true`, `matchup_id: null`, `items: []` when fewer than two eligible photos exist.

### Proactive B2 ↔ D1 deletion reconciliation

Additive daily sync inserts new B2 keys only. Deletion reconciliation
(`scripts/b2_d1_deletion_reconcile.sh`, after incremental sync in
`.github/workflows/b2-d1-daily-sync.yml` at **04:00 EST** / `0 9 * * *` UTC):

1. Soft-retires D1 rows whose object keys are absent from B2
   (`is_matchup_eligible = -1` plus a `PURGE_ELIGIBLE` rights note).
2. Repairs any **active** `weekly_matchups` row that still references excluded
   photos (keeps the healthy slot when possible; otherwise picks a new pair).
3. Clears `weekly_votes` for that week when the pair changes.
4. Emits audit outputs; opens/updates an ops findings issue only when rows were
   retired or a matchup was repaired (silent when nothing changed).
5. Fails closed if the B2 inventory is empty; escalates a failure issue on
   workflow error.

Historical matchup rows keep their photo IDs; retired photos are never
reselected for new matchups. Public browser/`current` probes no longer mutate
mid-week (#3028); they only log.

### Broken-image reporting (`POST /api/matchup/repair`) — audit only (#3028)

When a homepage matchup `<img>` fires `onError`:

1. The client posts `{ broken_photo_id }` to `/api/matchup/repair` (max two attempts per page load).
2. The server verifies the id is in the active current-week pair and probes the object URL.
3. It emits a structured `matchup_repair_audit` console log (trigger, week, slot, probe, before/after ids, client UA + IP hash).
4. It **does not** update `weekly_matchups` or delete votes.
5. When the id is found in the active pair, the response includes `mutation_blocked: true` and the unchanged pair. The no-active-matchup, stale-id, and invalid-id responses do not set `mutation_blocked` — they are non-mutating by construction and carry no pair to hold, so there is nothing to block.

### Authorized mid-week replace / restore (Issue/PR required)

Mid-week changes to Photo A and/or B require:

1. A GitHub **source Issue** number (`source_issue`), and
2. Admin auth (`ADMIN_TOKEN`) via:
   - `POST /api/admin/matchup/repair` `{ broken_photo_id, source_issue }` — replace broken slot; or
   - `POST /api/admin/matchup/update` `{ id, photo_a_id?, photo_b_id?, status?, source_issue }` — set exact pair (restore/replace).

`source_issue` is parsed and recorded as an operator-supplied reference (`#3028`, `3028`, or `Issue 3028`, normalized to `#3028`) — it is **not** verified against the GitHub API, so any well-formed issue number authorizes the change. Treat it as an audit annotation, not a proof of a real, open Issue.

**Votes:** pair change deletes `weekly_votes` for that `week_start`. Votes are **not archived**; **vote restore is impossible**. Authorized change resets the week to **0–0**. Prefer opening a tracked Issue/PR before using these endpoints.

**Lazy Monday rotation:** the first homepage or API hit of a new week creates the new pair. No separate scheduled rollover job is required.

### CI Monday snapshot + mid-week drift monitor (#3031)

Workflow: `.github/workflows/matchup-pair-monitor.yml` (hourly + `workflow_dispatch`).

1. Calls public `GET /api/matchup/current` (forces lazy Monday create when needed).
2. Snapshots photo IDs + URL basenames for the current `week_start` into an Actions cache baseline (first run of the week / missing baseline).
3. Later runs compare live pair to that baseline.
4. On drift in `auto` mode: replaces **both** slots via remote D1, deletes `weekly_votes` for that week (**0–0**), adopts the new pair as baseline, and upserts an ops findings issue.
5. Modes: `auto` (default), `adopt-current` (refresh baseline after an authorized Issue-gated admin change), `watch-only` (report drift without mutating).

**Authorized mid-week changes:** after admin repair/update with `source_issue`, run the workflow with `adopt-current` so CI does not treat the Issue-gated pair as unauthorized drift.

**Deferred:** event-driven trigger when the pair mutates (prefer over interval polling). Interval CI is the shipped first cut.

Scripts: `scripts/ci/matchup_pair_monitor.mjs`, `scripts/ci/ops_matchup_drift_findings.mjs`.

## Eligibility (interim)

| `is_matchup_eligible` | Meaning | Selection today |
| --- | --- | --- |
| `0` | Default / unreviewed | Temporarily eligible while catalog curation is in progress |
| `1` | Approved club use | Eligible |
| `-1` | Excluded | Never selected |

Target state after admin curation via `/admin/d1-test/`: select only `= 1`.

New and synced rows default to `0` (`NOT NULL DEFAULT 0` in migration `0007_photos_metadata.sql`).

## Vote and results storage

Votes are stored in D1; winner is computed at read time (not persisted as a column).

| Table | Role |
| --- | --- |
| `weekly_votes` | One row per vote: `week_start`, `choice` (`a`/`b`), `source_hash`, `created_at` |
| `weekly_matchups` | Pair metadata: `week_start`, `photo_a_id`, `photo_b_id`, `status` (`active`/`closed`) |

`GET /api/matchup/results` aggregates `weekly_votes` for totals and derives `winner` (`a`, `b`, or `tie`) for the last **closed** week. There is no `winner` column on `weekly_matchups`.

## Related files

- `functions/api/matchup/current.ts` — resolver and selection
- `functions/api/matchup/vote.ts` — vote insert
- `functions/api/matchup/results.ts` — totals and last-week winner
- `src/components/WeeklyMatchup.tsx` — homepage UI
- `tests/matchup-current-rotation.test.ts` — rotation unit tests
- `tests/matchup-pair-monitor.test.mjs` — CI snapshot/drift helpers (#3031)
- `.github/workflows/matchup-pair-monitor.yml` — hourly pair monitor (#3031)
- `docs/as-built/weekly-matchup-photo-url-normalization.md` — URL normalization on read paths

## Operator surfaces

| Route | Role |
| --- | --- |
| `/admin/matchup` | Override/emergency: manual create, activate, close; public preview panel |
| `/admin/d1-test` | Inspect `photos` rows (including `is_matchup_eligible`); curation editing deferred to PMO program |

Normal weekly rollover does **not** require `/admin/matchup` action.
