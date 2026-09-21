---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Operator-facing GitHub Actions inventory routing and current workflow disposition summary
Does Not Own: CI domain policy, merge-protection settings, workflow YAML implementation, or competing check classification
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #2769, #3746, #2469, #2175, #2208, #4263
Last Reviewed: 2026-09-21
---

# GitHub Actions Workflows Inventory

## Authority

This file is an **operator inventory**. It does not own CI policy.

Resolve conflicts in this order:

1. `docs/governance/CI-AND-VERIFICATION.md` — CI and Verification Domain Policy
2. `docs/governance/PR_PROCESS.md` — PR process procedure
3. Supporting CI references:
   - `scripts/ci/merge_protection_surface.mjs` — machine-readable required/advisory/manual surface
   - `.github/CI_GUARDRAILS_MAP.md`
   - `docs/reference/ci/merge-protection-surface.md`
   - `docs/reference/ci/pr-process-current-state.md`
   - `docs/reference/ci/pr-workflow-ci-inventory.md`
   - `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md`
   - `docs/reference/ci/pr-process-rebuild-retired-assets.md`

Historical February 2026 GATE/OPS redesign text and the July 2026 two-check-only inventory wording are superseded. Do not restore required-check lists that omit the live `#3746` reviewer-lifecycle blocker, ZIP-gate filenames, or “add every GATE to branch protection” guidance.

## Current known truth (main)

Verified 2026-09-14 against live repository ruleset `Main` (id `15885337`) and `scripts/ci/merge_protection_surface.mjs`.

Live `main` requires these deterministic checks:

| Job id | Workflow file | Workflow name |
| --- | --- | --- |
| `quality` | `gate-quality.yml` | `GATE — Quality Checks` |
| `gitleaks` | `gitleaks.yml` | `GATE — Secret Scan` |
| `reviewer-response-completion` | `reviewer-response-completion.yml` | `GATE — Reviewer Response Completion` |

`reviewer-response-completion` was promoted by #3746 so late trusted-review events re-pending merge eligibility. Enforcement remains event-conditional inside the workflow (advisory on `opened` / `synchronize` / `reopened`; enforcing on `pull_request_review`, `ready_for_review`, `edited`, `pull_request_review_comment`, and `workflow_dispatch`). Required in the ruleset does not mean it fails closed on every push.

Do **not** configure as required:

- advisory checks (`pr-hygiene`, `diff-scope`)
- manual-only / paused gates (including `pr-issue-accounting`, drift, intent labeler, docs guardrails, design-compliance warn, post-merge-readiness)
- OPS, post-merge closeout, orchestrator, bridge, PMO, or one-shot workflows
- retired #1075 names

This inventory does not mutate GitHub settings. Repo docs describe the live surface; operators own the ruleset UI.

## Architecture summary

Current CI separates:

- **Required merge safety** — `quality`, `gitleaks`, `reviewer-response-completion`
- **Advisory PR hygiene** — stable PR-body and diff-scope signals
- **Manual-only / paused** — stubs awaiting justified rebuild
- **Single-owner post-merge closeout** — `post-merge-closeout.yml`
- **OPS / platform / delivery automation** — scheduled, push-main, dispatch, or non-main profiles
- **Retired #1075 phase engine** — absent; do not restore

OPS and support workflows must not become merge blockers for `main`.

## Required merge protection

