---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Rollback profile definitions, deterministic evidence requirements, and component red/green state facts consumed by delivery and operations policy
Does Not Own: Approval authority, CI gate implementation, workflow behavior, or emergency procedure steps
Canonical Reference: /docs/governance/DELIVERY-AND-RELEASE.md
Related Issues: #2495, #4777
Last Reviewed: 2026-10-26
---

# Delivery and Rollback Profiles

## Purpose

This reference defines stable rollback profiles, required evidence fields, and component integration state facts. Policy boundaries live in `docs/governance/DELIVERY-AND-RELEASE.md` and `docs/governance/OPERATIONS-AND-RECOVERY.md`.

Parser metadata values are enumerated in `docs/reference/ci/delivery-profile-contract.md`.

## Rollback profiles

| Profile | Delivery models | Controlled actions | Evidence required before merge/promotion |
| --- | --- | --- | --- |
| `one-step` | Model A | Single revert or deployment restore | Documented revert target (commit SHA or deployment ID) and smoke-test checklist |
| `multi-step` | Model B child, Model B promotion | Ordered rollback package | Full package per schema below |
| `emergency-stabilization` | Emergency recovery | Stabilize first; defer full RCA | Recovery action record, approval reference, follow-up issue link |

Profiles are mutually exclusive per PR. The classifier must not silently downgrade profiles.

## One-step rollback evidence (Model A)

Record on the source issue and PR before implementation:

```text
rollback_target_type: revert-commit | deployment-restore
rollback_target_ref: <commit SHA or Cloudflare deployment ID>
smoke_tests: <ordered checklist>
verification_owner: PMO Admin
```

After merge, if regression is observed:

1. Execute the documented one-step action immediately.
2. Run smoke tests.
3. Open bounded fix work if revert alone is insufficient.

## Multi-step rollback evidence (Model B)

Design before implementation begins. Finalize before promotion opens.

### Required package fields

```text
release_unit: <component branch or program issue>
rollback_trigger: <conditions that authorize rollback execution>
disablement_steps: <feature flags, routing, or config off>
external_write_stops: <APIs, queues, or storage write blocks>
config_restoration: <files, bindings, env values>
data_restoration: <migration reversal or compatible restore path>
deployment_restoration: <previous deployment ID or artifact>
dependency_order: <ordered list of rollback steps>
verification_checklist: <post-rollback tests>
reconciliation: <issues, docs, incident records to update>
package_owner: PMO
package_finalized_before_promotion: yes | no
```

### Child-scope vs promotion-scope

| Scope | When recorded | Minimum contents |
| --- | --- | --- |
| Child | Each Model B child issue at launch | Increment-specific revert steps and component-branch recovery path |
| Promotion | Model B promotion issue before PR open | Full release-unit package covering all integrated children |

Child rollback evidence does not substitute for promotion rollback evidence.

### Model B rollback principles

- Prefer backward-compatible migrations and delayed destructive cleanup.
- Previous application version must remain operable if rollback executes.
- Ordered steps must be deterministic — no ambiguous "fix as needed" placeholders.

## Emergency-stabilization evidence

Record on the emergency issue and recovery PR:

```text
impact_summary: <what is broken and who is affected>
stabilization_action: <rollback, hotfix, traffic isolation, or config change>
approval_ref: <Product Authority approval on issue or PR>
recovery_verification: <targeted checks run>
follow_up_issue: #<number> — mandatory for RCA, hardening, deferred migration
production_state_after: stabilized | degraded-bounded | restored
```

Emergency recovery may defer DIATAXIS migration on touched legacy documents when follow-up issue `#<number>` is linked before merge.

## Component integration state facts

| State | Required signals | Auto-integration |
| --- | --- | --- |
| `green` | Required technical checks passing on component branch head | Eligible when delivery profile and protected-change rules pass |
| `red` | Failed required check, broken build, or integration regression | Blocked |
| `hold` | Product Authority hold label or explicit issue instruction | Blocked |

State is derived from GitHub-native checks and branch status — not PR-body lifecycle fields.

## Profile-to-metadata mapping

| Delivery model | Rollback profile | Gate profile | Target environment |
| --- | --- | --- | --- |
| `A` | `one-step` | `production-candidate` | `production` |
| `B-child` | `multi-step` | `component-child` | `component` |
| `B-promotion` | `multi-step` | `component-promotion` | `production` |
| `emergency-recovery` | `emergency-stabilization` | `emergency-recovery` | `recovery` |

Mismatch between PR metadata and branch facts must fail classification explicitly.

## Canonical references

| Topic | Owner |
| --- | --- |
| Delivery policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Operations and recovery policy | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Metadata parser contract | `docs/reference/ci/delivery-profile-contract.md` |
| Model A release procedure | `docs/how-to/delivery/run-model-a-release.md` |
| Model B component procedure | `docs/how-to/delivery/run-model-b-component-release.md` |
| Emergency procedure | `docs/how-to/ops/run-emergency-recovery.md` |
