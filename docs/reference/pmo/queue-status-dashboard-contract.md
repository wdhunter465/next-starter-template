---
Doc Type: Reference
Audience: Implementers and validators
Authority Level: Contract
Owns: Queue-status dashboard classification, JSON shape, and section requirements for #3609
Does Not Own: PMO Active/Pipeline book views, GitHub Issue authority, Pages setup
Canonical parent: Issue #3609; launch packet `docs/ops/implementation-plans/issue-3609-queue-status-dashboard-launch-packet.md`
Last Reviewed: 2026-09-28
---

# Queue-status dashboard contract

## Purpose

Normative rules for the LGFC **queue-status** reporting surface (not the PMO portfolio books).

## Classification

Open Issues only (exclude PRs and closed Issues).

1. If labels include `ops-pr-escalation` or `post-merge-failure` → team `operations`.
2. Else if exactly one of `team:operations`, `team:engineering`, `team:governance` → that team.
3. Else if zero team labels or multiple team labels (and not step 1) → **data quality** (do not place on a team table).
4. `team:pmo` and `pmo:task` Issues are excluded from team tables (not data quality unless multi-team).

## Ownership

Exactly one `agent:*` → display name; zero → `Unassigned`; multiple → conflict string. No body/`owner:*`/assignee override.

## Sections

Operations, Engineering, Governance open lists; 10 newest; 20 oldest (with duration from `generatedAt − createdAt`); data quality list.

## JSON

Published as `queue-status-data.json` with `source: github-issues` and ISO `generatedAt`. See launch packet for full schema.

## Refresh

Event-driven via the shared PMO dashboard build workflow; 30-minute schedule fallback; artifact publish only.
