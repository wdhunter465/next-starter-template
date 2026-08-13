---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Program Contract
Status: Active — #2679 Phase 2 collector/publisher landed; baseline observation continues
Source Issue: #2679
Owns: Workflow transition SLO definitions, authoritative evidence mapping, measurement rules, breach taxonomy, and daily 5 PM ET report schema for the LGFC continuous implementation chain
Does Not Own: Automatic merge to main, Production mutation, protected-decision substitution, or weakening of approval boundaries to meet targets
Canonical Reference: /docs/ops/reports/workflow-transition-slo-2679.md
Related Issues: #2679, #2676, #2677, #2682, #3212, #3241, #3278, #3288, #3298
Last Reviewed: 2026-08-10
Executor: Cursor Local
---

# Workflow Transition SLO and Daily Performance Report (#2679)

## Purpose

Define and operate a service-level objective for the LGFC continuous implementation workflow. Measure time between authoritative state transitions so silent idle periods are visible and actionable.

The SLO measures the **full operating chain**, not runner uptime alone.

## Scope

**In scope**

- Transition definitions with authoritative start/end evidence sources.
- Measurement rules (holds, protected waits, missing evidence, dedupe).
- Daily 5:00 PM America/New_York report schema and scorecard.
- Instrumentation gap register (missing evidence → bounded defect, not false pass).
- Two-week observation baseline plan.

**Out of scope**

- Authorization to auto-merge to `main` or bypass protected decisions.
- Weakening CI, review, or approval gates to improve scores.
- Live Production D1/B2 mutation.
- Claiming two-week baseline completion in this document revision.

## Current known truth

