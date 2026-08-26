---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Delivery models, Sandbox/Development/Promotion Candidate/Production profiles, integration and promotion boundaries, approval profiles, rollback policy, and release-unit promotion rules
Does Not Own: Current team-member assignments, PMO sizing, CI implementation, environment-isolation proof, or emergency stabilization procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2495, #2640, #2641, #3752, #3753
Last Reviewed: 2026-08-26
---

# Delivery and Release

## Purpose

This document defines how approved work moves from experimentation or implementation into public production use.

- **Delivery models** define the shape of the release unit.
- **Promotion profiles** define the increasing control applied as work approaches Production.

Stable role names are used throughout. Current people and agents are mapped in `docs/governance/AGENT-TEAM.md` or the project manifest.

Canonical profile definitions live in `docs/reference/operations/operating-lanes-and-promotion-profiles.md`.

## Promotion profiles

### Sandbox

Sandbox is an optional, isolated PMO / Engineering proof-of-concept profile.

- remote isolated branch;
- scaled-down build/test, secret, isolation, and reproducibility checks;
- no production credentials, writes, or bindings;
- no direct path to Promotion Candidate or Production;
- output may be discarded, retained as evidence, or adopted into Development.

### Development

Development is the primary Model B implementation profile.

- work targets a non-production component branch;
- automated PR gates validate build, tests, security, scope, metadata, protected paths, freshness, and component state;
- eligible non-protected work may integrate automatically into the component branch;
- protected or material design concerns route to PR Approver / Engineering;
- independent work may continue while prior work is review- or administration-pending.

Sandbox output must enter Development before it can become a Promotion Candidate.

### Promotion Candidate

Promotion Candidate is the mandatory release barrier between Development and Production.

The exact integrated candidate identity must be recorded. Applicable release qualification includes:

- integrated acceptance and regression testing;
- load and performance testing;
- security and privacy validation;
- migration and data-integrity validation;
- failure-path, resilience, and recovery testing;
- deployment and rollback rehearsal;
- operational-readiness and monitoring validation;
- planned-versus-built and unresolved-gap review;
- documentation and repository-standards reconciliation;
- manual Go/No-Go by the required roles.

A material failure returns the candidate to Development. A solution that legitimately changes repository standards must reconcile those standards before Production Go.

### Production

Production is the controlled path to `main`, deployment, live verification, and public use.

- full repository standards apply;
- the approved candidate identity must not drift;
- applicable manual production authority is required;
- rollback readiness and production bindings are verified;
- deployment is controlled and followed by live health verification;
- failure enters containment, rollback, or Day-2 Operations.

## Mandatory transitions

Allowed:

```text
Sandbox -> Development
Development -> Promotion Candidate
Promotion Candidate -> Development
Promotion Candidate -> Production
Production -> Day-2 Operations
```

Prohibited:

```text
Sandbox -X-> Promotion Candidate
Sandbox -X-> Production
Development -X-> Production
```

The profiles progressively narrow work into full repository alignment. They are not interchangeable labels.

Model C documentation-only merges to `main` do **not** travel the Sandbox → Development → Promotion Candidate path. They use the documentation gate profile defined below and remain outside executable Promotion Candidate qualification unless a separate rule independently requires it.

## Delivery models

Every release unit uses exactly one delivery model.

| Model | When used | Profile path | Rollback profile |
| --- | --- | --- | --- |
| Model A | Small or Medium work that fits one reviewable production PR | Promotion Candidate -> Production | `one-step` |
| Model B child | Bounded increment into a component branch | Development only | `multi-step` component scope |
| Model B promotion | Final integrated release-unit promotion | Promotion Candidate -> Production | `multi-step` release-unit scope |
| Model C | Documentation-only work on approved documentation surfaces | Documentation gate profile (no code Promotion Candidate) | `one-step` (docs revert) |
| Emergency recovery | Production unavailable, unsafe, or materially degraded | Day-2 Operations -> Development/Promotion Candidate/Production as risk requires | `emergency-stabilization` |

