---
Doc Type: Explanation
Audience: Bill, Governance, Cursor, repository maintainers
Authority Level: Supporting design; becomes active only through approved promotion to main
Owns: Design rationale, operating boundaries, domain segmentation, and target behavior for the two-model delivery system
Does Not Own: Current PR policy, live CI behavior, GitHub rulesets, production configuration, or active agent authority before promotion
Canonical Reference: docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #2477, #2478, #2479, #4776
Last Reviewed: 2026-10-26
---

# Two-Model Delivery System Design

## Purpose

Define the target repository delivery system approved by Bill and Chat for LGFC work.

The system separates construction and testing from production promotion. It allows small changes to move directly through production controls while allowing larger cohesive solutions to be assembled and verified on non-production component branches before one controlled production release.

This document is the first design artifact for Program #2477. It does not change current repository authority, CI, agent behavior, branch protection, or production deployment by itself.

## Problem statement

The current workflow applies similar controls to nearly every issue and PR regardless of release impact. That has produced excessive stop points, premature handoffs, repeated review rounds, predictable post-merge exceptions, and multiple issue/PR pairs for deliverables that should complete as one release unit.

The design must solve four problems together:

1. Match controls to the actual production boundary.
2. Let Cursor complete implementation and testing without repeated human authorization inside an approved plan.
3. Preserve independent Chat or Bill approval before production changes.
4. Reduce future repository-wide process rewrites by separating domain policy from shared contracts and implementation details.

## Approved operating principles

1. Bill and Chat define the deliverable and approve the final design.
2. Bill and Chat make the implementation Go / No-Go decision.
3. Chat converts the approved design into the implementation plan and launches execution.
4. Cursor implements, tests, collects evidence, and remediates.
5. Chat is the primary PR reviewer and approver. Bill remains an authorized alternate approver.
6. Chat verifies the integrated and production implementation against the approved design.
7. Chat declares success and notifies Bill for final completed-product review.
8. Bill returns to the implementation loop only for material product, design, cost, credential, or business decisions.
9. Cursor does not approve its own work.
10. Production controls apply at the production boundary. Construction controls apply inside the test environment.
11. A production merge should represent a complete usable capability unless an intentionally independent incremental release has been approved.
12. Documentation completion is part of implementation completion.

## Work classification

Every one-off, project, and program enters PMO as `Medium — provisional`.

The sizing decision tree then classifies it as Small, Medium, or Large.

### Small

Small work is a complete release unit that can be implemented, reviewed, tested, promoted, and reversed in one production PR.

Typical characteristics:

- one bounded outcome;
- one source issue and one implementation PR;
- no unresolved architecture decision;
- no multi-step production activation;
- simple rollback by PR revert or previous deployment restoration;
- full behavior testable in the PR preview.

Small work normally uses Model A.

### Medium

Medium work is one cohesive feature or operational component that may require multiple implementation concerns or PRs but can still be promoted as one release unit.

Medium work uses the Model A / Model B decision tree.

Choose Model A only when the full solution remains reviewable, testable, and reversible in one production PR. Choose Model B when multiple PRs are required, intermediate production states would be incomplete, or integrated testing is required before release.

### Large

Large work spans multiple components, architectural domains, migrations, external systems, or production promotions.

Large work defaults to Model B and may contain multiple component branches and promotion PRs.

### Risk override

Work is at least Medium when it affects authentication, authorization, destructive data changes, deployment workflows, production secrets or bindings, irreversible external writes, branch protection, or governance enforcement.

Multiple protected boundaries may make the work Large.

## Model A — direct production delivery

Model A is the direct path for small, deliberate, complete changes.

### Flow

1. Bill and Chat approve the design and implementation.
2. Chat creates the complete implementation package.
3. Cursor implements and tests the complete change.
4. The PR targets `main`.
5. Full production-candidate gates run.
6. Chat or Bill approves the PR; Chat is primary.
7. The PR merges to `main` and activates production.
8. Chat verifies production behavior.
9. Cursor remediates through the same issue when the defect is in scope, or through a new bounded issue when it is genuinely separate.
10. Chat declares success and completes documentation closeout.

### Model A rollback

Rollback should normally be one controlled action:

- revert the production PR; or
- restore the previous Cloudflare deployment.

Targeted smoke tests confirm recovery.

## Model B — component construction and promotion

Model B builds a cohesive solution on a non-production component branch.

### Branch structure

- Component branch: `component/<release-unit>`
- Child branch: one bounded implementation issue
- Child PR base: the component branch
- Promotion PR head: the component branch
- Promotion PR base: `main`

### Child integration flow

1. Chat prepares the complete component plan, child sequence, integration constraints, test plan, and rollback design.
2. Cursor implements one child issue at a time.
3. Child PRs target the component branch.
4. Child PRs run the component technical profile.
5. Eligible child PRs auto-integrate when all required technical checks pass.
6. Protected-change child PRs require Chat review before component integration.
7. Integrated component tests rerun after each child merge.
8. A failed integration state pauses subsequent auto-integration until Cursor restores a green component state.
9. Child issues close when their increment is integrated and verified; they do not claim production success.

