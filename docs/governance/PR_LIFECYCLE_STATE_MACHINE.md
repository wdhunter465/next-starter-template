---
Doc Type: Governance / Process
Audience: Human + AI
Authority Level: Governance
Owns: PR lifecycle states, transition gates, profile-specific readiness, GitHub-native evidence, and closeout transition requirements
Does Not Own: PR-body policy, delivery-model selection, product/design authority, Administration mutation taxonomy, or Production approval
Canonical Reference: /docs/governance/PR_PROCESS.md
Related Issues: #2640, #2641
Last Reviewed: 2026-07-19
---

# PR Lifecycle State Machine

## Purpose

Define the GitHub-native lifecycle for LGFC pull requests while preserving the four promotion profiles.

```text
NO PR -> DRAFT -> READY FOR REVIEW -> READY FOR INTEGRATION OR PROMOTION
      -> AUTHORIZED DECISION -> INTEGRATED OR MERGED -> CLOSEOUT VERIFIED
```

The logical state is derived from GitHub evidence. It is not duplicated as a dynamic PR-body ledger.

## Profile context

Every PR lifecycle evaluation identifies:

- source Issue;
- durable owner roles;
- delivery model;
- current promotion profile;
- target branch/environment;
- protected scope;
- current operational hold.

The same PR state has different exit authority by profile.

| Profile | Normal target | Exit boundary |
| --- | --- | --- |
| Sandbox | isolated Sandbox branch | discard, evidence, or Development adoption |
| Development | non-main component branch | eligible integration into Development |
| Promotion Candidate | exact integrated candidate/release record | Go/No-Go or return to Development |
| Production | `main` / Production environment | authorized merge/deploy and live verification |

## State 0 — NO PR

A valid task exists and no PR exists.

Before opening a PR confirm:

- one primary source Issue;
- role, lane, profile, delivery model, target, and allowlist;
- no prohibited profile transition;
- applicable authority and skills;
- operational hold state;
- stable PR facts can be supplied.

Stop when authority, target, profile, or scope is ambiguous.

## State 1 — DRAFT

A PR exists but implementation, validation, stable facts, or handoff evidence is incomplete.

Transition to `READY FOR REVIEW` when:

- diff matches the source allowlist and intent;
- PR stable facts match the current diff;
- profile-appropriate builder validation is complete or exact blockers are recorded;
- acceptance criteria are addressed;
- Implementation / Operations records the handoff.

The affected task may pause for review. Independent Development work may continue when authorized.

## State 2 — READY FOR REVIEW

The PR is open, not draft, and available for independent inspection.

Review evaluates:

- current head SHA;
- source Issue and profile;
- required checks;
- scope and branch boundary;
- acceptance and design alignment;
- protected paths;
- review threads;
- candidate/Production constraints when applicable;
- predictable closeout integrity.

Possible dispositions:

- `APPROVED FOR INTEGRATION` for eligible Development work;
- `PROMOTION CANDIDATE READY` after complete candidate qualification;
- `PRODUCTION GO` when the Production decision is authorized;
- `ADJUSTMENT` for bounded correction;
- `PLAN CHANGE REQUIRED` for material change;
- `HOLD` for protected or operational conditions.

## State 3 — READY FOR INTEGRATION OR PROMOTION

Required technical and governance evidence is complete for the current profile.

### Sandbox

Sandbox work may integrate only within the isolated Sandbox or be adopted into a normal Development work package. It cannot become Promotion Candidate or Production directly.

### Development

Non-protected work may integrate automatically into the non-main component branch when deterministic eligibility passes. Protected/material work requires PR Approver / Engineering.

Development integration does not establish Promotion Candidate or Production readiness.

### Promotion Candidate

The exact candidate identity and qualification evidence are complete. The candidate awaits Go/No-Go by the required roles.

### Production

The exact approved candidate, full standards, Production authority, rollback, and environment readiness are complete. The PR awaits the authorized merge/deploy decision.

