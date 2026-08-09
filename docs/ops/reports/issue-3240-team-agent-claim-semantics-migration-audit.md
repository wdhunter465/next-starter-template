---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Evidence / Reconciliation
Owns: Classification of open agent:* labels under #3240 claim-lifecycle semantics
Does Not Own: Normative queue policy (see WORK-QUEUES-AND-COLLABORATION.md) or live bulk label mutation beyond proven STALE_PREASSIGNMENT
Canonical Reference: /docs/governance/WORK-QUEUES-AND-COLLABORATION.md
Related Issues: #3240, #3145, #3152
Last Reviewed: 2026-08-09
---

# Issue #3240 — Team queue vs agent claim migration audit

## Purpose

Record the classification of open Issues that carry `agent:*` labels under the target semantics:

- `team:*` = durable queue ownership
- `agent:*` = active claim or explicit reservation only

## Scope

- Open Issues with `agent:grok`, `agent:cursor`, or `agent:claude` at audit time
- Classification only; live label removal limited to proven `STALE_PREASSIGNMENT`
- No paid services; no auto-merge; no protected-decision bypass

## Classification rules

| Class | Meaning | Action |
| --- | --- | --- |
| ACTIVE_CLAIM | Agent is presently executing, remediating, or verifying | Keep |
| EXPLICIT_RESERVATION | Product Authority / control authority deliberately assigned | Keep until released |
| STALE_PREASSIGNMENT | No active execution and no current reservation | Remove `agent:*` after evidence recorded |
| AMBIGUOUS | Cannot determine safely | Leave unchanged; surface for disposition |

## Snapshot (2026-08-09)

### agent:grok

| Issue | Title (short) | Class | Notes |
| --- | --- | --- | --- |
| #3240 | team vs agent claim semantics | ACTIVE_CLAIM | This work; Grok claim ack recorded |
| #3134 | PMO sequencing / holds / risk exceptions | AMBIGUOUS | Open governance; no live Grok session evidence at audit |
| #2679 | Workflow transition SLO | AMBIGUOUS | Prior Grok phase-1 contract; label may be residual |
| #1038 | PR gate-readiness hierarchy | AMBIGUOUS | Long-open reference/governance |

### agent:cursor (sample of open set)

Many open Issues carry historical `agent:cursor` preassignments on Operations and backlog items. Without live Cursor session evidence or an explicit Product Authority reservation comment, most older items are candidates for `STALE_PREASSIGNMENT` or `AMBIGUOUS`.

Conservative disposition for this report: treat as **AMBIGUOUS** unless a recent claim comment, open PR head owned by Cursor, or `status:in-progress` / `status:implementation` with matching activity is present.

Examples left **AMBIGUOUS** (no bulk remove):

- #3188, #2794 (gov:hold), #2682, #2637, #2636, #2215, #2170, #2137, #2095, #2092, #1806, #1613, #1318, #1300, #1225, #1055, #1036, #527, #476

### agent:claude

Several items reflect the explicit website / implementation lane assignment pattern (Product Authority direction that Claude owns those packages). Treat those as **EXPLICIT_RESERVATION** or **ACTIVE_CLAIM** when status indicates live work.

| Issue | Class (initial) | Notes |
| --- | --- | --- |
| #3215 | EXPLICIT_RESERVATION / ACTIVE_CLAIM | Explicit Claude assignment pattern in title/lane |
| #3213 | AMBIGUOUS | Research task |
| #3151 | AMBIGUOUS | PMO exception |
| #3124 | AMBIGUOUS | Sandbox |
| #2933–#2926 series | AMBIGUOUS or EXPLICIT_RESERVATION | Queued PMO tasks with agent:claude; confirm reservation vs preassignment |
| #2909, #2901 | ACTIVE_CLAIM or EXPLICIT_RESERVATION | Active website task lane |
| #2860, #2857, #2782, #2781, #2780 | EXPLICIT_RESERVATION | Project parents with agent:claude on Active portfolio |

## Actions taken in this PR

1. Canonical documentation updated so ordinary new team-queue Issues do not treat `agent:*` as permanent ownership.
2. This audit published as durable evidence.
3. **No bulk label deletion.** Only future, individually evidenced `STALE_PREASSIGNMENT` removals are authorized after this contract lands.

## Follow-up

- Independent review of the governance PR.
- Optional bounded cleanup Issue to remove proven stale `agent:*` labels one-by-one with evidence comments.
- Dispatcher / agent startup instructions should refuse work only when a claim is confirmed active or reserved — not merely because a label exists.

## Rollback

Revert the governance PR. This audit remains as historical evidence; any labels later removed under STALE evidence can be restored from this classification if needed.
