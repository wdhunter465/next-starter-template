---
Doc Type: Implementation Plan
Status: production-ready
Project: Two-Model Delivery System v1
Owner: ChatGPT
Execution Mode: Model B component integration
Audience: ChatGPT, Cursor, Bill, repository maintainers
Authority Level: Operational execution package for Program #2477
Owns: Ordered implementation tasks, file boundaries, interfaces, tests, validation, rollback, and promotion sequence
Does Not Own: Current production authority before promotion; product design outside #2477
Canonical Reference: /docs/explanation/projects/two-model-delivery-system-design.md
Related Issues: #2477, #2478, #2483
Component Branch: component/delivery-system-v1
Last Reviewed: 2026-07-13
---

# Two-Model Delivery System v1 Implementation Plan

> **For agentic workers:** Execute this plan task-by-task through bounded GitHub child issues and child PRs into `component/delivery-system-v1`. Cursor implements code and documentation changes; Chat reviews component exceptions, production promotion, and design compliance. Child PRs use bootstrap manual integration until the auto-integration task is proven.

**Goal:** Implement a repository-wide delivery system that routes small complete changes through Model A, constructs multi-step solutions through Model B component branches, preserves a separate emergency-recovery path, and enforces the system through shared contracts, CI, Operations, PMO, agent authority, templates, and DIATAXIS migration.

**Architecture:** A single delivery-profile contract defines stable metadata and classification. PMO selects a profile, agents execute it, CI validates it, Operations consumes it, and GitHub configuration enforces the production boundary. Domain policies link to the shared contract instead of duplicating model definitions. Model B children integrate into a component branch; only a final promotion PR targets `main`.

**Tech Stack:** Node.js 22, ESM JavaScript, Vitest 3, GitHub Actions, GitHub Issues/PRs, Cloudflare Pages previews, Next.js 15, TypeScript 5, repository DIATAXIS/governance documentation.

## Global Constraints

- Every one-off, project, and program enters PMO as `Medium — provisional` until classified Small, Medium, or Large.
- Model A targets `main` and requires Chat or Bill approval; Chat is primary.
- Model B child PRs target `component/<release-unit>` and may auto-integrate only after technical eligibility is proven.
- Model B promotion PRs target `main` and require Chat or Bill approval; Chat is primary.
- Cursor implements and remediates but does not approve its own work.
- Emergency recovery is separate from Model A and Model B.
- Model B rollback is designed before implementation and finalized before promotion.
- A normal PR touching a legacy document must migrate, consolidate, archive, supersede, or delete it; adding a header alone is insufficient.
- Dynamic lifecycle state remains in GitHub-native checks, reviews, threads, labels, and issue state; PR bodies store stable facts only.
- Required checks must remain deterministic and low-noise.
- Current `main` behavior remains unchanged until the final promotion PR merges.
- Protected changes never auto-integrate.
- Component/preview execution must not silently mutate production resources.

## Delivery sequence

| Order | Child project | Predecessor | Successor | Stage before production | Halt condition | Resume condition |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Shared delivery-profile contract | #2483 plan merged | PMO and template consumers | yes | Contract tests fail or metadata remains ambiguous | Contract and tests pass |
| 2 | Repository authority hierarchy | Shared contract | Domain-policy migrations | yes | Canonical ownership conflict unresolved | One owner per domain documented |
| 3 | PMO sizing and model selection | Shared contract + hierarchy | Agent and delivery policy | yes | Decision tree can produce conflicting result | Deterministic classification tests/docs pass |
| 4 | Agent and approval authority | Hierarchy + PMO contract | CI enforcement | yes | Chat/Bill/Cursor authority conflicts remain | Canonical authority and procedures agree |
| 5 | Delivery, rollback, and recovery policy | Hierarchy + PMO contract | CI profiles | yes | Model A/B/emergency boundaries overlap | Domain policy and how-to procedures agree |
| 6 | Environment-isolation audit | Delivery policy | Auto-integration | yes | Preview can mutate production without control | Isolation proven or protected changes blocked |
| 7 | Branch-aware CI and preflight | Contract + policies | Auto-integration | yes | Profile routing differs locally vs CI | Shared fixtures pass in both paths |
| 8 | Model B auto-integration | CI profiles + isolation | Pilot | yes | Protected/failed/red component can merge | Negative fixtures block and positive fixture merges |
| 9 | DIATAXIS migration ratchet | Hierarchy + contract | Pilot | yes | False positives block normal work or legacy survives touched PR | Fixture suite passes |
| 10 | Templates and GitHub configuration | Contract + CI | Pilot | yes | Stable metadata cannot be represented or rulesets conflict | Template and configuration audit passes |
| 11 | Integrated pilot and rollback exercise | Tasks 1-10 | Documentation closeout | yes | Any profile violates approved design | Corrected component branch passes full suite |
| 12 | As-built documentation and promotion | Pilot | Production verification | no | Documentation, rollback, or promotion evidence incomplete | Chat verifies and approves promotion |