| File | Name | Triggers | Jobs | Class |
| --- | --- | --- | --- | --- |
| `gate-quality.yml` | GATE — Quality Checks | `pull_request`, `push`, `workflow_dispatch` | `quality` | Required |
| `gitleaks.yml` | GATE — Secret Scan | `pull_request`, `push` (`main`), `workflow_dispatch` | `gitleaks` | Required |
| `reviewer-response-completion.yml` | GATE — Reviewer Response Completion | `pull_request`, `pull_request_review`, `pull_request_review_comment`, `workflow_dispatch` | `reviewer-response-completion` | Required (#3746); event-conditional enforcement |

## Active advisory PR checks

| File | Name | Triggers | Jobs | Class |
| --- | --- | --- | --- | --- |
| `gate-pr-hygiene.yml` | GATE — PR Hygiene | `pull_request`, `workflow_dispatch` | `pr-hygiene` | Advisory |
| `gate-diff-scope.yml` | GATE — Diff Scope | `pull_request`, `workflow_dispatch` | `diff-scope` | Advisory |
| `gate-model-c.yml` | GATE — Model C Documentation | `pull_request`, `workflow_dispatch` | Model C path/docs gate | Advisory / profile-scoped |

## Manual-only / paused

These are `workflow_dispatch` only (or manual backfill). They are **not** merge blockers.

| File | Name | Disposition |
| --- | --- | --- |
| `gate-intent-labeler.yml` | GATE — Intent Labeler | Defer / rebuild only if justified |
| `ops-pr-issue-accounting.yml` | GATE — PR Issue Accounting | Defer / rebuild only if justified |
| `gate-drift.yml` | GATE — Drift Control | Defer / rebuild only if justified |
| `gate-branch-freshness.yml` | GATE — Branch Freshness | Defer |
| `docs-guardrails.yml` | Docs Guardrails | Defer |
| `design-compliance-warn.yml` | Design Compliance (Warn) | Defer |
| `gate-post-merge-readiness.yml` | GATE — Post-Merge Readiness | Manual backfill only; do not restore auto PR triggers |
| `post-merge-intent-verification.yml` | Post-Merge Intent Verification | Compatibility marker; no automatic closeout ownership |
| `pr-triage-zip-taint.yml` | PR Triage - ZIP Taint Classification | Manual triage remnant |
| `preview-invariants.yml` | Preview Invariants (Cloudflare Pages) | Manual preview checks |
| `lgfc-d1-migrate.yml` | LGFC D1 Migrate (remote) | Manual remote migrate |
| `ops-gehrig-retrosheet-ingest-4263.yml` | OPS — Gehrig Retrosheet Ingest (#4263) | Manual hosted-runner ingest of Retrosheet Gehrig games + AL standings into Production D1; default dry-run |
| `ai_review.yml` | AI Code Review | Manual AI review |
| `ops-cf-pages-retry.yml` | OPS — Cloudflare Pages Auto-Retry | Manual retry |
| `ops-agent-doctrine-issue-closeout.yml` | OPS — Agent Doctrine Issue Closeout | Manual closeout helper |
| `purge-zip-history.yml` | Purge ZIPs from Git History (FORCE PUSH) | Dangerous manual history rewrite — keep gated |
| `repository-runner-health.yml` | Repository Runner Health | Manual runner health |
| `cursor-bridge-build.yml` | Cursor Bridge Build | Manual |
| `cursor-bridge-watch.yml` | Cursor Bridge Watch | Manual |

## Post-merge ownership

Automatic source-issue closeout has **one** owner:

| File | Name | Triggers | Role |
| --- | --- | --- | --- |
| `post-merge-closeout.yml` | Post-Merge Detection | `pull_request_target` (closed / merged to `main`) | Single automatic closeout owner |

Supporting / bounded (must not claim the same automatic closeout ownership):

| File | Name | Role |
| --- | --- | --- |
| `post-merge-pr-body-closeout.yml` | Post-Merge PR Body Closeout | Manual / backfill closeout |
| `post-merge-remediation.yml` | Post-Merge Remediation | Failure remediation support |
| `ops-post-merge-self-healing.yml` | OPS — Post-Merge Self-Healing | Exception hygiene |
| `ops-pr-process-metrics.yml` | OPS — PR Process Metrics | Metrics (PR-visible; not required) |
| `diataxis-post-merge-validate.yml` | DIATAXIS Post-Merge Validation | Documentation validation support |
| `post-merge-late-review-reaudit.yml` | Post-Merge Late Review Reaudit | Late trusted-review reaudit |
| `post-merge-model-c.yml` | Post-Merge Model C Verification | Model C post-merge support |

## Production / platform OPS

Keep as OPS. Not `main` required checks.

Includes scheduled/push/dispatch workflows such as `ops-assess.yml`, `production-audit.yml`, `snapshot.yml`, `b2-s3-smoke-test.yml`, `b2-d1-daily-sync.yml`, `ops-main-change-monitor.yml`, `d1-migrations.yml`, `enforce-pr-only.yml`, `ops-design-compliance-audit.yml`, D1 backup/preflight suite (`ops-d1-*`), library/gehrig/chatterbox content jobs, `lgfc-cursor-dispatch.yml`, `lgfc-cursor-runner-health.yml`, and `program-2477-chat-attention-pulse.yml`.

Production scan trigger marker remains `docs/ops/scan-trigger.md` for on-demand OPS scans after merge to `main`.

## Docs / governance PR support (non-required)

These may appear on the PR check panel. They are **not** `main` required checks unless separately promoted.

| File | Name | Notes |
| --- | --- | --- |
| `agent-governance.yml` | Agent Governance | Agent governance check |
| `design-authority-check.yml` | Design Authority Check | Duplicate design-definition guard |
| `diataxis-folder-authority.yml` | DIATAXIS Folder Authority | Advisory; overlaps sibling workflow |
| `diataxis-folder-authority-check.yml` | DIATAXIS Folder Authority Check | Advisory; shared comment marker with sibling |
| `zip-history-audit.yml` | ZIP History Audit (Full History) | Full-history ZIP scan; PR-visible noise risk |
| `cursor-review.yml` | Cursor PR Review | Review helper |

## Delivery / component / orchestrators

Generic implementation-plan orchestration remains. The dedicated #1075 CI phase engine does **not**.

| File | Name | Notes |
| --- | --- | --- |
| `component-child-integration.yml` | Component Child Integration | Model B child integration |
| `orchestrator-issue-factory.yml` | Orchestrator — Issue Factory | Generic plan issue factory |
| `orchestrator-queue-advance.yml` | Orchestrator — Queue Advance | Queue advance |
| `orchestrator-agent-trigger.yml` | Orchestrator — Agent Trigger | Agent trigger |
| `orchestrator-draft-pr.yml` | Orchestrator — Draft PR Creator | Draft PR creation |
| `orchestrator-pr-state-sync.yml` | Orchestrator — PR State Sync | PR-visible state sync |
| `project-implementation-orchestrator.yml` | Project Implementation Orchestrator | High-sensitivity orchestrator |

## One-shot / deprecated candidates

These remain in the tree pending separately authorized retirement. Treat as non-authority. This PR does **not** delete them.

| File | Name | Notes |
| --- | --- | --- |
| `gate-ensure-issue.yml` | gate-ensure-issue | Deprecated noop stub (`pull_request_target`) |
| `bridge-1314-verification-closeout.yml` | Bridge 1314 Verification Closeout | Historical bridge closeout |
| `bridge-optional-closeout.yml` | Bridge Optional Closeout | Historical issue closeout |
| `ops-close-superseded-pr-1492.yml` | OPS — Close Superseded PR #1492 | Hardcoded PR closeout |
| `post-recovery-425-verify.yml` | Post-Recovery Verification (PR #425) | Historical recovery verification |

## Retired assets (must remain absent)

Retired by #2469 / related closeout — do not restore without new authorization:

- `ci-orchestration-engine.yml`
- `gate-reviewer-response.yml`
- `gate-close-work-issue.yml`
- parked legacy `ci.yml`, `deploy.yml`, `deploy-dev.yml`, `deploy-prod.yml`, `lgfc-validate.yml`, `test.yml`, `test-homepage.yml`
- `.github/ci-orchestration-state.json`
- `scripts/orchestrator/ci-orchestration-engine.mjs`
- `lgfc-ci-phase:*` issue generation
- `gate-zip-safety.yml` / required job `check-no-zip-files` (ZIP enforcement lives inside `quality`)

Retired by #2524:

- `update-docs.md` / `update-docs.lock.yml`

Verified 2026-09-14: those runtime files remain absent.

## Complete live file index

Every current `.github/workflows/*` file as of 2026-09-14 (`HEAD` at inventory refresh). Trust this count over memory.

| File | Name |
| --- | --- |
| `agent-governance.yml` | Agent Governance |
| `ai-execution-bridge-smoke.yml` | AI Execution Bridge Smoke Test |
| `ai-execution-bridge.yml` | AI Execution Bridge |
| `ai_review.yml` | AI Code Review |
| `b2-d1-daily-sync.yml` | OPS — B2 D1 Daily Sync |
| `b2-s3-smoke-test.yml` | OPS — B2 S3 Smoke Test |
| `bridge-1314-verification-closeout.yml` | Bridge 1314 Verification Closeout |
| `bridge-optional-closeout.yml` | Bridge Optional Closeout |
| `chatterbox-dev-integration-check.yml` | OPS — Chatterbox Development Integration Check (#3794) |
| `claude-code-wake.yml` | Claude Code Wake Delivery |
| `clear-legacy-photos-and-resync.yml` | OPS — Clear Legacy Photos + B2 Resync (#3552) |
| `component-child-integration.yml` | Component Child Integration |
| `copilot-setup-steps.yml` | Copilot Setup Steps |
| `cursor-bridge-build.yml` | Cursor Bridge Build |
| `cursor-bridge-watch.yml` | Cursor Bridge Watch |
| `cursor-local-wake.yml` | Cursor Local Wake Delivery |
| `cursor-review.yml` | Cursor PR Review |
| `d1-migrations.yml` | D1 Migrations |
| `design-authority-check.yml` | Design Authority Check |
| `design-compliance-warn.yml` | Design Compliance (Warn) |
| `diataxis-folder-authority-check.yml` | DIATAXIS Folder Authority Check |
| `diataxis-folder-authority.yml` | DIATAXIS Folder Authority |
| `diataxis-post-merge-validate.yml` | DIATAXIS Post-Merge Validation |
| `docs-guardrails.yml` | Docs Guardrails |
| `enforce-pr-only.yml` | Enforce PR Only Changes |
| `ensure-ai-build-label.yml` | Ensure AI Build Label |
| `events-public-dev-write-2859.yml` | OPS — Events-public Development D1 Write (#2859) |
| `gate-branch-freshness.yml` | GATE — Branch Freshness |
| `gate-diff-scope.yml` | GATE — Diff Scope |
| `gate-drift.yml` | GATE — Drift Control |
| `gate-ensure-issue.yml` | gate-ensure-issue |
| `gate-intent-labeler.yml` | GATE — Intent Labeler |
| `gate-model-c.yml` | GATE — Model C Documentation |
| `gate-post-merge-readiness.yml` | GATE — Post-Merge Readiness |
| `gate-pr-hygiene.yml` | GATE — PR Hygiene |
| `gate-quality.yml` | GATE — Quality Checks |
| `gehrig-content-discovery.yml` | Gehrig Content Discovery (#3551 / #3552) |
| `gehrig-perceptual-hash-backfill.yml` | Gehrig Perceptual Hash Backfill (#3740, follow-up to #3739) |
| `gehrig-resolve-near-duplicate.yml` | Gehrig Resolve Near-Duplicate Flag |
| `gehrig-rights-evidence-provenance-backfill.yml` | Gehrig Rights Evidence Provenance Backfill (#3728, follow-up to #3726) |
| `gehrig-wikimedia-batch-approval.yml` | Gehrig Wikimedia Batch Approval + Ingestion (#3551 / #3552) |
| `gitleaks.yml` | GATE — Secret Scan |
| `lgfc-cursor-dispatch.yml` | LGFC Cursor Dispatch |
| `lgfc-cursor-runner-health.yml` | LGFC Cursor Runner Health |
| `lgfc-d1-migrate.yml` | LGFC D1 Migrate (remote) |
| `library-books-content-load-3451.yml` | OPS — Library Books Content Load (#3451) |
| `library-books-search-eligibility-3455.yml` | OPS — Library Books Search Eligibility (#3455) |
| `library-books-search-eligibility-3456.yml` | OPS — Library Books Search Eligibility (#3456) |
| `library-content-production-preflight-2913.yml` | OPS — Library Content Production D1 Preflight (#2913) |
| `library-content-production-write-2860.yml` | OPS — Library Content Production Write (#2860) |
| `matchup-pair-monitor.yml` | OPS — Matchup Pair Monitor |
| `opencode.yml` | OpenCode Maintenance |
| `ops-agent-doctrine-issue-closeout.yml` | OPS — Agent Doctrine Issue Closeout |
| `ops-ai-review-enable.yml` | OPS — Enable AI Review Access (#2215) |
| `ops-assess.yml` | OPS — Site Assessment |
| `ops-cf-pages-retry.yml` | OPS — Cloudflare Pages Auto-Retry |
| `ops-chatterbox-command-bridge.yml` | OPS — Chatterbox Command Bridge (#3415) |
| `ops-chatterbox-reconciliation-sweep.yml` | OPS — Chatterbox Reconciliation Sweep (#3845) |
| `ops-chatterbox-room-bootstrap.yml` | OPS — Chatterbox Room Bootstrap (#3794) |
| `ops-close-superseded-pr-1492.yml` | OPS — Close Superseded PR #1492 |
| `ops-d1-3658-legacy-photos-inventory.yml` | OPS — 3658 Legacy Photos Rights Inventory |
| `ops-d1-backup-phase1-preflight-3268.yml` | OPS — D1 Backup Phase 1 Preflight (#3268) |
| `ops-d1-backup-phase2-capability-preflight-3268.yml` | OPS — D1 Backup Phase 2 Package 1 Capability Preflight (#3268) |
| `ops-d1-backup-phase2-export-upload-3268.yml` | OPS — D1 Backup Phase 2 Package 2 Export/Upload (#3268) |
| `ops-d1-backup-phase2-restore-verify-3268.yml` | OPS — D1 Backup Phase 2 Package 3 Restore Verify (#3268) |
| `ops-d1-backup-r2-phase1-preflight-3268.yml` | OPS — D1 Backup R2 Phase 1 Preflight (#3268) |
| `ops-d1-dev-migration-diagnostic.yml` | OPS — D1 Development Migration Diagnostic |
| `ops-d1-dev-migration-drift-fix.yml` | OPS — D1 Development Migration Drift Fix |
| `ops-d1-prod-dev-refresh.yml` | OPS — D1 Prod→Dev Refresh (#3359) |
| `ops-design-compliance-audit.yml` | OPS — Design Compliance Audit |
| `ops-gehrig-retrosheet-ingest-4263.yml` | OPS — Gehrig Retrosheet Ingest (#4263) |
| `ops-main-change-monitor.yml` | OPS — Main Change Monitor |
| `ops-post-merge-self-healing.yml` | OPS — Post-Merge Self-Healing |
| `ops-pr-issue-accounting.yml` | GATE — PR Issue Accounting |
| `ops-pr-process-metrics.yml` | OPS — PR Process Metrics |
| `ops-stale-communication.yml` | OPS — Stale communication detector |
| `ops-stale-issue-label-cleanup.yml` | OPS — Stale Issue Label Cleanup |
| `orchestrator-agent-trigger.yml` | Orchestrator — Agent Trigger |
| `orchestrator-draft-pr.yml` | Orchestrator — Draft PR Creator |
| `orchestrator-issue-factory.yml` | Orchestrator — Issue Factory |
| `orchestrator-pr-state-sync.yml` | Orchestrator — PR State Sync |
| `orchestrator-queue-advance.yml` | Orchestrator — Queue Advance |
| `pmo-dashboard-ci-build.yml` | PMO dashboard CI build |
| `pmo-dashboard-ci-deploy.yml` | PMO dashboard CI deploy |
| `post-merge-closeout.yml` | Post-Merge Detection |
| `post-merge-intent-verification.yml` | Post-Merge Intent Verification |
| `post-merge-late-review-reaudit.yml` | Post-Merge Late Review Reaudit |
| `post-merge-model-c.yml` | Post-Merge Model C Verification |
| `post-merge-pr-body-closeout.yml` | Post-Merge PR Body Closeout |
| `post-merge-remediation.yml` | Post-Merge Remediation |
| `post-recovery-425-verify.yml` | Post-Recovery Verification (PR #425) |
| `pr-triage-zip-taint.yml` | PR Triage - ZIP Taint Classification |
| `preview-invariants.yml` | Preview Invariants (Cloudflare Pages) |
| `production-audit.yml` | OPS — Production Audit |
| `production-content-preview-preflight-2859.yml` | OPS — Production Content Preview Evidence Preflight (#2859) |
| `program-2477-chat-attention-pulse.yml` | Program 2477 Chat Attention Pulse |
| `project-implementation-orchestrator.yml` | Project Implementation Orchestrator |
| `purge-zip-history.yml` | Purge ZIPs from Git History (FORCE PUSH) |
| `repository-runner-health.yml` | Repository Runner Health |
| `reviewer-response-completion.yml` | GATE — Reviewer Response Completion |
| `snapshot.yml` | OPS — Snapshot Backup |
| `zip-history-audit.yml` | ZIP History Audit (Full History) |


## Operator rules

1. **Required checks for `main`:** `quality`, `gitleaks`, and `reviewer-response-completion` (#3746).
2. **Do not** add OPS, remaining advisory, manual-only, or retired checks to the required ruleset without promotion evidence.
3. **Do not** treat a red advisory/support PR check as a merge blocker unless the live ruleset lists it as required.
4. **New workflows:** classify under `docs/governance/CI-AND-VERIFICATION.md`, update the classification matrix / PR workflow inventory, and update this operator inventory in the same change set when practical.
5. **GATE naming** (`gate-*.yml` / `GATE — …`) does not automatically mean “required.”
6. **OPS naming** (`ops-*.yml` / `OPS — …`) must never become a `main` required check.
7. Prefer thin routing to current controlled references over duplicating long policy text here.

## Remaining Product Authority decisions (not in this change)

Recorded for closeout honesty; not executed here:

1. Retire one-shot / deprecated stubs listed above, or leave them frozen.
2. Consolidate overlapping DIATAXIS advisory workflows, or keep both.
3. Keep, pause, or retire `program-2477-chat-attention-pulse.yml` after program closure.

## Count

Current `.github/workflows/` file count at last review of this document: **102**.

When the live tree and this count disagree, trust the live tree and open a bounded docs correction under the active CI inventory issue.

## References

- Domain policy: `docs/governance/CI-AND-VERIFICATION.md`
- Machine-readable surface: `scripts/ci/merge_protection_surface.mjs`
- Guardrails map: `.github/CI_GUARDRAILS_MAP.md`
- Merge protection surface: `docs/reference/ci/merge-protection-surface.md`
- Classification matrix: `docs/reference/ci/lgfc-ci-workflow-classification-matrix.md`
- PR workflow inventory: `docs/reference/ci/pr-workflow-ci-inventory.md`
- PR process: `docs/governance/PR_PROCESS.md`
- PR template: `.github/pull_request_template.md`
