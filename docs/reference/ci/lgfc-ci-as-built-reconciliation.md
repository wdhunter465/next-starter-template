---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Historical #1075/#1500 CI reconciliation and current retirement disposition
Does Not Own: Canonical PR policy, branch protection settings, or production runtime configuration
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #1075, #1058, #1500, #2175, #2208, #2469, #3746, #2769
Last Reviewed: 2026-09-14
---

# LGFC CI As-Built Reconciliation

## Purpose

Reconcile the implemented #1075 and #1500 CI work with the current July 2026 PR-process and retirement state.

## Scope

This reference covers delivered capabilities, retained current assets, retired #1075 mechanisms, exception-storm resolution, and closeout ownership. It does not define canonical PR policy or live branch protection.

## Current known truth

The #1075 implementation wave delivered CI capabilities but also contributed to post-merge remediation loops later stabilized by Program #1500. The July 2026 PR-process rebuild supersedes the remaining #1075 design authority, and #2469 retires its dedicated phase-generation engine and legacy residue.

## Intended final state

Current deterministic checks, advisory review controls, single-owner closeout, OPS monitoring, and explicitly approved generic orchestration remain. Retired #1075 phase mechanisms remain historical and non-executable.

## Current disposition

The #1075 CI redesign implementation wave delivered PR hygiene, merge-protection, reviewer, post-merge, OPS, and documentation changes. Program #1500 then stabilized the post-merge closeout failures and remediation loops produced by that operating model. The July 2026 PR-process rebuild superseded the remaining #1075 design authority.

Issue #2469 retires the dedicated #1075 phase-generation engine and legacy workflow residue.

## Current authority

| Concern | Current authority |
| --- | --- |
| PR policy | `docs/governance/PR_PROCESS.md` |
| Current baseline | `docs/reference/ci/pr-process-current-state.md` |
| Required checks | `docs/reference/ci/merge-protection-surface.md` |
| PR workflow inventory | `docs/reference/ci/pr-workflow-ci-inventory.md` |
| Automatic closeout | `.github/workflows/post-merge-closeout.yml` |
| Generic orchestration | `docs/reference/architecture/orchestration-model.md` |

## Capabilities retained

- deterministic `quality`, `gitleaks`, and `reviewer-response-completion` required checks (#3746);
- advisory PR hygiene and diff-scope checks;
- single-owner automatic post-merge closeout;
- bounded remediation and routine exception housekeeping;
- production OPS monitoring;
- generic implementation-plan issue generation where explicitly approved.

## Assets retired by #2469

- scheduled #1075 CI phase engine;
- fixed CI phase state and `lgfc-ci-phase:*` generation;
- orphaned fixed #1075 task decomposition files;
- no-op and hardcoded legacy workflow residue;
- active-authority claims in #1075-only documentation.

## Exception-storm resolution

The retirement prevents the old engine from creating new obsolete phase issues, treating stale #1075 issues as current blockers, or updating #1089-style orchestration remediation.

Existing legitimate exception issues are not bulk-closed. They remain routine housekeeping work and are handled incrementally.

## Closeout ownership

`.github/workflows/post-merge-closeout.yml` is the single automatic source-issue closeout owner. Other post-merge workflows may provide remediation, evidence, metrics, or scheduled cleanup but must not race the same mutation boundary.

## Historical evidence

Original rollout plans, issues, and merged PRs remain historical evidence. Historical status does not authorize reactivation of the retired architecture.
