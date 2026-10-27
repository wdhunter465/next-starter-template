---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: CI and OPS workflow monitoring ownership, trigger classes, escalation paths for the LGFC CI redesign
Does Not Own: Workflow implementation code, branch protection settings, product UX behavior
Canonical Reference: /docs/reference/ci/lgfc-ci-as-built-reconciliation.md
Related Issues: #1199, #1075, #1058, #1335, #1340, #1343, #2376, #2380, #4776
Last Reviewed: 2026-10-26
---

# CI and OPS Monitoring Ownership

## Purpose

This operations reference documents monitoring ownership after CI redesign
Tasks 001–006 merged and Program 1 Task 002 CI closeout evidence is recorded.

## Ownership Model

| Domain | Operator owner | Agent owner | Blocking for PR merge |
|---|---|---|---|
| Merge protection | Repository maintainers | Implementation agent on active PR | Yes |
| PR hygiene | Repository maintainers | Implementation agent on active PR | No |
| Reviewer lifecycle | Repository maintainers | Implementation agent on active PR | Yes on protected CI scope only |
| Post-merge validation | CI orchestration maintainers | Merge closeout agent | No for PR merge; yes for queue advancement |
| OPS runtime | Platform operations | Scheduled/manual ops responder | No |

Program 1 Task 005 snapshot (`docs/ops/reports/program-1-ops-monitoring-snapshot.md`)
documents trigger class, escalation path, and advisory vs fail-closed verdict for
each workflow in `scripts/ci/ops_runtime_surface.mjs`.

## Monitoring Triggers

| Signal type | Where observed | Expected response |
|---|---|---|
| Required PR check failure | GitHub PR checks panel | Fix and rerun on same PR |
| Advisory PR comment | PR conversation | Correct metadata/docs before merge readiness claim |
| Post-merge detection failure | `Post-Merge Detection` workflow on `main` | Remediation issue and follow-up PR |
| Merged PR with failed required pre-merge check | PR checks panel at merge time plus `Post-Merge Detection` on merge commit | Verify canonical `post-merge-failure` remediation issue exists; use manual fallback in `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md` if missing; route root-cause work separately |
| Orchestrator pause | Issue labels / queue state | Complete remediation before next CI task starts |
| OPS scheduled failure | OPS workflow run + issue | Triage using workflow artifacts and ops runbook |
| Direct push to `main` | `OPS — Main Change Monitor` issue | Admin verification or revert |

## Escalation Paths

### Pre-merge

1. Inspect failing required check logs.
2. Determine whether failure is deterministic (quality, secret scan, issue accounting) or protected-scope reviewer evidence on CI workflow/script paths.
3. Fix on the same PR and rerun checks.

### Post-merge

1. Inspect `post-merge-result.md` artifact or PR comment from Post-Merge Detection.
2. Open or update remediation work from generated issue output.
3. When merge occurred with a failed required pre-merge check still on the PR head, confirm the remediation issue names the failed gate and links root-cause work when known; follow `docs/how-to/ci/merged-pr-failed-pre-gate-followup.md`.
4. Do not advance CI orchestration until post-merge validation passes or Product Authority records an accepted exception with authority.

### OPS runtime

1. Download workflow artifacts (assessment reports, Playwright reports, snapshots).
2. Open or update the workflow-specific operations issue when present.
3. For Cloudflare retry exhaustion, treat the helper as advisory and escalate manually if deployment remains failed.

## Related References

- **Program 1 OPS monitoring snapshot:** `docs/ops/reports/program-1-ops-monitoring-snapshot.md`
- As-built reconciliation: `docs/reference/ci/lgfc-ci-as-built-reconciliation.md`
- Merge protection surface: `docs/reference/ci/merge-protection-surface.md`
- PR hygiene foundation: `docs/reference/ci/pr-hygiene-foundation.md`
- Reviewer lifecycle surface: `docs/reference/ci/reviewer-lifecycle-surface.md`
- Post-merge validation surface: `docs/reference/ci/post-merge-validation-surface.md`
- OPS runtime surface: `docs/reference/ci/ops-runtime-surface.md`
- Monitoring coverage master: `docs/ops/monitoring-coverage_MASTER.md`
