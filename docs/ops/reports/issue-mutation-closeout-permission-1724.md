---
Doc Type: Operations
Audience: Bill, Atlas, Cursor, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Task #1724 durable issue-mutation and closeout permission matrix for Program #1719 and reusable agent closeout rules
Does Not Own: Workflow YAML, CI scripts, runtime code, unauthorized GitHub mutation, Cursor self-merge, or automatic merge to main
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #1724, #1719, #1723, #1722, #1725, #1726
Last Reviewed: 2026-08-18
---

# Issue Mutation and Closeout Permission Policy (#1724)

## Purpose

Define when agents may or may not close, reopen, relabel, or otherwise mutate
GitHub issues during PR closeout and ordinary program execution, under Program
`#1719` Model B construction on
`component/pmo-governance-workflow-automation`.

## Scope

This report owns the Task #1724 issue-mutation and closeout permission matrix for Program #1719. It does not grant workflow, CI, runtime, self-merge, or automatic `main` merge authority.

## Current known truth

Cursor default-denies close, reopen, relabel, and other GitHub issue mutations unless the active source Issue explicitly grants the exact action. Merge is not closeout. Component-branch documentation integration does not authorize source-issue closeout.

## Intended final state

Agents and closeout automation consult this matrix instead of inferring mutation permission from PR merge or documentation recommendations.

## Documentation authority (same model as #1723)

| Level | Surface | Meaning |
| --- | --- | --- |
| Project construction authority | `component/pmo-governance-workflow-automation` | Versioned authority for Program `#1719` construction and successor child execution |
| Repository-wide authority | `main` | Default authority for the whole repository |

Project-branch documentation becomes repository-wide authority only through a
Bill/ChatGPT-approved promotion PR to `main`. Use a separate early documentation
promotion only when another active workstream must consume the rule before
`#1719` finishes. Governance-doc edits on the component branch do **not** create
an intermediate human gate.

## Mutation-permission matrix

| Actor | Action | Default | Allowed only when |
| --- | --- | --- | --- |
| Cursor | Close issue | Denied | Active source issue explicitly grants close authority for a named issue |
| Cursor | Reopen issue | Denied | Active source issue explicitly grants reopen for a named issue |
| Cursor | Relabel / add/remove labels | Denied | Active source issue explicitly grants the exact label mutation |
| Cursor | Change issue state / assignees / milestone / project membership | Denied | Active source issue explicitly grants that exact mutation |
| Cursor | Create child / related issues | Denied | Active source issue or program launch package explicitly authorizes creation |
| Cursor | Advance queue labels / wave labels | Denied | Continuous reduced-gate or launched-queue rule plus explicit grant |
| Cursor | Mutate historical / foreign program issues (`#1417`–`#1424`, `#1255` children, closed `#1500`, etc.) | Denied | Never from `#1719` docs tasks; requires that foreign program’s own source authority |
| Cursor | Merge PR to `main` | Denied | Never (Bill/ChatGPT only) |
| Cursor | Component integrate non-`main` PR | Denied by default role | Allowed only when source issue / program rule authorizes Model B `component-auto-integration` and technical checks pass; still no self-approve theater |
| Atlas | Close completed source issue after clean post-merge | Denied until authorized | Authorized closeout path (controller or explicit Bill/Atlas closeout instruction) with clean verification |
| Atlas | Label reconciliation on closeout | Denied until authorized | Same authorized closeout path; remove active/failure status labels; retain stable non-status labels + `status:complete` when that is the selected terminal behavior |
| Controller / automation | Idempotent post-merge closeout steps | Denied until wired | Repository closeout owner / workflow explicitly defined for that target branch |
| Bill / ChatGPT | Any issue mutation | Owner authority | Owner decision; remains authority for destructive and strategy actions |

## Closeout rules

1. Merge is not closeout. A merged PR does not by itself authorize issue close,
   relabel, or queue advancement.
2. Source-issue closeout occurs only after merge verification (and applicable
   post-merge validator state) is clean **and** an authorized actor performs the
   closeout mutation.
3. Undispositioned trusted reviewer findings block closeout and queue
   advancement until dispositioned or linked to a bounded follow-up issue.
4. Docs may recommend future labels or issue structure; recommendations are not
   permission to mutate GitHub state.
5. Component-branch integration of documentation does not authorize Cursor to
   close or relabel the source issue. Repository-wide effect of the policy still
   waits for Bill/ChatGPT-approved promotion to `main` unless an early
   documentation promotion is used.

## Default Cursor closeout posture

For Program `#1719` Tasks `#1723`–`#1727` unless a child issue says otherwise:

- implement allowlisted docs;
- validate;
- open/update the PR;
- enable or allow authorized non-`main` component integration when the issue
  uses `component-auto-integration`;
- **do not** close, reopen, or relabel the source issue, parent program, or any
  other issue;
- record required follow-up or discovered out-of-allowlist work in the PR body
  / evidence report (not by mutating foreign issues).

## Checklist

- [x] Mutation-permission matrix published
- [x] Closeout ≠ merge documented
- [x] Cursor default deny for close/reopen/relabel/state mutation
- [x] Atlas/controller closeout path distinguished from Cursor implementation
- [x] Historical/stale issue non-mutation retained
- [x] Obsolete `#1723`/`#1724` protected-review language cleared in allowlisted PMO/contract docs
- [x] Two-level documentation authority retained
- [x] No automatic merge to `main`
- [x] No Cursor self-approve / self-merge to `main`

## Files updated this task

| Document | Change |
| --- | --- |
| `docs/governance/PR_PROCESS.md` | Issue mutation / closeout permission section |
| `docs/governance/PR_GOVERNANCE.md` | Mutation summary pointer |
| `docs/ops/pmo/workflow-automation.md` | Matrix pointer; cleared obsolete protected-review implication |
| `docs/ops/pmo/pmo-governance-workflow-automation-completion-readiness.md` | Cleared `#1723`/`#1724` protected-review stops; Task 005 matrix complete |
| `docs/reference/pmo/lgfc-cursor-execution-contract.md` | Removed protected-governance child row; `#1719` rules updated |
| `docs/ops/reports/cursor-continuation-contract-matrix-1722.md` | Residual protected-review wording cleared |
| `docs/reference/pmo/lgfc-program-queue-and-dependency-map.md` | `#1723`/`#1724` note aligned to component-doc model |

## Deferred (outside this allowlist)

`docs/ops/implementation-plans/pmo-governance-workflow-automation-completion.md`
still contains older “protected governance review” dependency-map wording.
Clear in Task `#1726` or `#1727` when that path is writable, or via a bounded
follow-up with an expanded allowlist.

## Out of scope

- Runtime / workflow YAML / CI scripts / package / website files
- Performing unauthorized issue mutation from this task
- Cursor approval or merge to `main`
- Automatic merge to `main`

## Successor

After this PR’s technical component integration succeeds, begin Task `#1726`
immediately. Task `#1725` remains completed and is skipped.
