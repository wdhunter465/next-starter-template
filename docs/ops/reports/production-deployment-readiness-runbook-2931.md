---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2931 (#2782 Task 002) change window, role, preflight, communications, credential-boundary, smoke/complete-test, stop-trigger, and rollback runbook
Does Not Own: The candidate manifest (#2930, owned by that report); actual Production execution (#2932, separately protected); post-deployment verification/closeout (#2933)
Canonical Reference: /docs/ops/reports/production-deployment-readiness-runbook-2931.md
Related Issues: #2931, #2782, #2930, #2932, #2933, #2929, #2781, #2776, #2777, #2783, #2786, #2787, #2785, #2860, #2913, #3268, #2780
Last Reviewed: 2026-08-14
---

# Production deployment preflight runbook — #2931

## Purpose

Deliver #2931 (#2782 Task 002): the change window, executor/verifier role
definitions, preflight checklist, communications plan, credential boundary,
smoke/complete test plans, explicit stop triggers, rollback candidate, and
recovery owner — so #2932's actual deployment execution follows a pre-agreed,
testable procedure instead of improvising any of these under time pressure.

## Scope

Covers deployment preparation only: the preflight record schema/harness below,
role/communication/stop/rollback definitions, and the smoke/complete test plan
structure. It does not cover #2930's candidate manifest (only consumes its
`candidateSha`), does not execute any Production action, and does not cover
#2932's actual deployment or #2933's post-deployment verification/closeout —
each is owned by its own task.

## Current known truth

- Predecessor project #2781 is COMPLETE after #2929 / merged PR #3445. The
  recorded rehearsal disposition is **GO** for bounded #2782 non-Production
  preparation on the unchanged frozen candidate
  `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` (Pages Preview
  `05568c3e-a56f-45d0-a3db-1298d9b7b80c`, D1 `lgfc-litedev` /
  `35232809-b4c1-4df9-9f39-2f178b13c378`). That GO is **not** Product Authority
  Production Go.
- Nine of twelve preflight fields now have citation-backed content. The three
  remaining empty fields in
  `docs/ops/reports/production-deployment-preflight-record-2931.json` are
  `changeWindowStart`, `changeWindowEnd`, and `rollbackCandidateSha`.
- Running that real record through
  `scripts/ci/production_deployment_preflight_readiness.mjs` is expected to
  report `ready: false` / `preflight_incomplete` because those three fields are
  empty. That is the correct fail-closed verdict: a scheduled Production window
  and a distinct already-deployed Production rollback SHA are not recorded, and
  inventing them would fabricate readiness.
- #2776, #2777, #2783, #2786, and #2787 remain explicit unresolved protected
  Pipeline intake decisions. They are not waived.
- This document does not authorize deployment, Production mutation, or
  credential use of any kind.

## Intended final state

After Product Authority records Production Go and a bounded change window, and
after a distinct last-accepted Production SHA is recorded as the rollback
target, the three remaining empty fields are filled with those exact values and
the harness is re-run. The schema and the nine already-filled fields are not
expected to change for that step.

## Non-blocking prerequisite rule

Per #2931's non-blocking prerequisite rule and the 2026-08-14 PMO release,
collision-safe preparation continues after #2929 GO. Protected Production items
that are not yet authorized are left empty rather than invented. No Production
authorization is implied.

## Preflight record — required fields

| Field | Purpose |
| --- | --- |
| `changeWindowStart` / `changeWindowEnd` | Exact, bounded deployment window — no open-ended change window |
| `executorRole` | Who performs the deployment (a role, not necessarily a name) |
| `verifierRole` | Who independently confirms live behavior — must not be the same actor as `executorRole` performing unverified self-checks |
| `preflightChecklistEvidence` | Citation to the completed preflight checklist run |
| `communicationPlan` | Pre/during/post-deployment communication channels and audiences |
| `credentialBoundaryStatement` | Exactly which credentials are used and confirmation they never appear in Issues/PRs/logs/reports |
| `smokeTestPlan` | Immediate post-deploy smoke tests: public, auth/member, content/data/media, email/fundraiser state, monitoring, failure behavior (per #2782 work unit 5) |
| `completeVerificationPlan` | Complete post-deployment verification plan (#2782 work unit 6) |
| `stopTriggers` | Explicit conditions that halt deployment before/during execution |
| `rollbackCandidateSha` | The already-qualified candidate to roll back to — must differ from the deployment candidate |
| `recoveryOwner` | Named accountable owner for executing rollback/recovery |

## Readiness harness

`scripts/ci/production_deployment_preflight_readiness.mjs` validates a preflight
record against the schema above and, when given `--manifest` pointing at #2930's
candidate manifest JSON, cross-checks that `rollbackCandidateSha` differs from
the manifest's `candidateSha` — the mechanical enforcement of "no untested
recovery path": a rollback target identical to what's being deployed cannot
recover anything.

```bash
node scripts/ci/production_deployment_preflight_readiness.mjs \
  --preflight preflight-record.json \
  --manifest candidate-manifest.json
```

## Stop-trigger reference

Per #2782's own recorded stop and rollback rules, deployment stops before or
during execution for: candidate drift, failed preflight, missing authority,
binding/configuration mismatch, failed critical smoke test, security/privacy
exposure, data integrity risk, unavailable recovery owner, or monitoring
failure. This runbook does not invent new stop conditions — `stopTriggers` in
the real preflight record cites this list plus any deployment-specific
additions.

## Policy-level field content (stable; prepared now)

Seven of the twelve required fields (`executorRole`, `verifierRole`,
`communicationPlan`, `credentialBoundaryStatement`, `smokeTestPlan`,
`completeVerificationPlan`, `stopTriggers`) describe a **role or procedure**,
not a specific deployment instance. Those seven were prepared in PR #3412.
Two further instance-bound fields are now filled from recorded authority
(#2929 evidence and `docs/governance/AGENT-TEAM.md`). The remaining three
(`changeWindowStart`, `changeWindowEnd`, `rollbackCandidateSha`) stay empty
because they still require Production Go and a distinct last-accepted
Production SHA.

**`executorRole`:** The Team:PMO implementation agent (Cursor Local or Claude
Code) holding an explicit, recorded Bill/Product Authority Production-dispatch
authorization naming this exact candidate SHA. Self-approval/self-merge
remains prohibited regardless of which agent executes.

**`verifierRole`:** An actor distinct from whoever fills `executorRole` for
this run — a different agent identity, or Bill directly — who independently
confirms live post-deploy behavior against #2932's six smoke-test categories.
The verifier does not perform the deployment and does not mark its own
smoke-test evidence accepted; this mirrors the repo's existing builder/
reviewer separation rule rather than inventing a new one.

**`communicationPlan`:** This project runs entirely on GitHub Issues/PR
comments — there is no separate status page, chat channel, or paging system
in scope (#2785's transactional-email project covers member-facing email
only, not an internal deployment channel). Concretely:
- *Pre-deployment:* the accepted #2930 candidate manifest and this runbook's
  filled instance fields are posted to #2932 before execution begins.
- *During:* no mid-deployment public communication channel exists or is
  authorized. Internal status is the #2932 Issue thread itself, updated at
  each stop-trigger checkpoint (Stop-trigger reference, above) as it is
  reached.
- *Post-deployment:* immediate smoke-test results are posted to #2932 per its
  own result-record schema; complete verification, stabilization, and Day-2
  handoff are posted to #2933 per its closeout template.
- No user-facing outage-notice channel exists today. If deployment risk ever
  requires one, that is a new decision outside #2931's scope — not something
  this plan assumes into existence.

**`credentialBoundaryStatement`:** Deployment/candidate-identity actions and
`smokeTestPlan`'s six categories (below) do not share one credential set —
stating a single "exactly four secrets" boundary across both would itself be
the inconsistency this field exists to prevent. Three existing, already-used
secret groups are in scope, all reused unchanged with no new provisioning:

- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `D1_DATABASE_ID`,
  `D1_DATABASE_NAME` — Production D1 identity/read/write, validated
  end-to-end by #2860's Production write path and #3268's backup path.
- `B2_ENDPOINT`, `B2_BUCKET`, `B2_KEY_ID`, `B2_APP_KEY` — B2 media reads for
  the `content_data_media` smoke category (`functions/_lib/b2.ts`'s existing
  contract; read-only for this deployment's purposes).
- `MAILCHANNELS_ENABLED`, `MAILCHANNELS_API_KEY` — the `email_fundraiser_state`
  smoke category's controlled test-address send, through the existing
  provider adapter (`functions/_lib/email.ts`); sending is skipped, not
  silently attempted, when `MAILCHANNELS_ENABLED` is unset.

No secret value from any of these three groups is ever printed to Issues,
PRs, logs, or reports; only identity confirmation (present/absent, or
match/mismatch for D1) is recorded, per the pattern already proven live in
#2860/#2913.

**`smokeTestPlan`:** Per #2932's six required categories:
- `public` — `tests/e2e/launch-readiness-public-routes.spec.ts` plus the route
  checklist in `docs/how-to/website/website-production-smoke-test.md`.
- `auth_member` — `tests/e2e/launch-readiness-fanclub-routes.spec.ts` (guest
  redirect/deny, member session, admin-route boundary).
- `content_data_media` — read-only D1/B2 identity and count checks, the same
  pattern already proven in #2860/#2913's live Production preflight and write
  runs (three-way identity check, aggregate counts only, no row content).
- `email_fundraiser_state` — a controlled test-address send through the
  existing provider adapter (`functions/_lib/email.ts`) plus a check that
  fundraiser state matches the approved disabled/enabled configuration.
- `monitoring` — confirmation that #2780's monitoring/alert dispatch is live
  and reporting for the deployed candidate.
- `failure_behavior` — a deliberate stop-trigger drill (Stop-trigger
  reference, above) proving rollback actually engages, not merely documented.

Each category's real pass/fail/stop-rollback-activated result is recorded in
#2932's own smoke-test result-record schema at execution time — this field
states the plan those results are checked against, not an outcome.

**`completeVerificationPlan`:** Beyond the immediate smoke subset above,
complete post-deployment verification (#2782 work unit 6) covers: the full
`website-production-smoke-test.md` checklist (every public route, not the
smoke subset); member Fan Club journeys (profile, library, gallery,
memorabilia) at the depth #2781's rehearsal journey catalog defines; the
#2860 dual-read verification pattern for any migrated `content_inventory`
rows; a bounded post-deploy stabilization-monitoring window per #2780; and
defect/rollback/retest disposition, completed before #2933 records Product
acceptance.

**`stopTriggers`:** The literal field value is the Stop-trigger reference
list above, verbatim: candidate drift, failed preflight, missing authority,
binding/configuration mismatch, failed critical smoke test, security/privacy
exposure, data integrity risk, unavailable recovery owner, or monitoring
failure. No deployment-specific addition has been identified beyond #2782's
own recorded list as of this preparation.

### Instance fields filled from #2929 / recorded authority

**`preflightChecklistEvidence`:** Non-Production rehearsal preflight is the
#2929 evidence package, not a live Production preflight run. Citation:
`docs/ops/reports/launch-rehearsal-disposition-evidence-index-2929.md` and
merged PR #3445, recording 22/22 journeys on
`origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` with defects
D-2928-001–004 resolved. Production preflight against Production D1/hostname
has **not** been run and is not authorized by this increment.

**`recoveryOwner`:** Bill — Product Authority and Day-2 Operations per
`docs/governance/AGENT-TEAM.md` current team mapping (Last Reviewed
2026-08-08). #2786 operator succession remains an unresolved protected Pipeline
intake decision and is **not** waived; it does not replace this named mapping.

### Instance fields still empty (protected Production items)

- `changeWindowStart` / `changeWindowEnd` — no scheduled Production window
  exists. #2929 GO authorizes only non-Production #2782 preparation. Recording
  timestamps here would fabricate a window. These fields stay empty until
  Product Authority records Production Go and the bounded window on #2782 /
  #2932.
- `rollbackCandidateSha` — #2930 recorded that no Production deployment of an
  immutable candidate has occurred, so no distinct last-accepted Production
  SHA exists to name. The #2929 frozen SHA is the **deployment** candidate,
  not the rollback target; using it as both would fail the
  rollback-distinctness invariant. This field stays empty rather than
  inventing a Production SHA.

## Unresolved protected decisions carried from #2929

Do not waive or close:

1. #2776 Website 100% completion contract
2. #2777 Website program dependency/sequence map
3. #2783 Launch acceptance (a11y/perf/security/privacy)
4. #2786 Operator training/access/support/succession
5. #2787 Vendor/account/domain/service continuity

## Real preflight record and harness verdict

Record: `docs/ops/reports/production-deployment-preflight-record-2931.json`

```bash
node scripts/ci/production_deployment_preflight_readiness.mjs \
  --preflight docs/ops/reports/production-deployment-preflight-record-2931.json
```

Expected this increment: `ready: false`, blocker `preflight_incomplete`,
detail missing `changeWindowStart`, `changeWindowEnd`, and
`rollbackCandidateSha`. That fail-closed result is the recorded truth, not a
test failure.

## What #2932 inherits from this task

- The preflight record schema, readiness harness, and the real
  `production-deployment-preflight-record-2931.json` instance with nine
  citation-backed fields filled.
- Exact deployment-candidate identity handed forward from #2929:
  `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d`.
- Fail-closed empty change-window and rollback-SHA fields until Production Go
  and a distinct last-accepted Production SHA are recorded.
- The rollback-distinctness invariant, so #2932 cannot proceed with a rollback
  target indistinguishable from what it is deploying.

## Validation

- `npx vitest run tests/production-deployment-preflight-readiness.test.mjs`
- `node scripts/ci/production_deployment_preflight_readiness.mjs --preflight docs/ops/reports/production-deployment-preflight-record-2931.json` — expected `ready: false` / `preflight_incomplete` for the three empty Production-bound fields.
