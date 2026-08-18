# CI Guardrails Map

**Status:** AUTHORITATIVE  
**Effective Date:** 2026-07-12  
**Purpose:** Current CI/CD guardrails, PR-process checks, post-merge ownership, and retired workflow disposition

## Controlling authority

- `docs/governance/PR_PROCESS.md`
- `docs/reference/ci/pr-process-current-state.md`
- `docs/reference/ci/merge-protection-surface.md`
- `docs/reference/ci/pr-workflow-ci-inventory.md`

The dedicated #1075 CI phase engine is retired under #2469 and is not a guardrail, monitor, queue owner, or issue-generation authority.

## Required pre-merge checks

| Workflow | Job | Role |
| --- | --- | --- |
| `gate-quality.yml` | `quality` | Class-aware deterministic quality routing |
| `gitleaks.yml` | `gitleaks` | Secret exposure blocker |

No retired or manual-only workflow may be required by branch protection.

## Active advisory checks

| Workflow | Job | Role |
| --- | --- | --- |
| `gate-pr-hygiene.yml` | `pr-hygiene` | Stable PR-body hygiene and guidance |
| `gate-diff-scope.yml` | `diff-scope` | Allowed-path diff assessment |
| `reviewer-response-completion.yml` | `reviewer-response-completion` | GitHub-native reviewer/thread assessment |

Advisory checks remain non-blocking until promotion criteria in `PR_PROCESS.md` are satisfied.

## Manual-only / paused checks

| Workflow | Disposition |
| --- | --- |
| `gate-intent-labeler.yml` | Manual-only pending advisory-first rebuild |
| `ops-pr-issue-accounting.yml` | Manual-only while paused |
| `gate-drift.yml` | Manual-only; rebuild only if current evidence justifies it |
| `gate-branch-freshness.yml` | Manual-only |
| `docs-guardrails.yml` | Manual-only |
| `design-compliance-warn.yml` | Manual-only |
| `gate-post-merge-readiness.yml` | Manual backfill only |

## Post-merge ownership

Automatic source-issue closeout has one owner:

- `.github/workflows/post-merge-closeout.yml`

Supporting post-merge and operational workflows must not independently claim the same closeout mutation boundary.

| Workflow | Role |
| --- | --- |
| `post-merge-closeout.yml` | Automatic validation, source-issue reconciliation, and evidence |
| `post-merge-remediation.yml` | Failure remediation support |
| `ops-post-merge-self-healing.yml` | Scheduled/manual exception backlog hygiene |
| `ops-pr-process-metrics.yml` | PR-process metrics |
| `ops-workflow-transition-slo-report.yml` | #2679 workflow transition SLO daily scorecard (read-only) |
| `ops-stale-communication.yml` | #3188 source-Issue stale communication detector (exception comments only; no ack/reassign) |
| `ops-ai-review-enable.yml` | #2215 operator-authorized AI review Pages secret enablement |
| `post-merge-intent-verification.yml` | Inert manual compatibility marker; no automatic trigger or mutation permissions |

## Removed legacy workflows

#2469 removes the following executable residue:

- `ci-orchestration-engine.yml`
- `gate-reviewer-response.yml`
- `gate-close-work-issue.yml`
- parked legacy `ci.yml`, `deploy*.yml`, `lgfc-validate.yml`, `test.yml`, and `test-homepage.yml`

The old hardcoded logic from `post-merge-intent-verification.yml` is removed. Only a zero-effect manual marker remains for compatibility-test continuity.

Retired names must not appear in branch protection, current queue decisions, or active CI reports.

## Exception handling boundary

Legitimate current exceptions remain valid and are handled incrementally through routine housekeeping. Retirement of #1075 eliminates obsolete phase-generation and false remediation loops; it does not suppress current security, validation, production, or closeout failures.