---

## Task 1 — Shared delivery-profile contract

Type: ci + reference
Agent: Cursor
Priority: 1
Depends On: #2483 merged

**Files**

- Create: `scripts/ci/delivery_profile.mjs`
- Create: `tests/delivery-profile.test.mjs`
- Create: `docs/reference/ci/delivery-profile-contract.md`
- Modify: `.github/pull_request_template.md`
- Modify: `package.json`

**Interfaces**

- Produces `DELIVERY_MODELS = ['A', 'B-child', 'B-promotion', 'emergency-recovery']`.
- Produces `WORK_SIZES = ['small', 'medium', 'large']` plus provisional value `medium-provisional` for PMO intake.
- Produces `CHANGE_MODES = ['project', 'routine-ops', 'planned-migration', 'emergency']`.
- Produces `TARGET_ENVIRONMENTS = ['component', 'preview', 'production', 'recovery']`.
- Produces `APPROVAL_PROFILES = ['component-auto-integration', 'chat-bill-production', 'protected-change-review', 'emergency-approval']`.
- Produces `GATE_PROFILES = ['component-child', 'production-candidate', 'component-promotion', 'emergency-recovery']`.
- Produces `ROLLBACK_PROFILES = ['one-step', 'multi-step', 'emergency-stabilization']`.
- Produces `parseDeliveryMetadata(body)` returning stable PR-body values without lifecycle state.
- Produces `classifyDeliveryProfile({ baseRef, body, changedFiles })` returning `{ deliveryModel, targetEnvironment, approvalProfile, gateProfile, rollbackProfile, componentBranch, protectedChange, errors }`.
- Produces CLI output and JSON artifact through `DELIVERY_PROFILE_RESULT_JSON`.
- Adds `npm run delivery-profile:check`.

- [ ] **Step 1: Write failing metadata parsing tests**

Add fixtures for Model A, Model B child, Model B promotion, emergency recovery, missing metadata, invalid model, and component branch mismatch. Assertions must verify exact normalized values and errors.

- [ ] **Step 2: Run focused test and confirm failure**

Run: `npx vitest run --config tests/vitest.node.config.ts tests/delivery-profile.test.mjs`
Expected: FAIL because `scripts/ci/delivery_profile.mjs` does not exist.

- [ ] **Step 3: Implement exported constants and parsers**

Implement line-oriented parsing matching the PR summary labels:

```text
Size:
Delivery model:
Change mode:
Target environment:
Approval profile:
Gate profile:
Rollback profile:
Component branch:
Component master:
```

HTML comments and placeholders must normalize to missing values. Dynamic status fields must not be parsed or required.

- [ ] **Step 4: Implement branch-aware classification**

Required invariants:

```text
A               -> base main, target production, chat-bill-production, production-candidate, one-step
B-child         -> base component/*, target component, component-auto-integration unless protected, component-child, multi-step
B-promotion     -> head component/* and base main, target production, chat-bill-production, component-promotion, multi-step
emergency       -> base main, target recovery, emergency-approval, emergency-recovery, emergency-stabilization
```

A mismatch must return an error and must not silently downgrade.

- [ ] **Step 5: Implement protected-change classification**

Initial protected patterns:

```text
.github/workflows/**
.github/CODEOWNERS
wrangler*.toml
migrations/**
functions/api/auth/**
functions/api/admin/**
scripts/ci/**
docs/governance/**
```

