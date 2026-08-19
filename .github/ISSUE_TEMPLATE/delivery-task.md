---
name: Delivery Task
about: Model A/B or emergency task with stable delivery metadata
title: 'TASK: <short title>'
labels: []
assignees: []
---

## Purpose

<!-- One paragraph: what this task delivers and why. -->

## PMO intake (required before launch)

All work enters as `Size: medium-provisional` until classified. See `docs/how-to/pmo/classify-work-and-select-delivery-model.md`.

```text
Size: medium-provisional
Delivery model:
Change mode:
Target environment:
Approval profile:
Gate profile:
Rollback profile:
Component branch:
Component master:
Promotion PR:
Runtime: local
```

## Classification evidence

Record the matrix row or contract outcome used to finalize fields above:

- Work-size contract row or rationale:
- Model A/B decision evidence (if Medium):
- Protected-change paths touched (if any):
- Emergency exit used: NO / YES — rationale if YES

## Scope

### Allowed paths

- `path/to/file`
- `path/to/directory/**`

All other paths are out of scope.

## Acceptance criteria

- [ ] Stable metadata recorded on the issue and matching PR
- [ ] Changed files stay inside the allowlist
- [ ] Verification evidence attached to the PR

## Rollback

<!-- One-step, multi-step, or emergency-stabilization action for this task. -->

## Stop rule

Stop only for authority conflict, missing allowlist, or a material business/security decision. Routine template, label, ruleset, and evidence corrections remain in scope.