## State 4 — AUTHORIZED DECISION

The required role or deterministic policy has recorded the transition decision.

Before action recheck:

- current head/candidate SHA;
- current checks and review threads;
- source Issue and role authority;
- branch/environment target;
- profile transition legality;
- operational holds;
- rollback and closeout expectations.

Return to review or Development if evidence regresses or candidate identity changes.

## State 5 — INTEGRATED OR MERGED

GitHub records non-main integration or Production merge.

### Development integration

Administration & Communications verifies:

- correct component branch;
- required checks and review disposition;
- source task state;
- parent/project accounting;
- successor dependency state;
- one bounded exception when needed.

Independent successors do not wait for routine administrative prose when their dependencies already permit execution.

### Production merge/deploy

Verify:

- exact approved Promotion Candidate identity;
- merge/deployment record;
- required post-deployment checks;
- live feature and service health;
- rollback/incident disposition;
- Day-2 ownership transfer.

### WORK acceptance transition

After Development integration or Production merge evidence exists, WORK performs the acceptance review required by the source package when a substantive assurance gate applies or a discrepancy appears. The allowed dispositions are `ACCEPT`, `HOLD`, `REMEDIATE`, and `VERIFY MORE`.

For a graduated serial project, the next prepared package-complete successor may be self-claimed under standing parent authority after deterministic predecessor completion without repeat dispatch (#3145). WORK `ACCEPT` is required for child closure and parent reconciliation when the project defines a substantive acceptance gate on that edge, and for exception/HOLD/REMEDIATE decisions. Neither merge state nor routine Administration prose invents acceptance. If WORK implemented the PR, WORK cannot supply its own independent review or verification; another authorized reviewer must provide that evidence before acceptance.

## State 6 — CLOSEOUT VERIFIED

The applicable closeout transaction is complete.

Evidence varies by level:

| Closeout level | Required result |
| --- | --- |
| Sandbox | discarded, evidence-only, or adopted into Development |
| Development task | non-main integration or authorized disposition; task accounting complete |
| Promotion Candidate | approved, returned, superseded, or stopped |
| Production | deployment and live verification complete |
| Incident | recovery verified, holds released, follow-up tracked |

Later deterministic drift may be corrected without duplicating the original closeout.

## GitHub-native evidence

| State | Surface |
| --- | --- |
| Draft/open/merged/closed | PR state |
| Validation and eligibility | checks/workflow runs |
| Independent review | reviews and threads |
| Lane/profile/routing | source Issue, labels, assignments, structured comments |
| Candidate identity | release Issue/PR, commit, checks, artifacts |
| Production decision | recorded role authority and merge/deployment record |
| Holds and recovery | incident Issue, labels, comments, checks |
| Closeout | source Issue and closeout record |

## Administration & Communications synchronization

The vertical lane may reconcile deterministic state but must not:

- advance a profile without its evidence and decision;
- create review or Production authority;
- convert reporting lag into a gate;
- serialize independent Development;
- permit Sandbox -> Promotion Candidate/Production or Development -> Production.

## Minimal-gate principle

Required gates protect only material invariants:

- valid authority;
- exact scope and target;
- profile-appropriate validation;
- independent approval when required;
- protected/Production boundary;
- legal profile transition;
- predictable closeout integrity.

Cosmetic metadata, dashboard freshness, duplicate PR-body state, and session presence are not independent gates.

## Non-merge dispositions

Canceled, duplicate, superseded, not-planned, evidence-only Sandbox, administrative-only, and no-change verification may bypass merge when explicit authority records the disposition.

A non-merge disposition cannot falsely claim implementation, candidate, Production, or recovery success.

## Related authorities

- `docs/governance/PR_PROCESS.md`
- `docs/governance/DELIVERY-AND-RELEASE.md`
- `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
- `docs/reference/operations/administrative-control-lane-contract.md`
- `docs/ops/pmo/github-issue-closeout-protocol.md`