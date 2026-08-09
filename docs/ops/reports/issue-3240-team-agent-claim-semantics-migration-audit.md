---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Evidence Snapshot
Source Issue: #3240
Canonical Reference: /docs/ops/reports/issue-3240-team-agent-claim-semantics-migration-audit.md
Related Issues: #3240
Last Reviewed: 2026-08-09
Executor: Grok
---

# Issue #3240 — team vs agent claim semantics migration audit

## Purpose

Classify open `agent:*` Issues against the claim lifecycle defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` so only proven `STALE_PREASSIGNMENT` labels are removed.

## Classification rules

| Class | Meaning | Action |
| --- | --- | --- |
| ACTIVE_CLAIM | Agent is actively executing or has current handoff evidence | Keep `agent:*` |
| EXPLICIT_RESERVATION | Product Authority deliberately reserved the Issue for a named agent | Keep until released |
| STALE_PREASSIGNMENT | Historical pre-assignment with no recent activity or reservation evidence | Remove `agent:*` only after recorded evidence |
| AMBIGUOUS | Insufficient evidence to classify | Leave; do not bulk-delete |

## Policy constraints

- No bulk deletion of valid reservations.
- No removal of `ACTIVE_CLAIM` or `EXPLICIT_RESERVATION`.
- `team:*` remains durable queue ownership and is out of scope for this migration.

## Snapshot note

Classification is performed at audit time against open Issues. A durable table of classifications will be attached in a follow-up comment or report revision once live GitHub search evidence is recorded under this Issue.

## Rollback

Revert this report via reviewed PR. Label removals (if any) are separate, evidence-backed operations.
