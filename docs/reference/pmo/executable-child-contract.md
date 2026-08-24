---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Canonical machine-readable executable project/child contract fields, package-completeness validation, and lifecycle-state consistency validation
Does Not Own: Project Graduation, priority, Product/Production decisions, PR approval, merge authority, or the human-facing child task template
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3665, #3055, #3113, #2724, #3240
Last Reviewed: 2026-08-24
---

# Executable Child Contract

## Purpose

Define the canonical machine-readable execution contract for PMO project
child Issues so eligible LGFC agents can evaluate claimability
deterministically, without interpretive handoff loss, and without a
competing source of truth. GitHub Issues remain the authoritative task
record; this document and its validator
(`scripts/ci/executable-child-contract.mjs`) describe how to read that
record mechanically.

This document formalizes the field set already described in prose by
`docs/templates/executable-child-task-template.md`. That template remains
the authoritative human-facing authoring guide; this contract is the
machine-readable projection of its required fields, plus the
lifecycle-state consistency and queue-invariant checks needed before a
child Issue is claimable.

Policy owners this contract reconciles with, without duplicating their
authority:

- Project Graduation and portfolio decisions: `docs/governance/PMO-PORTFOLIO.md`
- Queue/label/priority semantics: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`,
  `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md`
- Work-size/delivery model (Model A/B) classification:
  `docs/reference/pmo/work-size-and-delivery-model-contract.md`
- Claim lifecycle (`team:*` vs `agent:*`): `docs/governance/AGENT-TEAM.md`,
  `scripts/ci/agent-claim-contract.mjs`
- Separation of duties: `docs/reference/agents/implementation-authority-contract.md`

## Required execution-contract fields

A child Issue is **package-complete** only when every field below has a
labeled `Field: value` line in the Issue body with a real (non-placeholder)
value. A bare template placeholder (for example `____` or `#____`) does not
satisfy a field. An explicit answer such as `not applicable` or `terminal`
does satisfy a field, since it records a deliberate decision rather than an
unfilled blank.

| Field | Accepted labels (case-insensitive) | Meaning |
| --- | --- | --- |
| `objective` | `Objective`, `One bounded objective` | The single bounded objective of the child |
| `parentProject` | `Parent project`, `Parent` | The parent project Issue number |
| `predecessor` | `Predecessor`, `Predecessor and required WORK acceptance`, `Predecessor(s)` | Ordered predecessor(s) and required acceptance evidence |
| `permittedScope` | `Writable files/actions`, `Permitted file/domain scope`, `Permitted scope` | The permitted file/domain scope for the change |
| `acceptanceCriteria` | `Acceptance criteria`, `Observable acceptance criteria` | Observable acceptance criteria |
| `requiredValidation` | `Required validation`, `Positive validation`, `Negative/failure-path validation` | Required validation evidence |
| `expectedArtifact` | `Expected artifact/PR`, `Exact observable deliverable`, `PR target branch` | The expected artifact/PR |
| `rollback` | `Rollback`, `Rollback/disable/recovery procedure` | Rollback/disable/recovery procedure |
| `protectedStops` | `Protected stops`, `Stop conditions`, `Protected Product/Production/Legal/Privacy/Rights/Cost/Provider/Credential/Destructive-Data/Public-Claim boundaries` | Protected stops the child must not cross |
| `reviewerRequirement` | `Independent reviewer role holder`, `Required review/check evidence`, `Collaboration/reviewer requirement` | The independent-review requirement |
| `successor` | `Successor` | The successor child, or `terminal` |
| `completionEvidence` | `Durable evidence location`, `Completion evidence` | Where durable completion evidence is recorded |

Authors using `docs/templates/executable-child-task-template.md` already
produce most of these fields inline. For the two fields that template
renders as a heading followed by a bullet list (`Writable files/actions:`
and `Observable acceptance criteria:`), also record a summary value on the
labeled line itself (for example `Writable files/actions: src/widget/**,
tests/widget/**`) so the field is machine-readable in addition to the
prose bullet list.

## Package-completeness validation

`validatePackageCompleteness(issue)` in
`scripts/ci/executable-child-contract.mjs` parses the twelve fields above
and returns `complete: false` with an actionable `missing` field list and
`remediation` guidance when any field is absent or placeholder-only. A
child fails closed (`PACKAGE-INCOMPLETE`) rather than being silently routed
when package-complete is not demonstrated.

## Lifecycle-state consistency validation

`detectLifecycleContradiction(issue)` fails closed when the Issue body's
narrative text contradicts its live labels/status. Detected contradiction
classes:

1. **Not-authorized narrative vs. claimable labels** — body text states
   implementation is not authorized (or similar) while labels indicate
   `pmo:active`, `pmo:task`, `pmo:pipeline` + `pmo:stage:graduation-candidate`,
   or an active `agent:*` claim.
2. **Terminal narrative vs. live state** — a `Disposition`/`Status`/`State`
   field uses terminal language (`closed`, `complete`, `done`, `terminal`,
   `reconciled`, `accepted`) without the `pmo:closed` label, or the
   `pmo:closed` label is present while that field uses non-terminal
   language (`in progress`, `active`, `pending`, `open`, `blocked`, `hold`).
3. **Pipeline/Active/Engineering lifecycle language inconsistent with
   labels** — a `Lifecycle stage`/`Stage` field names a stage from
   `docs/reference/pmo/pmo-lifecycle-and-priority-contract.md` (for example
   `Graduation Candidate` or `Active`) whose required/forbidden labels do
   not match the Issue's live labels.

## Queue/package invariants

Before a child is treated as claimable, `evaluateExecutableChildContract`
also enforces the core queue invariants already codified in
`.github/queue-label-registry.json` and implemented by
`scripts/pmo-dashboard/queue-label-contract.mjs` (`analyzeQueueLabels`,
`role: 'task'`):

- exactly one `team:*` owner — project children carry none, since
  `team:*` is a portfolio-parent concern;
- no cross-namespace priority combination (`pmo:priority:*`,
  `pmo:pipeline-priority:*`, `eng:priority:*`, `ops:*`, `gov:*` are
  prohibited on a `pmo:task` child);
- lifecycle-compatible labels, evaluated by the checks above;
- required execution-contract fields present before claimability.

## Composite evaluation

`evaluateExecutableChildContract(issue)` composes all three checks and
returns a single fail-closed result:

| `status` | Meaning |
| --- | --- |
| `INVALID-QUEUE-STATE` | Malformed queue/label state (checked first — a malformed child cannot be evaluated for lifecycle or package state) |
| `LIFECYCLE-CONTRADICTION` | Body/label/lifecycle contradiction detected |
| `PACKAGE-INCOMPLETE` | One or more required fields missing or placeholder-only |
| `PACKAGE-COMPLETE` | All checks pass; `claimable: true` |

The result always includes the full aggregated `errors` and `remediation`
evidence from every check that ran, not only the highest-precedence one,
so the owning role can correct every defect in a single pass rather than
discovering them one at a time.

## Non-goals

This contract does not decide Project Graduation, priority, delivery-model
classification (Model A/B — see
`docs/reference/pmo/work-size-and-delivery-model-contract.md`), PR
approval, or merge authority. It only determines whether a child Issue's
package is complete and internally consistent enough to be evaluated for
claiming.
