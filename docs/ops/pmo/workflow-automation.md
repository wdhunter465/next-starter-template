---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: PMO workflow automation planning authority, Cursor queue-control boundaries, PR readiness rules, wave/run control concepts, and PMO Backlog promotion handoff for workflow automation
Does Not Own: Workflow YAML implementation, runtime application behavior, D1 migrations, production secrets, GitHub issue mutation, or merge authority
Canonical Reference: /docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md
Related Issues: #1411, #1417, #1418, #1419, #1420, #1421, #1422, #1423, #1424, #1379, #1255, #1501, #1719, #1720, #1721, #1722, #1723, #1724, #1725, #1726, #1727, #4776
Last Reviewed: 2026-10-26
---

# PMO Workflow Automation

## Purpose

Represent the LGFC Workflow Automation design in GitHub documentation authority. Historical planning cycle Program #1411 — PMO Automation and Agent Workflow Control — produced the original planning package. Current executable work for remaining automation gaps routes through Priority #3 Program #1719 (and its child tasks), not through #1411.

This document converts Workflow Automation from PMO Backlog material into bounded repository-owned planning authority. It defines what the automation program may design before any workflow code, label mutation, issue mutation, or runtime implementation begins.

This document is subordinate to `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`.

Task **#1721** completed design migration inventory and gap classification. Durable evidence:
`docs/ops/reports/workflow-automation-design-gap-inventory-1721.md`.

## Scope

This document owns:

- workflow automation planning boundaries originating from historical Program #1411 and continued under Program #1719;
- Cursor continuation, stop, and queue-control rules;
- PR readiness and batch-review control requirements;
- merge, close, relabel, and issue-mutation prohibitions for Cursor;
- wave labels and run identifiers as planning/control concepts;
- post-merge closeout evidence stabilization requirements;
- terminal completed-issue label reconciliation requirements;
- PMO Backlog promotion requirements for workflow automation candidates.

This document does not own:

- workflow YAML changes;
- orchestrator script implementation;
- website/runtime feature work;
- D1 migrations;
- production configuration or secrets;
- GitHub issue closure, relabeling, or queue mutation;
- creation of implementation child issues before Product Authority launch approval.

## Current Known Truth

- issue `#1411` promoted Workflow Automation from PMO Backlog material into a completed planning/control cycle. `#1411` is **closed complete** historical evidence, not an open staged/blocked program.
- Issues `#1417`–`#1424` are stale historical task issues from the `#1411` cycle. They are evidence only and must not be mutated or treated as current source issues.
- Current Priority #3 execution for remaining workflow-automation work is Program `#1719` (Implementation Active as of 2026-07-16). Task `#1720` completed PMO July 2026 authority reconciliation. Task `#1721` completed workflow-automation design migration inventory and gap classification.
- Project branch for #1719 Model B children: `component/pmo-governance-workflow-automation`. Approval profile: `component-auto-integration` (non-`main` integration). Promotion to `main` remains Product Authority.
- legacy issue `#1379` captured Workflow Automation as future candidate material and listed available draft concepts.
- Program `#1255` remains active and must not be blocked, relabeled, closed, or otherwise mutated by Priority #3 planning or docs work.
- Completed Program 1 cycle `#1335` remains historical evidence only. It is not the parent issue for Program `#1411` or `#1719`.
- Cursor may prepare docs-only PRs and run validation when authorized. Merge to `main` remains Product Authority only. Component-branch auto-integration may apply when the source issue specifies a non-`main` project branch and `component-auto-integration`.
- Task `#1725` reconciled Program `#1500` queue/wave and closeout baselines. Do not rebuild `#1500`.

## Intended Final State

- GitHub documentation, not Google Drive or chat, is the canonical design source for PMO Workflow Automation.
- Historical Program `#1411` planning outputs feed Priority #3 Program `#1719` child tasks; new execution uses current `#1719`–`#1727` issues only.
- Wave labels, run identifiers, merge policy labels, and queue-control behavior are specified before workflow code changes begin.
- Cursor continuation rules distinguish one-task handoff, launched-program queue, continuous reduced-gate serial chains, and Model B component-auto-integration (hardened in `#1722`), and preserve Product Authority review and merge authority at every stop.
- Completed source issues have reconciled terminal labels: stable non-status labels plus `status:complete`, with stale active or failure status labels removed during closeout.
- PMO Backlog remains the documented inventory for work not yet promoted into program issues.

## Design area map (historical #1411 → current #1719)

