---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2860 residual parent-disposition evidence packet for (1) empty Production `library_entries` expectedness and (2) retain versus retire
Does Not Own: Product Authority retain/retire decision; #2860 project closeout; Production D1/B2 mutation; #2859 content sourcing
Canonical Reference: /docs/ops/reports/library-content-residual-disposition-packet-2860.md
Related Issues: #2860, #2910, #2911, #2912, #2913, #2859, #2776, #2777, #2778, #2779, #3268
Last Reviewed: 2026-08-14
---

# #2860 residual disposition packet — empty table and retain versus retire

## Purpose

PMO routing on #2860 (https://github.com/wdhunter465/next-starter-template/issues/2860#issuecomment-5294399923)
assigned Cursor Local to gather and verify the evidence needed to disposition
two residual parent items, and to package the exact decision for PMO / Product
Authority. This report is that packet. It does not record the decision, close
#2860, or mutate Production.

## Scope

Covers repository and GitHub-native evidence already accepted for #2860
children #2910–#2913 and the post-execution reconciliation in
`docs/ops/reports/library-content-production-go-evidence-2860.md` (PR #3411).
It does not run a new Production query, does not retire `library_entries`, and
does not change the dual-read path in `functions/api/fanclub/library.ts`.

## Current known truth

- Implementation children #2910–#2913 are CLOSED `status:complete`.
- Product Authority Production GO for the controlled backfill is recorded on
  #2860 (comment 5268483994) and explicitly excluded destructive cleanup and
  `library_entries` retirement.
- Cursor then ran read-only preflight, dry-run, and apply against Production
  D1. Production `library_entries` had **0** rows; the apply executed **0**
  statements. Counts stayed `0 → 0`.
- Dual-read fallback from `library_entries` remains in
  `functions/api/fanclub/library.ts`. Canonical design still names
  `content_inventory` as the active library authority and `library_entries` as
  a legacy table that must not be silently orphaned.
- #2860 remains OPEN. Project closeout is a WORK/PMO disposition after the two
  items below are decided by Product Authority, not by this packet.

## Item 1 — Is empty Production `library_entries` expected?

### Verified fact

Production `library_entries` was empty at authorized execution time:

| Step | Evidence |
| --- | --- |
| Read-only preflight | Actions run 31624912865 — six columns, `is_approved` absent |
| Dry-run | Actions run 31625083912 — total **0** rows; plan `0/0/0/0/0` |
| Apply | Actions run 31625296915 — executed YES; statements **0** |
| Issue trail | #2860 comments 5270559258 (dry-run) and 5270604009 (apply) |

That emptiness is a **source-data fact**, not a migration defect. The gated
write path classified zero rows and executed the empty plan.

### What the fact does not prove

#2860 assumed migrating existing legacy Library submissions. Empty Production
does not by itself prove Product expected that state. If Product expected
non-zero historical rows, that is a **#2859 content/data sourcing** question,
not a #2860 implementation failure. PR #3411 Section 7 already named this
split; this packet does not reverse it.

### Packet for Product Authority

Choose one and record it on #2860:

- **EXPECTED** — Production never held durable `library_entries` rows to
  migrate; #2860 migration completeness stands on the `0 → 0` account.
- **UNEXPECTED** — open or continue a #2859 sourcing increment to locate the
  missing records; do not treat #2860 apply as the defect.
- **UNDETERMINED** — keep #2860 open on this item only; do not invent rows.

This packet does not select among those three.

## Item 2 — Retain versus retire `library_entries`

### Constraints already recorded

- Production GO (comment 5268483994) excluded retirement and destructive
  cleanup.
- Design: `docs/reference/website/content-inventory-model.md` — do not silently
  orphan `library_entries` when reads move to `content_inventory`.
- Storage model: `docs/reference/content/content-pipeline-storage-model.md` —
  `library_entries` is **legacy read fallback; no new writes**.
- Runtime: `functions/api/fanclub/library.ts` still queries `library_entries`
  when the table exists.

### Risk note (not a decision)

With Production row count **0**, retiring the table would not destroy live
legacy submissions **today**. Retirement would still require a new authorized
child covering schema/read-path removal, fallback tests, and a distinct
Product GO. That child does not exist. Inferring retirement from emptiness
would violate the recorded GO exclusion.

### Packet for Product Authority

Choose one and record it on #2860:

- **RETAIN** — keep the table and dual-read fallback; no schema PR. Lowest
  collision with current GO and design “no silent orphan” rule.
- **RETIRE** — authorize a new child (allowlist, tests, dual-read removal) and
  a distinct Product GO; not performed by this packet.
- **CONTINUE FALLBACK** — same operational effect as RETAIN, named explicitly
  against #2860 acceptance criterion “legacy retirement, retention, or
  continued fallback is explicitly dispositioned.”

This packet does not select among those three.

## Requested PMO / Product Authority action

Reply on #2860 with one disposition each for Item 1 and Item 2. Cursor will
not close #2860, will not open a retirement PR, and will not mutate Production
from this packet.

## Unresolved protected decisions carried forward

Do not waive: #2776, #2777, #2778, #2779. #2859 remains a separate parent for
any unexpected-empty sourcing work. No destructive Production cleanup.

## Validation

- `node scripts/ci/diataxis_folder_audit.mjs`
- Header on this file is complete. No Production command was executed.
