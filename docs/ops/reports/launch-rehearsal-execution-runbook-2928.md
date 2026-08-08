---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2928 (#2781 Task 003) formal rehearsal execution runbook, defect taxonomy, remediation routing, and retest procedure
Does Not Own: Candidate/environment identity (#2926); journey catalog/automation/evidence model (#2927, owned by that report); final GO/HOLD/ADJUSTMENT/NO-GO disposition (#2929)
Canonical Reference: /docs/ops/reports/launch-rehearsal-execution-runbook-2928.md
Related Issues: #2928, #2781, #2926, #2927, #2929
Last Reviewed: 2026-08-08
---

# Launch rehearsal execution runbook, defect taxonomy, and retest procedure — #2928

## Purpose

Deliver #2928 (#2781 Task 003): the runbook, defect taxonomy, remediation-routing
design, and retest procedure the formal rehearsal execution follows once #2926's
candidate/environment identity is accepted, so execution has a complete,
pre-agreed procedure instead of improvising defect handling mid-rehearsal.

## Scope

Covers how a formal rehearsal run is executed against #2927's journey registry,
how defects found during that run are classified and routed, and how retests are
proven to have run against a genuinely requalified candidate rather than a silent
re-run of the same one. It does not cover #2926's candidate/environment identity,
#2927's journey catalog/automation/evidence model (only consumes them), or #2929's
final disposition — each is owned by its own task/report.

## Current known truth

- No formal rehearsal has been executed. #2926's candidate/environment identity is
  not yet accepted, so this runbook and its companion defect-ledger harness are
  **procedure and automation scaffolding**, not a record of any actual defect.
- The defect-ledger schema and its harness
  (`scripts/ci/launch_rehearsal_defect_ledger.mjs`) are implemented and pass their
  own test suite (`tests/launch-rehearsal-defect-ledger.test.mjs`) against synthetic
  fixtures, proving the schema and retest-coverage logic are sound before any real
  rehearsal produces real data.
- This runbook consumes #2927's journey registry and evidence-log shape unchanged;
  it does not redefine them.

## Non-blocking prerequisite rule

Per #2928's non-blocking prerequisite rule, this document and its companion
defect-ledger harness are **runbook preparation, defect taxonomy, remediation-routing
design, retest planning, and evidence-template work** — the collision-safe category
of work #2928 explicitly authorizes before #2927's journeys/harness are accepted
for final execution. No rehearsal journey has been executed and no defect has been
found; this deliverable only builds the procedure #2928 will follow once it can run
for real.

## Execution runbook

1. Confirm the accepted, immutable candidate SHA and isolated environment identity
   from #2926 before starting. The candidate must not change for the duration of a
   rehearsal pass — this is what "unchanged qualified candidate" in #2928's
   objective means.
2. Run every journey in `docs/ops/reports/launch-rehearsal-journey-registry-2927.json`
   via its `executionPath`, recording one evidence-log entry per journey per
   `docs/ops/reports/launch-rehearsal-journey-catalog-2927.md`'s evidence-model shape,
   extended with `result` (`pass`/`fail`) and `candidateSha` (required for this
   runbook's defect-ledger cross-checks).
3. Run `node scripts/ci/launch_rehearsal_harness.mjs --mode evidence-audit --evidence <log>`
   to prove every journey has evidence before triaging results.
4. For every `fail` result, open one defect record (see taxonomy below) referencing
   the failing journey id and the candidate SHA the failure occurred on.
5. Route each defect per its severity (see Remediation routing below).
6. For a defect requiring retest: the remediation produces an explicitly rebuilt,
   requalified candidate (a new SHA) — never a silent edit to the same candidate.
   Retest the affected journey against the new SHA and append a new evidence-log
   entry (same journey id, new `candidateSha`, new `result`).
7. Run `node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode validate-ledger --ledger <ledger>`
   to prove every defect record is well-formed, then
   `--mode retest-coverage --evidence <log> --ledger <ledger>` to prove every
   failure has a defect record and every `requires-retest` defect has a later
   passing retest on a genuinely different candidate SHA.
8. A rehearsal pass is complete for #2928's purposes only when every defect has a
   terminal disposition (`resolved`, `formally-dispositioned-accepted-risk`) or an
   explicit `deferred-with-owner` disposition — never left unclassified.
9. Prove cleanup and rollback: confirm every journey's `cleanup` step from the
   #2927 registry was actually performed, and that the rehearsal environment's
   rollback path was exercised and restored a known-good state (per #2927's
   `ops-rollback-recovery` scenario).

## Defect taxonomy

| Severity | Meaning | Blocks #2929 GO recommendation? |
| --- | --- | --- |
| `launch-blocker` | Breaks a required journey outright or exposes private/secret data | Yes, until `resolved` or explicitly accepted-risk by Product Authority |
| `major` | Degrades a required journey without breaking it (wrong content, slow, partial failure) | Only if left with no terminal or deferred disposition |
| `minor` | Cosmetic or non-blocking defect | No, but still must be dispositioned (never silently dropped) |

## Defect disposition vocabulary

| Disposition | Meaning | Requirements |
| --- | --- | --- |
| `resolved` | Fixed and reverified | Must cite `evidenceRef` |
| `formally-dispositioned-accepted-risk` | Product Authority accepts the risk without a fix | Must cite `evidenceRef` (the acceptance record) |
| `requires-retest` | Fix attempted or pending; needs a retest against a requalified candidate | Retest-coverage audit requires a later passing evidence entry on a different candidate SHA |
| `deferred-with-owner` | Explicitly deferred per #2781's "explicit deferred/fallback dispositions" requirement | Must cite `deferredOwner` |

## Remediation routing

- `launch-blocker` and `major` defects route to a bounded remediation PR (normal
  reviewed change, self-approval/self-merge prohibited, same as every other PR in
  this repository) targeting `component/launch-rehearsal` for rehearsal-asset-only
  changes, or the relevant product component branch if the defect is in product
  code rather than rehearsal tooling.
- `minor` defects may be batched into the same remediation PR as a related
  `major`/`launch-blocker` fix, or dispositioned `deferred-with-owner` if fixing
  them is out of scope for launch readiness.
- No defect is silently dropped: `validate-ledger` fails closed on any defect
  missing a disposition, and `retest-coverage` fails closed on any `fail` evidence
  entry with no matching defect record at all.

## Retest procedure and candidate-drift protection

A `requires-retest` defect is only closed out once `retest-coverage` finds a later
evidence entry for the same journey with `result: 'pass'` on a **different**
`candidateSha`. A later pass on the *same* SHA is explicitly rejected — see the
"hidden-candidate-drift case" test in `tests/launch-rehearsal-defect-ledger.test.mjs`
— because that would mean the candidate was silently mutated in place rather than
going through the recorded rebuild/requalification step #2781's work unit 6
requires. This is the mechanical enforcement of #2928's acceptance criterion "no
candidate drift is hidden."

## What #2929 inherits from this task

- A validated defect-ledger schema and `retest-coverage` harness, ready to prove
  (not merely assert) that every launch blocker found during #2928's formal
  execution was either resolved, formally accepted, or explicitly deferred with an
  owner, before #2929 cites that evidence in its GO/HOLD/ADJUSTMENT/NO-GO
  recommendation.

## Validation

- `npx vitest run tests/launch-rehearsal-defect-ledger.test.mjs` — all tests passing.
- `node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode validate-ledger --ledger <sample>` — verified `ok: true` on a compliant ledger and fails closed on a malformed one.
- `node scripts/ci/launch_rehearsal_defect_ledger.mjs --mode retest-coverage --evidence <sample> --ledger <sample>` — verified it correctly rejects a same-SHA "retest" as uncovered.
