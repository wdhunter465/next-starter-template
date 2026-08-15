---
Doc Type: Operations Report
Audience: Bill, PMO, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: Consolidated evidence that the #3415 Chatterbox prototype's Development-level implementation and testing is complete against its own launch package, and the exact open items remaining before Project Graduation
Does Not Own: The Project Graduation GO/NO-GO decision itself (Product Authority); any Production access, credential provisioning, or MCP/notification-adapter work explicitly deferred past this prototype
Canonical Reference: /docs/ops/reports/chatterbox-launch-ready-package-3415.md
Related Issues: #3415
Last Reviewed: 2026-08-15
Executor: Claude Code
---

# #3415 Chatterbox — launch-ready package

## Purpose

Bill's instruction (chat, 2026-08-14): complete 100% of the Pipeline
preparation work for #3415, including a full application and Development-
level testing — not a half-built prototype — so the project is ready to
graduate to PMO Active on a Product Authority GO/NO-GO decision alone. This
report consolidates that evidence against the launch package originally
posted on #3415 (issue comments 5296357240 review, 5296363781 launch
package).

**No Production access, deployment, credential provisioning, or Go/No-Go
action is performed, attempted, or implied by this report or any of the
work it cites.**

## Scope reconciliation against the original launch package

The launch package scoped the first prototype slice to work units 1–3
(schema, core API, atomic claims) and named units 4–7 as the ordered
remainder. This report closes out units 4–7 that are achievable without
Production access or a new credential decision, and names explicitly, not
silently, the two items that remain open because they require a decision
only Bill/PMO can make.

| Work unit | Status | Evidence |
| --- | --- | --- |
| 1. Schema + migration | **Complete** | PR #3464 (originally `0046_chatterbox_core.sql`), renumbered to `migrations/0050_chatterbox_core.sql` before promotion to `main` |
| 2. Core append/read API | **Complete** | PR #3464, `functions/api/chatterbox/**` |
| 3. Task graph + atomic claims | **Complete** | PR #3464; DB-level partial unique index |
| 4. Bounded catch-up digest | **Complete** | Built as part of PR #3464 (`buildCatchUpDigest`), not a separate slice |
| 5. GitHub-linking ingestion (read-only) | **Code complete — live dispatch still requires `workflow_dispatch`, deferred to Graduation** | PR #3479 — `chatterbox_github_ingest.mjs` + workflow; see "Live dispatch status" below |
| 6. Multi-agent async test harness | **Code complete, verified twice over locally, and now dispatchable pre-Graduation via a scoped `push` trigger** | PR #3479 — `chatterbox_dev_integration_check.mjs` + workflow; see "Live dispatch status" below |
| 7. Diátaxis documentation | **Complete** | 5 docs from PR #3464, extended in PR #3479 |
| MCP interface | **Deliberately deferred, per the launch package's own MVP boundary** | Not a gap — see chatterbox-architecture-rationale.md |
| ACK tracking, cause→effect reconciler | **Deliberately deferred, per the launch package's own MVP boundary** | Not a gap |

## What "complete" means for work unit 6

`scripts/ci/chatterbox_dev_integration_check.mjs` exercises the live
deployed API end-to-end — not a mock — proving, for real HTTP requests
against real Development D1:

- Room/participant/task creation across 4 independently registered
  participants spanning 3 role classes (PMO, 2 implementation agents, 1
  system_clerk) — satisfying #3415's own stated success criterion of "PMO
  plus at least three independently operating agents."
- Dependency-gated claims (a task cannot be claimed while its dependency is
  unmet).
- Concurrent claim resolution: two genuinely simultaneous requests for the
  same task resolve to exactly one winner, verified by asserting the loser
  is rejected (never a double-201), independent of which of the two
  legitimate rejection paths (DB constraint vs. precondition check) fires.
- Release is claimant-only, and the actual claimant can release cleanly.
- Idempotent event posting (a retried call with the same key never
  double-posts).
- Durable question/answer across a check-in boundary (a targeted question
  is visible before an answer exists, and gone after).
- Exact missed-wake recovery: a participant who misses events entirely
  gets a precisely-accurate unread count on their next check-in, neither
  stale nor double-counted.
- The `system_clerk` structural boundary rejects a substantive event type
  for real (`403`), not just in a unit test.

This script's own control flow is verified locally
(`tests/chatterbox-dev-integration-check.test.mjs`) against an in-memory
fake HTTP layer built on the same already-unit-tested pure logic
(`canClaim`, `buildCatchUpDigest`, `isSystemClerkEventAllowed`) — that local
test caught two real bugs in the script during development (a wrong
concurrency-loser assertion, and an incorrect unread-count expectation
across a checkpoint boundary) before either could have wasted a live
dispatch cycle. It is explicitly not a substitute for the real dispatch —
only that proves the actual database-level guarantees.

## Live dispatch status (work units 5 and 6)

**Dedicated credential provisioned (2026-08-15).** Bill created
`CHATTERBOX_PREVIEW_ADMIN_TOKEN` as a new repository secret and set its
value as the `ADMIN_TOKEN` configured in Cloudflare Pages' own Preview
environment. Both workflows now read this secret instead of the repository's
general-purpose shared `ADMIN_TOKEN`, closing the earlier name-vs-scope gap
described in chatterbox-authority-boundary.md: the secret's name now states
its own scope, and its value was set directly against Preview, not inferred.
The credential itself was never pasted into or handled by any chat session —
it exists only as a GitHub Actions secret, injected server-side.

