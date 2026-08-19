---
Doc Type: Tutorial
Audience: New PMO operators and agents
Authority Level: Learning Path
Owns: One worked example of classifying a project from Engineering qualification through Active
Does Not Own: Canonical stage definitions, weekly meeting procedure, or Product decisions
Canonical Reference: /docs/how-to/pmo/run-pmo-lifecycle-and-priority.md
Related Issues: #3597, #3620, #3622
Last Reviewed: 2026-08-19
---

# Classify a Project Through the PMO Lifecycle

## Goal

Learn how a fictional LGFC project moves from Engineering qualification into PMO Pipeline, progresses through design and launch-packet preparation, graduates to Active, and closes while keeping lifecycle state and ordered priority separate.

This walkthrough is not repository authority. Use the how-to for real Issues.

## Outcome

By the end of this tutorial, the reader should be able to:

- identify when an Issue is still in Engineering qualification;
- move a qualified project into PMO Pipeline at Initial Idea;
- recognize the evidence required for Drafted Design, Pending Launch Packet, and Graduation Candidate;
- distinguish Pipeline priority from Active priority;
- perform the label transition for explicit graduation to Active;
- understand that one implementation owner is selected for start-to-finish Active execution;
- close the PMO parent without incorrectly moving it into Operations.

## Walkthrough

## Starting point

You receive a proposed project: members cannot tell whether a submitted photo is already licensed.

Create or identify an Engineering qualification Issue:

```text
team:engineering
```

Write the problem, why it matters, the intended outcome, and the remediation direction (for example: capture rights metadata before review). Do not write the full child graph yet.

## Enter Pipeline

When those fields are coherent, the project leaves Engineering:

```text
remove team:engineering
add team:pmo
add pmo
add pmo:pipeline
add pmo:stage:initial-idea
add pmo:pipeline-priority:1
```

The project is now PMO preparation. It is not Active.

## Draft and approve design

Document the proposed design on the Issue. Request feedback from the agents who must live with the result. After feedback is reconciled and the design is approved, change only the stage label:

```text
pmo:stage:drafted-design  ->  pmo:stage:pending-launch-packet
```

Keep `pmo:pipeline` and the Pipeline priority.

## Build the launch packet

Add linked child tasks, the implementation plan, sequence, acceptance, rollback, and the intended implementation owner. When that packet is complete:

```text
pmo:stage:pending-launch-packet  ->  pmo:stage:graduation-candidate
```

The dashboard should now show Graduation Candidate. Implementation still must not start.

## Graduate

At the PMO meeting the project receives Active order 2 because another Active parent is already position 1, and Cursor Local is named as the single implementation owner:

```text
remove pmo:pipeline
remove pmo:pipeline-priority:1
remove pmo:stage:graduation-candidate
add pmo:active
add pmo:priority:2
keep team:pmo
```

Pipeline 1 and Active 2 are different queues. The old Pipeline number is not reused as the Active number unless the meeting independently chooses it.

## Close

After implementation, acceptance, and required handoff:

```text
remove pmo:active
add pmo:closed
```

Historical `pmo:priority:2` may remain as a closed-record label. Do not add `team:operations` to a closed PMO parent.
