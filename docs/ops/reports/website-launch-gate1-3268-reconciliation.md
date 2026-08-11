---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: Reconciling #3268 Phase 2 completion (real D1 export, checksum, R2 upload, and isolated restore proof) against the "Real D1 backup/restore capability" row of the Gate 1 prerequisite matrix (PR #3282); the honest downstream effect on #2859's outstanding acceptance criteria and #2780's entry gate
Does Not Own: The Gate 1 PASS/HOLD determination itself, or the #2780/#2859/#2926 acceptance decisions (Product Authority / WORK); Gate 2 (#2928/#2929) or Gate 3 (#2930/#2931); any Production action, credential use, or protected CI path change
Source Issue: #2780
Canonical Reference: /docs/ops/reports/website-launch-gate1-3268-reconciliation.md
Related Issues: #2859, #2780, #2781, #2926, #2779, #3268, #3282, #3306, #3309, #3311, #3314, #3317, #3323, #3325, #3327, #3329
Last Reviewed: 2026-08-11
Executor: Claude Code
---

# Website Launch Completion — Gate 1 reconciliation against #3268 Phase 2 evidence

## Purpose

PR #3282's Gate 1 prerequisite matrix (`docs/ops/reports/website-launch-gate1-prerequisite-matrix.md`)
identified one row as the root cause behind most of #2859's outstanding
acceptance criteria: **"Real D1 backup/restore capability"**, status
**PROTECTED / OUTSTANDING**, because #2779's actual deliverable was a
synthetic simulation only and #3268 was "created 2026-08-10, queued not
active." That report's own "Intended final state" section named exactly
this trigger for a follow-up: *"if #2779/#3268's real backup/recovery proof
lands ... [it] produces its own later evidence artifact ... rather than an
edit to this file."* This report is that artifact.

Since PR #3282, #3268 Phase 2 (Packages 1–3) completed with live evidence
under bounded, independently-reviewed PRs: #3306/#3309 (capability
preflight), #3311 (real export/checksum/R2 upload), #3314/#3317/#3323/#3325/#3327
(isolated restore proof, five live iterations). This report reconciles that
completion against the matrix — one row, and only that row.

## Scope

Updates the "Real D1 backup/restore capability" matrix row only. Does not
re-litigate #2858/X-10, #2860, or #2784/#2920 — PR #3282 already settled
those and no new evidence has surfaced that changes them. Does not perform,
authorize, or schedule any Production action, and does not create or
modify any `.github/workflows/**` or `scripts/ci/**` file. Does not flip
#2780, #2859, or #2926 state — those remain Product Authority / WORK
decisions.

## Current known truth

#3268 Phase 2 delivered, with live Cloudflare/D1/R2 evidence (not
simulated, not against a disposable local `node:sqlite` database):

- **Package 1** (capability preflight): R2 write capability and D1 admin
  capability both **CONFIRMED** live, with a clean post-merge remediation
  loop (#3308→#3309) proving the safety net works.
- **Package 2** (real export/checksum/upload): a real `wrangler d1 export
  --remote` of `lgfc_lite` (469,630 bytes), SHA-256 checksummed, uploaded
  to the private `lgfc-d1-backups` R2 bucket, independently re-downloaded
  and re-hashed to confirm the checksum matched exactly.
- **Package 3** (isolated restore proof): the R2 backup was discovered,
  checksum-reverified, imported into a uniquely-named, `wrangler.toml`-unbound
  restore-drill database (1,313 queries, 5,711 rows written), and its
  restored schema matched the backup file's schema exactly (37/37 tables,
  after correctly excluding D1-internal `_cf_%`/`d1_migrations%`/`sqlite_%`
  bookkeeping tables from the comparison). The drill database was deleted
  unconditionally on completion.

At no point did any package read, write, or restore into `lgfc_lite`
(Production D1) directly, or expose row content, secrets, or the
`wrangler d1 export` presigned URL. Full result comment:
https://github.com/wdhunter465/next-starter-template/issues/3268#issuecomment-5252882921

## Intended final state

