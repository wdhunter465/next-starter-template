---
Doc Type: Reference
Audience: Implementers and validators
Authority Level: Contract
Owns: Queue-status dashboard classification, JSON shape, and section requirements for #3609
Does Not Own: PMO Active/Pipeline book views, GitHub Issue authority, Pages setup, Graduation Go
Canonical Reference: GitHub Issue #3609; docs/ops/implementation-plans/issue-3609-queue-status-dashboard-launch-packet.md
Last Reviewed: 2026-09-28
---

# Queue-status dashboard contract

## Purpose

Normative rules for the LGFC **queue-status** reporting surface (not the PMO portfolio books).

## Classifier result kinds

Do **not** overload `classifyTeamQueue`’s `null`. Queue-status returns one of:

- `team` — Operations, Engineering, or Governance table  
- `dataQuality` — missing-team or multi-team  
- `excluded` — closed, pull request, `team:pmo`, or `pmo:task`  

## Classification order

1. Closed → `excluded`  
2. Pull request → `excluded`  
3. `ops-pr-escalation` or `post-merge-failure` → `team: operations`  
4. Exactly one of `team:operations` | `team:engineering` | `team:governance` → that team  
5. `team:pmo` → `excluded`  
6. `pmo:task` → `excluded`  
7. Zero `team:*` → `dataQuality` (`missing-team`)  
8. Multiple `team:*` → `dataQuality` (`multi-team`)  

Newest and oldest lists use **only** `team` rows.

## Ownership

Exactly one `agent:*` → display name; zero → `Unassigned`; multiple → conflict string. No body / `owner:*` / assignee override.

## Sections

Operations, Engineering, Governance; 10 newest; 20 oldest (duration from `generatedAt − createdAt`); data quality.

## JSON

`queue-status-data.json` with `source: github-issues` and ISO `generatedAt`. Schema in the launch packet.

## Refresh

Shared PMO dashboard build workflow. Issue events + `issue_comment` + selected `pull_request` types (**not** `synchronize`; **not** review events in v1). Thirty-minute schedule fallback. Artifact publish only.
