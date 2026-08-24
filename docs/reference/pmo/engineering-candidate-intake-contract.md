---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Bounded agent-generated Engineering candidate intake, package completeness, deduplication, and intake authority boundaries
Does Not Own: Engineering qualification decisions, PMO Active priority assignment, implementation Go, or Product Authority decisions
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3670, #3665
Last Reviewed: 2026-08-24
---

# Engineering Candidate Intake Contract

## Purpose

Let LGFC agents and deterministic repository telemetry surface candidate
improvement work — technical debt, test weaknesses, documentation drift,
recurring operational defects, security concerns, architectural
inconsistencies, CI shortcomings, and product improvement candidates —
continuously, without granting those observations implementation
priority or bypassing Engineering qualification (#3670). Implemented in
`scripts/ci/engineering-candidate-intake.mjs`.

Candidates route into the existing Engineering qualification authority
(`docs/governance/PMO-PORTFOLIO.md` § Intake); this contract does not
create a competing backlog surface.

## Candidate package fields

`validateCandidatePackage(candidate)` parses six required fields, using
the same labeled-field convention as #3665's `extractFieldValue`
(imported, not duplicated): `evidence`, `stated deficiency`, `intended
outcome`, `candidate remediation direction`, `constraints/risks`, and
`provenance` (the observation's source). A candidate is only
package-complete once every field carries real, non-placeholder content
— no bare, unevidenced observation enters the qualification model.

## Deduplication

`isDuplicateCandidate(a, b)` / `findDuplicateCandidates(candidate,
existingCandidates)` flag a duplicate deterministically when two
candidates share normalized (case/whitespace-insensitive) `stated
deficiency` text or normalized `provenance`. `evaluateCandidateIntake`
folds this into `intakeReady`, so a repeated observation is routed for
reconciliation with the existing candidate instead of spamming a new
Issue.

## Authority boundary

`assertCandidateAuthorityBoundary(action)` fails closed: only
`submit-candidate` and `route-to-engineering-qualification` are
permitted. `assign-pmo-active-priority`, `grant-implementation-go`,
`grant-project-graduation`, and `change-product-authority-decision` are
always rejected, regardless of how complete or well-evidenced the
candidate is — candidate generation can produce a package-complete,
non-duplicate candidate and still never self-promote it into priority,
Go, Graduation, or a Product Authority decision. An unrecognized action
is also rejected rather than defaulting to permitted.

## Non-goals

This contract does not decide Engineering qualification itself, does not
assign priority, and does not grant implementation Go or Project
Graduation — it only bounds what an evidence-backed candidate observation
may do on its own before a human/PMO decision is made.