- Source defect #2676 and controller project #2677 are closed; continuous-loop controller evidence exists in repository workflows and contracts.
- Cursor Local Bridge automatic wake is **retired** as an execution dependency (#3212 Phase 4). Primary wake is GitHub Actions `lgfc-cursor-dispatch` on runner label `lgfc-cursor`. Host Bridge remain available only for residual local evidence; routine Bridge ACK/STARTED/COMPLETED Issue comments remain prohibited.
- Wake delivery: `.github/workflows/lgfc-cursor-dispatch.yml` (primary) and residual `.github/workflows/cursor-local-wake.yml` paths where still present.
- PR process metrics exist for closed/merged PRs (`.github/workflows/ops-pr-process-metrics.yml`) but do **not** yet cover the full transition chain in #2679.
- Phase 2 collector/publisher: `scripts/ops/workflow-transition-slo-report.mjs` + `.github/workflows/ops-workflow-transition-slo-report.yml` (dispatch + daily cron). How-to: `docs/how-to/ops/workflow-transition-slo-daily-report.md`.

## Intended final state

- Every listed transition has a deterministic start and end timestamp from repository-native or Bridge-local evidence.
- A daily report can be generated without human reconstruction of timelines.
- Breaches name exact Issue/PR, timestamps, owner class, and corrective action or follow-up Issue.
- Holds and protected-decision waits are scored separately from avoidable idle.
- Missing instrumentation surfaces as explicit measurement failure.

---

## 1. Transition catalog and evidence mapping

Each transition is a single SLO transaction. Start is the **first authoritative event**, not when a watcher notices it. End is the first matching completion signal. Deduplicated retries share the original transaction id.

| ID | Transition | Target | Start evidence (authoritative) | End evidence (authoritative) | Primary owner class |
| --- | --- | ---: | --- | --- | --- |
| T1 | Wake event → runner delivery ack | ≤ 2 min | Authoritative start is exactly one concrete timestamp chosen by trigger class: (a) when wake is label-driven, the GitHub Issues `labeled` event `created_at` that first establishes both `agent:cursor` and `handoff:ready` on the Issue; or (b) when wake is manually forced, the `workflow_dispatch` run `created_at`. Do not use a later-of tie-break between label and dispatch events. Collectors must use the recorded event or run timestamp, not a reconstructed “when labels become jointly true” inference. | End is the successful completion of the active wake delivery job: prefer `lgfc-cursor-dispatch.yml` delivery/complete job `completed_at` after #3212 Phase 4; residual `cursor-local-wake.yml` job named **`deliver`** `conclusion=success` remains valid for historical samples. Do not invent a generic “any wake job” name. Phase 2 collector may temporarily use workflow-run duration as an explicit proxy and must label that proxy in sample rationale. | runner/host |
| T2 | Runner delivery ack → Bridge start or explicit fallback | ≤ 2 min | Wake job success / packet or dispatch claim write completion timestamp | Local runner/dispatch accept evidence **or** actionable `CURSOR BRIDGE FALLBACK:*` Issue comment created_at. After #3212, prefer dispatch-runner accept evidence over retired Bridge automatic-wake paths. | Bridge/auth/capacity / dispatch runner |
| T3 | Cursor handoff / PR-review request → controller acknowledgment | ≤ 5 min | Canonical Cursor `IMPLEMENTATION HANDOFF` comment or equivalent PR-ready marker on source Issue (`created_at`) | Controller review-packet comment or deterministic controller workflow run start that binds that Issue/PR head SHA | controller/dispatcher |
| T4 | Bounded actionable review finding → Cursor remediation resume | ≤ 10 min | First unresolved actionable review-thread comment on current head (human or trusted bot disposition required) `created_at` | Source-Issue routing labels re-applied for Cursor (`handoff:ready`+`agent:cursor`) **or** wake workflow run created for that Issue after the finding | review defect / controller |
| T5 | Clean authorized component PR → component-branch integration | ≤ 15 min | Component Integration Eligibility check conclusion `success` at head SHA **and** no unresolved human CHANGES_REQUESTED | PR `merged_at` into `component/**` | CI/checks + controller |
| T6 | Component integration → verified merge reconciliation | ≤ 10 min | PR `merged_at` | Post-merge verification workflow success for that merge SHA **or** source Issue transition to `status:post-merge-verify` then reconciled close/complete evidence | CI/checks |
| T7 | Verified child completion → successor activation and wake | ≤ 10 min | Child source Issue marked complete/reconciled (`closed_at` or `status:complete`) | Successor Issue receives required routing labels and wake workflow run created | controller/dispatcher |
| T8 | Bridge auth/capacity failure → deduplicated operator alert | ≤ 5 min | First Bridge/local evidence of auth or capacity failure for a delivery id | Single deduplicated operator-visible alert (Issue comment or ops fault) for that failure class/window | Bridge/auth/capacity |

### Evidence priority

1. GitHub-native timestamps (event, workflow run, check run, PR, review thread, Issue).
2. Bridge local structured evidence when GitHub-visible lifecycle comments are prohibited by contract.
3. Explicit measurement failure if neither class is available.

### Explicit non-evidence

- Human memory or chat transcript times.
- Poll-loop “noticed at” times.
- Synthetic keepalive comments.
- Inferred times from missing fields.

---

## 2. Measurement rules

1. **Authoritative first event** — transaction start is the first qualifying event time, not rediscovery.
2. **HOLD exclusion** — wall time under an explicit authorized `HOLD` (documented label, status, or Product Authority hold comment) is excluded from compliance scoring and reported as `hold_duration_seconds` separately.
3. **Protected-decision wait** — time waiting on Product/rights/legal/Bill decision is classified `protected_decision` and excluded from avoidable-idle totals; still reported.
4. **Avoidable controller idle** — executable work existed (labels/status/PR green) and no HOLD/protected block, yet no controller transition occurred within target.
5. **Missing evidence** — score as `measurement_failure` for that transition; never count as pass.
6. **Dedupe** — retries for the same delivery id / resume / head SHA do not open a new SLO transaction; attach as retry count on the original.
7. **Safety floor** — meeting an SLO must never require skipping required checks, unresolved review threads, or protected approvals.

---

## 3. Availability and throughput indicators (daily)

| Indicator | Evidence source |
| --- | --- |
| Wake-delivery success rate | `cursor-local-wake` conclusions / eligible labeled Issues |
| Bridge validation and launch success rate | Local Bridge launch transactions; fallback comments |
| Authentication/capacity failures | Fallback taxonomy + preflight results |
| Duplicate/stale suppressions | Controller/Bridge dedupe logs and suppressed-event evidence |
| Median and max transition times | Computed from T1–T8 samples in the reporting window |
| Cursor execution time | Bridge accept→complete local evidence where available |
| Cursor idle while executable work existed | Derived: eligible open work intervals minus execution and HOLD/protected |
| Completed Issues / merged PRs | GitHub Issue/PR state in window |
| Bounded-remediation count | Review disposition → resume transactions |
| Post-merge exception count by category | Post-merge exception Issues/labels |
| Transitions requiring Bill | Escalation comments / protected stops |
| Routine transitions without Bill | Controller completions without Bill actor |

---

## 4. Root-cause classification

Every breach and measurement failure is tagged with exactly one primary class:

| Code | Meaning |
| --- | --- |
| `runner_host` | Self-hosted runner offline, queue write failure, host capacity |
| `bridge_auth_capacity` | Bridge down, auth, capacity, preflight |
| `cursor_execution` | Cursor accepted but exceeded execution expectations |
| `ci_checks` | Required checks pending/failed |
| `review_defect` | Actionable review finding path |
| `controller_dispatcher` | Controller did not advance eligible work |
| `protected_decision` | Waiting on human Product/rights/legal/Bill authority |
| `repository_contract_defect` | Missing instrumentation, wrong labels, contract mismatch |

---

## 5. Daily 5:00 PM America/New_York report schema

Publish window: **17:00–17:30 America/New_York** for the prior 24 hours ending 17:00 ET (or calendar day 00:00–17:00 ET on first report — state which).

### Required sections

1. **Header** — report date, window start/end (ISO-8601 with offset), generator identity, data completeness flag.
2. **SLO scorecard** — one row per T1–T8: samples, compliance %, median, p95, max, breaches.
3. **Breaches** — Issue/PR number, transition id, start/end timestamps, duration, owner class, link.
4. **Root-cause rollup** — counts by classification code.
5. **Avoidable Cursor idle** — total minutes and top contributing Issues.
6. **Corrective actions** — already taken vs new bounded Issue required (number if created).
7. **Trend** — vs prior available report (compliance delta per transition).
8. **Measurement failures** — transitions lacking evidence (instrumentation defects).

### Publication targets (implementation order)

1. Durable markdown under `docs/ops/reports/daily/` (or ops artifact upload) — preferred for audit.
2. Optional Issue comment on a standing ops report Issue once automation exists.
3. Scheduled GitHub Actions job on `ubuntu-latest` at **17:00 America/New_York** year-round (`cron: '0 17 * * *'` + `timezone: 'America/New_York'` in `.github/workflows/ops-workflow-transition-slo-report.yml`) — **protected path**. Workflow introduction/review: Phase 2 via #3278; DST-correct schedule remediation: #3288 (closes the prior UTC-only `21:00` winter drift).

---

## 6. Instrumentation gap register (Phase 1)

| Gap | Impacted transitions | Required remediation |
| --- | --- | --- |
| No GitHub-visible Bridge/dispatch accept timestamp by design | T2 | Export accept timestamps via artifact/API or controlled ops signal without restoring prohibited routine comments |
| Wake job success not always correlated to Issue in queryable form | T1 | Ensure wake/dispatch workflow summary includes issue number + delivery id in job summary/artifact |
| Controller acknowledgment not uniformly schema’d | T3 | Standard review-packet marker or workflow output binding Issue+PR+SHA |
| Successor activation not always timestamp-linked to parent close | T7 | Require activation comment or label event with parent issue reference |
| Scheduled daily publisher | Report | **Phase 2 landed** — `.github/workflows/ops-workflow-transition-slo-report.yml` + collector script; **DST-correct 17:00 America/New_York schedule landed via #3288**; durable `docs/ops/reports/daily/` commit path remains an optional follow-up |
| PR process metrics cover merge checks only | T5–T6 partial | Extend collector correlation (eligibility check → merge → post-merge verify) |

Until gaps close, affected transitions report `measurement_failure` rather than green compliance.

---

## 7. Two-week observation plan

| Week | Focus |
| --- | --- |
| Days 1–3 | Merge this contract; list live evidence availability per transition |
| Days 4–10 | Collect samples; open bounded Issues for each persistent instrumentation gap |
| Days 11–14 | Publish baseline percentiles, failure taxonomy frequencies, proposed target revisions |

Initial compliance objective for **deterministic non-protected** transitions with complete evidence: **≥ 90%** within target. Do not dilute safety to hit the number.

---

## 8. Acceptance mapping (#2679)

| Criterion | Status in this revision |
| --- | --- |
| Every SLO transition has authoritative start/end evidence defined | **Met** (catalog §1); live completeness tracked in gap register |
| Deterministic report generable from repository state | **Partial → Phase 2** — collector emits scorecard; several transitions still `measurement_failure` until gaps close |
| Holds and protected waits separated from avoidable delay | **Met** in measurement rules |
| Daily reports identify exact breaches and owners | **Schema + publisher met**; breach rows depend on measured samples |
| Missing instrumentation → bounded defect, not false pass | **Met** |
| Two-week baseline and recommendation produced | **In progress** — #2679 reopened under `status:remediation` after premature Phase 2 closeout (#3288); observation/baseline continues until two weeks of published scorecards + recommendation |
| SLO does not authorize auto-merge to main or bypass protected decisions | **Met** (explicit non-goal) |

---

## 9. Follow-up work

### Phase 2 (this increment)

1. `scripts/ops/workflow-transition-slo-report.mjs` + offline self-test harness.
2. How-to: `docs/how-to/ops/workflow-transition-slo-daily-report.md`.
3. Scheduled/manual workflow: `.github/workflows/ops-workflow-transition-slo-report.yml`.
4. Remap T1/T2 evidence notes for `#3212` dispatch cutover.

### Remaining

1. Close instrumentation gaps in §6 with bounded Issues (job-level T1 end, T2 accept export, T3–T4/T7–T8 correlation, T5/T6 eligibility→verify linkage).
2. After two weeks of published scorecards, revise targets with observed percentiles (baseline **in progress** on #2679; do not close solely on Phase 2 / #3288 schedule remediation).
3. Optional: durable commit path under `docs/ops/reports/daily/` (DST-correct schedule already landed in #3288).

---

## 10. Rollback

Revert collector, how-to, workflow, and this document via reviewed PR. Runtime site behavior is unchanged.

---

*End of #2679 SLO contract (Phase 2 collector/publisher).*
