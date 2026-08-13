---
Doc Type: Template
Audience: Human + AI
Authority Level: Operational
Owns: Standard role-based format for assigning scoped work to current and future LGFC agents and systems
Does Not Own: Source Issue scope, design authority, current team mapping, implementation decisions, PR approval, merge authority, or closeout policy
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #1449, #2700, #3138
Last Reviewed: 2026-08-07
---

# Agent Assignment Template

## 1. Purpose

This template is the mandatory format for assigning scoped repository work to an LGFC role holder. It is executor-neutral: current and future agents, models, tools, humans, and automation receive authority through durable roles defined in `docs/governance/AGENT-TEAM.md`.

Assignments must identify one source Issue, assigned role, current role holder, Issue class, parent/master relationship, closeout delegation, one deliverable, exact file scope, explicit non-goals, acceptance criteria, verification method, rollback plan, pre-implementation checkpoint, implementation Go, stop conditions, and handoff requirements.

A named agent does not receive permanent repository authority from this template. The current team mapping or project manifest determines which member fills each role.

## 2. When to use this template

Use this template when:

- assigning implementation, remediation, documentation, governance, verification, troubleshooting, worklist, or operations-cleanup work;
- converting a source GitHub Issue into a launch-control-ready package;
- assigning a project-child or child-remediation task that may receive delegated task-closeout authority;
- assigning work to a newly added team member or changing the role holder without changing repository policy; or
- routing work through a launched program or project dependency map.

Do not use this template to:

- replace the source Issue;
- grant a role that is absent from the current team mapping or project manifest;
- authorize self-approval or self-merge;
- bypass delivery, Promotion Candidate, Production, or incident policy; or
- delegate project/master or higher-level closeout through task-level authority.

## 3. Required assignment fields

| Field | Requirement |
| --- | --- |
| Operating mode | Exactly one mode; the role holder must not switch modes without new authority |
| Assigned durable role | Product Authority, PMO / Engineering, Implementation / Operations, PR Approver / Engineering, Administration & Communications, Day-2 Operations, or Deterministic CI |
| Current role holder | Exact current member or system mapped to the assigned role |
| Runtime or execution surface | Exact runtime, connector, local/cloud surface, or `not applicable`; member-specific policy controls allowed values |
| Source Issue | Exactly one primary source Issue (`#number`) |
| Issue class | `one-off-task`, `project-child`, `child-remediation`, `project-master`, `program`, `promotion-candidate`, `production`, `incident`, or `ops-interrupt` |
| Parent/master | Exact parent or master Issue, or `not applicable` |
| Task-closeout delegation | `delegated`, `reserved`, or `not applicable` |
| Documentation package | Canonical policy, design, plan, procedure, or approved PR that gates the work |
| Objective | Plain language; one task only |
| Deliverable | Exact file, Issue, PR, report, review, deployment, or administrative output |
| Approved file/action scope | Explicit allowlist and permitted GitHub actions |
| Explicit non-goals | Actions, files, decisions, and closeout levels excluded from the assignment |
| Acceptance criteria | Checklist the assigned role holder can verify without inventing decisions |
| Verification plan | Exact commands, checks, evidence sources, or manual review steps |
| Rollback or recovery plan | How to revert, contain, or safely halt |
| Pre-implementation checkpoint | Required package review before edits or mutations begin |
| Implementation Go or action authority | Exact role decision and durable reference authorizing execution |
| Stop conditions | Protected stops, holds, scope conflicts, or missing evidence that require escalation |
| Handoff | Changed files/actions, validation, risks, scope confirmation, and next target role |
| Execution Contract | Explicit agreed-action elements when Product Authority (or equivalent) has approved a formulated action; see `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md` |
| Closeout packet | Required when task-closeout delegation is `delegated` |
| Dependency fields | Predecessor, successor, stage-before-merge, collision, halt/resume condition when applicable |

## 4. Mandatory template block

Copy this block into the source Issue or canonical assignment comment. Replace every placeholder before execution.

