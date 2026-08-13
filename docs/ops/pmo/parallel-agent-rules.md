---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Safe parallel read-only exploration, one-implementer-per-task PR rules, PR readiness handoff, and batch review boundaries for PMO-orchestrated agents
Does Not Own: Agent routing configuration, workflow implementation, GitHub label automation, legacy issue modifications, or merge authority
Canonical Reference: /docs/ops/pmo/critical-path.md
Related Issues: #1411, #1409, #1379, #1255, #1335
Last Reviewed: 2026-06-07
---

# PMO Parallel Agent Rules

## Purpose

Prevent issue sprawl, conflicting implementation PRs, and unauthorized GitHub
state mutation when multiple AI agents and maintainers work in the same
repository.

## Scope

This document owns:

- safe read-only parallel work;
- one-implementer-per-task PR rules;
- PR readiness and batch-review handoff rules;
- Program 1 planning vs active Program 2 non-interference;
- wave/run planning boundaries before workflow implementation.

This document does not own:

- closing, relabeling, or mutating GitHub issues;
- workflow YAML, orchestrator script, runtime, D1, production configuration, or
  secret changes;
- merge authority;
- creation of implementation child issues before ChatGPT/Bill walkthrough.

## Current Known Truth

- Program 1 `#1411` is the active planning cycle for PMO Automation and Agent
  Workflow Control.
- Program 2 `#1255` remains the active Website Implementation and Content
  Operations execution lane.
- Program 3 `#1379` remains portfolio intake; Workflow Automation has been
  promoted from Program 3 into Program 1 planning.
- Completed Program 1 cycle `#1335` is historical evidence only and is not the
  parent issue for this Program 1 cycle.
- Cursor may prepare a docs-only planning PR for `#1411`, but may not merge,
  close, relabel, queue, mutate issue state, or create implementation child
  issues from this PR.

## Intended Final State

- Parallel agents can gather evidence or review safely without creating
  competing implementation PRs.
- Each active task has one source issue, one primary implementer, and one PR
  unless the program owner records an explicit exception.
- PR readiness and batch review improve handoff quality while preserving
  ChatGPT/Bill review and merge authority.
- Wave labels and run identifiers are designed before any workflow or label
  implementation changes.

## Rule 1 — One Implementation PR Per Active Task

| Allowed | Not allowed |
| --- | --- |
| One open implementation or docs PR for the active task issue | Multiple competing PRs for the same task without program owner approval |
| One primary agent named by the task or handoff | Splitting one task across agents without PMO exception |
| File changes within the task allowlist only | Nearby cleanup outside the allowlist |
| One accepted source issue line in the PR body | Multiple source issue lines or context issues treated as authority |

For the current planning PR, the only source issue line is `#1411`. Context
issues `#1409`, `#1379`, `#1255`, and `#1335` are not source issues for the PR.

## Rule 2 — Program 2 Non-Interference

Program 1 planning may proceed while Program 2 executes only when it does not
mutate or block Program 2.

Program 1 agents must not:

- close Program 2 issues;
- relabel Program 2 issues;
- advance or halt Program 2 queues;
- reinterpret Program 2 child project priority;
- modify website runtime files or D1 state;
- create Program 2 implementation issues unless an active Program 2 source issue
  authorizes that work.

## Rule 3 — Parallel Read-Only Work

Multiple agents may work in parallel when all of the following are true:

- The work is read-only or limited to local review notes.
- The work does not create commits or PRs for a blocked task.
- The work does not close, relabel, merge, comment-close, or mutate issues unless
  explicitly assigned that closeout task.
- Output is delivered as review notes, issue comments when authorized, or draft
  findings for the assigned implementer.

### Permitted parallel activities

- Repository audit and evidence gathering.
- Reviewing merged PRs and gate logs.
- Drafting doc outlines locally without pushing.
- ChatGPT governance review of Cursor-produced diffs before PR open or before
  `READY FOR REVIEW`.

### Prohibited parallel activities

- Pushing implementation branches for the same task from multiple agents.
- Bulk-closing or relabeling legacy issues.
- Creating orchestrator-labeled child issues outside the approved issue factory
  path.
- Modifying workflow YAML or runtime behavior during docs-only planning tasks.

## Rule 4 — PR Readiness Handoff

`READY FOR REVIEW` means the PR has complete evidence for human review. It does
not mean Cursor may merge or mutate issue state.

Before setting or reporting `READY FOR REVIEW`, Cursor must confirm:

- the diff matches the active allowlist;
- the PR body has exactly one source issue line;
- required validation commands and outcomes are recorded;
- docs-only or implementation-scope assertions match the diff;
- reviewer, bot, and gate blockers are either absent or explicitly dispositioned;
- no issue closure, relabeling, queue movement, or merge action has been taken.

ChatGPT/Bill review remains required after Cursor handoff.

## Rule 5 — Batch Review Control

Batch review may group related PRs or tasks for ChatGPT/Bill efficiency, but batch
control must define:

- included PRs/issues;
- excluded PRs/issues;
- validation required before review;
- stop/continue rule;
- merge authority;
- issue mutation authority;
- rollback or follow-up path for failed gates.

Batch review does not authorize Cursor to merge, close, relabel, or create
issues.

## Rule 6 — Wave/Run Planning

Wave labels and run identifiers are planning/control concepts until a later
implementation issue authorizes workflow or label changes.

Before any future implementation, the design must specify:

- wave/run identifier format;
- batch scope;
- who decides stop vs continue;
- how PR readiness is detected;
- what evidence is required for queue advancement;
- what issue-state actions are allowed;
- how bad wave decisions are rolled back or halted.

This planning PR defines the concept only. It does not create labels, apply
labels, edit workflow YAML, or change queue automation.

## Rule 7 — No Synthetic Issue Trees

Do not create:

- child issues from this Program 1 planning PR;
- umbrella issues duplicating `#1411`;
- Program 2 implementation issues from Program 1 planning work;
- tracker issues to compensate for missing pre-existing governing Issues (issue-first hard gate).

New orchestrated work enters through production-ready implementation plans,
ChatGPT/Bill walkthrough, and the approved issue factory path.

## Handoff Checklist

Before requesting ChatGPT/Bill review:

- [ ] Changes match the active task allowlist.
- [ ] Changed active Markdown files have required headers.
- [ ] Repo-wide `./scripts/ci/docs_check_headers.sh .` passed, or scoped
      changed-file header validation and the repo-wide blocker are documented.
- [ ] `./scripts/ci/docs_canonical_hashes_verify.sh .` passed.
- [ ] No Program 2 issues were closed, relabeled, or mutated.
- [ ] No implementation child issues were created.
- [ ] PR body cites exactly one source issue.

## Related References

- PMO critical path: `/docs/ops/pmo/critical-path.md`
- Program registry: `/docs/ops/pmo/program-registry.md`
- Cursor execution contract:
  `/docs/reference/pmo/lgfc-cursor-execution-contract.md`
- Workflow Automation authority: `/docs/ops/pmo/workflow-automation.md`
