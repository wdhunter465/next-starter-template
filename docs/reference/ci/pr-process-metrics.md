---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: PR-process success metrics schema and collection workflow
Does Not Own: Branch protection settings or merge approval
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #2175, #2208, #2228, #3746, #2769
Last Reviewed: 2026-09-14
---

# PR Process Metrics

## Purpose

Lightweight measurement for PR-process rebuild validation. Metrics are recorded after merge via `OPS — PR Process Metrics` and the `scripts/ci/pr_process_metrics.mjs` helper.

## Tracked checks

- `quality` — required
- `gitleaks` — required
- `reviewer-response-completion` — required on `main` (#3746); event-conditional enforcement
- `pr-hygiene` — advisory
- `diff-scope` — advisory

## Recorded fields

- `firstPassSuccess` — all tracked checks pass on run attempt 1
- `secondPassSuccess` — all tracked checks pass on run attempt 2
- `requiredChecksGreen` — required checks pass regardless of advisory noise
- `failedRequiredChecks` — deterministic blockers that failed
- `failedAdvisoryChecks` — advisory gates that failed without blocking merge

## Collection

1. Automatic: `ops-pr-process-metrics.yml` on merged PR close events.
2. Manual: workflow dispatch with a PR number for probe validation.

Check runs are deduplicated by name before metrics are recorded. When multiple completed runs exist for the same tracked check, the latest completed attempt wins. Stale failed attempts cannot override a later successful attempt. The metrics script applies the same dedupe defensively if duplicates are passed.

Artifacts: `pr-process-metrics.json` and `pr-process-metrics.md`.

## Operator rule

Use metrics to decide whether advisory gates are ready for promotion. Do not promote a gate to required until it shows low-noise advisory behavior across several PRs.
