---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: Classification register and remediation accounting for the `wdhunter645` repository-owner/user-account reconciliation audit (#3215)
Does Not Own: Repository authority itself (see `docs/governance/REPOSITORY-AUTHORITY.md`); future changes to CODEOWNERS or actor allowlists
Canonical Reference: /docs/ops/reports/wdhunter645-reconciliation-register-3215.md
Related Issues: #3215
Last Reviewed: 2026-08-08
---

# `wdhunter645` reconciliation register — #3215

## Purpose

Full classification register for every occurrence of `wdhunter645` on the default branch, produced per the audit procedure in #3215. Two identities exist and must never be conflated:

- **Repository owner / repository slug (current, live):** `wdhunter465` / `wdhunter465/next-starter-template`
- **Product Authority GitHub user account:** `wdhunter645` (documented elsewhere as "Bill")

Live repository identity was verified directly against the GitHub API for this session (`wdhunter465/next-starter-template`, owner login `wdhunter465`, id `203789911`).

## Scope

Covers every `wdhunter645` occurrence found by a full-repository text search of the default branch (`main`) at the commit recorded below — source files, workflows, config, scripts, docs, and tests. It does not cover GitHub-native surfaces outside repository file content (Issues, PR bodies/comments, past commit messages, branch names) — #3215 explicitly scoped Grok's source report to repository files only, and this register follows the same scope. It does not decide or change CODEOWNERS/actor-allowlist policy; it only classifies whether an *existing* occurrence correctly identifies the repository owner or the Product Authority user account.

## Current known truth

- Live repository owner/slug: `wdhunter465` / `wdhunter465/next-starter-template` (verified via GitHub API, this session).
- Product Authority GitHub user account: `wdhunter645` (referred to elsewhere in this repository as "Bill").
- As of the corrections delivered by PR #3217 (the original remediation PR), `main` contains 301 remaining `wdhunter645` occurrences — down from the 392 found by the initial search below — because the 91 `REPOSITORY_OWNER_INCORRECT` occurrences were corrected and removed; each of the 301 remaining occurrences has a recorded non-error classification (`USER_ACCOUNT_CORRECT`, `HISTORICAL_EVIDENCE_CORRECT`, or `OTHER_VALID_REFERENCE`) — see the Register and Classification totals sections below for the authoritative breakdown. This register's substantive content (the search results, classification totals, and per-file register below) is point-in-time as of PR #3217 and is not expected to change; only this file's required metadata sections (such as this one) are amended by narrow post-merge remediation PRs like this one. A future audit that finds new `wdhunter645` occurrences should produce a new dated register rather than amend this register's substantive findings.

## Initial search

Re-run on default branch `main` at commit `e8907b1911f001f3aa825dc664101871840ec644` (`git grep -n wdhunter645`):

- **392 occurrences** across **81 files**
- Grok's source report (embedded in #3215) listed ~80 files. The fresh search found one additional file not in Grok's list: `scripts/ci/post_merge_validator.mjs` (two occurrences — historical PR-body fixture constants; see classification below). No file in Grok's list was found to no longer contain `wdhunter645`.

## Classification totals

| Classification | Occurrences | Files (all-or-part) |
| --- | --- | --- |
| A. `REPOSITORY_OWNER_INCORRECT` | 91 | 40 |
| B. `USER_ACCOUNT_CORRECT` | 22 | 13 |
| C. `HISTORICAL_EVIDENCE_CORRECT` | 220 | 20 |
| D. `ACTIVE_REFERENCE_AMBIGUOUS` | 0 | 0 |
| E. `OTHER_VALID_REFERENCE` (arbitrary/self-consistent test fixture) | 59 | 16 |

Totals verified: 91 + 22 + 220 + 59 = 392, matching the initial full-repository occurrence count exactly. Post-remediation re-search (below) confirms 301 remaining occurrences (22 + 220 + 59), zero of which are `REPOSITORY_OWNER_INCORRECT`.

**One correction made during test verification:** `tests/cursor-bridge-delivery-first.test.mjs:219` (`const repo = 'wdhunter645/next-starter-template';`) was initially classified E (arbitrary fixture) because the file's *early* tests (lines 20-70) pass `expectedRepo` explicitly, which is self-consistent regardless of value. Running the full affected test suite after the `wake-ingress.mjs` default fix surfaced 3 failing assertions later in the same file (lines ~283-372) that call `shouldDeliverCursorWake` using the `repo` constant *without* passing `expectedRepo`, so they *do* depend on the corrected default — the same coupling already identified for `self-check.mjs`. Reclassified to A and corrected; full suite re-run green afterward. This is called out here because it is exactly the kind of dependency the audit procedure requires verifying by running tests, not by inspection alone.

No occurrence required escalation as ambiguous — every occurrence resolved to a classification with direct evidence from its surrounding code/document context, cross-referenced against the function/workflow that consumes it.

## Register

Legend: **A** = REPOSITORY_OWNER_INCORRECT (correct to `wdhunter465`), **B** = USER_ACCOUNT_CORRECT (leave), **C** = HISTORICAL_EVIDENCE_CORRECT (leave), **E** = OTHER_VALID_REFERENCE (leave — arbitrary/self-consistent test fixture, not compared against any production default).

### A — corrected (REPOSITORY_OWNER_INCORRECT)

| File | Lines | Semantic purpose | Evidence | Risk if changed incorrectly |
| --- | --- | --- | --- | --- |
| `.github/ISSUE_TEMPLATE/config.yml` | 4, 7 | Issue-template contact-link URLs | Active repo navigation links for users opening issues | Low — GitHub redirects renamed-repo URLs, but links should name the live repo |
| `.github/REPOSITORY_METADATA.md` | 43, 57, 61, 65, 106 | Operator runbook `gh repo edit`/`gh api` commands and homepage URL | Active "how to apply metadata" runbook, no historical framing | Commands would target the wrong repo slug if run verbatim |
| `.github/workflows/claude-code-wake.yml` | 32, 79, 94 | `github.repository ==` gate condition; `gh api repos/…/issues/…/comments` calls | Repo-identity gate + hardcoded API path in a live, currently-run workflow | Gate condition now always false against the live repo → workflow never fires (matches the "post-merge alert noise" pattern investigated earlier this session) |
| `.github/workflows/cursor-bridge-build.yml` | 24 | `if: github.repository == 'wdhunter645/next-starter-template'` | Job-level repo gate | Job never runs on the live repo |
| `.github/workflows/cursor-bridge-watch.yml` | 29 | Same pattern | Job-level repo gate | Job never runs on the live repo |
| `.github/workflows/cursor-local-wake.yml` | 34, 56 | `github.repository ==` gate; `test "$REPOSITORY" = …` | Repo-identity gates | Gate never satisfied on the live repo |
| `.github/workflows/purge-zip-history.yml` | 24, 37 | Force-push target URL for history-purge tags/mirror | Pushes to *this* checked-out repo's history; hardcoded URL must match | Push would fail (wrong/inaccessible repo) or, worse, target an unintended repo |
| `.github/workflows/repository-runner-health.yml` | 21, 36 | `github.repository ==` gate; `test "$REPOSITORY" = …` | Repo-identity gates (distinct from actor gates on the same lines nearby) | Health workflow gate never satisfied |
| `CONTRIBUTING.md` | 71, 149 | `git remote set-url`/`git remote add origin` example commands | Active contributor setup instructions | New contributors would configure the wrong remote |
| `config/cursor-bridge/bridge-maintenance-result.schema.json` | 3 | JSON Schema `$id` URL | Canonical schema location URL | Low — cosmetic but identifies repo incorrectly |
| `config/cursor-bridge/bridge.json` | 3 | `"repository"` field | Active Cursor Bridge runtime config | Bridge repo-identity check reads this value |
| `config/cursor-bridge/bridge.schema.json` | 3 | JSON Schema `$id` URL | Same as above | Low — cosmetic |
| `config/cursor-bridge/preflight-result.schema.json` | 3 | JSON Schema `$id` URL | Same as above | Low — cosmetic |
| `config/github-actions/repository-runner.json` | 3 | `"repository"` field | Active repository-runner config | Runner health/wake-delivery repo check reads this value |
| `create-github-secrets.sh` | 95 | `gh secret set … --repo wdhunter645/next-starter-template` | Active secret-provisioning script | Would create secrets on the wrong repo |
| `delete-reviewed-branches.sh` | 7 | `REPO="wdhunter645/next-starter-template"` | Active branch-cleanup script | Would target the wrong repo for branch deletion |
| `docs/governance/REPOSITORY-AUTHORITY.md` | 20 | Link to Project #2678 (temporary constitutional register) | Constitutional-authority doc, `Last Reviewed: 2026-07-29`, actively cites where the *current* register lives | Points at the wrong repo for an actively-consulted authority link |
| `docs/how-to/ci/configure-lgfc-repository-runner.md` | 40, 62 | "In `wdhunter645/…`" step; `--url https://github.com/wdhunter645/…` runner-registration command | Active self-hosted-runner registration procedure | New runner registration would fail against the wrong repo |
| `docs/how-to/cursor/github-poll-wake-loop.md` | 20 | "…while working in `wdhunter645/next-starter-template`" | Describes the live repo context for the poller | Misidentifies the operating repo |
| `docs/how-to/delivery/manage-component-integration.md` | 110, 111, 112 | `gh api repos/wdhunter645/…/rulesets…` operator verification commands | Active rollback/verification runbook | Commands would target the wrong repo |
| `docs/reference/ci/cursor-local-bridge-contract.md` | 101 | "Repository matches the configured expected repository (`wdhunter645/…`)" | Documents the live `expectedRepo` check in `wake-ingress.mjs` (see below) — must track the corrected default | Doc would describe a check value that no longer matches the corrected code |
| `docs/reference/ci/repository-runner-contract.md` | 71, 110 | Repository identity table row; wake-delivery repository condition | Documents `repository-runner.json`'s `"repository"` field, corrected above | Doc/config drift |
| `docs/reference/platform/CLOUDFLARE.md` | 25 | "**Connected repo:** `wdhunter645/next-starter-template`" | Resource-inventory doc, `Last Reviewed: 2026-07-21`, states current Cloudflare Pages connection | Misdocuments live infra binding (Cloudflare Pages projects persist through a GitHub repo rename by internal id, so this is a documentation correction, not an infra change) |
| `package.json` | 21, 25 | `repository.url`, `bugs.url` | Active npm package metadata | Wrong clone/issue-tracker URL surfaced to npm tooling |
| `scripts/cursor-bridge/bridge-watch.mjs` | 397 | `gh workflow run … --repo wdhunter645/next-starter-template` | Active `gh` dispatch call | Dispatch would target the wrong repo |
| `scripts/cursor-bridge/bridge.mjs` | 48 | `const REPO = 'wdhunter645/next-starter-template';` | Active default repo constant | Wrong repo used throughout bridge.mjs |
| `scripts/cursor-bridge/lib/launch.mjs` | 100 | Issue-URL fallback constructor | Active fallback URL builder | Wrong URL in launch prompts when `issue.url` absent |
| `scripts/cursor-bridge/lib/notify.mjs` | 32 | `gh issue comment … --repo wdhunter645/next-starter-template` | Active `gh` call | Comment would target the wrong repo |
| `scripts/cursor-bridge/lib/reconcile.mjs` | 24 | `const DEFAULT_REPO = 'wdhunter645/next-starter-template';` | Active default | Wrong repo used in recovery/reconcile paths |
| `scripts/cursor-bridge/lib/wake-ingress.mjs` | 99 | `const expectedRepo = event.expectedRepo \|\| 'wdhunter645/next-starter-template';` | **Confirmed live bug**: `shouldDeliverCursorWake` gates all Cursor wake delivery on this default when no explicit `expectedRepo` is passed | On the live repo this default now makes every real event fail `repository_mismatch` → `untrusted_repository`, silently blocking all Cursor wake delivery |
| `scripts/cursor-bridge/self-check.mjs` | 98, 108, 118, 129 | `repository: 'wdhunter645/…'` passed into the real (non-mocked) `shouldDeliverCursorWake` | Directly exercises the default above; **must move in lockstep** with the `wake-ingress.mjs` fix or these assertions start failing (`deliver:false` where `true` is expected) | Self-check script breaks after the code fix if left unchanged |
| `scripts/orchestrator/select-next-queue-work.mjs` | 82 | `deps.repo \|\| process.env.GITHUB_REPOSITORY \|\| 'wdhunter645/next-starter-template'` | Active fallback default | Wrong repo when `GITHUB_REPOSITORY` unset |
| `scripts/pmo-dashboard/apply-completed-child-metadata.mjs` | 8 | `const REPO = 'wdhunter645/next-starter-template';` | Active default | Wrong repo for metadata writes |
| `scripts/pmo-dashboard/apply-dashboard-metadata.mjs` | 8 | Same pattern | Active default | Wrong repo for metadata writes |
| `scripts/pmo-dashboard/build-dashboard.mjs` | 12, 13 | `OWNER = process.env.GITHUB_REPOSITORY_OWNER \|\| 'wdhunter645'`; `REPO = (process.env.GITHUB_REPOSITORY \|\| 'wdhunter645/next-starter-template').split('/')[1]` | Active fallback defaults, used to build the GitHub API path for dashboard generation | Wrong repo/owner when env vars unset |
| `scripts/pmo-dashboard/reconcile-task-child-labels.mjs` | 22 | `process.env.GITHUB_REPOSITORY \|\| 'wdhunter645/next-starter-template'` | Active fallback default | Wrong repo for label reconciliation |
| `scripts/rewrite_zip_history.sh` | 4, 8 | Comment + `REPO_URL="${REPO_URL:-https://github.com/wdhunter645/next-starter-template.git}"` | Active destructive history-rewrite helper's default target | Force-push/mirror-rewrite against the wrong repo if `REPO_URL` not explicitly overridden |
| `scripts/update-repository-metadata.sh` | 7 | `REPO_OWNER="wdhunter645"` | Active metadata-apply script referenced by `.github/REPOSITORY_METADATA.md` | Metadata applied to the wrong repo |
| `site/pmo-dashboard/dashboard-data.json` | 4, and all `issueUrl` values (30 lines) | Published GitHub Pages dashboard data: `"repository"` field + every issue URL | Machine-generated output of `build-dashboard.mjs` (corrected above); this checked-in copy is stale relative to the corrected generator default | Published dashboard links point at the wrong repo until next regeneration; corrected directly since this session cannot trigger a live regeneration run |
| `tests/cursor-bridge-delivery-first.test.mjs` | 219 | `const repo = 'wdhunter645/next-starter-template';`, consumed by later `shouldDeliverCursorWake` calls (lines ~273-372) without an explicit `expectedRepo` override | Discovered via test execution, not inspection: 3 assertions failed after the `wake-ingress.mjs` default fix until this constant was corrected | Test suite breaks against the corrected production default if left unchanged |

### B — left unchanged (USER_ACCOUNT_CORRECT)

| File | Lines | Semantic purpose | Evidence |
| --- | --- | --- | --- |
| `.github/CODEOWNERS` | 1, 2, 3 | `@wdhunter645` review-assignment ownership of `/docs/`, `/docs/ops/`, `/docs/reference/` | Human GitHub-username review assignment — explicitly called out as high-risk in #3215; no evidence it is wrong |
| `.github/workflows/claude-code-wake.yml` | 43, 48 | `github.event.comment.user.login ==`, `github.actor ==` | Human-actor authorization gates, distinct from the repo-identity gate on line 32 |
| `.github/workflows/cursor-local-wake.yml` | 45 | `github.actor == 'wdhunter645'` | Human-actor authorization gate |
| `.github/workflows/ops-main-change-monitor.yml` | 110 | `admins = ['wdhunter645']; // Default admin` | Human admin allowlist for unapproved-main-change monitoring |
| `.github/workflows/repository-runner-health.yml` | 22, 38, 89, 90 | `github.actor ==`, `test "$ACTOR" =`, `trustedActors[0] !==`, error message | Human-actor trust checks |
| `config/github-actions/repository-runner.json` | 29 | `"trustedActors": ["wdhunter645"]` | Human trusted-actor allowlist, mirrors the contract doc |
| `docs/how-to/cursor/configure-cursor-local-bridge.md` | 153 | Example command's 4th positional arg (actor) | Mirrors `wake-ingress.mjs`'s actor check |
| `docs/how-to/cursor/github-poll-wake-loop.md` | 49, 56, 57 | `GITHUB_POLL_LOGIN` default; "assign … to `wdhunter645`" (×2) | Human operator/assignee identity |
| `docs/ops/reports/watcher-action-mutation-contract-1719.md` | 38 | "Assign source issue / active PR to `wdhunter645`" | Authorized dispatcher mutation class — human assignee |
| `docs/reference/ci/claude-code-wake-contract.md` | 42, 43 | `issue_comment` author check; `workflow_dispatch` actor restriction | Documents the same actor gates as B rows above, `Last Reviewed: 2026-08-03` |
| `docs/reference/ci/repository-runner-contract.md` | 89 | "actor is `wdhunter645`" | Documents the actor-trust check |
| `docs/reference/governance/governance-launch-control-reference-implementation.md` | 266 | `AUTHORIZED_ACTORS = ['wdhunter645', 'Bill', 'ChatGPT']` | Draft/future code (explicitly marked `NOT IMPLEMENTED`) — still a human-actor allowlist, correct as written |
| `scripts/cursor-bridge/lib/wake-ingress.mjs` | 116 | `event.actor !== 'wdhunter645'` | Human-actor authorization for `workflow_dispatch` |

### C — left unchanged (HISTORICAL_EVIDENCE_CORRECT)

All of the following are dated logs, point-in-time snapshots, archived PR-body evidence, or reports whose own header states an evidentiary (not live-configuration) authority level. None are rewritten.

| File | Lines | Why historical |
| --- | --- | --- |
| `docs/how-to/pmo/pmo-dashboard.md` | 63 | Explicitly describes the *old* pre-rename Pages URL as dead (404), by name, as historical fact |
| `docs/ops/ai/AI-REVIEW-ACCESS.md` | 87 | Citation link to a past source issue |
| `docs/ops/deploy-log.md` | 55 | Dated log entry ("Deployment and Operations Log") |
| `docs/ops/implementation-plans/issue-2724-queue-label-migration-plan.md` | 233 | Snapshot-contract example for an already-executed migration (#2727) |
| `docs/ops/implementation-plans/issue-2727-live-queue-label-inventory.json` | all 40 occurrences | Point-in-time captured inventory snapshot |
| `docs/ops/implementation-plans/issue-2727-migration-execution-log.json` | 5 | Execution log recording who ran a completed migration |
| `docs/ops/implementation-plans/issue-2727-pre-migration-snapshot.json` | all 51 occurrences | Pre-migration snapshot, captured before a completed migration |
| `docs/ops/implementation-plans/zip-history-remediation-plan-2374.md` | 26, 38 | "Commands were run…" — past-tense investigation evidence, `Authority Level: Task Evidence` |
| `docs/ops/reports/delivery-system-v1-pilot-evidence.md` | 87, 91, 92, 97 | Pilot evidence report citing specific past PRs/runs |
| `docs/ops/tickets/docs-remediation.md` | 23 | Point-in-time remediation ticket citing PR #693 |
| `docs/ops/trackers/THREAD-LOG_Master.md` | 28, 46, 52, 70 | Explicitly "Append-only thread closeout history" |
| `docs/reference/github/delivery-system-repository-configuration.md` | 101 | "Captured from GitHub API … on 2026-07-13" — explicit point-in-time capture |
| `docs/reference/open-issues-snapshot-2026-06-02.md` | all ~100 occurrences | Filename itself is a dated snapshot |
| `scripts/ci/post-merge-closeout/pr-1229-body.md`, `pr-1239-body.md`, `pr-1240-body.md`, `pr-1242-body.md`, `pr-1243-body.md`, `pr-2237-body.md` | all occurrences | Archived verbatim PR-body evidence for specific merged PRs |
| `scripts/ci/post_merge_validator.mjs` | 47, 49 | `PR_1552_MAINTAINER_BODY` / `PR_1241_MAINTAINER_BODY` — verbatim historical PR-body text embedded as named constants; not a repo-identity default |
| `scripts/launch-readiness/README.md` | 3 | Citation link to a source issue |

### E — left unchanged (OTHER_VALID_REFERENCE: arbitrary/self-consistent test data)

Verified for each: the surrounding production code either (a) has no comparison against a hardcoded `wdhunter645` default at all (confirmed by reading the source, e.g. `eligibility.mjs`'s `repository_mismatch` check only runs when the caller explicitly passes `expectedRepo`), or (b) uses the field purely to construct an API URL/string without ever comparing it against a fixed value. In every case the value is either wholly self-consistent within the fixture (e.g. `owner`/`repo` used to build a matching URL in the same test) or asserts login *equality* between two fixture actors, not identity against a real account.

| File | Lines | Confirmed non-coupling |
| --- | --- | --- |
| `scripts/pmo-dashboard/fixtures/issues-label-driven.json` | all 20 occurrences | `test-label-driven-fixture.mjs` only asserts `issueUrl.includes('github.com')`, not the owner |
| `scripts/pmo-dashboard/test-lifecycle-transitions.mjs` | 29 | Fixture `html_url`, not compared to `build-dashboard.mjs`'s OWNER/REPO default |
| `scripts/pmo-dashboard/test-task-count-incomplete-skew.mjs` | 35 | Same |
| `tests/cursor-bridge-delivery-first.test.mjs` | 26, 27, 33, 66, 98, 205, 360, 369 | `validateEligibility`'s `repository_mismatch` check only fires when `expectedRepo` is explicitly passed — confirmed by reading `eligibility.mjs`. (Line 219, the `repo` constant, is **not** in this row — see the A table: it required correction, discovered via test execution.) |
| `tests/cursor-bridge-parent-context.test.mjs` | 8 | `REPO` used only to build mocked `gh` response payload URLs, never compared to `bridge.mjs`'s real `REPO` constant (spawnSync is fully mocked) |
| `tests/cursor-bridge-preflight.test.ts` | 18 | `runPreflight`'s probes are mocked/stubbed; `config.repository` is not compared |
| `tests/cursor-bridge-watch-build.test.ts` | 38 | Same pattern |
| `tests/fixtures/delivery-system/scenarios.mjs` | 342 | Pass-through fixture field |
| `tests/gate-post-merge-readiness.test.mjs` | 59, 262, 273, 334 | `evaluatePostMergeReadinessGate`'s `repository` param is used only to build API URLs, never compared |
| `tests/late-post-merge-findings.test.mjs` | 20 | Pass-through fixture URL |
| `tests/post-merge-closeout-manual-merge-sha.test.mjs` | 28, 106, 126 | Same pattern as gate-post-merge-readiness |
| `tests/post-merge-source-issue-closeout.test.mjs` | 1142 | Same pattern |
| `tests/pr-body-auto-repair.test.mjs` | 16, 22 | Pass-through `full_name` fixture field |
| `tests/pr-issue-accounting-parser.test.mjs` | 12, 26, 68, 71 | `owner`/`repo` locals used only to build a matching URL inside the same test body (self-consistent) |
| `tests/pr-preflight.test.mjs` | 95, 347, 351, 367, 371 | `repository` is a local test-helper default (source `pr_preflight.mjs` has no hardcoded repo comparison at all); `login` fixtures test author/reviewer login *equality*, not identity against a real account |

## Corrections applied

Only the 91 **A**-classified occurrences (40 files, including the 4 dependent `scripts/cursor-bridge/self-check.mjs` assertions and the 1 dependent `tests/cursor-bridge-delivery-first.test.mjs` constant required to keep those tests passing against the corrected `wake-ingress.mjs` default, and the 31 mechanically-generated occurrences in `site/pmo-dashboard/dashboard-data.json`) were changed, string-for-string `wdhunter645` → `wdhunter465` in the identified repository-owner/slug/URL context. No other file was touched. Verified via `git diff --stat`: 40 files changed, 91 insertions(+), 91 deletions(-) — an exact 1:1 line substitution with no line added or removed.

## Tests run

- Full `npx vitest run`: **97 test files / 1009 tests, all passing** (post-remediation).
- Standalone assert-based check scripts (not part of the vitest suite): `scripts/cursor-bridge/self-check.mjs`, `scripts/pmo-dashboard/test-lifecycle-transitions.mjs`, `scripts/pmo-dashboard/test-task-count-incomplete-skew.mjs`, `scripts/pmo-dashboard/test-label-driven-fixture.mjs` — all passing.
- `git diff --check` — clean except one pre-existing trailing-whitespace line in `docs/reference/platform/CLOUDFLARE.md` (line 25) that predates this change (Markdown hard-break convention used throughout that file's block); not modified, per the no-unrelated-edits rule.
- JSON validity (`JSON.parse`) on every changed `.json` file — all valid.
- YAML sanity (`yaml.safe_load`) on every changed workflow/template file — all valid.

## Rollback

Standard reviewed reversion of the remediation PR. This register is preserved at `docs/ops/reports/wdhunter645-reconciliation-register-3215.md` so any reverted occurrence can be restored to its exact prior classification and value without re-running the audit.
