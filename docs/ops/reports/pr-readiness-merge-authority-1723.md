---
Doc Type: Operations
Audience: Bill, Atlas, Cursor, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #1723 durable evidence reconciling PR readiness, batch review, merge authority, and documentation authority levels for Program #1719 Model B construction
Does Not Own: Workflow YAML, CI scripts, runtime code, issue mutation, Cursor self-merge, or automatic merge to main
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #1723, #1719, #1722, #1724
Last Reviewed: 2026-08-18
---

# PR Readiness and Merge Authority Control (#1723)

## Purpose

Reconcile PR process/governance docs for readiness, batch review, human review,
merge authority, and documentation authority levels under Program `#1719`
Model B construction on `component/pmo-governance-workflow-automation`.

## Scope

This report owns Task #1723 evidence reconciling PR readiness, batch review, merge authority, and documentation authority levels for Program #1719. It does not change workflow YAML, CI scripts, runtime code, or issue-mutation permissions.

## Current known truth

`READY FOR REVIEW` is not merge authority for `main`. Bill/ChatGPT approve `main` merges. Model B `component-auto-integration` is allowed when the source Issue authorizes it. Governance-folder placement does not invent an intermediate human gate on the component branch for Tasks #1723 or #1724.

## Intended final state

PR-process docs keep two documentation authority levels (component project vs `main`) without restoring an obsolete protected-review stop for governance-doc children.

## Documentation authority levels

| Level | Surface | Meaning |
| --- | --- | --- |
| Project construction authority | `component/pmo-governance-workflow-automation` | Versioned authority for Program `#1719` construction and successor child execution |
| Repository-wide authority | `main` | Default authority for the whole repository |

Promotion rule: project-branch documentation becomes repository-wide authority only
through a Bill/ChatGPT-approved promotion PR to `main`. Use a separate early
documentation promotion only when another active workstream must consume the
updated rule before `#1719` finishes, then synchronize the project branch.

Governance-folder placement does **not** invent an intermediate human gate on
the component branch for Tasks `#1723` or `#1724`.

## Authority updates

| Document | Change |
| --- | --- |
| `docs/governance/PR_PROCESS.md` | Documentation authority levels; merge/readiness matrix; removed obsolete `#1723`/`#1724` protected-review stop; batch-review rules |
| `docs/governance/PR_GOVERNANCE.md` | Merge-authority summary aligned to two-level docs model |
| `docs/governance/DELIVERY-AND-RELEASE.md` | Clarified governance-doc edits alone do not select `protected-change-review` |

## Checklist

- [x] `READY FOR REVIEW` ≠ merge authority for `main`
- [x] Bill/ChatGPT approve all merges/promotions to `main`
- [x] Non-`main` Model B / `component-auto-integration` allowed when source issue authorizes
- [x] `#1723` / `#1724` do **not** require an intermediate human gate merely for governance-doc edits on the component branch
- [x] Two documentation authority levels documented (component project vs `main`)
- [x] Batch review preserves one issue per PR and does not grant Cursor `main` merge authority
- [x] Cursor self-approval / self-merge prohibited
- [x] No new custom gates added
- [x] No automatic merge to `main` authorized

## Follow-up note

Residual “protected governance `#1723`/`#1724`” phrasing from Task `#1722` was
cleared in Task `#1724` (allowlist includes `docs/reference/pmo/**` and
`docs/ops/reports/**`). See
`docs/ops/reports/issue-mutation-closeout-permission-1724.md`.

`docs/ops/implementation-plans/pmo-governance-workflow-automation-completion.md`
may still hold older dependency-map wording outside the `#1723`/`#1724`
allowlists; clear in `#1726`/`#1727` when writable.

## Out of scope

- Runtime / workflow YAML / CI scripts / package / website files
- Issue mutation
- Cursor approval or merge
- Automatic merge to `main`

## Successor

After this PR’s technical component integration succeeds, begin Task `#1724`
immediately under the same component-branch documentation model. Task `#1725`
remains completed and is skipped. Task `#1726` follows `#1724`.