### Promotion flow

1. All intended child increments are integrated.
2. Cursor completes integrated testing and evidence collection.
3. Chat verifies the complete release candidate against the approved design.
4. As-designed, as-built, Operations, troubleshooting, activation, and rollback documentation are complete.
5. The promotion PR targets `main` and introduces no new feature implementation.
6. Full production gates run.
7. Chat or Bill approves; Chat is primary.
8. The promotion PR merges and activates production.
9. Chat verifies production behavior and either declares success or returns bounded corrections to Cursor.

### Model B rollback

Rollback is designed before implementation begins and finalized before production promotion.

The rollback package must define:

- feature disablement or traffic isolation;
- external-write stop controls;
- configuration restoration;
- compatible data restoration or migration reversal;
- previous deployment restoration;
- dependency rollback order;
- verification after rollback;
- issue, documentation, and incident reconciliation.

Model B should prefer backward-compatible migrations and delayed destructive cleanup so the previous application can continue operating if rollback is required.

## Emergency recovery

Emergency recovery is not Model A or Model B.

It applies when production is unavailable, unsafe, data is at risk, or performance and functionality are materially degraded enough to require immediate stabilization.

The response order is:

1. confirm impact;
2. pause conflicting promotions;
3. roll back to last known good when possible;
4. use the smallest safe recovery PR when rollback is insufficient;
5. require Chat or Bill approval;
6. run targeted recovery verification;
7. restore service;
8. create normal follow-up work for root cause, hardening, and deferred documentation migration.

A slower but usable system with a known bounded cause may use expedited Model A. Structural performance degradation requiring redesign should use planned Model B.

## Agent and approval authority

### Bill

- Product and design authority.
- Implementation Go / No-Go authority with Chat.
- Authorized alternate PR reviewer and approver.
- Escalation authority for material decisions.
- Final completed-product reviewer.

### Chat

- Finalizes the design.
- Builds and launches the implementation plan.
- Is the primary PR reviewer and approver.
- Merges approved PRs.
- Verifies integrated and production behavior.
- Coordinates remediation with Cursor.
- Declares success or identifies design failure.
- Coordinates final documentation placement and closeout.

### Cursor

- Implements approved plans.
- Tests and collects evidence.
- Performs implementation self-review.
- Resolves technical and reviewer findings.
- Supports as-built and Operations documentation.
- Does not approve its own work.

## Gate profiles

### Model A production candidate

Required outcomes include:

- deterministic quality and secret checks;
- complete implementation acceptance criteria;
- preview deployment and end-to-end verification;
- design compliance;
- production compatibility;
- activation and rollback readiness;
- documentation readiness;
- Chat or Bill approval.

### Model B child integration

Required outcomes include:

- valid component master and child issue;
- bounded changed-file scope;
- build, typecheck, lint, and relevant tests;
- no critical security defect;
- child acceptance criteria satisfied;
- component branch remains integrable;
- no protected-change or hold classification.

A Model B child does not require whole-feature production approval, production closeout prediction, or final Operations documentation.

### Model B promotion

The promotion profile includes the complete production-candidate requirements plus:

- all intended child PRs integrated;
- integrated release-candidate testing;
- component branch synchronized with current `main`;
- final rollback package;
- complete documentation closeout;
- Chat or Bill approval.

### Protected-change profile

The following child changes require Chat review before component integration:

- destructive or non-backward-compatible database migration;
- authentication or authorization boundary;
- secret or credential handling;
- deployment workflow or production binding;
- branch protection or governance enforcement;
- irreversible external-service mutation.

## Environment isolation

Model B depends on a real non-production environment, not only a non-production URL.

The implementation must verify and document:

- Cloudflare preview deployment behavior;
- preview D1 bindings and test-data isolation;
- B2 and other storage behavior;
- email suppression or test routing;
- analytics separation;
- external API mutation controls;
- administrative credentials and token boundaries;
- test-data cleanup and reset procedures.

Auto-integration must remain disabled for changes that can silently mutate production until the isolation boundary is proven.

## DIATAXIS migration ratchet

A normal PR that modifies a legacy document must completely disposition that document before the PR may complete.

Valid dispositions are:

- migrate to the correct active location;
- consolidate into an existing canonical document;
- archive as historical;
- mark superseded and remove active routing;
- delete when no retained value exists.

Adding a header without correcting placement, authority, duplication, and references does not complete migration.

Migration must update dependent workflows, scripts, templates, prompts, indexes, and cross-references.

Emergency recovery may defer migration through mandatory follow-up work when immediate stabilization takes precedence.

## Domain-owned authority hierarchy

The target structure has five layers.

### Layer 0 — repository constitution

Owns precedence, source-of-truth rules, domain ownership, canonical-document rules, and escalation.

It does not contain detailed PMO, PR, agent, CI, or Operations procedures.

### Layer 1 — domain policy

Each domain has one canonical policy boundary:

| Domain | Ownership |
| --- | --- |
| Product and Design | Product behavior, UX, data and functional requirements |
| PMO and Portfolio | Work inventory, size, priority, launch authorization, and release-unit selection |
| Delivery and Release | Model A, Model B, promotion, approval, and rollback policy |
| Agent Team | Chat, Cursor, and Bill implementation roles and authority |
| CI and Verification | Gate profiles, evidence requirements, and promotion criteria |
| Operations and Recovery | Upkeep, degradation, incidents, emergency recovery, and post-incident hardening |
| Documentation and Knowledge | DIATAXIS routing, authority migration, archive, and deduplication |
| Platform and Environment | Cloudflare, D1, B2, preview, production, and external-service boundaries |

A domain policy links to shared contracts instead of restating another domain's rules.

### Layer 2 — shared contracts and profiles

Stable reference definitions represent:

- Size;
- Delivery Model;
- Change Mode;
- Target Environment;
- Approval Profile;
- Gate Profile;
- Rollback Profile;
- Component Master;
- Component Branch;
- Promotion PR.

PMO selects the profile. Agents execute it. CI enforces it. Operations consumes it.

### Layer 3 — procedures

How-to documents explain one execution path, such as sizing work, selecting a model, creating a component branch, integrating a child PR, promoting a release, executing rollback, recovering production, or migrating a legacy document.

### Layer 4 — implementation and as-built state

Workflow YAML, scripts, templates, GitHub rulesets, Cloudflare configuration, branch patterns, live gate names, and as-built documents implement and record the policy.

## Stable project and PR metadata

The delivery system must support these stable facts:

| Field | Purpose |
| --- | --- |
| Size | Small, Medium, or Large after provisional intake classification |
| Delivery Model | A, B-child, B-promotion, or emergency-recovery |
| Change Mode | Project, routine Operations, planned migration, or emergency |
| Target Environment | Component, preview, production, or recovery |
| Approval Profile | Component auto-integration, Chat/Bill production approval, or protected-change review |
| Gate Profile | Technical integration, production candidate, promotion, or recovery |
| Rollback Profile | One-step, multi-step, or emergency stabilization |
| Component Master | Authoritative release-unit issue |
| Component Branch | Integration branch for Model B |
| Promotion PR | Final production promotion record |

These are stable facts. Dynamic review, check, and lifecycle state remain in GitHub-native state rather than the PR body.

## Bootstrap implementation

Program #2477 is implemented on `component/delivery-system-v1` before the final Model B automation exists.

During bootstrap:

- child PRs use current deterministic technical checks;
- Chat manually makes component-integration decisions;
- no child PR claims production readiness;
- later child PRs exercise the new branch-aware profiles and auto-integration behavior;
- the final promotion PR proves the complete system before it changes active repository authority.

Parallel Newspaper and Content Collection Phase 1 component branches may build under provisional manual Model B rules. Before either promotes, the Delivery System v1 promotion must reach `main`, the project branch must synchronize with the updated `main`, and the final production profile must pass.

## Testing strategy

The implementation plan must include tests for:

- sizing and Model A / Model B selection;
- branch and metadata classification;
- Model B child eligibility;
- protected-change blocking;
- failed technical checks;
- serial integration ordering;
- component branch red-state pause;
- promotion completeness;
- production approval requirements;
- emergency recovery bypass boundaries;
- DIATAXIS touched-document migration;
- rollback profile completeness;
- preview resource isolation.

The system is successful only when test fixtures demonstrate both permitted and prohibited paths without relying on agent prose.

## Success criteria

The design is implemented successfully when:

- PMO classifies all work through one sizing and model-selection contract;
- Model A moves small complete changes directly through production controls;
- Model B constructs multi-step solutions without exposing incomplete production states;
- eligible Model B children auto-integrate through technical gates;
- protected changes receive independent Chat review;
- production promotion requires Chat or Bill approval;
- emergency recovery remains fast and stabilization-first;
- preview resources are proven safe;
- rollback is defined and testable before promotion;
- touched legacy authority is migrated or dispositioned;
- domain policies no longer duplicate shared process definitions;
- future process changes can be made by updating the owning domain, shared contract, implementation, and as-built record rather than rewriting the repository broadly.

## Non-goals

This initial design does not:

- change current production behavior;
- enable auto-merge;
- alter branch protection;
- modify current agent authority;
- create or migrate every final authority document;
- promote Newspaper or Content Collection Phase 1;
- replace emergency recovery with a normal project workflow.

Those actions require ordered child implementation under #2477.

## Implementation boundaries to resolve in the plan

The implementation plan must select the exact repository assets for:

- the canonical Delivery and Release policy;
- the shared contract representation and validation schema;
- component-branch classification;
- auto-integration workflow and permissions;
- GitHub ruleset configuration;
- environment-isolation verification;
- touched-document migration enforcement;
- final as-built documentation.

Those selections must preserve one canonical authority per topic and must migrate or archive any conflicting legacy source that is modified.