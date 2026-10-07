---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: Task #3633-005 inventory of existing CI workflows, CI scripts, and tests, mapped to the Phase 1 catalog
Does Not Own: Gap dispositions (task #3633-007), deduplication decisions (task #3633-006), new workflows, or Product date changes
Canonical Reference: /docs/ops/implementation-plans/issue-3633-002-ordered-plan.md
Related Issues: #3633, #4463, #4462, #4464, #4465
Last Reviewed: 2026-10-07
---

# CI and test inventory for #3633

## Status

`_DRAFT` — documentation only. Counts and file lists were produced from `main` on 2026-10-07 by reading the repository files. Mapping a check to a catalog domain says what it appears to cover from its name, triggers and the scripts it calls. It does not say the check is sufficient; Phase 4 (#4465) decides that.

## Method

- Workflows: all 107 files under `.github/workflows/` parsed for name, triggers, schedules, called scripts and secrets.
- Scripts: all 111 files under `scripts/ci/`, checked for a reference in any workflow or in `package.json`.
- Tests: all 240 `*.test.*` and `*.spec.*` files under `tests/`, grouped by catalog domain.
- Authority status comes from the names the repository already uses: the pre-merge checks `quality`, `gitleaks` and `reviewer-response-completion` are required; `pr-hygiene` hard-fails on four codes; `diff-scope` is advisory.
- Not recorded here: runtime and cost per run, and evidence retention. Those need the Actions run history and are listed as follow-up for #4464 and #4465.

## Summary

| Surface | Count |
| --- | --- |
| Workflow files | 107 |
| Run on a pull request | 21 (plus 4 on `pull_request_target`) |
| Run on a schedule | 17 |
| Run on push to main | 24 |
| Manual (`workflow_dispatch`) | 88 (many only manual) |
| Scripts under `scripts/ci/` | 111 |
| Test files under `tests/` | 240 |
| Playwright browser specs | 6 |

### Findings that matter for the gap assessment

1. **26 test files do not run in CI.** `vitest.config.ts` excludes `tests/post-merge-*.test.mjs` (22 files) and `tests/reviewer-*.test.mjs` (4 files), and the required `quality` job runs `npm test` with that config. No workflow runs those files another way. They cover the post-merge closeout and reviewer-lifecycle pipeline. Run separately on 2026-10-07, 4 of the 315 tests in the post-merge group fail on unmodified `main` (`post-merge-closeout-all-manifests` and the consolidated closeout ownership test), so the failures are not being caught.
2. **Playwright specs are not part of the required checks.** The six specs (`tests/homepage.spec.ts` and five under `tests/e2e/`, including `accessibility-scan.spec.ts`) run only through `preview-invariants`, `production-audit` and manual use. `preview-invariants` is manual only.
3. **41 scripts under `scripts/ci/` are not named in any workflow or in `package.json`.** 27 are called only by other scripts. 14 have no reference outside their own tests (listed below).
4. **Scheduled checks fail today for known reasons:** scheduled content publish fails on a missing secret (#4407, exception Issue #4453). The LGFC Cursor runner-health workflow had a `secrets` context error (#4446, fixed in #4455, merged).
5. **88 workflows can be run by hand, and most of the Production-writing ones are manual only.** That is by design for data loads, but means the catalog rows for D1 and content pipelines are covered by scripts and tests, not by an automatic check.

## Workflows


### PR gate (26)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `agent-governance.yml` | PR, manual | Agent governance bootstrap check | Gate |
| `component-child-integration.yml` | PR, PR review, workflow run, manual | Component child integration eligibility | Gate |
| `cursor-review.yml` | PR | Cursor review request | Advisory |
| `design-authority-check.yml` | PR | Documentation headers, canonical hashes, DIATAXIS folder authority | Gate / advisory |
| `design-compliance-warn.yml` | manual | Design compliance warning | Advisory (dispatch only) |
| `diataxis-folder-authority-check.yml` | PR | Documentation headers, canonical hashes, DIATAXIS folder authority | Gate / advisory |
| `diataxis-folder-authority.yml` | PR | Documentation headers, canonical hashes, DIATAXIS folder authority | Gate / advisory |
| `diataxis-post-merge-validate.yml` | PR | Documentation headers, canonical hashes, DIATAXIS folder authority | Gate / advisory |
| `docs-guardrails.yml` | manual, PR | Documentation headers, canonical hashes, DIATAXIS folder authority | Gate / advisory |
| `enforce-pr-only.yml` | push | Enforce PR-only changes to main | Guard |
| `ensure-ai-build-label.yml` | manual, push | Intent label and allowlist | Gate / helper |
| `gate-branch-freshness.yml` | manual | Branch freshness | Gate (dispatch only) |
| `gate-diff-scope.yml` | PR, manual | Diff scope against the PR allowlist | Advisory (non-blocking during PR-process rebuild) |
| `gate-drift.yml` | manual | Drift gate | Gate (dispatch only) |
| `gate-ensure-issue.yml` | PR (target) | Issue-first accounting and exactly one source issue | Gate |
| `gate-intent-labeler.yml` | manual | Intent label and allowlist | Gate / helper |
| `gate-model-c.yml` | PR, manual | Protected-path delivery profile (Model C) | Gate |
| `gate-post-merge-readiness.yml` | manual | Pre-merge post-merge-readiness check | Gate (dispatch only) |
| `gate-pr-hygiene.yml` | PR, manual | PR hygiene: allowlist, placeholders, acceptance boxes | Hard-failing on four codes, otherwise advisory |
| `gate-quality.yml` | PR, push, manual | Build, typecheck, lint, format, repository structure, unit tests | Required pre-merge check (quality) |
| `gitleaks.yml` | PR, push, manual | Secrets and credential leakage | Required pre-merge check (gitleaks) |
| `ops-pr-issue-accounting.yml` | manual | Issue-first accounting and exactly one source issue | Gate |
| `ops-pr-process-metrics.yml` | PR, manual | PR process metrics | Reporting |
| `preview-invariants.yml` | manual | Preview invariants (Playwright on the Pages preview) | On demand |
| `reviewer-response-completion.yml` | PR, PR review, PR review comment, manual | Reviewer lifecycle and separation of duties | Required pre-merge check (reviewer-response-completion) |
| `zip-history-audit.yml` | PR, manual | Deleted-ZIP / zip history audit | Gate |

### Agent and queue automation (20)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `ai-execution-bridge-smoke.yml` | push, schedule (0 9 * * 1), manual | AI execution bridge | Automation |
| `ai-execution-bridge.yml` | issues, manual | AI execution bridge | Automation |
| `ai_review.yml` | manual | Claude Code, Copilot, opencode and AI review hooks | Automation |
| `claude-code-wake.yml` | PR, issue comment, manual | Claude Code, Copilot, opencode and AI review hooks | Automation |
| `copilot-setup-steps.yml` | manual, push | Claude Code, Copilot, opencode and AI review hooks | Automation |
| `cursor-bridge-build.yml` | manual | Cursor bridge, dispatch and wake | Automation |
| `cursor-bridge-watch.yml` | manual | Cursor bridge, dispatch and wake | Automation |
| `cursor-local-wake.yml` | manual | Cursor bridge, dispatch and wake | Automation |
| `lgfc-cursor-dispatch.yml` | issues, manual | Cursor bridge, dispatch and wake | Automation |
| `opencode.yml` | issue comment | Claude Code, Copilot, opencode and AI review hooks | Automation |
| `ops-ai-review-enable.yml` | manual | Claude Code, Copilot, opencode and AI review hooks | Automation |
| `ops-chatterbox-command-bridge.yml` | issue comment | Chatterbox command bridge and room bootstrap | Automation |
| `ops-chatterbox-room-bootstrap.yml` | push, manual | Chatterbox command bridge and room bootstrap | Automation |
| `orchestrator-agent-trigger.yml` | issues | Orchestrator | Automation |
| `orchestrator-draft-pr.yml` | issues | Orchestrator | Automation |
| `orchestrator-issue-factory.yml` | push | Orchestrator | Automation |
| `orchestrator-pr-state-sync.yml` | PR | Orchestrator | Automation |
| `orchestrator-queue-advance.yml` | issues | Orchestrator | Automation |
| `program-2477-chat-attention-pulse.yml` | schedule (*/15 * * * *), manual | Chatterbox command bridge and room bootstrap | Automation |
| `project-implementation-orchestrator.yml` | PR (target), manual | Orchestrator | Automation |

### Content / media (19)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `b2-d1-daily-sync.yml` | manual, schedule (0 9 * * *) | B2/D1 sync and S3 smoke | Scheduled |
| `b2-s3-smoke-test.yml` | manual, schedule (15 6 * * *) | B2/D1 sync and S3 smoke | Scheduled |
| `clear-legacy-photos-and-resync.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `events-public-dev-write-2859.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `gehrig-content-discovery.yml` | manual, schedule (0 13 * * 1) | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `gehrig-perceptual-hash-backfill.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `gehrig-resolve-near-duplicate.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `gehrig-rights-evidence-provenance-backfill.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `gehrig-wikimedia-batch-approval.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `library-books-content-load-3451.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `library-books-search-eligibility-3455.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `library-books-search-eligibility-3456.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `library-content-production-preflight-2913.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `library-content-production-write-2860.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `ops-d1-3658-legacy-photos-inventory.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `ops-gehrig-retrosheet-ingest-4263.yml` | manual | Gehrig discovery (scheduled) and content-pipeline backfills | Scheduled / on demand (D1 writes) |
| `ops-scheduled-content-publish.yml` | schedule (0 14 * * *; 0 15 * * *), manual | Scheduled content publish | Scheduled |
| `production-content-preview-preflight-2859.yml` | manual | Library books and library content loads | On demand (Production writes) |
| `seed-club-home-pilot.yml` | manual | Library books and library content loads | On demand (Production writes) |

### Post-merge (11)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `bridge-1314-verification-closeout.yml` | manual, push | Post-merge closeout of the source issue | Automatic after merge |
| `bridge-optional-closeout.yml` | manual, push | Post-merge closeout of the source issue | Automatic after merge |
| `ops-main-change-monitor.yml` | push, manual | Main-branch change monitor | Push monitor |
| `ops-post-merge-self-healing.yml` | manual, schedule (0 6 * * *) | Post-merge self-healing sweep | Scheduled |
| `ops-workflow-failure-exception-issues.yml` | workflow run | Exception Issue on watched workflow failure (#4444) | Automatic on failure |
| `post-merge-closeout.yml` | PR (target) | Post-merge closeout of the source issue | Automatic after merge |
| `post-merge-intent-verification.yml` | PR (target), push, manual | Post-merge closeout of the source issue | Automatic after merge |
| `post-merge-late-review-reaudit.yml` | PR review comment, PR review | Post-merge closeout of the source issue | Automatic after merge |
| `post-merge-model-c.yml` | PR, manual | Post-merge closeout of the source issue | Automatic after merge |
| `post-merge-pr-body-closeout.yml` | push, manual | Post-merge closeout of the source issue | Automatic after merge |
| `post-merge-remediation.yml` | workflow run | Post-merge closeout of the source issue | Automatic after merge |

### Health and monitoring (11)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `chatterbox-dev-integration-check.yml` | push, manual | Chatterbox reconciliation sweep and dev integration check | Scheduled / push |
| `lgfc-cursor-runner-health.yml` | manual, schedule (17 11 * * *) | Self-hosted runner health | Scheduled |
| `matchup-pair-monitor.yml` | manual | Weekly Matchup pair monitor | On demand |
| `ops-assess.yml` | schedule (0 2 * * *), push, manual | Repository assessment | Scheduled |
| `ops-chatterbox-reconciliation-sweep.yml` | schedule (*/30 * * * *), push, manual | Chatterbox reconciliation sweep and dev integration check | Scheduled / push |
| `ops-design-compliance-audit.yml` | push, schedule (0 2 * * *), manual | Design compliance audit | Scheduled |
| `ops-stale-communication.yml` | schedule (*/15 * * * *), manual, PR | Stale communication detector | Scheduled |
| `pmo-dashboard-ci-build.yml` | manual, schedule (*/30 * * * *), issues, push | PMO dashboard build and deploy | Scheduled / push |
| `pmo-dashboard-ci-deploy.yml` | manual, workflow run, push | PMO dashboard build and deploy | Scheduled / push |
| `production-audit.yml` | push, schedule (15 12,0 * * *), manual | Production audit (Playwright against Production) | Scheduled |
| `repository-runner-health.yml` | manual | Self-hosted runner health | Scheduled |

### Deployment and data (5)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `d1-migrations.yml` | push | D1 migrations applied to prod and dev on push | Automatic on push to main |
| `lgfc-d1-migrate.yml` | manual | D1 migration, diagnostic and drift repair, on demand | On demand (writes) |
| `ops-d1-dev-migration-diagnostic.yml` | manual | D1 migration, diagnostic and drift repair, on demand | On demand (writes) |
| `ops-d1-dev-migration-drift-fix.yml` | manual | D1 migration, diagnostic and drift repair, on demand | On demand (writes) |
| `ops-d1-prod-dev-refresh.yml` | manual | D1 migration, diagnostic and drift repair, on demand | On demand (writes) |

### Housekeeping (6)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `ops-agent-doctrine-issue-closeout.yml` | manual | Issue and label hygiene, one-off closes, ZIP purge | On demand / push |
| `ops-cf-pages-retry.yml` | manual | Issue and label hygiene, one-off closes, ZIP purge | On demand / push |
| `ops-close-superseded-pr-1492.yml` | manual, push | Issue and label hygiene, one-off closes, ZIP purge | On demand / push |
| `ops-stale-issue-label-cleanup.yml` | manual, push | Issue and label hygiene, one-off closes, ZIP purge | On demand / push |
| `pr-triage-zip-taint.yml` | manual | Issue and label hygiene, one-off closes, ZIP purge | On demand / push |
| `purge-zip-history.yml` | manual | Issue and label hygiene, one-off closes, ZIP purge | On demand / push |

### Recovery / Day-2 (9)

| Workflow file | Triggers | Covers | Authority / status |
| --- | --- | --- | --- |
| `ops-d1-backup-phase1-preflight-3268.yml` | manual | D1 backup preflights, export, restore verify (#3268) | On demand |
| `ops-d1-backup-phase2-capability-preflight-3268.yml` | manual | D1 backup preflights, export, restore verify (#3268) | On demand |
| `ops-d1-backup-phase2-export-upload-3268.yml` | manual | D1 backup preflights, export, restore verify (#3268) | On demand |
| `ops-d1-backup-phase2-restore-verify-3268.yml` | manual | D1 backup preflights, export, restore verify (#3268) | On demand |
| `ops-d1-backup-r2-phase1-preflight-3268.yml` | manual | D1 backup preflights, export, restore verify (#3268) | On demand |
| `ops-d1-backup-scheduled-daily-3268.yml` | schedule (0 9 * * *), manual | Scheduled daily D1 export | Scheduled |
| `ops-d1-backup-scheduled-quarterly-drill-3268.yml` | schedule (0 10 1 1,4,7,10 *), manual | Scheduled quarterly restore drill | Scheduled |
| `post-recovery-425-verify.yml` | PR, manual | Post-recovery verification | On demand |
| `snapshot.yml` | schedule (0 8 * * *), manual, push | Repository snapshot / Pages snapshot | Scheduled |

## Tests by catalog domain

| Group | Files |
| --- | --- |
| Public website, routes, SEO, responsive, social, consent | 59 |
| Content pipeline, media, rights, archive, rotation | 46 |
| Reviewer lifecycle, hygiene, delivery profile, Model C, diff scope | 45 |
| Agent, bridge, chatterbox, orchestrator, wake, ops runtime | 24 |
| Admin routes, APIs and auth matrix | 22 |
| Post-merge closeout and self-healing | 13 |
| D1 backup, prod/dev, migrations, verify | 11 |
| Membership, join, login, session | 10 |
| Playwright browser (tests/e2e, homepage.spec) | 6 |
| Other / review | 2 |
| Fundraiser | 2 |

Files in the group "Other / review" (`tests/api/join-email-opt-in-gate.test.ts`, `tests/rendition-generation-ui.test.tsx`) map to Membership and Content / media respectively.

Test files by group, for use in #4464 and #4465:


<details><summary>Admin routes, APIs and auth matrix (22)</summary>

- `tests/admin-audit-reporting.test.tsx`
- `tests/admin-auth-matrix.test.ts`
- `tests/admin-cms-content.test.tsx`
- `tests/admin-editorial-archive.test.tsx`
- `tests/admin-editorial-rotation-preview.test.ts`
- `tests/admin-events.test.tsx`
- `tests/admin-fundraiser-details-create.test.ts`
- `tests/admin-fundraiser-details-delete.test.ts`
- `tests/admin-fundraiser-details-list.test.ts`
- `tests/admin-fundraiser-preview.test.tsx`
- `tests/admin-matchup.test.tsx`
- `tests/admin-media-assets.test.tsx`
- `tests/admin-moderation.test.tsx`
- `tests/admin-operations.test.tsx`
- `tests/admin-photos.test.ts`
- `tests/api/admin-editorial-suppress.test.ts`
- `tests/api/admin-member-soft-delete.test.ts`
- `tests/api/admin-photos-purge.test.ts`
- `tests/club-staging.test.tsx`
- `tests/content-pipeline-candidate-admin-api.test.ts`
- `tests/fanclub-operations.test.tsx`
- `tests/faq-moderation.test.ts`

</details>

<details><summary>Agent, bridge, chatterbox, orchestrator, wake, ops runtime (24)</summary>

- `tests/ai-execution-bridge.test.mjs`
- `tests/bounded-retry.test.ts`
- `tests/branch-freshness-gate.test.mjs`
- `tests/chatterbox-check-in-race.test.ts`
- `tests/chatterbox-core.test.ts`
- `tests/chatterbox-force-release.test.ts`
- `tests/chatterbox-participant-auth.test.ts`
- `tests/chatterbox-pmo-actions.test.ts`
- `tests/component-integration-eligibility.test.mjs`
- `tests/cursor-bridge-launch-transaction.test.ts`
- `tests/cursor-bridge-lifecycle-telemetry.test.mjs`
- `tests/cursor-bridge-parent-context.test.mjs`
- `tests/cursor-bridge-preflight.test.ts`
- `tests/cursor-bridge-watch-build.test.ts`
- `tests/cursor-next-work-resolver.test.mjs`
- `tests/github-api-retry.test.mjs`
- `tests/github-issue-api.test.mjs`
- `tests/launch-readiness-h011-disposition.test.ts`
- `tests/launch-readiness-manifest.test.ts`
- `tests/lgfc-event-wake.test.mjs`
- `tests/ops-reconcile-findings.test.mjs`
- `tests/ops-runtime-escalation.test.mjs`
- `tests/ops-runtime-surface.test.mjs`
- `tests/orchestrator-queue.test.mjs`

</details>

<details><summary>Content pipeline, media, rights, archive, rotation (46)</summary>

- `tests/api/rights-evidence-queue.test.ts`
- `tests/archive-items-api.test.ts`
- `tests/archive-items-repository.test.ts`
- `tests/b2-ingest-validation.test.ts`
- `tests/close-duplicate-remediation-issues.test.mjs`
- `tests/content-inventory-media.test.ts`
- `tests/content-inventory-public.test.ts`
- `tests/content-inventory-rotation.test.ts`
- `tests/content-inventory-search.test.ts`
- `tests/content-inventory-seed.test.ts`
- `tests/content-items-curator-decision.test.ts`
- `tests/content-pipeline-batch-rights-approval.test.ts`
- `tests/content-pipeline-candidate-import.test.ts`
- `tests/content-pipeline-candidate-repository.test.ts`
- `tests/content-pipeline-discovery-text-signals.test.ts`
- `tests/content-pipeline-dpla-adapter.test.ts`
- `tests/content-pipeline-duplicate-detection.test.ts`
- `tests/content-pipeline-ingest.test.ts`
- `tests/content-pipeline-license-conclusion-mapping.test.ts`
- `tests/content-pipeline-media-key-member-upload.test.ts`
- `tests/content-pipeline-media-key-readable-intake.test.ts`
- `tests/content-pipeline-media-reference.test.ts`
- `tests/content-pipeline-member-submission-intake.test.ts`
- `tests/content-pipeline-publication-prep.test.ts`
- `tests/content-pipeline-rights-evidence-backfill.test.ts`
- `tests/content-search-run-outcome.test.ts`
- `tests/content-search-runs.test.ts`
- `tests/content-storage-policy-2312.test.ts`
- `tests/d1-b2-fail-closed.test.ts`
- `tests/failure-remediation-routing.test.mjs`
- `tests/ingest-gehrig-retrosheet-zip.test.ts`
- `tests/legacy-photos-cleanup-plan.test.ts`
- `tests/media-ingest-repository.test.ts`
- `tests/migration-0065-archive-acquisition-rollback.test.ts`
- `tests/migration-0065-archive-acquisition.test.ts`
- `tests/perceptual-hash.test.ts`
- `tests/photos-rights-reconcile.test.ts`
- `tests/post-merge-remediation-workflow.test.mjs`
- `tests/production-content-preview-preflight-2859.test.mjs`
- `tests/publication-audit.test.ts`
- `tests/publication-transition-gate.test.ts`
- `tests/rights-evidence-hold-queue.test.ts`
- `tests/rights-evidence-owner-worklist.test.ts`
- `tests/rights-evidence.test.ts`
- `tests/rights-hold-quarantine.test.ts`
- `tests/scheduled-content-publish-due.test.ts`

</details>

<details><summary>D1 backup, prod/dev, migrations, verify (11)</summary>

- `tests/d1-backup-phase1-preflight-3268.test.mjs`
- `tests/d1-backup-phase2-capability-preflight-3268.test.mjs`
- `tests/d1-backup-phase2-export-upload-3268.test.mjs`
- `tests/d1-backup-phase2-restore-verify-3268.test.mjs`
- `tests/d1-backup-r2-phase1-preflight-3268.test.mjs`
- `tests/d1-prod-dev-identity.test.mjs`
- `tests/d1-prod-dev-refresh.test.mjs`
- `tests/d1-prod-dev-sanitize.test.mjs`
- `tests/diataxis-migration-ratchet.test.mjs`
- `tests/migration-0073-lou-gehrig-day-2859.test.ts`
- `tests/verify-cloudflare-d1-auth.test.mjs`

</details>

<details><summary>Fundraiser (2)</summary>

- `tests/fundraiser-details-list.test.ts`
- `tests/fundraiser.test.ts`

</details>

<details><summary>Membership, join, login, session (10)</summary>

- `tests/api/fanclub-gehrig-box-score.test.ts`
- `tests/api/fanclub-photos-upload.test.ts`
- `tests/api/fanclub-timeline.test.ts`
- `tests/fanclub-home-dynamic.test.tsx`
- `tests/fanclub-home-shell.test.tsx`
- `tests/fanclub-responsive-completion-2858.test.tsx`
- `tests/friends-of-fanclub.test.tsx`
- `tests/join-login-auth.test.tsx`
- `tests/public-auth-state-validation.test.tsx`
- `tests/use-member-session.test.tsx`

</details>

<details><summary>Other / review (2)</summary>

- `tests/api/join-email-opt-in-gate.test.ts`
- `tests/rendition-generation-ui.test.tsx`

</details>

<details><summary>Playwright browser (tests/e2e, homepage.spec) (6)</summary>

- `tests/e2e/accessibility-scan.spec.ts`
- `tests/e2e/homepage-sections.spec.ts`
- `tests/e2e/launch-readiness-fanclub-routes.spec.ts`
- `tests/e2e/launch-readiness-public-routes.spec.ts`
- `tests/e2e/mobile-navigation.spec.ts`
- `tests/homepage.spec.ts`

</details>

<details><summary>Post-merge closeout and self-healing (13)</summary>

- `tests/gate-post-merge-readiness.test.mjs`
- `tests/late-post-merge-findings.test.mjs`
- `tests/open-workflow-failure-issue.test.mjs`
- `tests/ops-post-merge-self-healing-workflow.test.mjs`
- `tests/post-merge-implementation-evidence.test.mjs`
- `tests/post-merge-self-heal-apply.test.mjs`
- `tests/post-merge-self-heal-backlog.test.mjs`
- `tests/post-merge-self-heal-detect.test.mjs`
- `tests/post-merge-self-heal-escalate.test.mjs`
- `tests/post-merge-self-heal-rollout.test.mjs`
- `tests/post-merge-stabilization.test.mjs`
- `tests/post-merge-validation-surface.test.mjs`
- `tests/post-merge-validator.test.mjs`

</details>

<details><summary>Public website, routes, SEO, responsive, social, consent (59)</summary>

- `tests/analytics-consent.test.tsx`
- `tests/api/library-submit-rights-capture.test.ts`
- `tests/api/milestones-list-visibility.test.ts`
- `tests/ask-page.test.tsx`
- `tests/batch-post-merge-closeout.test.mjs`
- `tests/campaignSpotlight.test.tsx`
- `tests/club-home-events-module-2859.test.tsx`
- `tests/club-home-recognition-module-2859.test.tsx`
- `tests/club-home-story-images.test.tsx`
- `tests/content-inventory-club-home.test.ts`
- `tests/content-inventory-public-surface-validation.test.ts`
- `tests/emit-closeout-backlog-metrics.test.mjs`
- `tests/events-public-content-backfill.test.ts`
- `tests/events-public-dev-write-2859.test.mjs`
- `tests/faq-browse.test.tsx`
- `tests/faq-page.test.tsx`
- `tests/ga-measurement-id.test.ts`
- `tests/gehrig-timeline-club-home.test.tsx`
- `tests/homepage-structure.test.tsx`
- `tests/library-books-content-load-3451.test.mjs`
- `tests/library-books-search-eligibility-3455.test.mjs`
- `tests/library-books-search-eligibility-3456.test.mjs`
- `tests/library-content-backfill.test.ts`
- `tests/library-content-production-write-2860.test.mjs`
- `tests/library-populated-content-qa-3453.test.ts`
- `tests/matchup-current-rotation.test.ts`
- `tests/matchup-pair-monitor.test.mjs`
- `tests/matchup-repair.test.ts`
- `tests/milestones-section.test.tsx`
- `tests/mobile-navigation.test.tsx`
- `tests/photo-credit-editor.test.tsx`
- `tests/photo-detail-experience.test.tsx`
- `tests/photo-lightbox-grid-prototype.test.tsx`
- `tests/photo-upload-validation.test.ts`
- `tests/post-merge-closeout-all-manifests.test.mjs`
- `tests/post-merge-closeout-automatic.test.mjs`
- `tests/post-merge-closeout-batch.test.mjs`
- `tests/post-merge-closeout-body-generate.test.mjs`
- `tests/post-merge-closeout-integrity.test.mjs`
- `tests/post-merge-closeout-manual-merge-sha.test.mjs`
- `tests/post-merge-closeout-wave1.test.mjs`
- `tests/post-merge-closeout-wave2.test.mjs`
- `tests/post-merge-closeout-wave3a.test.mjs`
- `tests/post-merge-closeout-wave3b.test.mjs`
- `tests/post-merge-source-issue-closeout.test.mjs`
- `tests/privacy-disclosure.test.ts`
- `tests/program-1255-closeout-readiness.test.ts`
- `tests/prune-closeout-manifest.test.mjs`
- `tests/public-d1-b2-read-path-validation.test.ts`
- `tests/public-mobile-responsive-validation.test.ts`
- `tests/public-route-navigation-validation.test.ts`
- `tests/public-seo-artifacts.test.ts`
- `tests/resolve-closeout-manifests-from-push.test.mjs`
- `tests/social-fallbacks.test.ts`
- `tests/social-wall.test.tsx`
- `tests/website-qa-final-handoff-validation.test.ts`
- `tests/website-qa-legacy-disposition-package.test.ts`
- `tests/weekly-matchup-hold.test.tsx`
- `tests/weekly-matchup.test.tsx`

</details>

<details><summary>Reviewer lifecycle, hygiene, delivery profile, Model C, diff scope (45)</summary>

- `tests/agent-claim-contract.test.mjs`
- `tests/agent-governance-bootstrap.test.mjs`
- `tests/ai-review-access.test.ts`
- `tests/ai-review-routes.test.ts`
- `tests/chatterbox-resolve-preview-url.test.ts`
- `tests/claim-collision-contract.test.mjs`
- `tests/cursor-bridge-delivery-first.test.mjs`
- `tests/delivery-profile.test.mjs`
- `tests/deterministic-approval-inventory.test.mjs`
- `tests/diataxis-folder-audit.test.mjs`
- `tests/diff-scope-gate.test.mjs`
- `tests/engineering-candidate-intake.test.mjs`
- `tests/executable-child-contract.test.mjs`
- `tests/governance-duplication-check.test.mjs`
- `tests/issue-3790-reviewer-disposition-regression.test.mjs`
- `tests/issue-3796-lint-format.test.mjs`
- `tests/issue-3797-verification-evidence-premerge.test.mjs`
- `tests/issue-3805-reviewer-ledger.test.mjs`
- `tests/issue-3807-model-c-workflow.test.mjs`
- `tests/issue-4066-reviewer-native-resolve.test.mjs`
- `tests/issue-templates-no-default-agent-claim.test.mjs`
- `tests/merge-protection-surface.test.mjs`
- `tests/model-c-delivery-profile.test.mjs`
- `tests/model-c-path-gate.test.mjs`
- `tests/model-c-post-merge-workflow-security.test.mjs`
- `tests/model-c-post-merge.test.mjs`
- `tests/next-executable.test.mjs`
- `tests/ops-ai-review-enable-2215.test.mjs`
- `tests/pipeline-preparation-contract.test.mjs`
- `tests/pmo-work-classification.test.mjs`
- `tests/policy-control-matrix-check.test.mjs`
- `tests/post-merge-delivery-lineage-3069.test.mjs`
- `tests/pr-body-auto-repair.test.mjs`
- `tests/pr-class-quality-plan.test.mjs`
- `tests/pr-hygiene-audit.test.mjs`
- `tests/pr-issue-accounting-parser.test.mjs`
- `tests/pr-preflight.test.mjs`
- `tests/pr-process-metrics.test.mjs`
- `tests/preview-isolation-inventory.test.ts`
- `tests/review-settle-gate.test.mjs`
- `tests/reviewer-comment-disposition.test.mjs`
- `tests/reviewer-gate-simulation.test.mjs`
- `tests/reviewer-lifecycle-gate.test.mjs`
- `tests/reviewer-preparer-handback.test.mjs`
- `tests/successor-release.test.mjs`

</details>

## Scripts under `scripts/ci/` with no reference outside their own tests

These are candidates for the deduplication review. None is proposed for removal here; a script with only test references may still be run by hand.


- `scripts/ci/branch_freshness_gate.mjs`
- `scripts/ci/cursor_next_work_resolver.mjs`
- `scripts/ci/delivery_system_acceptance.mjs`
- `scripts/ci/deterministic-approval-inventory.mjs`
- `scripts/ci/docs_check_paths.sh`
- `scripts/ci/engineering-candidate-intake.mjs`
- `scripts/ci/failure-remediation-routing.mjs`
- the forbidden-backend guard script behind `backend_reference_guard.sh` (its own name is not written here, because the guard scans documents for that name)
- `scripts/ci/ops_runtime_surface.mjs`
- `scripts/ci/pipeline-preparation-contract.mjs`
- `scripts/ci/post_merge_validation_surface.mjs`
- `scripts/ci/preview-isolation-manifest.json`
- `scripts/ci/successor-release.mjs`
- `scripts/ci/verify_pr_intent_allowlist.mjs`

## Coverage map against the Phase 1 catalog

Evidence of any existing check per domain, with no sufficiency judgment.

| Catalog domain | Existing checks found | Noted from the inventory |
| --- | --- | --- |
| Repository / PR qualification | `gate-quality`, `gitleaks`, `reviewer-response-completion`, `gate-pr-hygiene`, `gate-diff-scope`, `gate-model-c`, `d1-migrations`, docs and DIATAXIS gates, post-merge closeout set | Reviewer and post-merge tests are excluded from CI (finding 1) |
| Public website | `tests/e2e/*` specs, `public-*` validation tests, `preview-invariants`, `production-audit` | Browser specs are manual or Production-scheduled, not PR-required |
| Membership / authentication | `join-login-auth`, `use-member-session`, `public-auth-state-validation` tests, `fanclub-*` tests | No scheduled auth qualification workflow found |
| Administration | `admin-auth-matrix.test.ts` plus per-page admin tests | Matrix test exists; no scheduled run against a deployed environment found |
| Content / media / Club Newspaper | `content-pipeline-*`, `rights-*`, `scheduled-content-publish-due.test.ts`, `ops-scheduled-content-publish`, `b2-d1-daily-sync`, `gehrig-content-discovery` | Scheduled publish failing on a missing secret (#4407) |
| Fundraiser / Givebutter | `fundraiser.test.ts`, `admin-fundraiser-*` tests | Two fundraiser-named test groups; no widget or degraded-state workflow found (blocked on #4139) |
| Accessibility / UX | `tests/e2e/accessibility-scan.spec.ts`, `mobile-navigation` tests | Manual and Production-audit only |
| Performance / reliability | `production-audit`, `lgfc-cursor-runner-health`, `repository-runner-health`, `ops-assess`, `matchup-pair-monitor` | No route performance baseline workflow found |
| Recovery / Day-2 | `ops-d1-backup-*` (preflight, export, restore verify, daily, quarterly drill), `snapshot`, `post-recovery-425-verify` | Restore drill is quarterly; deployment-rollback exercise not found |
| Security / adversarial | `gitleaks`, auth matrix, `public-seo`, `backend_reference_guard` | No adversarial or dependency-audit workflow found |

## Overlap candidates for #4464 (unverified)

These pairs look like overlap from names and triggers only. #4464 must prove functional duplication before any proposal.

- `diataxis-folder-authority.yml` and `diataxis-folder-authority-check.yml` (both call `diataxis_folder_audit.mjs`)
- `d1-migrations.yml` and `lgfc-d1-migrate.yml`
- `library-books-search-eligibility-3455.yml` and `library-books-search-eligibility-3456.yml`
- `preview-invariants.yml` and `production-audit.yml` (same Playwright suite, different target)
- `post-merge-closeout.yml`, `post-merge-intent-verification.yml`, `post-merge-pr-body-closeout.yml`, `bridge-optional-closeout.yml`
- `ai-execution-bridge.yml` and `ai-execution-bridge-smoke.yml`
- `ops-chatterbox-reconciliation-sweep.yml` and `chatterbox-dev-integration-check.yml`
- `lgfc-cursor-runner-health.yml` and `repository-runner-health.yml`

## Not recorded

- Runtime and cost per run, flake history and evidence retention: these need the Actions run history. #4464 records them for the checks it proposes to change.
- Pass or fail authority for workflows outside the required-check set was inferred from names and triggers, not read from branch protection settings (which this repository's tooling cannot read here). #4465 should confirm against GitHub's live protection settings.

## Rollback

One documentation file. Rollback is reverting the merge commit.