The first implementation is intentionally conservative. Later tasks may refine patterns using evidence, but may not remove authentication, secrets, production binding, deployment, destructive migration, or governance enforcement protection without Chat review.

- [ ] **Step 6: Add CLI and JSON artifact output**

CLI accepts environment values `PR_BODY_FILE`, `PR_BASE_REF`, `PR_HEAD_REF`, and `CHANGED_FILES_FILE`. It exits nonzero on invalid or missing mandatory stable metadata for the selected path.

- [ ] **Step 7: Update PR template and package script**

Add the stable fields beneath PR class. Do not add lifecycle state. Add:

```json
"delivery-profile:check": "node scripts/ci/delivery_profile.mjs"
```

- [ ] **Step 8: Run tests and repository checks**

Run:

```text
npx vitest run --config tests/vitest.node.config.ts tests/delivery-profile.test.mjs
npm run typecheck
npm run lint
```

Expected: PASS.

**Rollback:** Revert the child PR. No workflow or production behavior consumes the contract yet.

---

## Task 2 — Repository constitution and domain ownership

Type: governance + documentation migration
Agent: Cursor with Chat disposition review
Priority: 1
Depends On: Task 1

**Files**

- Create or consolidate canonical constitution: `docs/governance/REPOSITORY-AUTHORITY.md`
- Modify or supersede: `docs/governance/standards/document-authority-hierarchy_MASTER.md`
- Modify: `docs/governance/DOCUMENT-ARCHITECTURE.md`
- Modify: `docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md`
- Modify: `docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md`
- Modify: `docs/reference/diataxis/authority-inventory-and-routing-map.md`
- Create: `docs/reference/diataxis/two-model-authority-disposition-map.md`
- Move superseded material to `docs/archive/**` where retained.

**Interfaces**

- Defines layers 0-4: constitution, domain policy, shared contract, procedure, implementation/as-built.
- Defines one canonical owner for Product/Design, PMO/Portfolio, Delivery/Release, Agent Team, CI/Verification, Operations/Recovery, Documentation/Knowledge, Platform/Environment.
- Resolves the conflict where `docs/ops/ai/` currently owns binding agent rules while DIATAXIS policy says `docs/ops/` must not own authority.

- [ ] **Step 1: Produce a complete authority disposition table**

For every touched canonical file record current owner, target owner, retain/migrate/consolidate/archive/delete action, replacement path, and reference-update scope.

- [ ] **Step 2: Write the constitutional authority document**

Keep it small: precedence, GitHub issue authority, one canonical source per topic, domain ownership, supersession requirements, escalation only for unresolved conflicts.

- [ ] **Step 3: Reconcile current architecture and DIATAXIS rules**

Binding agent policy must route to governance; agent facts/contracts to reference; procedures to how-to; runtime queue/state to ops.

- [ ] **Step 4: Update all direct references in touched documents**

No touched legacy canonical path may remain simultaneously active.

- [ ] **Step 5: Validate headers, routes, and duplicates**

Run the repository header and DIATAXIS checks plus targeted grep/reference verification. Expected: one active authority per touched topic.

**Rollback:** Revert the child PR. Because this targets the component branch, current `main` authority remains unchanged.

---

## Task 3 — PMO sizing and Model A/Model B decision contract

Type: PMO + governance + how-to
Agent: Cursor
Priority: 1
Depends On: Tasks 1-2

**Files**

- Create canonical policy or migrate existing PMO authority to: `docs/governance/PMO-PORTFOLIO.md`
- Create: `docs/reference/pmo/work-size-and-delivery-model-contract.md`
- Create: `docs/how-to/pmo/classify-work-and-select-delivery-model.md`
- Modify/migrate: `docs/ops/pmo/PMO-V4-OPERATING-MODEL.md`
- Modify: `docs/ops/implementation-plans/README.md`
- Modify PMO issue templates under `.github/ISSUE_TEMPLATE/**` after exact inventory.

**Interfaces**

- Intake defaults to `medium-provisional`.
- Decision function maps evidence to Small, Medium, or Large.
- Medium selection maps to Model A or Model B.
- Emergency conditions exit the normal tree and route to emergency recovery.

- [ ] **Step 1: Define objective sizing criteria**

