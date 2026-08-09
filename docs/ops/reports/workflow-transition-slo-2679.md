---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Program Contract
Status: Active — #2679 Phase 1 instrumentation contract
Source Issue: #2679
Owns: Workflow transition SLO definitions, authoritative evidence mapping, measurement rules, breach taxonomy, and daily 5 PM ET report schema for the LGFC continuous implementation chain
Does Not Own: Automatic merge to main, Production mutation, protected-decision substitution, or weakening of approval boundaries to meet targets
Canonical Reference: /docs/ops/reports/workflow-transition-slo-2679.md
related issues: #2679, #2676, #2677, #2682
Last Reviewed: 2026-08-09
Executor: Grok
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
- Cursor Local Bridge is delivery + mechanical launch control (`docs/reference/ci/cursor-local-bridge-contract.md`). Routine Bridge ACK/STARTED/COMPLETED Issue comments are **prohibited**; shared lifecycle is Issue labels/status + Cursor handoff comments + local Bridge evidence.
- Wake delivery: `.github/workflows/cursor-local-wake.yml` + `lgfc-repo-runner`.
- PR process metrics exist for closed/merged PRs (`.github/workflows/ops-pr-process-metrics.yml`) but do **not** yet cover the full transition chain in #2679.
- No repository-native scheduled 5 PM ET SLO publisher existed at contract authoring time.

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
| T1 | Wake event → runner delivery ack | ≤ 2 min | GitHub `issues` labeled event time when `agent:cursor`+`handoff:ready` become jointly true, or authorized `workflow_dispatch` run `created_at` | Wake workflow job step that writes host queue packet completes successfully (`cursor-local-wake` job completion with success) | runner/host |
| T2 | Runner delivery ack → Bridge start or explicit fallback | ≤ 2 min | Wake job success / packet write completion timestamp | Local Bridge claim/accept evidence (`claim.json` / `in-flight.json` acceptedAt) **or** actionable `CURSOR BRIDGE FALLBACK:*` Issue comment created_at | Bridge/auth/capacity |
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
3. Scheduled GitHub Actions job on `ubuntu-latest` at 21:00 UTC (approx 17:00 ET standard) / 22:00 UTC (EDT) — **protected path**; requires separate reviewed workflow PR.

This contract does **not** enable that workflow by itself.

---

## 6. Instrumentation gap register (Phase 1)

| Gap | Impacted transitions | Required remediation |
| --- | --- | --- |
| No GitHub-visible Bridge start timestamp by design | T2 | Export accept timestamps via artifact/API or controlled ops signal without restoring prohibited routine comments |
| Wake job success not always correlated to Issue in queryable form | T1 | Ensure wake workflow summary includes issue number + delivery id in job summary/artifact |
| Controller acknowledgment not uniformly schema’d | T3 | Standard review-packet marker or workflow output binding Issue+PR+SHA |
| Successor activation not always timestamp-linked to parent close | T7 | Require activation comment or label event with parent issue reference |
| No scheduled daily publisher | Report | Follow-up implementation Issue under Operations after this contract merges |
| PR process metrics cover merge checks only | T5–T6 partial | Extend collector or separate SLO collector script |

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
| Deterministic report generable from repository state | **Partial** — schema defined; collector/publisher is follow-up |
| Holds and protected waits separated from avoidable delay | **Met** in measurement rules |
| Daily reports identify exact breaches and owners | **Schema met**; first automated publication is follow-up |
| Missing instrumentation → bounded defect, not false pass | **Met** |
| Two-week baseline and recommendation produced | **Not yet** — plan only |
| SLO does not authorize auto-merge to main or bypass protected decisions | **Met** (explicit non-goal) |

---

## 9. Follow-up work (not this PR)

1. Implement `scripts/ci/workflow_transition_slo_report.mjs` (or ops path) to compute T1–T8 from GitHub API + optional Bridge export.
2. Add scheduled workflow (protected review) for 5 PM ET publication.
3. Close instrumentation gaps in §6 with bounded Issues.
4. After two weeks, revise targets with observed percentiles.

---

## 10. Rollback

Revert this document via reviewed PR. No runtime behavior changes in this increment.

---

*End of #2679 Phase 1 SLO contract.*
