---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Objective sizing criteria, Medium Model A/B evidence flags, Model C documentation-only selection, decision-matrix examples, and mapping to delivery-profile stable metadata
Does Not Own: PMO launch authorization, workflow behavior, or merge approval
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2487, #3752
Last Reviewed: 2026-08-26
---

# Work Size and Delivery Model Contract

This reference defines the evidence contract PMO uses before writing stable delivery metadata. Values align with `scripts/ci/delivery_profile.mjs` from issue #2485 and Model C policy from #3752.

## Evidence flags

| Flag | Meaning |
| --- | --- |
| `documentationOnlyApprovedSurfaces` | Every intended write path is inside Model C approved documentation namespaces; no executable/coding/runtime path in scope |
| `singleReviewablePr` | Complete solution fits one independently reviewable PR |
| `oneStepRollback` | Rollback is one controlled action |
| `fullPreviewTestable` | Full behavior can be validated before production |
| `unresolvedArchitecture` | Material architecture decision remains open |
| `protectedMultiStepBoundary` | Protected path requires isolated integration |
| `harmfulIncompleteProduction` | Intermediate production state would be unsafe |
| `multipleDeployableComponents` | Multiple independently deployable parts |
| `multiplePromotions` | Multiple planned production promotions |
| `multipleArchitecturalDomains` | Multiple data or architecture domains need release units |
| `severalProtectedBoundaries` | Several protected boundaries touched |
| `platformMigrationOrOperatingModelChange` | Platform or repository-wide operating-model change |
| `emergencyCondition` | Active incident or unsafe production requiring recovery path |
| `fullOutageOrUnsafeProduction` | Full outage or confirmed unsafe production state |

## Classification algorithm

1. **Intake:** `size = medium-provisional`
2. **Emergency:** if `emergencyCondition` or `fullOutageOrUnsafeProduction` → route `emergency-recovery` (exit tree)
3. **Model C:** if `documentationOnlyApprovedSurfaces` is true and no executable path is in scope → `deliveryModel = C`, size typically `small` or `medium` by review scope; exit tree for model selection
4. **Large:** if any Large flag is true → `size = large`, `deliveryModel = B-child` or `B-promotion` per release shape
5. **Small:** if all Small required flags are true and no Large flag is true → `size = small`
6. **Medium:** otherwise → `size = medium`
7. **Model A/B (executable Medium only):** Model A only when all five Medium Model A conditions are true; otherwise Model B

## Decision matrix

| Example | Provisional | Final size | Change mode | Delivery model | Approval profile | Rollback profile | Decisive evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Typo in how-to under `docs/how-to/**` | medium-provisional | small | documentation | C | documentation-review | one-step | Docs-only approved surface; no executable path |
| Governance domain-policy clarification under `docs/governance/**` | medium-provisional | medium | documentation | C | protected-change-review | one-step | Docs-only; constitutional/domain-policy review intensity |
| README root documentation-only edit | medium-provisional | small | documentation | C | documentation-review | one-step | Exceptional root documentation surface; content-only |
| Add `README.md` inside `functions/**` | medium-provisional | small | routine-ops | A | chat-bill-production | one-step | Coding/runtime path — **not** Model C |
| Typo or bounded content correction in application UI copy (code path) | medium-provisional | small | routine-ops | A | chat-bill-production | one-step | Single PR, executable surface |
| Routine dependency patch | medium-provisional | small | routine-ops | A | chat-bill-production | one-step | One reviewable PR, no architecture change, patch rollback |
| Club Homepage newspaper feature | medium-provisional | medium | project | B-child | component-auto-integration | multi-step | Multiple UI surfaces and protected layout boundaries require component integration |
| Content Collection Phase 1 | medium-provisional | medium | project | B-child | component-auto-integration | multi-step | Multi-step feature boundary; preview-testable only across child sequence |
| Two-model delivery-system program | medium-provisional | large | planned-migration | B-child | protected-change-review | multi-step | Repository-wide operating-model change, multiple promotions, several protected boundaries |
| CI redesign | medium-provisional | large | planned-migration | B-child | protected-change-review | multi-step | Touches `scripts/ci/**` and workflows; multiple deployable gate components |
| Authentication migration | medium-provisional | large | planned-migration | B-child | protected-change-review | multi-step | Multiple architectural domains and protected auth paths |
| Bounded performance degradation | medium-provisional | medium | routine-ops | A | chat-bill-production | one-step | Degraded but non-outage production; harmful incomplete state blocks Small; expedited single-PR mitigation |
| Structural performance degradation | medium-provisional | medium | emergency | emergency-recovery | emergency-stabilization | emergency-approval | Emergency condition without full outage; stabilization-first |
| Full outage or unsafe production | medium-provisional | medium | emergency | emergency-recovery | emergency-stabilization | emergency-approval | `fullOutageOrUnsafeProduction`; exits normal tree |

## Invariants

- Identical evidence must always produce identical classification.
- No example may map to both Model A and Model B for the same release unit.
- No example may map to Model C when any executable or coding/runtime path is in scope.
- Emergency examples must not be reclassified through Medium Model A/B or Model C logic.
- Stable metadata recorded on issues and PRs must match the matrix outcome for the cited evidence.

## Executable fixture

`tests/support/pmo_work_classification.mjs` implements this matrix for automated regression. The table above remains the human review authority when the fixture and table disagree; fix the fixture before merge. Model C rows are added under issue #3753 implementation work when CI enums are extended.