**Dispatch mechanism blocker (2026-08-14), still standing for work unit
5.** GitHub's Actions API resolves `workflow_dispatch` by looking up the
workflow file among workflows registered on the repository's **default
branch**. Neither Chatterbox workflow file exists on `main` — both live
only on `component/chatterbox-prototype` — so `workflow_dispatch` still
404s for both, identically whether attempted via CLI, API, or the GitHub
UI. `chatterbox-github-ingest.yml` (work unit 5) takes required inputs
(`issue_number`, `room_key`) with no safe default for an automatic trigger,
so it remains `workflow_dispatch`-only and deferred to Graduation, per
Bill's 2026-08-15 decision not to promote workflow files to `main` ahead of
a GO/NO-GO call.

**Work unit 6 resolved via a scoped `push` trigger, not `workflow_dispatch`
(2026-08-15).** `chatterbox-dev-integration-check.yml` needs no required
inputs beyond a target branch that already defaults sensibly, so it now
also triggers on `push` to `component/chatterbox-prototype`, scoped by path
to files that could affect the check's own correctness. Unlike
`workflow_dispatch`, `push`-triggered workflows are evaluated from the
workflow file present in the pushed commit itself — the same mechanism this
repository's own CI (`pr-hygiene`, `quality`, etc.) has used against
non-default branches all along — so this does not require promoting
anything to `main` and carries none of the Production-adjacent risk that
motivated deferring work unit 5. The first live dispatch fired automatically
the moment PR #3494 merged into `component/chatterbox-prototype`; see the
follow-up comment on #3415 for the actual result.

**Work unit 6's credential surface narrowed to a single secret
(2026-08-15).** The first live dispatch above failed before reaching
Chatterbox's own API — a Cloudflare Pages Deployments API call returned
`404 Project not found` while resolving the branch's Preview URL via
`CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`. Per Bill's explicit
instruction, the fix was not to debug that token's scope but to stop using
it for this check entirely: only `CHATTERBOX_PREVIEW_ADMIN_TOKEN` is needed
for this testing. `chatterbox-dev-integration-check.yml` now targets the
component branch's known, stable Cloudflare Pages Preview alias directly
(`component-chatterbox-prototy.next-starter-template-6yr.pages.dev`,
confirmed against the live Cloudflare dashboard 2026-08-15) instead of
resolving it via the Cloudflare API at run time. `CLOUDFLARE_API_TOKEN` and
`CLOUDFLARE_ACCOUNT_ID` are no longer read by this workflow at all.

**Production credentials confirmed available, explicitly reserved for
Graduation (2026-08-15).** Bill confirmed Cloudflare's Production
environment has its own `ADMIN_TOKEN` configured, and the repository's
existing `CLOUDFLARE_API_TOKEN` secret already has the access this would
need. Per Bill's explicit decision, neither is used for any Chatterbox
testing before Project Graduation — confirmed available for that step
specifically, not drawn on early. Same posture as the `main`-branch
promotion decision above: capability confirmed, deliberately not exercised
yet.

## Verification (this PR)

- `npx vitest run` — 124 files / 1371 tests, all passing, including 11 new
  tests for GitHub ingestion, 7 for Cloudflare URL resolution, and 2 for
  the Development integration check's own orchestration logic.
- `npx tsc --noEmit` — clean.
- `bash scripts/ci/docs_check_headers.sh .` — no new/changed-file failures.
- `node scripts/ci/diataxis_folder_audit.mjs` — no defects.
- `git diff --check` — clean.
- YAML syntax of both new workflow files validated.

## Acceptance checklist (this report)

- [x] Work units 4 and 7 from the original launch package are complete.
- [x] Work units 5 and 6 are code-complete (work unit 6 also verified twice
      over locally: unit tests plus a fake-HTTP-layer orchestration
      self-test); live dispatch of both is deliberately deferred to Project
      Graduation itself, per Bill's decision (2026-08-15), not an unresolved
      gap in this report.
- [x] Work units 5 and 6's live dispatch credential
      (`CHATTERBOX_PREVIEW_ADMIN_TOKEN`) is a dedicated, Preview-scoped
      secret Bill provisioned specifically for Chatterbox (2026-08-15),
      resolving the earlier name-vs-scope ambiguity on the shared secret.
- [x] Work unit 6 is now live-dispatchable pre-Graduation via a scoped
      `push` trigger on `component/chatterbox-prototype`, with no `main`
      promotion and no Production-adjacent risk.
- [x] MCP interface and v2 features (ACK tracking, reconciler) are
      confirmed as deliberate launch-package scope decisions, not
      discovered gaps.
- [x] No Production access, mutation, or credential use performed or
      implied by this report or the PR it documents.

## Recommendation

**Ready for Product Authority GO/NO-GO on Project Graduation to PMO Active.**
Two conditions are accepted as part of that decision, not blockers to making
it:

1. Bill's/PMO's confirmation that the launch package's own MVP boundary
   (MCP interface and v2 features deferred) remains the intended prototype
   scope, rather than something to pull forward before Graduation.
2. Live dispatch of the GitHub-linking ingestion (work unit 5) still
   requires `workflow_dispatch`, and stays explicitly deferred to Graduation
   itself, per Bill's 2026-08-15 decision not to promote workflow files to
   `main` ahead of a GO/NO-GO call. Work unit 6 no longer needs this
   deferral — it dispatches via a scoped `push` trigger instead, with no
   `main` promotion involved.

Neither condition requires more implementation work from this component —
both are decisions, not tasks. Work unit 6's actual live result, once the
push-triggered run completes, is recorded as a follow-up comment on #3415
rather than re-stated here to avoid this report going stale relative to the
live evidence.

## Rollback

Revert the documentation/workflow PR that introduces this report. No data
action is implied — this report performs no Production or Development D1
access itself.