Small requires one complete reviewable PR, one-step rollback, preview-testable behavior, no unresolved architecture, and no protected multi-step boundary. Large includes multiple deployable components, multiple promotions, or several protected boundaries. Everything else is Medium.

- [ ] **Step 2: Define deterministic Medium decision tree**

Model A only when the complete solution fits one reviewable PR, is fully preview-testable, has no harmful intermediate state, and has one-step rollback. Any failed condition selects Model B.

- [ ] **Step 3: Add issue metadata and examples**

Examples must cover a typo fix, dependency patch, newspaper feature, Content Collection Phase 1, CI redesign, auth migration, performance degradation, and outage.

- [ ] **Step 4: Migrate PMO authority touched by the PR**

The old operational authority must be archived, superseded, or converted to non-authoritative execution state. It may not remain a second active PMO policy.

- [ ] **Step 5: Validate decision examples**

Use a table-driven review fixture in the reference document and, if the PMO metadata parser is executable, add Node/Vitest fixtures in the same child PR.

**Rollback:** Revert policy/reference/procedure migration as one component-branch child.

---

## Task 4 — Agent and approval authority migration

Type: governance + agent rules
Agent: Cursor with Chat review
Priority: 1
Depends On: Tasks 1-3

**Files**

- Create canonical policy or consolidate into: `docs/governance/AGENT-TEAM.md`
- Create: `docs/reference/agents/implementation-authority-contract.md`
- Create/update: `docs/how-to/agents/run-model-a.md`
- Create/update: `docs/how-to/agents/run-model-b.md`
- Migrate or archive binding content from:
  - `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md`
  - `docs/ops/ai/SHARED-AGENT-RULES.md`
  - `docs/ops/ai/CHATGPT-RULES.md`
  - `docs/ops/ai/CURSOR-RULES.md`
- Modify `Agent.md` only as a router to canonical authority.

**Interfaces**

- Bill: design/go-no-go, alternate PR approver, material-decision escalation, final product review.
- Chat: final design, implementation planning/launch, primary PR review/approval, merge, verification, success declaration, documentation closeout.
- Cursor: implementation, test evidence, remediation, documentation support, no self-approval.
- Within an authorized Model B component plan Cursor proceeds through routine implementation and correction until a real stop condition.

- [ ] **Step 1: Migrate binding role rules to governance**
- [ ] **Step 2: Separate facts/contracts from procedures**
- [ ] **Step 3: Remove routine Bill stop points between go decision and final product notification**
- [ ] **Step 4: Preserve protected stop conditions**

Protected stops are material design decisions, authority conflicts, unsafe preview isolation, credentials/cost/business authorization, or structural design failure.

- [ ] **Step 5: Run Agent Governance checks and reference audit**

**Rollback:** Revert the authority child PR; active `main` agent rules remain unchanged until promotion.

---

## Task 5 — Delivery, rollback, Operations, and emergency-recovery policy

Type: governance + operations + how-to
Agent: Cursor with Chat review
Priority: 1
Depends On: Tasks 1-4

**Files**

- Create: `docs/governance/DELIVERY-AND-RELEASE.md`
- Create: `docs/governance/OPERATIONS-AND-RECOVERY.md`
- Create: `docs/reference/delivery/delivery-and-rollback-profiles.md`
- Create: `docs/how-to/delivery/run-model-a-release.md`
- Create: `docs/how-to/delivery/run-model-b-component-release.md`
- Create: `docs/how-to/ops/run-emergency-recovery.md`
- Modify/migrate: `docs/ops/OPERATING_MANUAL.md`
- Modify/migrate canonical change-control material identified by Task 2.

**Interfaces**

- Model A uses production candidate profile and one-step rollback.
- Model B uses child integration profile, promotion profile, and multi-step rollback designed before implementation.
- Emergency recovery uses stabilization-first profile and may defer DIATAXIS migration through mandatory follow-up.
- Degraded service routes by impact: break-glass, expedited Model A, or planned Model B.

- [ ] **Step 1: Write release and approval policy**
- [ ] **Step 2: Write rollback profile requirements and evidence schema**
- [ ] **Step 3: Write degraded-service decision table**
- [ ] **Step 4: Write component-branch synchronization and recovery rules**
- [ ] **Step 5: Migrate touched legacy Ops authority and validate references**

