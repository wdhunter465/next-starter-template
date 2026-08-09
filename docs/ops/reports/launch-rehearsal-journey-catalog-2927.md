---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2927 (#2781 Task 002) journey catalog, automation, evidence model, and approved scenario set for the integrated launch rehearsal
Does Not Own: Candidate/environment identity (#2926); formal rehearsal execution/results (#2928); final GO/HOLD/ADJUSTMENT/NO-GO disposition (#2929)
Canonical Reference: /docs/ops/reports/launch-rehearsal-journey-catalog-2927.md
Related Issues: #2927, #2781, #2926, #2928, #2929
Last Reviewed: 2026-08-08
---

# Launch rehearsal journey catalog, automation, and scenarios — #2927

## Purpose

Deliver #2927 (#2781 Task 002): the journey catalog, automation harness, evidence
model, and approved scenario set the integrated launch rehearsal executes against,
so #2928 has a complete, tested, machine-checkable basis for formal execution
instead of deriving one from scratch.

## Scope

Covers journey design, the completeness-automation harness, the evidence-log shape,
and the approved failure/monitoring/rollback/recovery/communication/stop/resume
scenario tables for the rehearsal defined in #2781. It does not cover #2926's
candidate/environment identity, #2928's actual rehearsal execution/results, or
#2929's final GO/HOLD/ADJUSTMENT/NO-GO disposition — each of those is owned by its
own task and, where applicable, its own future report.

## Current known truth

- The registry (`docs/ops/reports/launch-rehearsal-journey-registry-2927.json`)
  contains 22 journeys, one or more per each of the 7 required categories from
  #2781's "Required journeys" list, and passes `launch_rehearsal_harness.mjs --mode
  validate-registry` with zero defects as of this document's `Last Reviewed` date.
- No formal rehearsal journey has been executed against a live candidate. #2926's
  candidate/environment identity is not yet accepted, so every journey's
  `executionPath` describes a *repeatable safe* path, not a completed run.
- The scenario tables reflect #2781's and #2927's own already-recorded protected-stop
  and rollback language; they are not new policy invented by this document.

## Non-blocking prerequisite rule

Per #2927's non-blocking prerequisite rule, this document and its companion
registry/harness are **journey design, automation scaffolding, and evidence-template
work** — the collision-safe category of work #2927 explicitly authorizes before
#2926's candidate/environment identity is accepted. `#2928` owns formal execution;
this deliverable only builds what #2928 will run against and how its results will be
proven complete.

## Journey catalog

The full, machine-readable catalog is `docs/ops/reports/launch-rehearsal-journey-registry-2927.json`
(22 journeys as of this PR). Every entry carries the fields #2927's acceptance
criteria require — expected result, evidence, owner, privacy control, cleanup,
defect routing, and a repeatable safe execution path — and `scripts/ci/launch_rehearsal_harness.mjs`
proves this deterministically (see Automation below) rather than by inspection alone.

Journeys are grouped into the seven categories from #2781's "Required journeys" list:

| Category | Journeys (registry `id`) | #2781 source line |
| --- | --- | --- |
| `anonymous` | `anon-home-browse`, `anon-search`, `anon-error-fallback` | "anonymous home/information/search/navigation and error/fallback behavior" |
| `membership` | `member-join-login`, `member-logout-session-expiry`, `member-unauthorized-access` | "join/login/logout/session/member access and unauthorized handling" |
| `fanclub` | `fanclub-profile-card`, `fanclub-gallery-photo`, `fanclub-library`, `fanclub-memorabilia`, `fanclub-discussion-submission` | "Fan Club profile/card, gallery/photo, library, memorabilia, discussion/submission paths" |
| `content` | `content-media-rights-attribution`, `content-publication-takedown` | "content/media source, rights, attribution, publication, and takedown controls" |
| `communications` | `email-notification-success`, `email-notification-failure-contingency` | "email/notification success and failure contingencies" |
| `fundraiser` | `fundraiser-enabled-state`, `fundraiser-disabled-state` | "fundraiser enabled/disabled state and approved external-provider boundary" |
| `operations` | `ops-deployment-monitoring`, `ops-incident-intake`, `ops-rollback-recovery`, `ops-operator-communication`, `ops-evidence-closeout` | "deployment, monitoring, incident intake, rollback/recovery, operator communication, and evidence closeout" |

Each journey's full field set (expected result, evidence, owner, privacy control,
cleanup, defect routing, execution path) lives in the registry JSON, not duplicated
here, so there is exactly one source of truth #2928 executes against.

## Automation

`scripts/ci/launch_rehearsal_harness.mjs` is the automation and "repeatable safe
execution path" deliverable. It is read-only and side-effect free in both modes:

- `--mode validate-registry` (default): proves every journey carries all ten
  required fields, has a unique non-empty `id`, and belongs to one of the seven
  approved categories, and that every category has at least one journey. This is
  what makes "each journey has an expected result, evidence, owner, privacy
  control, cleanup, defect routing, and repeatable safe execution path" a
  CI-checked fact instead of a claim.
- `--mode evidence-audit --evidence <path>`: once #2928 executes journeys and
  produces an evidence log (one entry per executed journey `id`), this mode
  cross-checks it against the registry and reports any journey missing evidence
  or any evidence entry with no matching registry journey. This is the exact
  check #2929 needs before it can cite "complete evidence" in its final
  disposition.

Unit tests: `tests/launch-rehearsal-harness.test.mjs` (17 tests, covers both modes
and the committed registry file itself).

## Evidence model

Each journey's `evidence` field in the registry describes what a single executed
run must capture. The common shape for #2928's future evidence log entries:

```json
{
  "journeyId": "anon-home-browse",
  "candidateSha": "<unchanged rehearsal candidate SHA>",
  "environment": "<isolated preview/staging environment identity>",
  "executedAt": "<ISO-8601 UTC timestamp>",
  "actorRole": "<recorded operator/actor role>",
  "result": "pass | fail | blocked",
  "evidenceRef": "<link or path to the captured artifact — screenshot, response capture, log excerpt>",
  "defectRef": "#<issue> | not-applicable",
  "cleanupConfirmed": true
}
```

This mirrors #2781's validation requirement: "Every journey records
candidate/environment, timestamp, actor role, result, evidence, defect link, and
cleanup." `auditEvidence()` only requires `journeyId` to cross-check completeness;
the remaining fields are the human-readable record #2929 cites.

## Approved scenarios

These scenario classes are drawn directly from #2781's and #2927's own protected-stop
and rollback language — this document does not invent new policy, it operationalizes
the existing one into a scenario/response table for #2928 to execute against.

### Failure-injection scenarios

| Scenario | Trigger | Expected response | Stop condition |
| --- | --- | --- | --- |
| Forced provider unavailability (notification) | Mock/force the notification provider into a failure state (`email-notification-failure-contingency`) | Triggering action completes; failure is recorded via a defined fallback/queue/retry, never a silent drop | Silent drop with no recorded contingency |
| Forced unauthenticated access attempt | Scripted request to a member-only route with no session (`member-unauthorized-access`) | Deterministic rejection (redirect/401/403), never partial content | Any private/member data returned |
| Forced invalid route | Scripted request to a nonexistent/degraded route (`anon-error-fallback`) | Deterministic sanitized fallback/error UI | Any stack trace, secret, or internal path leaks |

### Monitoring scenarios

| Scenario | Trigger | Expected response |
| --- | --- | --- |
| Rehearsal deployment/update | A rehearsal-environment deployment action (`ops-deployment-monitoring`) | Change is observable in the monitoring surface within the expected window, reusing the existing production-health-collector pattern pointed at the rehearsal environment |
| Synthetic failure signal | A synthetic unhealthy check result (`ops-incident-intake`) | Routed to a deduplicated Operations Issue (or rehearsal-scoped equivalent) — no silent drop, no duplicate spam, reusing `scripts/ci/ops_runtime_escalation.mjs`'s existing idempotent upsert primitive |

### Rollback and recovery scenarios

| Scenario | Trigger | Expected response | Stop condition |
| --- | --- | --- | --- |
| Rehearsal-environment rollback | Trigger the rehearsal rollback path (`ops-rollback-recovery`) | Environment restored to pre-change state with no residual synthetic taint, proven via before/after state comparison | Rollback does not fully restore state — protected stop: unavailable recovery ownership |

### Communication scenarios

| Scenario | Trigger | Expected response | Stop condition |
| --- | --- | --- | --- |
| Rehearsal event requiring operator notification | Simulated failure event (`ops-operator-communication`) | Expected operator-facing notification fires via approved non-secret channels | Any credential, token, or secret value appears in a communication payload — immediate protected stop |

### Stop scenarios

Per #2927/#2928's recorded protected stops, execution of the *affected action only*
(not the whole rehearsal) halts immediately for: unsafe failure injection,
private/secret exposure, candidate drift, unavailable recovery ownership, failed
critical checks, real collision, or unauthorized Production mutation. No journey in
the registry authorizes any Production mutation or use of real member/Production
data — every journey's `privacyControl` field states its synthetic/redacted-data
boundary explicitly.

### Resume scenarios

Once the specific stop condition is corrected and confirmed (e.g. contingency
recorded, secret redacted, candidate re-qualified), only the affected journey
resumes — an unrelated journey's pass/fail status from before the stop is not
invalidated or re-run. This mirrors #2928's acceptance criterion that "failed
journeys are retested against a requalified candidate" without requiring a full
rehearsal restart.

## What #2928 inherits from this task

- The registry file and its 22 journeys, ready to execute once #2926's candidate/
  environment identity is accepted.
- `launch_rehearsal_harness.mjs --mode evidence-audit`, ready to prove evidence
  completeness the moment #2928 produces an evidence log.
- The scenario tables above, ready to drive #2928's failure-injection, monitoring,
  rollback, recovery, communication, stop, and resume execution without
  re-deriving policy from #2781/#2927 from scratch.

## Validation

- `npx vitest run tests/launch-rehearsal-harness.test.mjs` — 17/17 passing.
- `node scripts/ci/launch_rehearsal_harness.mjs --mode validate-registry` — `ok: true`, 22 journeys, zero defects, zero duplicate ids, zero missing categories.
- `node scripts/ci/launch_rehearsal_harness.mjs --mode evidence-audit --evidence <path>` — verified to fail closed (exit 1) on an incomplete evidence log and pass on a complete one.
