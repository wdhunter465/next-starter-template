---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Mandatory project documentation lifecycle, AS-BUILT requirements, documentation completeness, closeout evidence, and documentation defect routing
Does Not Own: Product priorities, implementation authority, Production approval, or technical design decisions
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #1719
Last Reviewed: 2026-08-04
---

# Project Documentation and AS-BUILT Policy

## Governing invariant

Documentation is implementation. It is never optional, deferred, or treated as post-project administration.

A project is not complete unless its implementation, repository documentation, operational evidence, GitHub state, PMO records, dependency routing, and AS-BUILT documentation are complete, current, mutually consistent, and merged into the project’s required target.

There is no separate LGFC state called “administratively closed.” An Issue may not be closed merely because code or a component PR merged.

## Required documentation lifecycle

Every project must maintain all applicable documentation from design through Day-2 operation:

1. **Requirements and decision authority** — objective, scope, non-goals, acceptance criteria, constraints, dependencies, protected boundaries, and Product decisions.
2. **Design documentation** — architecture, data model, interfaces, user experience, security/privacy boundaries, operational model, and material tradeoffs.
3. **Implementation plan** — ordered tasks, file boundaries, delivery model, validation, rollback, stop conditions, and ownership.
4. **How-to documentation** — procedures for operators, maintainers, implementers, reviewers, deployment, rollback, and recovery.
5. **Reference documentation** — exact contracts, schemas, configuration, commands, routes, APIs, workflows, labels, states, and invariants.
6. **Explanation documentation** — why the final design exists, alternatives considered, and consequences.
7. **Tutorial documentation** — learning-oriented material when the project introduces a new repeatable capability.
8. **AS-BUILT documentation** — the exact implemented and deployed state at completion.
9. **Verification and closeout evidence** — tests, checks, promotion identity, merge identity, post-merge verification, rollback disposition, unresolved limitations, and final authority reconciliation.

## Mandatory AS-BUILT record

Every project requires a durable AS-BUILT document under `docs/ops/as-built/` or another project-specific controlled location explicitly named in the source Issue.

The AS-BUILT record must contain:

- project and parent Issue identifiers;
- final objective and delivered outcome;
- final architecture and component boundaries;
- exact files, routes, workflows, services, environments, databases, storage, bindings, secrets classes, and external dependencies affected;
- final data model, migrations, and integrity controls;
- final configuration and operational procedures;
- final security, privacy, legal, content-rights, and cost boundaries;
- exact implementation PRs, candidate SHA, merge SHA, and deployment identity;
- validation and post-merge verification results;
- rollback and recovery procedures;
- monitoring and Day-2 ownership;
- known limitations and separately authorized future work;
- superseded documents and final current-authority links;
- documentation reconciliation inventory proving every affected authority surface was updated.

The AS-BUILT document describes what exists, not what was planned.

## DIATAXIS requirement

Projects must classify documentation by user need:

- `docs/tutorials/**` — learning-oriented guided experience;
- `docs/how-to/**` — goal-oriented operational procedure;
- `docs/reference/**` — exact factual contract;
- `docs/explanation/**` — conceptual rationale and tradeoffs.

Governance, PMO plans, reports, and AS-BUILT records may live in their controlled operational locations, but they must link to and reconcile all applicable DIATAXIS surfaces.

A project may state that a DIATAXIS quadrant is not applicable only with a written justification in the source Issue and AS-BUILT document. Silence is not a disposition.

## PMO responsibilities

ChatGPT, acting as PMO / Engineering, is accountable for ensuring before closure that:

- the documentation inventory was defined at project preparation;
- each child Issue identifies its documentation impacts;
- documentation changes are included with the implementation that changes repository truth;
- an AS-BUILT document exists and matches the merged implementation;
- all PMO, queue, dashboard, registry, dependency, role, governance, operating, and reference surfaces are reconciled;
- intermediate reports are marked historical or superseded where necessary;
- no search-visible authority document presents stale project state;
- post-merge exceptions are assigned immediately to the implementer of the originating PR;
- independent verification confirms documentation completeness before closure.

PMO may not close a project based on percentage, merged code, closed child Issues, or a completion comment alone.

## Implementer responsibilities

Cursor or Claude, whichever implements the PR, must update all documentation affected by that PR in the same delivery transaction. The implementer must not defer documentation to PMO or a later project.

If a post-merge documentation exception is found, it is assigned immediately to the implementer of the PR where the exception occurred. PMO defines and routes the defect, independently reviews remediation, verifies the repository, and controls final closeout.

## Project template requirements

Every project master Issue and implementation plan must contain:

- documentation inventory by DIATAXIS quadrant and controlled operational documents;
- named AS-BUILT path;
- documentation acceptance criteria;
- repository-wide authority-consumer reconciliation requirement;
- documentation validation commands or review method;
- explicit prohibition on project closure while any required document is missing, stale, contradictory, unmerged, or unverifiable.

## Closeout gate

Before closing a project, independent verification must prove all of the following:

- every child task has a terminal disposition;
- implementation is integrated into the authorized target;
- required Production promotion and post-merge verification are complete when applicable;
- AS-BUILT documentation exists and matches the final implementation;
- every planned, governance, DIATAXIS, PMO, queue, dashboard, dependency, role, operating, and reference document is current;
- GitHub Issue bodies, labels, links, and status match repository truth;
- deferred work has separate source authority and is not counted as incomplete project work;
- no stale current-authority statement remains discoverable in the repository;
- final closeout evidence is merged.

Failure of any condition means `CLOSEOUT BLOCKED — DOCUMENTATION INCOMPLETE`.

## Enforcement

A documentation omission is a project defect and may be a release blocker. It must not be normalized as reporting lag or administrative cleanup.

Any agent discovering a documentation mismatch must:

1. stop the affected closeout claim;
2. record the exact stale, missing, or contradictory surfaces;
3. route remediation to the responsible implementer;
4. require independent review;
5. re-run documentation and repository-state reconciliation;
6. close only after the corrected evidence is merged and verified.
