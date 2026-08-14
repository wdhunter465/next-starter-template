---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2929 (#2781 Task 004) final rehearsal disposition report structure, evidence indexing, and #2782 handoff packaging
Does Not Own: Product Authority Production Go; candidate/environment identity (#2926); journey/evidence/defect data (#2927, #2928, owned by those reports)
Canonical Reference: /docs/ops/reports/launch-rehearsal-final-disposition-template-2929.md
Related Issues: #2929, #2781, #2926, #2927, #2928, #2782
Last Reviewed: 2026-08-14
---

# Final rehearsal disposition template and #2782 handoff packaging — #2929

## Purpose

Deliver #2929 (#2781 Task 004): the report structure, evidence-indexing
automation, and #2782 handoff packaging so that once a real rehearsal has run
(#2926 candidate accepted, #2927 journeys executed, #2928 defects
resolved/dispositioned), publishing the final disposition is filling in a
pre-agreed structure against machine-checked evidence — not inventing a report
format under time pressure.

## Scope

Covers the disposition-readiness automation (`scripts/ci/launch_rehearsal_disposition_readiness.mjs`),
the report template below, and the #2782 handoff-package checklist. It does not
cover the actual GO/HOLD/ADJUSTMENT/NO-GO decision — that is a Product Authority
judgment made once real rehearsal evidence exists — and it does not redefine
#2926/#2927/#2928's own data or reports.

## Current known truth

- Formal rehearsal evidence is accepted on frozen candidate
  `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` (PMO COMPLETE #2928 /
  PR #3444): 22/22 journeys evidenced; D-2928-001–004 resolved; cleanup/rollback
  proven; no Production mutation.
- Filled disposition:
  `docs/ops/reports/launch-rehearsal-final-disposition-draft-2929.md` records
  **GO** for bounded #2782 non-Production handoff. That GO is not Product
  Authority Production Go.
- Live readiness snapshot: `ready: false` solely
  `unresolved_protected_decisions_present` (#2776, #2777, #2783, #2786, #2787).
  Registry, evidence-audit, ledger, and retest-coverage are `ok: true`.
- #2782 bounded handoff checklist is checked in the filled disposition; Production
  mutation remains prohibited.

## Intended final state

The filled disposition in
`docs/ops/reports/launch-rehearsal-final-disposition-draft-2929.md` is the
#2929 report. This template remains the structure and harness contract. Only
"Current known truth" tracks the live snapshot.

## Non-blocking prerequisite rule

#2928 evidence is now accepted. Remaining Pipeline intake Issues are explicit
carry-forwards into #2782 and are not waived here.

## Disposition readiness automation

`scripts/ci/launch_rehearsal_disposition_readiness.mjs` combines, without
deciding anything itself, the JSON *output* of four prior checks — a pipeline
contract rather than a code import, since #2927's and #2928's scripts ship on
their own component-branch PRs:

- #2927's `--mode validate-registry` output (is the journey registry
  structurally valid?);
- #2927's `--mode evidence-audit` output (does every journey have evidence?);
- #2928's `--mode validate-ledger` output (is the defect ledger structurally
  valid?);
- #2928's `--mode retest-coverage` output (is every failure dispositioned and
  every retest genuinely against a requalified candidate?);
- an explicit, externally-supplied list of unresolved protected Product/
  Production decisions (this script cannot discover these on its own — it only
  refuses to call the run "ready" while the list is non-empty).

Usage once real data exists:

```bash
node scripts/ci/launch_rehearsal_harness.mjs --mode validate-registry > registry-result.json
node scripts/ci/launch_rehearsal_harness.mjs --mode evidence-audit --evidence evidence-log.json > evidence-result.json
node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode validate-ledger --ledger defect-ledger.json > ledger-result.json
node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode retest-coverage --ledger defect-ledger.json --evidence evidence-log.json > retest-result.json
node scripts/ci/launch_rehearsal_disposition_readiness.mjs \
  --registry-result registry-result.json \
  --evidence-result evidence-result.json \
  --ledger-result ledger-result.json \
  --retest-result retest-result.json \
  --unresolved-decisions unresolved-decisions.json
```

Its output (`ready: boolean`, `blockers: string[]`) is evidence #2929's actual
future report cites; it does not replace the human GO/HOLD/ADJUSTMENT/NO-GO
judgment.

## Final rehearsal disposition report — structure

When #2929 is actually executed, its report follows this structure:

```markdown
# Final launch rehearsal disposition — #2781

## Candidate and environment
- Candidate SHA: <exact, unchanged for the accepted pass>
- Environment: <isolated preview/staging identity from #2926>

## Evidence summary
- Journeys executed: <N> / <N registered>
- disposition-readiness result: <ready: true|false, blockers: [...]>
- Evidence log: <link/path>
- Defect ledger: <link/path>

## Defect summary
- launch-blocker: <count>, all <resolved|accepted-risk|deferred-with-owner>
- major: <count>, all <resolved|accepted-risk|deferred-with-owner>
- minor: <count>, all <resolved|accepted-risk|deferred-with-owner>

## Unresolved protected decisions
- <none, or exact list requiring Product Authority decision before GO>

## Recommendation
- <GO | HOLD | ADJUSTMENT | NO-GO>, with rationale citing the evidence above

## #2782 handoff
- <complete bounded handoff per the checklist below, only on GO>
```

## #2782 handoff checklist (only on GO)

- [ ] Exact accepted candidate SHA recorded and cited identically in #2782's
  intake.
- [ ] Evidence log and defect ledger paths/links carried into #2782's intake
  (not re-summarized from memory).
- [ ] Every `deferred-with-owner` defect explicitly re-listed for #2782 so it
  is not silently dropped between projects.
- [ ] No Production mutation authorized by this handoff — #2782 owns its own
  separately protected Production Go decision.
- [ ] Source Issue accounting (#2929 → #2782's first task) stays consistent:
  one open, same-repository, non-PR source issue governs #2782's first PR.

## Validation

- `npx vitest run tests/launch-rehearsal-disposition-readiness.test.mjs` — all tests passing.
- `node scripts/ci/launch_rehearsal_disposition_readiness.mjs --registry-result <path> --evidence-result <path> --ledger-result <path> --retest-result <path>` — verified `ready: true` on fully-compliant synthetic sub-results and `ready: false` with the correct blocker(s) when any sub-result or the unresolved-decisions list is non-empty.
