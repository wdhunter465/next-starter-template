---
Doc Type: Operational Authority
Audience: Governance, Bill, Cursor, LGFC maintainers
Authority Level: Operational Authority
Owns: Program-level Cursor queue authorization and dependency-stop behavior
Does Not Own: GitHub merge authority, production deployment authority, branch protection, or human approval requirements
Canonical Reference: /docs/reference/pmo/lgfc-cursor-execution-contract.md
Related Issues: #1255, #1256, #1435, #4776
Last Reviewed: 2026-10-26
---

# Program Daisy-Chain Cursor Queue Model

## Purpose

Define the expected execution model when a documented LGFC program has an approved, ordered issue queue and is ready for launch.

The prior one-task-at-a-time continuation rule was too conservative for prepared programs. For a launched program, Cursor should keep staging pull requests until the program queue is exhausted or a declared dependency boundary is reached.

## Current known truth

- Bill approves pull requests oldest to newest unless a dependency, failed gate, reviewer finding, or controller decision changes that order.
- Cursor remains an implementation agent, not a merge authority.
- Product Authority or the controller selects and authorizes the program queue.
- Cursor should not sit idle between independent tasks in a prepared program.
- The only default execution stop is a real blocker: dependency not satisfied, unclear scope, missing source issue, failed validation outside scope, conflicting queue state, or protected human decision.

## Program launch rule

When a program is documented into issues and explicitly launched, the controller may authorize the entire ordered issue queue rather than only the first task.

A valid launch authorization must identify:

1. the parent program issue;
2. the child project issue when applicable;
3. the ordered task issue list;
4. dependency relationships between tasks;
5. whether tasks may be staged before earlier PRs merge;
6. the stop condition for dependency boundaries;
7. the rule that each task still produces its own PR with exactly one source issue line.

## Cursor daisy-chain behavior

After a valid program launch authorization, Cursor should:

1. start with the first executable task;
2. create or update one PR for that task;
3. work the PR to GitHub `READY FOR REVIEW` state;
4. stop work on that PR after readiness evidence is complete;
5. immediately move to the next executable task in the authorized queue;
6. repeat until the queue is exhausted or a dependency boundary blocks the next task.

Cursor should not wait for Product Authority to merge each prior PR when the next task has no dependency on that merge.

## Dependency boundaries

Cursor must pause instead of staging the next PR when:

- the next issue depends on code or documentation from an unmerged earlier PR;
- the next issue depends on post-merge CI artifacts or closeout from an earlier PR;
- the next issue lacks an open source issue;
- required source docs or allowlists are missing;
- validation failure requires work outside the source issue;
- two queued tasks would edit the same files in a way likely to create preventable PR conflicts;
- the controller launch comment marks the task as blocked.

A dependency boundary is a stop condition. Cursor must report the exact blocker and the next required Product Authority action.

## PR queue target

The desired steady state for an independent program lane is a queue of review-ready PRs, one per task, waiting for Bill to approve and merge oldest to newest.

PMO Admin then verifies those PRs as a batch and handles post-merge closeout after merge.

## Human approval boundary

Cursor may not:

- merge PRs;
- approve PRs;
- close source issues after merge;
- relabel issues after merge;
- bypass branch protection;
- launch a different program;
- create new child tasks unless the program launch explicitly grants issue-creation authority.

## Required program launch comment

Use this form on the parent program issue, child project issue, or first task issue:

```text
@cursor

Program queue launch authorization.

Program:
- #NNNN — <program title>

Project:
- #NNNN — <project title, if applicable>

Authorized queue:
1. #NNNN — <task title> — executable now
2. #NNNN — <task title> — executable now / blocked until <condition>
3. #NNNN — <task title> — executable now / blocked until <condition>

Execution rule:
- Work each executable issue as its own PR.
- Use exactly one PR source issue line for each PR:
  - **Issue:** #NNNN
- Work each PR to GitHub READY FOR REVIEW.
- After a PR is READY FOR REVIEW, continue to the next executable issue without waiting for merge unless a dependency boundary says otherwise.

Stop conditions:
- Stop at dependency boundary.
- Stop if file conflicts would make the next PR unsafe to stage before an earlier PR merges.
- Stop if validation requires out-of-scope work.
- Stop if the task would require merge, closeout, relabel, production, or secret authority.

Prohibited:
- Do not merge.
- Do not approve PRs.
- Do not close or relabel issues.
- Do not mutate parent program/project state unless explicitly authorized.
```

## Required Cursor status after each PR

Cursor must report:

```text
Task:
Source issue:
PR:
Branch:
Status: READY FOR REVIEW / BLOCKED
Validation:
Next queue item:
Dependency boundary: none / <reason>
```

## Intended final state

For a launched program with no dependency blockers, Cursor continuously stages the full ordered PR queue for human approval. Bill merges oldest to newest unless there is a reason not to. PMO Admin verifies PRs and post-merge state in batches.
