---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Step-by-step PMO classification and Model A/B selection before launch
Does Not Own: Domain policy, delivery-profile parser implementation, or merge approval
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2487, #4174
Last Reviewed: 2026-09-19
---

# Classify Work and Select Delivery Model

## Purpose

Classify provisional PMO intake into Small, Medium, or Large, select Model A or Model B for Medium work, or exit to emergency recovery before launch authorization.

## Prerequisites

- Source GitHub issue drafted for the work item
- Evidence gathered from design notes, affected paths, rollback plan, and promotion count
- `docs/reference/pmo/work-size-and-delivery-model-contract.md` available for matrix comparison

## Procedure

### 1. Record provisional intake

On the issue, set:

```text
Size: medium-provisional
```

Do not skip provisional intake for expedited work.

### 2. Collect evidence flags

Answer each flag in the work-size contract honestly. When uncertain, assume the stricter boundary (toward Medium/Large or Model B).

### 3. Check emergency exit

If production is in full outage or confirmed unsafe state, or an active emergency condition applies:

- set `Change mode: emergency`
- set `Delivery model: emergency-recovery`
- stop using the Medium Model A/B tree
- follow emergency recovery procedure (target: `docs/how-to/ops/run-emergency-recovery.md` when Task 5 lands)

### 4. Determine final size

Apply policy order from `docs/governance/PMO-PORTFOLIO.md`:

1. Large if any Large criterion is true
2. Else Small if all Small criteria are true
3. Else Medium

Update `Size:` on the issue to `small`, `medium`, or `large`.

### 5. Select delivery model

| Final size | Delivery model |
| --- | --- |
| small | `A` when all Model A conditions hold; otherwise stop and reclassify to Medium |
| medium | `A` only if all five Model A conditions hold; otherwise `B-child` |
| large | `B-child` for component work; `B-promotion` only for the production promotion PR |

Record stable fields on the issue:

```text
Delivery model:
Change mode:
Target environment:
Approval profile:
Gate profile:
Rollback profile:
Component branch:
Component master:
```

Use values from the decision matrix or `classifyDeliveryProfile` when the PR exists.

### 6. Validate against the decision matrix

Compare the outcome to `docs/reference/pmo/work-size-and-delivery-model-contract.md`. If no row matches, stop and post a source-Issue handoff for **PMO Admin** review.

### 7. Authorize launch

**PMO Admin** authorizes launch on the classified issue. Product Authority retains protected Product Go. Local implementation begins only after assignment, runtime, allowlist, and the current implementer `agent:*` plus `handoff:ready` labels (labels/status only — #3013; no resume comment required).

## Verification

```bash
npx vitest run --config tests/vitest.node.config.ts tests/pmo-work-classification.test.mjs
```

Expected: PASS — matrix examples match the executable fixture.

## Stop conditions

- Identical evidence produces two valid outcomes
- Issue lacks a single canonical PMO owner after migration
- Classified metadata contradicts branch or promotion facts
