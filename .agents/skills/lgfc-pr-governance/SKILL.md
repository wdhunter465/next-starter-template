# LGFC PR Governance Skill

Use this skill for PR creation, updates, source-Issue linkage, scope control, promotion-profile validation, independent review, Administration & Communications synchronization, and closeout evidence.

## Required authority chain

Before PR work, read:

1. `Agent.md`
2. `docs/governance/REPOSITORY-AUTHORITY.md`
3. `docs/governance/AGENT-TEAM.md`
4. `docs/ops/ai/CORE-RULES.md`
5. `docs/governance/PR_PROCESS.md`
6. `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`
7. `docs/governance/DELIVERY-AND-RELEASE.md`
8. `docs/reference/operations/operating-lanes-and-promotion-profiles.md`
9. source Issue and applicable task documents

For routing, labels, holds, communication, or closeout also read:

- `docs/governance/ADMINISTRATION-AND-COMMUNICATIONS.md`
- `docs/reference/operations/administrative-control-lane-contract.md`
- `docs/ops/ai/chatgpt-cursor-handoff-workflow.md`
- `docs/ops/pmo/queue-watch-and-dispatch-protocol.md`
- `docs/ops/pmo/github-issue-closeout-protocol.md`

## Required inputs

- one primary source Issue that **predates** the branch, first commit, and PR (issue-first hard gate; no PR-first exceptions — #3117);
- durable owner roles;
- horizontal lane;
- promotion profile;
- delivery model;
- target branch/environment;
- allowed paths and non-goals;
- acceptance and validation requirements;
- protected/operational hold state;
- current PR, check, review, and Issue evidence.

## Promotion-profile rule

Allowed progression:

```text
Sandbox -> Development -> Promotion Candidate -> Production
```

Prohibited:

```text
Sandbox -X-> Promotion Candidate
Sandbox -X-> Production
Development -X-> Production
```

### Sandbox PR

- isolated Sandbox target;
- scaled-down safety gates;
- no Production claim or path;
- result is discard, evidence-only, or Development adoption.

### Development PR

- targets approved non-main Development/component branch;
- uses automated build/test/security/scope/metadata gates;
- eligible non-protected work may integrate automatically;
- protected/material work requires PR Approver / Engineering;
- does not claim whole-feature Production readiness.

### Promotion Candidate

- exact integrated candidate identity;
- full applicable qualification and standards reconciliation;
- Go, No-Go, or return-to-Development decision;
- mandatory before Production.

### Production PR

- exact approved candidate;
- no unreviewed drift;
- full repository standards;
- required Engineering and Production authority;
- rollback and live-verification plan.

## PR-body rule

The PR body stores stable facts only:

- source Issue;
- intent and PR class;
- delivery model and promotion profile;
- target branch/environment;
- component/candidate identity when applicable;
- allowlist and out-of-scope declaration;
- change summary;
- verification already run;
- acceptance criteria;
- rollback summary;
- follow-up declaration;
- reviewer/bot attestation.

Do not use the PR body as a live database for draft/review/merge state, checks, threads, approval, queue, hold, incident, or closeout state.

## Procedure

1. Confirm one primary source Issue.
2. Confirm role, lane, profile, delivery model, target, and allowlist.
3. Reject mixed-intent or prohibited profile transitions.
4. Confirm stable PR facts match the current diff.
5. Read current checks, reviews, threads, labels, holds, and candidate identity from GitHub-native surfaces.
6. Apply profile-appropriate gates.
7. Distinguish automated Development eligibility from human Engineering approval.
8. Do not allow Implementation / Operations to self-approve protected work or Production promotion.
9. Record the appropriate disposition:
   - `APPROVED FOR INTEGRATION`
   - `ADJUSTMENT`
   - `PLAN CHANGE REQUIRED`
   - `PROMOTION CANDIDATE READY`
   - `PRODUCTION GO`
   - `HOLD`
10. Re-read current state immediately before merge, integration, or administrative mutation.
11. Verify closeout at the correct level; do not claim Production completion from Development integration.

## Lightweight correction

When a PR exposes a problem:

```text
PROBLEM FOUND
  -> route to the role that made the controlling decision
  -> GUIDANCE or ADJUSTMENT
  -> Administration & Communications records
  -> RESUME
```

Pause only the affected scope unless evidence requires more. Use `PLAN CHANGE REQUIRED` for material changes to product outcome, architecture, acceptance criteria, dependency structure, delivery model, profile path, Production boundary, or recovery strategy.

## Minimal-gate rule

A required gate must protect a material invariant:

- source authority;
- scope or branch boundary;
- profile transition;
- required validation;
- independent review/approval;
- protected or Production boundary;
- candidate identity;
- predictable closeout integrity.

Dashboard freshness, optional comments, cosmetic label order, duplicated PR-body state, and session presence are not independent gates.

## Administration & Communications rule

Administration & Communications may reconcile routing, labels, assignments, evidence, holds, resumes, reporting, and closeout to existing authority.

It must not create design, implementation, approval, recovery, or Production authority.

Routine administrative closeout does not block an independent Development successor.

## Stop conditions

Stop the affected transition when:

- source authority is missing or contradictory;
- role, lane, profile, target, or candidate identity is unclear;
- diff exceeds the allowlist or mixes intents;
- required checks or independent review are missing or failed;
- protected or operational hold applies;
- a prohibited profile transition is attempted;
- Production work differs from the approved candidate;
- closeout would falsely claim a higher completion level;
- the current plan cannot satisfy acceptance without material change.
