---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2931 (#2782 Task 002) change window, role, preflight, communications, credential-boundary, smoke/complete-test, stop-trigger, and rollback runbook
Does Not Own: The candidate manifest (#2930, owned by that report); actual Production execution (#2932, separately protected); post-deployment verification/closeout (#2933)
Canonical Reference: /docs/ops/reports/production-deployment-readiness-runbook-2931.md
Related Issues: #2931, #2782, #2930, #2932, #2933, #2785, #2860, #2913, #3268, #2780, #2781
Last Reviewed: 2026-08-12
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

- #2930's candidate manifest is not yet accepted and Product Authority has not
  recorded a Production Go. No real preflight record exists yet — this document
  and its companion harness are **runbook preparation and automation
  scaffolding**.
- `buildDeploymentReadiness()` is implemented and tested against synthetic
  fixtures (`tests/production-deployment-preflight-readiness.test.mjs`),
  including the rollback-distinctness invariant, before any real preflight
  record exists.
- This document does not authorize deployment, Production mutation, or
  credential use of any kind.

## Intended final state

This document is evolving scaffolding pending #2930 acceptance and Product
Authority's Production Go. As of this update, seven of the twelve required
fields ("Policy-level field content," below) carry real, final content rather
than a placeholder — only the five genuinely instance-bound fields ("Instance
fields — still blocked") remain open. Once #2931 is actually executed, those
five are filled with the real change window, named recovery owner, and cited
preflight/rollback evidence, and the `buildDeploymentReadiness()` verdict is
run against the complete real record and #2930's accepted candidate manifest.
The schema and invariants themselves are not expected to change — only
"Current known truth" above and the four instance fields are expected to
update.

## Non-blocking prerequisite rule

Per #2931's non-blocking prerequisite rule, this document and the readiness
harness are **runbook preparation, communication drafting, preflight design,
rollback planning, evidence templates, and package completion** — the
collision-safe category #2931 explicitly authorizes before #2930's candidate and
evidence manifest are accepted for final deployment binding. No preflight record
is filled in with real evidence here, and no Production authorization is
implied.

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
not a specific deployment instance. Those seven do not need a real candidate
SHA, a scheduled date, or a named individual to be defined, so this section
prepares their real, final content now — not a placeholder, and not a
synthetic example. The remaining five fields (`changeWindowStart`,
`changeWindowEnd`, `preflightChecklistEvidence`, `rollbackCandidateSha`,
`recoveryOwner` — below, "Instance fields — still blocked") are genuinely
data-bound and are correctly left open.

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

### Instance fields — still blocked (not filled by this preparation)

- `changeWindowStart` / `changeWindowEnd` — requires an actual scheduled
  window, which requires Production Go for a specific accepted candidate.
- `preflightChecklistEvidence` — requires a citation to a real, already-run
  preflight check; the procedure it will cite is `docs/reference/ci/pr-
  preflight.md` / `scripts/ci/pr_preflight.mjs` plus this task's own
  readiness harness, run for real against the accepted candidate.
- `rollbackCandidateSha` — requires #2930's real accepted candidate plus a
  distinct, already-qualified prior candidate to roll back to; neither exists
  yet.
- `recoveryOwner` — requires a named, accountable individual; Bill's call, not
  inferable from role definitions the way `executorRole`/`verifierRole` are.

These five remain genuinely blocked on #2781's rehearsal disposition, #2930's
acceptance, and Product Authority's Production Go — consistent with #2933's
own recorded closeout-path ordering (issue comment 5231615052). This section
does not fabricate values for them.

## What #2932 inherits from this task

- The preflight record schema and readiness harness, ready to validate the real
  preflight record once #2930's manifest is accepted.
- The rollback-distinctness invariant, so #2932's actual deployment cannot
  proceed with a rollback target indistinguishable from what it's deploying.

## Validation

- `npx vitest run tests/production-deployment-preflight-readiness.test.mjs` — all tests passing.
- `node scripts/ci/production_deployment_preflight_readiness.mjs --preflight <sample> --manifest <sample>` — verified `ready: true` when the rollback candidate differs from the deployment candidate, and `ready: false` with the correct blocker when they match, including with a null preflight record and without `--manifest` supplied.