Rules:

- Model A PRs target `main`, but the PR must still satisfy the Promotion Candidate profile before Production merge.
- Model B child PRs target `component/<release-unit>` and must not claim Production readiness.
- Model B promotion PRs contain the exact integrated candidate and release evidence; they introduce no unqualified feature implementation.
- Model C PRs target `main` (or an approved documentation-only branch that merges only documentation surfaces to `main`). They must not claim code Promotion Candidate or Production deployment readiness solely by virtue of being documentation.
- Emergency recovery follows stabilization-first authority and must not bypass required release qualification unless emergency policy explicitly authorizes the bounded exception.

PMO / Engineering selects the delivery model under `docs/governance/PMO-PORTFOLIO.md`.

## Model A — direct release unit

Model A is a single reviewable change whose PR itself becomes the Promotion Candidate.

Requirements:

- one primary source Issue;
- one implementation PR targeting `main`;
- full behavior testable before merge;
- Promotion Candidate validation complete;
- PR Approver / Engineering approval;
- Production authority recorded;
- one-step rollback prepared.

One-step rollback is one controlled action:

1. revert the production merge commit; or
2. restore the previous known-good deployment.

Targeted smoke tests confirm recovery.

## Model B — component construction and promotion

Model B builds a cohesive release unit on a non-production component branch before one controlled Production promotion.

### Branch structure

```text
component/<release-unit>     — Development integration branch
<agent>/<issue>-<task>       — child implementation branch
child PR base                — component/<release-unit>
promotion PR head            — exact approved component candidate
promotion PR base            — main
```

### Development child integration

| Field | Value |
| --- | --- |
| Delivery model | `B-child` |
| Profile | `development` |
| Target environment | `component` |
| Gate profile | `component-child` |
| Rollback profile | `multi-step` |
| Approval profile | automated non-main eligibility when non-protected; Engineering review when protected or material |

Child PRs do not require whole-feature Production approval or final release closeout.

Deterministic CI may record automated eligibility and enable non-main integration. It must not impersonate a human Engineering decision. Implementation / Operations must not self-approve protected work.

### Promotion Candidate construction

The candidate is an exact component-branch identity selected after intended Development increments are integrated.

Prerequisites:

- intended Development work integrated;
- candidate scope frozen or identified;
- integrated release qualification complete;
- component branch synchronized with current `main`;
- rollback package finalized;
- as-designed, as-built, Operations, and user-facing documentation complete where applicable;
- repository standards reconciled;
- unresolved gaps explicitly dispositioned;
- required Go/No-Go recorded.

### Production promotion

| Field | Value |
| --- | --- |
| Delivery model | `B-promotion` |
| Profile | `production` |
| Target environment | `production` |
| Gate profile | `component-promotion` |
| Rollback profile | `multi-step` |
| Approval profile | required Engineering and Production authority |

The Production PR must promote the exact approved candidate and introduce no new feature implementation.

## Model C — documentation-only delivery

Model C is the first-class delivery model for creating, revising, moving, superseding, archiving, or otherwise maintaining repository documentation **only** on surfaces formally classified for documentation work.

### Hard invariant

Model C may write **only** to repository paths formally classified as documentation surfaces. Model C work must not create, modify, move, copy, rename, or merge files into application-code, runtime, CI/workflow implementation, test, migration, deployment, configuration, dependency-manifest, script, or other executable repository namespaces.

Enforcement is **path-based**, not extension-based. A `.md`, `.txt`, `.json`, or similar file under a prohibited coding/runtime path is **not** Model C-eligible.

### Eligibility

Model C is eligible when **all** of the following hold:

1. Every changed path is inside an approved Model C documentation namespace (below).
2. No changed path is in a prohibited executable namespace.
3. No rename/move/copy introduces a documentation artifact into a prohibited namespace.
4. DIATAXIS type and destination folder are classified **before** placement (or reclassification is explicit in the source Issue).
5. One open, same-repository, non-PR source Issue authorizes the work (Issue-first).
6. Delivery metadata records `Delivery model: C` (or the stable enum value `C` defined in the delivery-profile contract).

