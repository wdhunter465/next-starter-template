---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: LGFC merge-protection required check surface, consolidated deterministic blockers, and branch-protection naming alignment as a supporting specification
Does Not Own: CI and Verification Domain Policy; GitHub branch protection settings UI; reviewer lifecycle policy; PR hygiene policy; OPS runtime workflows
Canonical Reference: /docs/governance/CI-AND-VERIFICATION.md
Related Issues: #2689, #2175, #2184, #2208, #2228, #2657
Last Reviewed: 2026-08-07
---

# LGFC Merge Protection Surface

This document is the **supporting merge-protection surface** under the CI and Verification Domain Policy (`docs/governance/CI-AND-VERIFICATION.md`).

It documents the expected required-check surface for `main` after #2228 closeout. It is **not** a Domain Policy co-owner. Conflicts with domain policy resolve through `docs/governance/CI-AND-VERIFICATION.md`. PR lifecycle procedure remains in `docs/governance/PR_PROCESS.md`.

## Required checks

Configure branch protection for `main` with these deterministic checks only:

| Job id | Workflow | Notes |
|---|---|---|
| `quality` | `GATE — Quality Checks` | Class-aware structure, ZIP, backend-ref guard, typecheck, lint, targeted tests, conditional build |
| `gitleaks` | `GATE — Secret Scan` | Secret exposure blocker; upstream `gitleaks/gitleaks-action@v2` owns its GitHub API calls — repository #2657 retry hardening does not silently weaken this required gate |

## Advisory checks (active, non-blocking)

| Job id | Workflow | Notes |
|---|---|---|
| `pr-hygiene` | `GATE — PR Hygiene` | Stable PR-body validation; artifact + upsert comment |
| `diff-scope` | `GATE — Diff Scope` | Allowed-path diff validation; artifact + upsert comment; transient GitHub API retry via repository script (#2657) |
| `reviewer-response-completion` | `GATE — Reviewer Response Completion` | GitHub-native reviewer lifecycle; artifact; transient GitHub API retry via repository script (#2657) |

## Manual-only / paused (not merge blockers)

| Workflow | Disposition |
|---|---|
| `GATE — Intent Labeler` | Manual-only until rebuilt advisory-first |
| `GATE — PR Issue Accounting` | Manual-only while paused |
| `GATE — Drift Control` | Manual-only; rebuild later if needed |
| `GATE — Branch Freshness` | Manual-only; rebuild later if needed |
| `Docs Guardrails` | Manual-only; rebuild later if needed |
| `Design Compliance (Warn)` | Manual-only; rebuild later if needed |
| `GATE — Post-Merge Readiness` | Manual-only backfill; retired pre-merge auto-trigger |

## Retired from required checks

Remove these from branch protection if still listed:

- `check-no-zip-files`
- `post-merge-readiness`
- `pr-issue-accounting` (while manual-only)
- `drift` / `drift-gate`
- `branch-freshness`
- `docs_guardrails`
- `design_compliance_warn`
- `diff-scope` (until promoted after advisory evidence)
- `reviewer-response-completion` (until promoted after advisory evidence)
- `pr-hygiene` (until promoted after advisory evidence)

OPS runtime, post-merge closeout, and metrics workflows are not merge-protection checks.

## Live GitHub verification (operator)

Bill/ChatGPT must confirm live branch protection on `main` matches this reference. Repo-owned docs cannot mutate GitHub settings.

Operator steps:

1. Open repository **Settings → Branches → Branch protection rules** for `main`.
2. Under **Require status checks to pass**, confirm only `quality` and `gitleaks` are required.
3. Remove any retired checks listed above if still present.
4. Record confirmation in #2175 and #2208 before closing those issues.

## Validation

The validator lives at `scripts/ci/merge_protection_surface.mjs`.

## Rollback

Rollback through a specific Ops issue only after confirming replacement checks are active, deterministic, and low-noise.