**Rollback:** Revert the policy/procedure child PR.

---

## Task 6 — Preview and component-environment isolation audit

Type: platform + security + operations
Agent: Cursor
Priority: 1
Depends On: Task 5

**Files**

- Create: `docs/reference/platform/component-environment-isolation.md`
- Create: `docs/ops/reports/delivery-system-preview-isolation-audit.md`
- Modify only after evidence: Cloudflare/Wrangler configuration, deployment workflows, and environment docs identified by the audit.
- Add targeted tests/scripts under `scripts/ci/**` and `tests/**` only when the audit identifies an enforceable repository check.

**Interfaces**

Audit Cloudflare Pages preview behavior, D1 bindings, B2/storage, email, analytics, external APIs, admin tokens, feature activation, cleanup, and production write paths.

- [ ] **Step 1: Inventory every preview-accessible mutating resource**
- [ ] **Step 2: Classify isolated, read-only, test-namespaced, disabled, or production-shared**
- [ ] **Step 3: Define automatic blocking rules for production-shared mutation paths**
- [ ] **Step 4: Implement only evidence-backed isolation corrections**
- [ ] **Step 5: Prove a component preview cannot silently mutate production or mark affected PRs protected**

**Rollback:** Revert isolation changes in reverse dependency order; retain audit evidence if still factual.

---

## Task 7 — Branch-aware CI profiles and unified preflight

Type: CI
Agent: Cursor
Priority: 1
Depends On: Tasks 1, 5, and 6

**Files**

- Modify: `scripts/ci/pr_class_quality_plan.mjs`
- Modify: `.github/workflows/gate-quality.yml`
- Create: `scripts/ci/pr_preflight.mjs`
- Create: `tests/pr-preflight.test.mjs`
- Modify: `tests/pr-class-quality-plan.test.mjs`
- Modify: `package.json`
- Modify existing readiness/closeout scripts only through shared pure functions; do not duplicate logic.
- Create/update reference/as-built docs under `docs/reference/ci/**`.

**Interfaces**

- PR class continues to control verification depth.
- Delivery profile controls release boundary, approval, promotion, rollback, and component behavior.
- `npm run pr:preflight` consumes local source plus GitHub-native JSON snapshots for metadata, changed files, reviews, threads, and source issue when available.
- Local and CI routing use the same `classifyDeliveryProfile()` function.

- [ ] **Step 1: Write failing profile-routing tests**

Cover A/code, A/docs, B-child/code, B-child/docs, B-promotion/release, emergency/ops, invalid branch/profile, and protected child.

- [ ] **Step 2: Extend quality planning without replacing PR class**

Quality depth is the stricter of PR class needs and delivery-profile minimums. Promotion and Model A code paths require full production build; docs-only children remain light unless protected.

- [ ] **Step 3: Implement `pr_preflight.mjs`**

The preflight result must include:

```text
delivery profile
PR class quality plan
scope result
required local commands
GitHub evidence availability
review/thread result
source issue accounting
closeout prediction for A/promotion
protected-change status
final pass/fail/block result
```

- [ ] **Step 4: Add package script**

```json
"pr:preflight": "node scripts/ci/pr_preflight.mjs"
```

- [ ] **Step 5: Reuse readiness logic**

Extract pure evaluators from the existing post-merge readiness/closeout scripts where needed so pre-merge prediction and post-merge validation cannot disagree on the same evidence.

- [ ] **Step 6: Update workflow artifact output**

Quality and preflight artifacts must include delivery profile, not lifecycle prose.

- [ ] **Step 7: Run focused and full tests**

```text
npx vitest run --config tests/vitest.node.config.ts tests/delivery-profile.test.mjs tests/pr-class-quality-plan.test.mjs tests/pr-preflight.test.mjs
npm test
npm run typecheck
npm run lint
```

**Rollback:** Revert the CI child PR; existing quality routing remains available.

---

## Task 8 — Model B component auto-integration

Type: CI + GitHub automation
Agent: Cursor
Priority: 1
Depends On: Tasks 6-7

**Files**