If any eligibility condition fails, the work must use Model A, Model B, or emergency recovery as appropriate—not Model C.

### Approved documentation path namespaces

Unless a later constitutional update expands this list, Model C may touch only:

```text
docs/tutorials/**
docs/how-to/**
docs/reference/**
docs/explanation/**
docs/governance/**
docs/ops/**
docs/archive/**
docs/templates/**
```

Plus the following **exceptional documentation surfaces** when the change is documentation content only (not executable config):

```text
README.md                    (repository root only)
LICENSE*                     (repository root legal text only)
CHANGELOG* / HISTORY*        (repository root release notes only, when present)
```

Root-level or other exceptional surfaces outside this list require Product Authority or an approved constitutional update before Model C may claim them. Prefer placing new documentation under the DIATAXIS tree rather than expanding root exceptions.

### Prohibited namespaces (non-exhaustive)

Model C must fail closed on any path under, including but not limited to:

```text
.app/**, src/**, functions/**, workers/**, pages/**, app/**
.github/workflows/**, .github/actions/**
scripts/** (including scripts/ci/**)
tests/**, test/**, __tests__/**
migrations/**
package.json, package-lock.json, pnpm-lock.yaml, yarn.lock
wrangler*.toml, wrangler.toml, .env*, Dockerfile*, docker-compose*
*.ts, *.tsx, *.js, *.jsx, *.mjs, *.cjs under any non-docs tree
```

File extension alone never authorizes Model C. Path namespace controls eligibility.

### DIATAXIS and canonical ownership

- DIATAXIS folder authority (`docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md`) governs type → folder placement.
- Classification occurs before document creation or relocation.
- Each topic retains one active canonical owner per `REPOSITORY-AUTHORITY.md`. Model C must not create competing policy owners.
- Supersession and archive follow repository supersession rules: complete disposition, correct folder, authority header, non-conflict with higher authority, and merge under authorized Model C (or A/B when the destination is outside Model C surfaces).

### Coding/runtime folder documentation (no Model C exception)

There is **no** Model C exception for documentation that must live inside a coding/runtime folder.

When such a file is required:

1. use Model C to author or revise it on an approved documentation surface, then use Model A or Model B to move/copy it into the code/runtime location; or
2. create and merge it directly through Model A or Model B.

Model C itself must never authorize the destination write into a prohibited namespace.

### Issue, PR, and review requirements

