---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: The reusable distinction among preview, production, smoke, rollback, and closeout evidence for #2089
Does Not Own: The #2039 launch checklist, Cloudflare configuration, CI workflow behavior, or permission to deploy
Canonical Reference: /docs/governance/PR_LIFECYCLE_STATE_MACHINE.md
Related Issues: #2089, #2047, #2039
Last Reviewed: 2026-09-27
---

# Production release evidence ownership

## Purpose

Pull-request checks and post-merge closeout are not the same thing as production release evidence. This file separates those evidence types for #2089 so a current-state record can point at the right one. It does not implement #2047 and it does not authorize a deploy.

## Scope

This file owns the reusable distinction among preview, production, smoke, rollback, and closeout evidence, and the rules below for when each is missing or complete. It does not own the #2039 launch checklist (that stays #2047's), Cloudflare configuration, CI workflow behavior, or permission to deploy.

#2047 remains the immediate launch-checklist owner for #2039. This file is the reusable model those records should follow.

## Current known truth

### Evidence types

| Evidence | Question it answers | Owner | Not the same as |
| --- | --- | --- | --- |
| Preview deploy | Did this pull request's preview build succeed? | The preview check on that pull request | Production readiness |
| Production deploy | Did the authorized production publish happen, and which revision? | Day-2 Operations, after Product Authority authorizes the publish | A green pull-request check |
| Smoke test | Did the named production or preview paths behave as the design standard requires after that publish? | The role that ran the smoke procedure, recorded on the source Issue | A unit test |
| Rollback | Can the previous production revision be restored, and was it restored if the smoke failed? | Day-2 Operations | A git revert of an unreleased branch |
| Source-issue closeout | Did the merged pull request meet the Issue's acceptance, including doc updates? | The post-merge closeout record for that pull request | A production Go decision |

### Rules

- A green preview check does not close production, smoke, or rollback evidence.
- Production Go stays with Product Authority. This model does not grant it.
- Missing evidence opens a follow-up Issue that names the missing type and the source Issue. It does not silently mark the release complete.
- Current-state and PMO surfaces link to the evidence record. They do not copy it into a second authority.
- Closeout may finish while production evidence is still open. Those are different states. Do not conflate them with pull-request `READY FOR REVIEW`.

### What stays unchanged

Cloudflare configuration and CI workflows are out of scope. If #2047 already specifies a checklist item, follow #2047 for that launch. Use this table only to classify the evidence.

## Intended final state

This model stays reusable and generic. As #2047 (or later launch-checklist work) records evidence in practice, its records should reference this file's evidence types rather than inventing new ones; this file does not expect to gain per-launch specifics of its own.