- Create: `scripts/ci/component_integration_eligibility.mjs`
- Create: `tests/component-integration-eligibility.test.mjs`
- Create: `.github/workflows/component-child-integration.yml`
- Create: `docs/reference/ci/component-auto-integration-as-built.md`
- Create: `docs/how-to/delivery/manage-component-integration.md`
- Modify GitHub configuration only through a recorded operator step when API automation cannot safely change repository settings.

**Interfaces**

`evaluateComponentIntegration({ profile, checks, reviews, componentState, labels, changedFiles })` returns `eligible`, `blockedReasons`, and `requiresChatReview`.

- [ ] **Step 1: Write negative-first tests**

Block failed check, pending check, non-component base, protected change, hold, component red state, branch mismatch, missing component master, and stale base.

- [ ] **Step 2: Write positive fixture**

A clean B-child PR with green technical checks and no protected changes is eligible.

- [ ] **Step 3: Implement eligibility evaluator**
- [ ] **Step 4: Implement workflow using GitHub-native check/review state**
- [ ] **Step 5: Enable auto-merge only after eligibility success**
- [ ] **Step 6: Record component red/green integration state through checks or branch status, not PR body**
- [ ] **Step 7: Pilot on a later #2477 child PR before treating the workflow as proven**

**Rollback:** Disable/remove workflow and auto-merge configuration; component branch and PR evidence remain intact.

---

## Task 9 — DIATAXIS touched-document migration ratchet

Type: CI + documentation governance
Agent: Cursor
Priority: 1
Depends On: Tasks 1-2

**Files**

- Create: `scripts/ci/diataxis_migration_ratchet.mjs`
- Create: `tests/diataxis-migration-ratchet.test.mjs`
- Create or modify: `.github/workflows/diataxis-folder-authority.yml`
- Modify: canonical DIATAXIS governance/reference/how-to documents from Task 2.

**Interfaces**

The ratchet compares changed files against the authority inventory and disposition map. A touched legacy document passes only when the PR also records a valid disposition and updates active references. Emergency recovery may emit a mandatory follow-up record rather than block stabilization.

- [ ] **Step 1: Write fixtures for migrate, consolidate, archive, supersede, delete, untouched legacy, header-only failure, stale-reference failure, and emergency deferral**
- [ ] **Step 2: Implement deterministic disposition evaluation**
- [ ] **Step 3: Integrate with existing DIATAXIS workflow in advisory mode**
- [ ] **Step 4: Prove low-noise behavior on this component program**
- [ ] **Step 5: Promote to blocking only after clean pilot evidence**

**Rollback:** Return the ratchet to advisory or revert it; do not restore duplicate authority documents.

---

## Task 10 — Templates, issue metadata, and repository configuration

Type: config + documentation
Agent: Cursor with Chat review
Priority: 1
Depends On: Tasks 1, 3, 7, and 8

**Files**

- Modify: `.github/pull_request_template.md`
- Modify/create relevant `.github/ISSUE_TEMPLATE/**`
- Create: `docs/reference/github/delivery-system-repository-configuration.md`
- Update labels/rulesets/auto-merge settings through explicit GitHub configuration evidence.

**Interfaces**

Stable fields: Size, Delivery model, Change mode, Target environment, Approval profile, Gate profile, Rollback profile, Component master, Component branch, Promotion PR.

- [ ] **Step 1: Update templates with stable facts only**
- [ ] **Step 2: Add PMO provisional Medium intake and classification evidence**
- [ ] **Step 3: Define component branch/ruleset requirements**
- [ ] **Step 4: Preserve `main` production approval and deterministic required checks**
- [ ] **Step 5: Verify emergency path cannot auto-approve production**
- [ ] **Step 6: Capture as-built configuration evidence**

**Rollback:** Restore previous templates and settings using recorded configuration snapshot.

---

## Task 11 — Integrated pilot and rollback exercise

Type: verification
Agent: Cursor executes; Chat verifies
Priority: 1
Depends On: Tasks 1-10

**Files**

- Create: `tests/fixtures/delivery-system/**`
- Create: `scripts/ci/delivery_system_acceptance.mjs`
- Create: `docs/ops/reports/delivery-system-v1-pilot-evidence.md`
- Modify defects only in their owning task files.

