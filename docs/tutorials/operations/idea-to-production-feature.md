---
Doc Type: Tutorial
Audience: New human and AI operators
Authority Level: Informational
Owns: Learning-oriented walkthrough of the four-lane, four-profile operating model
Does Not Own: Canonical policy, gate configuration, role assignment, or production authorization
Canonical Reference: /docs/reference/operations/operating-lanes-and-promotion-profiles.md
Related Issues: #2640, #2641, #2639
Last Reviewed: 2026-07-19
---

# Tutorial — From Idea to Public Production Feature

## Purpose

Teach new human and AI operators how one feature moves through the four-lane, four-profile operating model from idea to public Production use and Day-2 support.

## Scope

- Owns a learning-oriented walkthrough only.
- Does not own canonical policy, gate configuration, role assignment, or production authorization.
- Canonical definitions remain in `docs/reference/operations/operating-lanes-and-promotion-profiles.md` and related governance docs.

## Current known truth

- LGFC uses three horizontal lanes (PMO / Engineering, Implementation / Operations, Day-2 Operations) plus vertical Administration & Communications.
- Promotion profiles are Sandbox → Development → Promotion Candidate → Production; skipping profiles is prohibited.
- This tutorial is informational and must not be treated as executable authority.

## Intended final state

Operators who complete this tutorial can identify lane ownership and the correct promotion-profile path for a typical feature without inventing alternate lanes or skipped promotions.

## Goal

Follow one feature from agent entry through planning, optional experimentation, implementation, release qualification, production deployment, and Day-2 support.

## Scenario

LGFC wants a new member-facing feature that depends on an unfamiliar external integration. The design is promising, but one technical assumption is uncertain.

## Step 1 — Agent entry

The assigned agent reads `AGENTS.md`, loads the repository authority chain, identifies its durable role, and opens the source Issue and project manifest.

The current context is:

- horizontal lane: PMO / Engineering;
- profile: not yet selected;
- production: healthy;
- no operational hold.

Administration & Communications records the intake and routes the required evidence. It does not decide the product outcome.

## Step 2 — PMO / Engineering design

PMO / Engineering defines:

- the user outcome;
- acceptance criteria;
- scope and non-goals;
- design and architecture;
- dependencies;
- testing expectations;
- rollback expectations.

The external integration remains uncertain, so PMO / Engineering authorizes a Sandbox experiment.

## Step 3 — Sandbox proof of concept

Implementation / Operations executes the experiment on an isolated remote Sandbox branch.

The branch has:

- no production credentials or writes;
- a basic build check;
- targeted experiment tests;
- secret scanning;
- no path to Production.

The experiment proves the integration can work, but the code includes shortcuts and does not yet meet repository structure or acceptance requirements.

The result is **adopt into Development**, not release readiness.

## Step 4 — Development adoption

PMO / Engineering updates the approved Development work package using the Sandbox findings.

Implementation / Operations:

1. removes experimental shortcuts;
2. implements the repository design;
3. adds maintainable tests and documentation;
4. opens PRs against the remote component branch.

Automated Development gates verify build quality, tests, security, scope, metadata, and branch eligibility. Eligible non-protected PRs integrate automatically into the component branch.

One implementation task finishes while another is still active. Administration & Communications records the first task’s handoff, but the second independent task continues.

## Step 5 — A problem is found

During Development, Implementation / Operations discovers that one planned method cannot satisfy an acceptance criterion.

It posts:

```text
PROBLEM FOUND
Affected task: integration callback handling
Evidence: the provider cannot supply the required event ordering
Impact: current method cannot satisfy acceptance criterion AC-4
Independent work: safe to continue
```

Because PMO / Engineering made the design and acceptance decision, the communication routes there.

PMO / Engineering responds:

```text
ADJUSTMENT
Use the repository-side ordering buffer described below.
The product objective and acceptance criteria remain unchanged.
```

Administration & Communications records the decision and routes `RESUME`. No project-wide replan is required.

## Step 6 — Promotion Candidate

After Development is integrated, the team selects an exact component-branch SHA as the Promotion Candidate.

The candidate undergoes:

- full acceptance and regression tests;
- integrated external-service testing;
- load testing for expected fundraiser traffic;
- security and privacy checks;
- deployment rehearsal;
- rollback testing;
- monitoring validation;
- planned-versus-built review;
- repository-standards reconciliation.

The load test reveals a new operational requirement. The owning role updates the applicable standard, the candidate is adjusted in Development, and the affected Promotion Candidate tests run again.

After all requirements pass, the required roles record Production Go.

## Step 7 — Production

The exact approved candidate is promoted to `main` and deployed through the controlled Production path.

The team verifies:

- deployment success;
- routes and assets;
- external-service connectivity;
- feature behavior;
- monitoring and rollback readiness.

The feature is now available for public use.

## Step 8 — Day-2 Operations

Monitoring later detects elevated failures.

Because the impact is initially unknown, Day-2 Operations applies an assessment hold. The small current team pauses most other work while it determines:

- affected users and routes;
- probable cause;
- containment;
- resolution owner.

The issue is isolated to the new integration, and unrelated work cannot worsen it. The broad hold narrows to the incident task. Other work resumes.

Corrective implementation moves through Development and the required Promotion Candidate checks. Recovery is verified in Production, the remaining hold is released, and Administration & Communications closes the incident evidence.

## Result

The feature moved through a progressively stricter path:

```text
Idea
  -> PMO / Engineering
  -> Sandbox
  -> Development
  -> Promotion Candidate
  -> Production
  -> Day-2 Operations
```

The vertical Administration & Communications lane supported every stage without taking over the decisions of the horizontal lanes.