This snapshot is superseded, not updated in place, once #2859 closes any
of its remaining outstanding criteria, #2780 is accepted, or Bill/WORK
authorizes and runs the Preview D1/B2 preflight (PR #3282 §9) or the real
Production D1/B2 population action named in Section 3 below. Each such
event produces its own later evidence artifact.

## 1. Matrix row update

| Requirement | Prior status (PR #3282) | Updated status | Evidence |
| --- | --- | --- | --- |
| Real D1 backup/restore capability | PROTECTED / OUTSTANDING (issue closed; capability does not exist) | **SATISFIED** | #3268 Phase 2, Packages 1–3, live evidence (Current known truth, above) |

This is a genuine change of state, not a reclassification: the capability
PR #3282 said did not exist now does, proven against real Cloudflare
infrastructure rather than simulated.

## 2. What does NOT change

PR #3282 §3 was explicit that this row was necessary but not sufficient
for #2859's outstanding criteria, and that remains true today:

| Criterion | PR #3282 requirement | Status after #3268 |
| --- | --- | --- |
| 3 — D1/B2 population | Production action + credential authority + real backup/recovery proof | Backup/recovery proof sub-requirement now met. **Production action + credential authority remain a separate, not-yet-authorized decision.** Criterion stays **OUTSTANDING**. |
| 4 (remainder) — attribution/rights/privacy verification | Same Production-population dependency, plus Legal review (P-22/P-23) | Unchanged — still blocked on criterion 3, **and** on a Legal/Bill decision unrelated to the backup gap. Stays **PARTIALLY SATISFIED**. |
| 5 — no placeholder/broken media/stale copy | Read-only verification, blocked on criterion 3 | Unchanged — still mechanically blocked on real content existing. Stays **OUTSTANDING**. |
| 6 — search/nav expose only approved content | Read-only verification, blocked on criterion 3 | Unchanged — same as criterion 5. Stays **OUTSTANDING**. |
| 7 — Preview + Production evidence recorded | Splits: Preview half never needed the backup proof; Production half needs the same as criterion 3 | Preview half unchanged (still pending its own separate protected-CI authorization, PR #3282 §9). Production half's backup-proof sub-requirement now met, but Production action + credentials remain outstanding. Stays **OUTSTANDING, split**. |

Because criteria 3, 5, 6, and part of 4/7 remain open, **#2859 is not
complete or accepted**, and therefore **#2780's entry gate ("#2859
completed and accepted") does not advance** — it stays **HOLD**. #2926
still cannot produce a real entry-criteria record, for the same reason PR
#3282 §7 gave: that record depends on #2780's acceptance.

**Gate 1 (the project-level "Clear the actual launch blocker" determination
PR #3282 owns): still HOLD.** One prerequisite row cleared; the remaining
rows in PR #3282 §1 are unchanged.

## 3. What Bill/WORK can now decide

The backup/recovery gap was the cited root cause blocking multiple
criteria at once (PR #3282 §1, §3). With it closed, two previously-identified
candidate actions are now in a clearer state — neither is built or
executed by this report:

1. **Preview D1/B2 preflight** (PR #3282 §9's authorization packet). This
   never depended on #3268 — Preview data isn't the durable Production
   record the backup gap protects. It remains exactly as PR #3282 left it:
   a real, incremental, read-only step toward criterion 7's Preview half,
   requiring `protected-change-review` because it adds files under
   `.github/workflows/**` and `scripts/ci/**`. Still pending a Bill/WORK
   Go/No-Go, independent of this report.

2. **Real Production D1/B2 population for #2859 criterion 3.** This is the
   action that specifically depended on #3268, and its backup-proof
   precondition is now satisfied. It is also the action with the highest
   blast radius in this entire chain — a real write to Production D1/B2
   content — and remains squarely inside Bill's standing Production/
   destructive-data/credential-gate authority, not something this report
   recommends starting. If Bill/WORK wants to move this forward, the next
   step would be a bounded, separately-scoped authorization request (batch
   identity, rollback plan, editorial sourcing) — not a continuation of
   #3268, which is now complete for its own stated scope (Phase 3/4 —
   scheduled backups, recovery-drill cadence — remain separately out of
   scope per the #3268 Phase 2 design doc).

No action in this section is taken by this report. Both remain Bill/WORK
decisions.

## Acceptance checklist (this report)

- [x] Updates exactly the one matrix row #3268 evidence changed, and no
      other row from PR #3282.
- [x] States plainly that #2859, #2780, and #2926 do not change state as a
      result.
- [x] Distinguishes the now-satisfied backup-proof sub-requirement from
      the still-outstanding Production-write-authorization sub-requirement
      for criteria 3/4/7.
- [x] Identifies the two next candidate decisions without building,
      authorizing, or scheduling either.
- [x] No protected CI path created or modified.
- [x] No Production action performed, requested, or recommended as an
      immediate next step.

## Rollback (of this report)

Documentation-only. Revert via normal reviewed PR path if found inaccurate;
makes no code, schema, workflow, or Production state change.