```markdown
# AGENT ASSIGNMENT — <Work Path / Project / Task Name>

## 1. Operating Mode

Mode: <Design | Sandbox | Documentation | Governance | Worklist | Verification | Troubleshooting | Implementation | Administration & Communications | Day-2 Operations>

Do not switch modes without new recorded authority.

## 2. Assigned Role and Role Holder

Assigned durable role: <role>
Current role holder: <member or system>
Runtime or execution surface: <local | cloud | connector | automation | not applicable>
Current mapping authority: `docs/governance/AGENT-TEAM.md` or <project manifest path/reference>

The role contract, not the member name, defines authority.

## 3. Source Issue and Work Class

Primary source Issue: #<number>
Issue class: <one-off-task | project-child | child-remediation | project-master | program | promotion-candidate | production | incident | ops-interrupt>
Parent/master: #<number> | not applicable
Task-closeout delegation: delegated | reserved | not applicable

Use only the primary source Issue as task authority. Do not treat umbrella Issues, trackers, prior chats, old PRs, labels, branch state, or memory as substitute authority.

## 4. Documentation Package

Read before acting:

1. `Agent.md`
2. `docs/governance/REPOSITORY-AUTHORITY.md`
3. `docs/governance/AGENT-TEAM.md`
4. `docs/ops/ai/SHARED-AGENT-RULES.md`
5. `docs/ops/ai/CORE-RULES.md`
6. <task-specific policy, design, plan, procedure, or skill>

Approved documentation PR or decision reference: #<number> | <path/reference>

If sources conflict, stop and report `authorityConflict`.

## 5. Objective

<One bounded objective in plain language.>

## 6. Deliverable

Create or update exactly:

- <exact file path, Issue action, PR, review, report, deployment, or closeout output>

## 7. Approved File and Action Scope

Files permitted:

- <exact path>

GitHub or operational actions permitted:

- <exact action>

Do not edit or mutate anything else.

## 8. Explicit Non-Goals

Do not:

- expand scope beyond this assignment;
- make product, architecture, acceptance, priority, cost, business, Production, or recovery decisions outside the assigned role;
- approve or merge work implemented by the same role holder when independent review is required;
- create additional Issues or PRs unless explicitly authorized;
- modify workflows, runtime code, Production configuration, credentials, or paid services unless explicitly allowed;
- close a project/master, program, Promotion Candidate, Production, release, incident, standalone `OPS:`, or Product Authority disposition Issue through task-level delegation.

## 9. Acceptance Criteria

This assignment is complete when:

- [ ] <criterion 1>
- [ ] <criterion 2>
- [ ] <criterion 3>
- [ ] Every Execution Contract element (when present) is verified `Agreed → Delivered → PASS`

The agreed deliverable itself is an acceptance criterion. Useful-but-substituted outcomes do not satisfy the contract (`docs/governance/standards/AGENT-EXECUTION-FIDELITY.md`).

## 9a. Execution Contract (required when an action was explicitly approved)

When Product Authority (or another explicitly authorized decision role) has approved a formulated action, record it here. Omit this section only when the assignment has no separately approved multi-element action beyond the Objective/Deliverable fields above.

```text
AGREED ACTION

1. ____________________
2. ____________________
3. ____________________
4. ____________________
5. ____________________

Execution fidelity:
- Execute every numbered element exactly as approved.
- No substitution, summarization, expansion, reduction, reinterpretation, optimization, or redesign without new approval.
- If any element cannot be completed exactly, STOP and identify that element and blocker.
- Bounded technical discretion is allowed only for details the contract intentionally leaves open, without changing meaning, scope, source, destination, or required end state.
```

Canonical doctrine: `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md`.

## 10. Verification Plan

Run or perform:

- `<exact command or evidence check>`

Expected result:

- <exact pass condition>

Report exact results. Do not convert failed or ambiguous evidence into success.

## 11. Rollback or Recovery Plan

If validation fails or an authorized role records a hold:

- <exact revert, branch discard, feature disablement, containment, or safe halt procedure>

## Executable Child Package Gate

For a `project-child` or `child-remediation`, the live Issue must also define:

- exact ordered sequence, predecessor deterministic-completion rule, and successor;
- exact branch naming rule, target branch, and starting-SHA recording;
- exact writable file/action allowlist and explicit non-goals;
- observable acceptance criteria;
- implementation and validation steps;
- positive tests and applicable negative/failure-path tests;
- durable evidence location;
- rollback, disable, or recovery procedure;
- independent reviewer and prohibition on self-approval/self-merge;
- protected Product, Production, legal, privacy, rights, cost, provider, credential, destructive-data, and public-claim boundaries;
- implementation handoff packet;
- WORK assurance packet when a substantive acceptance gate applies, plus eligible-agent self-claim continuation under standing parent authority (#3145);
- Team ownership (`team:*`) versus execution claim (`agent:*`) — claim does not transfer Team ownership.

If any applicable field is absent, record `PACKAGE-INCOMPLETE` and stop before branch creation or editing. Do not infer the value and do not use a generic `BLOCKED` state.

## 12. Pre-Implementation Checkpoint

Before edits or mutations, the assigned role holder records:

- [ ] Repository authority read
- [ ] Current role mapping verified
- [ ] Source Issue and Issue class verified
- [ ] Parent/master verified
- [ ] Task-closeout delegation verified
- [ ] Allowlist and permitted actions complete
- [ ] Non-goals clear
- [ ] Acceptance criteria verifiable
- [ ] Verification and rollback plans present
- [ ] Protected stops reviewed
- [ ] Agreed-action contract loaded (or N/A — no separate Execution Contract)
- [ ] Every agreed element is executable as written
- [ ] No substitution or interpretation is required to begin
- [ ] Checkpoint: PASS | FAIL — <blockers>

Do not begin until checkpoint PASS and required action authority are recorded.

If interpretation or substitution is required to begin, stop and route before execution rather than deciding unilaterally.

## 13. Implementation Go or Action Authority

Decision authority role: <role>
Authorized action: <implementation Go | review | integration | deployment | recovery | closeout transaction | other>
Authority reference: #<Issue/comment/PR/review/check/deployment>

## 14. Stop Conditions

Stop and route when:

- authority, Issue class, parent/master, role mapping, or delegation is missing or contradictory;
- work would exceed the file or action allowlist;
- required validation, independent review, integration, or post-integration verification fails;
- a protected stop or operational hold applies;
- the requested transaction belongs to a different closeout class or decision authority; or
- terminal state cannot be determined without interpretation.

## 15. Handoff Required

When implementation, review, or remediation is complete, report:

- files or repository state changed;
- summary of work;
- exact validation performed and outcomes;
- unresolved risks or blockers;
- confirmation that scope did not expand;
- target role and requested next action;
- PR, commit, deployment, or incident identity;
- Execution Contract Verification (section 15a) when an Execution Contract was present.

## 15a. Execution Contract Verification

Required before claiming completion when section 9a was used. Completion requires every applicable element to PASS.

```text
EXECUTION CONTRACT VERIFICATION