**Required scenarios**

1. Small Model A documentation change.
2. Small Model A code change.
3. Eligible Model B child auto-integrates.
4. Failed Model B child does not integrate.
5. Protected Model B child pauses for Chat review.
6. Component red state blocks successor.
7. Model B promotion requires complete child/evidence/rollback package.
8. Emergency recovery bypasses normal migration block but creates follow-up.
9. Header-only legacy edit fails the migration ratchet.
10. Preflight and CI produce the same classification.
11. Model A one-step rollback simulation succeeds.
12. Model B ordered rollback simulation succeeds.

- [ ] **Step 1: Implement fixture matrix**
- [ ] **Step 2: Run focused delivery-system acceptance command**
- [ ] **Step 3: Run full repository unit, typecheck, lint, and build suite**
- [ ] **Step 4: Exercise a real component-child PR with the new automation**
- [ ] **Step 5: Record pass/fail evidence and remediate until all acceptance scenarios pass**

**Rollback:** Disable new automation and restore configuration snapshot; component branch remains available for correction.

---

## Task 12 — As-built documentation, promotion, and production verification

Type: release + documentation + operations
Agent: Cursor prepares evidence; Chat reviews, approves, merges, verifies
Priority: 1
Depends On: Task 11

**Files**

- Create/update as-built references under `docs/reference/**` for actual CI, branch, environment, agent, and GitHub configuration.
- Create/update operator procedures under `docs/how-to/**`.
- Create/update rationale under `docs/explanation/**` only where design changed.
- Create/update canonical governance policies under `docs/governance/**`.
- Archive/supersede all touched legacy authority under `docs/archive/**`.
- Create: `docs/ops/reports/delivery-system-v1-promotion-readiness.md`

- [ ] **Step 1: Reconcile as-designed against as-built**
- [ ] **Step 2: Complete authority disposition map and reference verification**
- [ ] **Step 3: Finalize multi-step rollback package before promotion**
- [ ] **Step 4: Synchronize `component/delivery-system-v1` with current `main`**
- [ ] **Step 5: Run `npm run pr:preflight` and full release validation**
- [ ] **Step 6: Open one promotion PR from `component/delivery-system-v1` to `main` with no new implementation**
- [ ] **Step 7: Chat verifies design compliance and approves; Bill remains alternate approver**
- [ ] **Step 8: Merge and run production/post-merge verification**
- [ ] **Step 9: On success, Chat declares completion and notifies Bill for final product review**
- [ ] **Step 10: On failure, return bounded corrections to Cursor or declare design failure for Bill/Chat reconsideration**

## Program-wide rollback plan

Before promotion, capture:

1. Current `main` SHA and Cloudflare production deployment.
2. Current branch protection, required checks, approval, auto-merge, and ruleset configuration.
3. Every authority file moved, superseded, archived, or deleted.
4. Every workflow, script, template, package script, label, and configuration change.
5. Restoration order:
   - pause component/auto-integration workflows;
   - disable new ruleset or restore previous ruleset;
   - restore previous workflow/configuration files;
   - revert promotion commit;
   - restore previous Cloudflare deployment if required;
   - verify current production routes and CI;
   - reconcile issues and documentation authority.
6. Verification commands and expected results.

## Completion criteria

Program #2477 is complete only when:

- Shared delivery metadata is parsed and validated once.
- PMO classifies all work from Medium provisional through Small/Medium/Large.
- Medium work has a deterministic A/B decision tree.
- Chat is primary PR approver and Bill remains alternate.
- Model A production changes require approval and support one-step rollback.
- Eligible Model B children can auto-integrate without production ceremony.
- Protected Model B children cannot auto-integrate.
- Model B promotion requires integrated evidence and multi-step rollback.
- Emergency recovery remains stabilization-first and independent.
- Preview/component environments cannot silently mutate production.
- Unified preflight and CI agree.
- Predictable closeout failures are blocked before production merge.
- Touched legacy documents are fully dispositioned.
- Canonical domain ownership is non-overlapping.
- Pilot fixtures and a real component-child exercise pass.
- Promotion to `main` passes production and post-merge verification.
- As-designed, as-built, Operations, troubleshooting, and recovery documentation is complete.
