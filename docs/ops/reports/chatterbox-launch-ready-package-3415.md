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
| 1. Schema + migration | **Complete** | PR #3464, `migrations/0046_chatterbox_core.sql` |
| 2. Core append/read API | **Complete** | PR #3464, `functions/api/chatterbox/**` |
| 3. Task graph + atomic claims | **Complete** | PR #3464; DB-level partial unique index |
| 4. Bounded catch-up digest | **Complete** | Built as part of PR #3464 (`buildCatchUpDigest`), not a separate slice |
| 5. GitHub-linking ingestion (read-only) | **Code complete — live dispatch blocked by the same mechanism issue as work unit 6, deferred to Graduation alongside it** | PR #3479 — `chatterbox_github_ingest.mjs` + workflow; see "Live dispatch status" below |
| 6. Multi-agent async test harness | **Code complete and verified twice over locally — live dispatch deferred to Project Graduation itself, per Bill's decision (2026-08-15)** | PR #3479 — `chatterbox_dev_integration_check.mjs` + workflow; see "Live dispatch status" below |
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

This section covers both `chatterbox-github-ingest.yml` (work unit 5) and
`chatterbox-dev-integration-check.yml` (work unit 6) — both hit the same
dispatch-mechanism blocker and share the same deferral decision below.

**Secret name confirmed (2026-08-14).** Product Authority confirmed the
repository already has an `ADMIN_TOKEN` GitHub Actions secret configured —
no new secret needed to be provisioned for this check to run.
`.github/workflows/chatterbox-dev-integration-check.yml` reads it directly
(`secrets.ADMIN_TOKEN`), reusing the same `requireAdmin` contract every
other `functions/api/admin/**` route already relies on. This confirms the
secret's *name* only, not the environment-scope of its value — per
`docs/ops/reports/delivery-system-preview-isolation-audit.md`'s explicit
warning, that value must be the Development/Preview deployment's own
`ADMIN_TOKEN`, never Production's, and this workflow cannot itself verify
which one is actually configured.

**Dispatch mechanism blocker discovered (2026-08-14).** Attempting the first
live dispatch of `chatterbox-dev-integration-check.yml` surfaced a real,
previously unknown blocker: GitHub's Actions API resolves `workflow_dispatch`
by looking up the workflow file among workflows registered on the
repository's **default branch**. Neither Chatterbox workflow file exists on
`main` — both live only on `component/chatterbox-prototype`, never merged —
so dispatch of either one returns `404 Not Found`, confirmed via both the
API and by fetching each file at `refs/heads/main` (neither exists there).
This is a dispatch-mechanics fact, not a code defect, and it applies
identically whether dispatch is attempted via the CLI, the API, or the
GitHub UI's "Run workflow" button, and identically to both workflows.

**Decision (Bill, chat, 2026-08-15): defer live dispatch to Project
Graduation itself.** Rather than promote the workflow files to `main` ahead
of a GO/NO-GO decision — which would very likely trigger a Cloudflare Pages
build against whatever `main` is wired to as its Production branch, directly
against the standing "no work will occur in production, nor will any of the
work impact production" instruction — live dispatch of work units 5 and 6 is
explicitly **not** a pre-Graduation blocking item. It happens as part of, or
immediately following, Project Graduation itself, at which point promoting
these workflow files (or dispatching them by whatever mechanism Product
Authority chooses at that time) is a decision made deliberately alongside
the GO/NO-GO call, not forced early to satisfy this report.

No credential was pasted into or handled by any chat session as part of
reaching this decision.

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
- [x] Work unit 6's live dispatch credential (`ADMIN_TOKEN`) is confirmed
      already configured — no new provisioning required, whenever dispatch
      happens.
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
2. Live dispatch of the GitHub-linking ingestion and the Development
   integration check (work units 5 and 6) is explicitly deferred to
   Graduation itself — per Bill's decision (2026-08-15) — rather than
   required before the GO/NO-GO call. Both are already code-complete, and
   work unit 6's design is already verified locally; only the live-dispatch
   mechanism (which requires promoting the workflow files to `main`) is
   deferred, deliberately, to the Graduation step itself.

Neither condition requires more implementation work from this component —
both are decisions, not tasks.

## Rollback

Revert the documentation/workflow PR that introduces this report. No data
action is implied — this report performs no Production or Development D1
access itself.
