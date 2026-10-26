---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: PMO critical-path rules, serial vs parallel execution boundaries, alternating Program 1/2 lane handoff, and queue/wave planning constraints
Does Not Own: Orchestrator workflow code, individual task acceptance criteria, Program 2 issue mutation, or legacy issue closure actions
Canonical Reference: /docs/ops/pmo/program-registry.md
Related Issues: #1449, #1448, #1411, #1409, #1379, #1255, #1335, #4776
Last Reviewed: 2026-10-26
---

# PMO Critical Path

## Purpose

Define how LGFC work advances through the PMO cycle so planning and execution
can move forward without competing issue trees, unreviewed queue movement, or
unauthorized issue mutation.

## Scope

This document owns:

- default serial task behavior;
- safe parallel planning and read-only work;
- Program 1 / Program 2 alternating lane handoff;
- Program 3 promotion dependency rules;
- queue/wave planning constraints before workflow implementation.

This document does not own:

- GitHub issue relabeling, closure, or queue mutation;
- workflow YAML or orchestrator script implementation;
- Program 2 website runtime work;
- D1 migrations, production configuration, or secrets.

## Current Known Truth

- Program 1 and Program 2 are alternating execution lanes in a perpetual PMO
  cycle, not permanent subject domains.
- Program 1 `#1411` is the active planning cycle for PMO Automation and Agent
  Workflow Control.
- Program 2 `#1255` is the active Website Implementation and Content Operations
  execution cycle and must not be blocked or mutated by Program 1 planning.
- Program 3 `#1379` is portfolio intake and prioritization; it is not an
  implementation execution lane.
- Prior Program 1 `#1335` is completed historical evidence only and is not a
  parent for the new Program 1 cycle.
- Workflow Automation has been promoted from Program 3 into Program 1 planning,
  but no workflow YAML, label, queue, or runtime implementation is authorized by
  this planning PR.

## Intended Final State

- Each active task has one source issue, one implementation PR, one verification
  path, and one closeout path.
- Program 1 planning can define the next body of work while Program 2 executes
  current work, as long as Program 2 state is not mutated.
- Program 3 candidates become executable only after owner promotion and
  repository authority.
- Future queue/wave automation follows documented stop/continue, evidence, and
  authority rules before implementation.

## Execution Modes

LGFC programs use one of two execution modes. See
`/docs/reference/pmo/lgfc-program-queue-and-dependency-map.md` for the full
definition.

| Mode | Applies when |
| --- | --- |
| One-task handoff | One-off tasks; programs without an approved dependency map |
| Launched-program queue | Launched program with an approved dependency map in repository docs |

Both modes enforce one source issue per PR. Launched-program queue mode adds
dependency-map gating for which task is authorized next. It does not grant
Cursor merge, close, relabel, or queue-mutation authority.

## Default Rule — One Active Implementation Task

```text
Program master issue → one active task issue → one PR → verify → closeout → next task
```

| State | Meaning | Who may implement |
| --- | --- | --- |
| Planning / review-ready | Documentation or plan is ready for Product Authority review | Assigned planning agent only |
| `status:queued` / `status:pr-draft` / `status:implementation` / `status:review` | Active pipeline slot | One primary agent on the active task only |
| `status:blocked` | Waiting for upstream task or queue slot | Read-only exploration only |
| `status:post-merge-verify` / `status:complete` | Terminal or verifying | No next implementation until closeout/queue authority is clear |

At most one orchestrator implementation task may hold an active pipeline state
per program unless the program owner documents an explicit PMO exception.

## Program 1 / Program 2 Lane Handoff

The perpetual cycle works as follows:

1. Program 1 defines or executes a bounded body of work.
2. Program 2 executes an authorized body of work.
3. Program 1 may define the next cycle while Program 2 executes, if it does not
   mutate Program 2 state.
4. A future handoff requires explicit review, validation, launch-gate or
   completion evidence, and owner approval.
5. Completed cycles remain historical evidence and do not become implicit parents
   for later cycles.

For the current cycle:

