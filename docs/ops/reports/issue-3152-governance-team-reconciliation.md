---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Evidence / Reconciliation
Owns: Current-versus-target reconciliation for Issue #3152 Governance Team/queue
Does Not Own: Normative queue policy (see WORK-QUEUES-AND-COLLABORATION.md) or live label migration execution
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3152, #3145, #3142, #2724
Last Reviewed: 2026-08-07
---

# Issue #3152 — Governance Team reconciliation

## Purpose

Record the addition of `team:governance` as the fourth mutually exclusive Team/queue for repository stewardship work, with a dedicated `gov:*` priority/state namespace and agent eligibility that does not invent a new durable agent role.

## Scope

In scope: canonical queue docs, agent precedence, queue-label registry/contract/tests, and narrow topology reconciliation for #3145/#3142.

Out of scope: live GitHub label creation and open-Issue migration (post-merge); Codex selective-use implementation (#3142); PMO continuous-execution redesign (#3145).

## Current known truth

Before this change, only `team:operations`, `team:pmo`, and `team:engineering` existed. Repository stewardship/audit/policy work was forced into PMO Active or Engineering Pipeline queues, contaminating portfolio visibility.

## Intended final state

Four mutually exclusive Team labels exist. Governance owns stewardship/standards/authority/audit/policy/documentation integrity. Governance is not an Operations interrupt and not an Active PMO Project queue. Substantial future implementation discovered by Governance still routes through Engineering preparation / PMO delivery.

## Classification rule

- failed/degraded/unsafe accepted capability → Operations
- stewardship/standards/audit/policy/docs integrity → Governance
- launched Project/Program delivery → PMO
- future Project/Program preparation → Engineering

## Labels

- `team:governance`
- `gov:priority:1` … `gov:priority:4`
- `gov:review`
- `gov:hold`

## Agent eligibility

| Agent | Normal Teams | Notes |
| --- | --- | --- |
| Cursor | Operations + PMO + Governance | Not normal Engineering |
| Claude Code | PMO + Engineering (+ Governance when assigned) | Operations only when escalated |
| WORK | Analysis/assurance/policy for Governance when assigned | `agent:*` still required for direct claim |

## Related Issue reconciliations

- **#3145:** continuous self-claim model retained; three-Team-only assumption superseded only for Team topology.
- **#3142:** Codex selective-use purpose unchanged; three-Team / no-fourth-Team wording noted for topology update only (comment on #3142).

## Post-merge migration (authorized)

1. Create missing live labels from `.github/queue-label-registry.json`.
2. Relabel only unambiguous open stewardship Issues to `team:governance` (+ one `gov:*` state).
3. Report ambiguous Issues; do not guess; never leave multiple `team:*` labels.