| Area | Historical #1411 design output | Current #1719 owner | Implementation boundary |
| --- | --- | --- | --- |
| PMO July 2026 authority | Durable language that program issue numbers identify programs and PMO Backlog holds ideas/project drafts | #1720 (complete) | No issue or label mutation |
| Workflow Automation design migration | This GitHub authority page replaces Drive/chat-only planning for workflow automation | #1721 (complete — inventory) | No workflow YAML edits in #1721; candidates scoped by #1726 |
| Cursor continuation and queue contract | Rules for when Cursor continues, stops, reports, and waits | #1722 (complete) | Docs hardening; no automated queue advancement unless later authorized |
| PR readiness and batch review control | Ready-for-review rules that preserve Product Authority review on `main` | #1723 (complete on component) | No PR merge or review-state mutation by Cursor on `main` |
| Merge and issue mutation policy | Explicit prohibition on Cursor merge, close, relabel, and issue-state changes without authorization | #1724 (complete on component) | No destructive issue action |
| Queue/wave model and labels | Planning definitions for wave/run identifiers and stop/continue gates | #1725 (complete); candidates scoped by #1726 (C-01) | No label creation or relabeling in docs tasks |
| Post-merge closeout evidence stabilization | Evidence and terminal-label reconciliation requirements before issue closeout or queue advancement | #1725 baseline; candidates scoped by #1726 (C-02–C-05) | No closeout automation change without CI source issue |
| PMO Backlog promotion process | Criteria for moving backlog items into program issues | #1727 terminal | No child implementation issues from planning-only PRs |
| Replacement candidate requalification | Prior qualified component candidate went stale against current `main` before Production review | #2775 (in progress) | No `main` merge, self-approval, or Production authority from this task |

## Workflow Automation Design Decisions

### Program issue model

Under PMO July 2026, programs are GitHub program issues identified by issue number. Program `#1411` is a **completed historical planning/control artifact** for PMO Automation and Agent Workflow Control. Current Priority #3 execution is Program `#1719`. PMO Backlog is not a program; it is a documentation-owned inventory for ideas, project drafts, and implementation-ready projects.

### Execution modes and queue control

LGFC program issues use one-task handoff mode or launched-program queue mode. See `/docs/reference/pmo/lgfc-program-queue-and-dependency-map.md`. Launched programs require an approved dependency map attached to or referenced by the program issue before issue creation. Queue mode governs which task is authorized next; it does not grant Cursor merge, close, relabel, or queue-mutation authority.

### Cursor continuation contract

Cursor may continue forward only inside the active source issue and changed-file allowlist.

Default permissions still prohibit merge to `main`, close, relabel, queue mutation, and issue mutation unless the active source issue explicitly authorizes those actions.

When a PR targets `main`, Cursor must:

1. finish the requested local validation;
2. update the PR body with exact validation results;
3. preserve exactly one source issue line;
4. stop at `READY FOR REVIEW` for Product Authority walkthrough;
5. avoid merge, close, relabel, queue, or issue-mutation actions unless the active issue explicitly authorizes them.

When a source issue specifies Model B / `component-auto-integration` and a non-`main` project branch (as Program `#1719` children do on `component/pmo-governance-workflow-automation`):

1. finish validation and PR-body evidence;
2. target the named project branch;
3. do not invent custom approval gates;
4. after technically necessary checks pass and no material defect remains, treat the PR as eligible for Atlas-controlled component integration;
5. proceed to the authorized successor child without a new launch prompt when the source issue says so.

**Hardening owner:** Task `#1722` published the authoritative continuation/stop matrix in `docs/reference/pmo/lgfc-cursor-execution-contract.md` and `docs/ops/reports/cursor-continuation-contract-matrix-1722.md`. Active source-issue delivery-model fields still control each PR.

Cursor continuation must support safe progress without converting component integration into `main` merge authority.

### Reviewer disposition enforcement

Reviewer comments are not satisfied by PR-body claims alone. Every actionable trusted reviewer comment must be resolved, explicitly dispositioned in the PR body with `review-comment:<id>`, or linked to a bounded follow-up issue.

Outdated GitHub review threads still require explicit disposition evidence.

Post-merge closeout must verify reviewer disposition before closing the source issue. Undispositioned reviewer findings create or preserve post-merge exception issues and stop program queue advancement until disposition is complete.

### PR readiness and batch review

PR readiness means the implementation or documentation PR is complete enough for human review. It does not transfer merge authority to Cursor.

Batch review must preserve:

- Bill authority for merges, protected actions, launch gates, destructive actions, production-sensitive work, and strategy decisions;
- ChatGPT authority for governance review, source-issue accounting, queue conformance, and review disposition;
- Cursor responsibility for scoped implementation, validation, PR-body evidence, and stopping at the authorized handoff point.

### Merge and issue mutation policy

Cursor may not merge PRs to `main`, close issues, relabel issues, mark issue state, advance queues, create child issues, or mutate other program work unless the active source issue explicitly authorizes that action.

Non-`main` Model B component integration may proceed under `component-auto-integration` when the source issue authorizes it. That path still does not grant Cursor issue close/relabel authority.

Docs may recommend future issue structure or label concepts. Recommendations are not permission to mutate GitHub state.

Authoritative matrix: `/docs/ops/reports/issue-mutation-closeout-permission-1724.md`.

### Queue/wave model and labels

Wave labels and run identifiers are planning/control concepts until a later implementation issue authorizes workflow or label changes.

Required design fields before implementation:

- wave/run identifier purpose;
- stop/continue decision owner;
- batch scope and allowed issue/PR set;
- PR readiness rule;
- issue mutation permission boundary;
- evidence required before queue advancement;
- rollback path for a bad wave decision.

### Post-merge closeout evidence

Closeout automation must not treat merge as sufficient evidence by itself. Future implementation must require a stable closeout packet that identifies:

- merged PR and merge commit;
- source issue;
- validation results;
- exact issue-state action authorized;
- terminal label reconciliation result;
- queue advancement decision;
- unresolved reviewer, gate, or post-merge blockers.

The selected terminal behavior is: a closed completed source issue retains only stable non-status labels plus `status:complete`. The controller or authorized ChatGPT closeout step must remove active or failure-state labels such as `status:queued`, `status:assigned`, `status:pr-draft`, `status:implementation`, `status:review`, `status:post-merge-verify`, and `status:failed` as part of the same authorized closeout action that closes the issue with `state_reason: completed`. If that reconciliation cannot be verified, queue advancement stops and the blocker is reported.

## PMO Backlog Promotion Process

Backlog item promotion starts during PMO meeting review or explicit Product Authority review.

Promotion creates or updates:

- project design documentation;
- a program issue if the work becomes a program;
- project/task issues if executable;
- PR(s) for documentation updates.

PMO Backlog does not launch work. PMO meeting issues may record promotion decisions and resulting issue/PR creation.

A PMO Backlog item may feed a future program issue only when:

1. Bill/owner approves promotion review.
2. The idea is converted into a finalized design or implementation plan.
3. Repository documentation becomes the design source of truth.
4. Non-interference with active program work is documented.
5. Scope is decomposed into tasks with allowlisted files and validation.
6. Authorized issue creation after Product Authority walkthrough.
7. Cursor receives a bounded source issue and PR scope.

Workflow Automation planning was promoted through historical `#1411`. Design migration inventory and gap classification are complete in Task `#1721` (`docs/ops/reports/workflow-automation-design-gap-inventory-1721.md`). Implementation candidates are scoped (docs vs workflow vs script) in Task `#1726` (`docs/ops/reports/workflow-ci-implementation-candidate-scoping-1726.md`). Remaining terminal closeout continues in `#1727`. This document alone does not authorize workflow YAML, label mutation, or child-issue creation.

## Implementation candidate classes

Future automation work must declare exactly one primary class (or split into separate issues):

| Class | Paths | May start from `#1719` docs children? |
| --- | --- | --- |
| Docs-only | Named `docs/**` allowlist | Yes, when the child allowlist includes those paths |
| Workflow YAML | `.github/workflows/**` | No — new source issue required |
| CI script-sensitive | `scripts/ci/**` | No — new source issue required |

Authoritative candidate matrix: `/docs/ops/reports/workflow-ci-implementation-candidate-scoping-1726.md`.

## Related References

- PMO July 2026 Operating Model: `/docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md`
- PMO Backlog: `/docs/ops/pmo/pmo-backlog.md`
- Program registry: `/docs/ops/pmo/program-registry.md`
- Program portfolio model: `/docs/reference/pmo/lgfc-program-portfolio-model.md`
- Cursor execution contract: `/docs/reference/pmo/lgfc-cursor-execution-contract.md`
- #1720 authority reconciliation: `/docs/ops/reports/pmo-july-2026-authority-reconciliation-1720.md`
- #1721 gap inventory: `/docs/ops/reports/workflow-automation-design-gap-inventory-1721.md`
- #1725 Program #1500 reconciliation: `/docs/ops/reports/program-1500-queue-wave-reconciliation.md`