- Program 1 `#1411` defines PMO Automation and Agent Workflow Control.
- Program 2 `#1255` continues Website Implementation and Content Operations.
- Program 1 planning must not close, relabel, queue, or otherwise mutate Program
  2 issues.

## Active Program 1 Critical Path

The Program 1 `#1411` planning path is:

```text
PMO cycle authority → Workflow Automation authority → Cursor continuation
  → PR readiness/batch review → mutation policy → wave model
  → closeout evidence → Program 3 promotion gate
```

| Step | Owns | Gate |
| --- | --- | --- |
| PMO cycle authority | Program 1/2/3 lane model | Docs headers and registry consistency |
| Workflow Automation authority | Drive/Program 3 design migration into GitHub docs | No workflow/runtime changes |
| Cursor continuation | Safe continue/stop contract | READY FOR REVIEW handoff preserved |
| PR readiness/batch review | Human review and merge authority | Product Authority walkthrough |
| Mutation policy | Merge/close/relabel/queue prohibitions | Explicit authorization required |
| Queue/wave model | Planning labels and run identifiers | No label or workflow mutation |
| Closeout evidence | Stable post-merge evidence packet | Closeout separated from mutation |
| Program 3 promotion | Portfolio-to-program rule | Owner approval + repo authority |

## Program 2 Non-Interference Rule

Program 2 `#1255` remains active. Program 1 `#1411` planning may reference
Program 2 only to document non-interference and dependency boundaries.

Program 1 planning must not:

- edit Program 2 runtime/application files;
- close, relabel, or mutate Program 2 issues;
- change Program 2 child project priority;
- create Program 2 implementation issues;
- modify D1 migrations or production configuration;
- block Program 2 validation or review.

## Program 3 Promotion Gate

Program 3 candidates do not enter implementation by being listed in the
portfolio. Promotion requires:

1. Bill/owner approval;
2. finalized design or implementation plan;
3. GitHub repository documentation authority;
4. non-interference with active Program 1/2 work;
5. scoped tasks, allowlists, validation, and rollback;
6. bounded source issues before Cursor implementation.

Workflow Automation is the current promoted candidate and is limited to Program
1 documentation authority until later child issues are authorized.

## Queue Advancement

After a task PR merges and post-merge verification completes:

1. Verify the merged PR and merge commit.
2. Verify the source issue and authorized closeout action.
3. Record closeout evidence.
4. Reconcile terminal labels for completed source issues when closure is
   authorized: retain stable non-status labels plus `status:complete`, and
   remove active or failure workflow status labels.
5. Apply issue mutation only when explicitly authorized.
6. Advance the next task only after source task closeout is clean and queue
   authority is clear.

Queue contract details remain in `/docs/reference/architecture/orchestration-model.md`.

## Queue/Wave Planning

Wave labels and run identifiers are planning/control concepts until a future
implementation issue authorizes label or workflow changes.

A future wave implementation must define:

- wave/run identifier format;
- included issues and PRs;
- excluded issues and PRs;
- stop/continue decision owner;
- validation and closeout evidence required;
- allowed issue-state actions;
- rollback or halt path.

This planning PR does not create labels, apply labels, edit workflow YAML, or
advance queues.

## Exceptions

| Exception | Authority | Notes |
| --- | --- | --- |
| Program owner parallel authorization | Human program owner | Must be recorded on the active program issue |
| Program 2 state mutation from Program 1 planning | Not allowed by default | Requires explicit active-source authorization |
| Wave/run implementation | Future implementation issue | Must define labels, evidence, stop/continue, and rollback before code changes |
| Merge or destructive issue action | Bill / authorized human path | Cursor does not own this authority |

## Related References

- PMO program registry: `/docs/ops/pmo/program-registry.md`
- PMO parallel agent rules: `/docs/ops/pmo/parallel-agent-rules.md`
- Workflow Automation authority: `/docs/ops/pmo/workflow-automation.md`
- Program queue and dependency map:
  `/docs/reference/pmo/lgfc-program-queue-and-dependency-map.md`
- Cursor execution contract:
  `/docs/reference/pmo/lgfc-cursor-execution-contract.md`
- GitHub issue closeout protocol:
  `/docs/ops/pmo/github-issue-closeout-protocol.md`