| Field | Value |
| --- | --- |
| Delivery model | `C` |
| Target environment | `production` (merge to `main` documentation surfaces) or `docs` when a docs-only label is recorded |
| Gate profile | `documentation` (implemented by companion Issue #3753) |
| Rollback profile | `one-step` |
| Approval profile | scaled by documentation authority (below) |

Requirements:

- one primary source Issue with explicit Model C intent and path scope;
- one implementation PR whose diff is limited to approved documentation namespaces;
- Issue/PR accounting and required review evidence remain enforced;
- independent review is required before merge when the change touches **Constitutional** or **Domain Policy** governance, alters DIATAXIS authority, or changes supersession of a canonical owner;
- lower-authority documentation (how-to, tutorial, non-policy reference, ops trackers that do not define binding policy) may use lighter review appropriate to documentation risk, but never zero review when repository process requires attestation;
- code-specific build, deploy, migration, and Production smoke gates must not be required **solely** because the PR is Model C.

Review intensity scales with documentation authority level (Constitutional / Domain Policy / Canonical / Controlled / Procedure / Evidence), not with file extension.

### Rollback

Model C rollback is one-step documentation revert:

1. revert the documentation merge commit on `main`; or
2. restore the prior content of the affected documentation paths.

No deployment rollback is implied. If a documentation change was later paired with executable work under Model A/B, that executable work uses its own A/B rollback package.

### CI and post-merge (ownership)

- Pre-merge Model C classification, path allowlist, no-code boundary, DIATAXIS validation, and related gates are **owned by implementation Issue #3753** and must conform to this policy without inventing broader write authority.
- Lightweight post-merge verification for Model C confirms documentation paths landed inside the allowlist, no prohibited path entered, DIATAXIS/metadata remain valid, and closeout evidence is correct. Production deployment/runtime smoke is not required solely for a documentation-only merge unless another repository rule independently requires it.

### Relationship to Models A and B

- Model A and Model B semantics for executable repository changes remain intact and are not relaxed by Model C.
- A release unit must not claim both Model C and Model A/B for the same set of path writes. Split work: documentation surfaces via Model C; executable or coding-folder destinations via A/B.
- Protected-path rules for governance documentation under Model C still require appropriate review; they do not authorize concurrent edits to `.github/workflows/**` or `scripts/ci/**` under Model C.

## Multi-step rollback

Model B rollback is designed before implementation and finalized before Production promotion.

The rollback package defines, as applicable:

- feature disablement or traffic isolation;
- external-write stop controls;
- configuration restoration;
- compatible data restoration or migration reversal;
- previous deployment restoration;
- dependency rollback order;
- verification after rollback;
- Issue, documentation, incident, and Administration & Communications reconciliation.

## Approval summary

| Boundary | Decision authority | Automated integration |
| --- | --- | --- |
| Sandbox experiment | PMO / Engineering | Yes within isolated Sandbox when safety checks pass |
| Development child, non-protected | Deterministic CI eligibility under Delivery policy | Yes to non-main component branch |
| Development child, protected/material | PR Approver / Engineering | No until approval |
| Promotion Candidate Go/No-Go | PMO / Engineering, PR Approver / Engineering, and other required roles | No |
| Production promotion | Production authority plus required Engineering approval | No |
| Model C documentation (non-constitutional) | PR review scaled to documentation authority; Deterministic CI path gates | No auto-merge to `main` without required checks |
| Model C documentation (constitutional / domain policy / DIATAXIS authority) | Independent review plus required Engineering or Product Authority as authority level demands | No |
| Emergency recovery | Day-2 Operations and required protected authority | Only pre-authorized deterministic recovery actions |

Implementation / Operations implements and remediates but does not approve its own protected work or Production promotion.

## Protected changes

Protected or material changes require PR Approver / Engineering review before Development integration or Production promotion, including:

- destructive or non-backward-compatible database migration;
- authentication or authorization boundary;
- secret or credential handling;
- deployment workflow or production binding;
- branch protection or governance enforcement;
- irreversible external-service mutation;
- material architecture or acceptance-criteria change.

Model C changes that edit constitutional or domain-policy governance, DIATAXIS authority, or supersession of a canonical owner are treated as protected documentation changes and require independent review before merge to `main`.

## Canonical references

| Topic | Owner |
| --- | --- |
| Lane and promotion-profile contract | `docs/reference/operations/operating-lanes-and-promotion-profiles.md` |
| Delivery metadata and classification | `docs/reference/ci/delivery-profile-contract.md` |
| Rollback profiles and evidence | `docs/reference/delivery/delivery-and-rollback-profiles.md` |
| Profile operating procedure | `docs/how-to/operations/run-work-through-promotion-profiles.md` |
| PMO sizing and model selection | `docs/governance/PMO-PORTFOLIO.md` |
| Role mapping and approval authority | `docs/governance/AGENT-TEAM.md` |
| Operations, degradation, and recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| DIATAXIS folder authority | `docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md` |
| Model C CI enforcement | Issue #3753 |

## Supersession

This policy supersedes any lower-level instruction that permits Sandbox or Development work to move directly to Production, that treats component integration as Production approval, or that forces pure documentation work through Model A/B code-delivery gates solely because documentation files change.