1. Agreed: __________
   Delivered: ________
   Result: PASS | FAIL

2. Agreed: __________
   Delivered: ________
   Result: PASS | FAIL

3. Agreed: __________
   Delivered: ________
   Result: PASS | FAIL

Overall: PASS | FAIL
```

Do not report `complete`, `done`, `accepted`, or equivalent terminal success when any required element is FAIL, missing, substituted, or unverifiable.

## 16. Task Closeout Packet

Complete this section only when `Task-closeout delegation: delegated` and the Issue class is `project-child` or `child-remediation`.

```text
CLOSEOUT
Level: task
Subject: #____
Source authority: #____
Issue class: project-child | child-remediation
Assigned role holder: ____
Parent/master: #____
Profile: development
PR / integration identity: ____
Validation and independent review evidence: ____
Post-integration verification: pass
Decision authority: Implementation / Operations
Transaction executor: deterministic-ci | assigned-implementation-operations
Terminal state: ____
Parent/program/reporting action: ____
Successor action: ____
Unresolved gaps: none | ____
Exception: none | #____
```

Deterministic CI attempts the transaction first. The assigned Implementation / Operations role holder may complete an otherwise eligible task transaction if automation does not. Do not duplicate a successful transaction.

## 17. Dependencies and Continuation

Predecessor: #____ | none
Successor: #____ | terminal | none
Stage-before-merge: yes | no | not applicable
Collision constraints: ____ | none
Halt/resume condition: ____

Dependency state controls technical continuation. Routine administrative prose does not create a dependency.
```

## 5. Prohibited omissions

Do not issue an assignment without:

- one numbered primary source Issue;
- assigned durable role and current role holder;
- Issue class and parent/master disposition;
- task-closeout delegation state;
- canonical documentation package;
- exact file and action scope;
- explicit non-goals;
- verifiable acceptance criteria;
- verification and rollback or recovery plans;
- pre-implementation checkpoint;
- implementation Go or action authority;
- stop conditions; and
- handoff requirements.

Do not:

- stack unrelated tasks in one assignment;
- use “continue from prior chat” as authority;
- infer a role from an agent name;
- assign a member to a role absent from the current mapping or project manifest;
- weaken shared governance in assignment text; or
- use task-closeout delegation to bypass independent review or higher-level closeout authority.

## 6. Valid operating-mode examples

| Mode | Valid assignment summary |
| --- | --- |
| Documentation | Assigned PMO / Engineering or Implementation / Operations role holder updates one canonical document under one source Issue; header and taxonomy checks required |
| Design | PMO / Engineering produces one bounded design or implementation plan; no implementation authority implied |
| Verification | PR Approver / Engineering inspects one PR, check set, candidate, or integrated state; no file edits unless separately authorized |
| Implementation | Assigned Implementation / Operations role holder implements one bounded task with exact allowlist, validation, independent review path, and closeout delegation state |
| Troubleshooting | Owning horizontal role diagnoses one bounded failure and routes changes through the applicable source Issue |
| Governance | PMO / Engineering aligns one authority domain with canonical policy and controlled contracts |
| Worklist | PMO / Engineering and Administration & Communications reconcile one Issue hierarchy without creating implementation authority |
| Administration & Communications | Assigned role holder executes one authorized routing, state, hold/resume, reporting, or closeout transaction |
| Day-2 Operations | Day-2 Operations handles one bounded monitoring, incident, containment, recovery, or hold-release action |

## 7. Required references

- Constitution and authority order: `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`
- Durable roles and current mappings: `docs/governance/AGENT-TEAM.md`
- Shared execution rules: `docs/ops/ai/SHARED-AGENT-RULES.md`, `docs/ops/ai/CORE-RULES.md`
- Execution fidelity: `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md`
- Implementation role contract: `docs/reference/agents/implementation-authority-contract.md`
- Administration executor matrix: `docs/reference/operations/administrative-control-lane-contract.md`
- Issue closeout procedure: `docs/ops/pmo/github-issue-closeout-protocol.md`
- Runtime-specific policy: applicable member or tool compatibility document
