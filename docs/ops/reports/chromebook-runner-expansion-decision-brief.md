---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Project #2871 (Chromebook Runner and Dispatcher Capability Expansion) as-built reconciliation, the #2637 RETAIN/DEFER/NOT-PLANNED decision, and the #2638 terminal closeout
Does Not Own: Production routing, protected-branch automation, secret-bearing workloads, or reopening completed Project #2294
Canonical Reference: docs/governance/standards/CURSOR-RUNTIME-ROUTING.md
Related Issues: #2871, #2636, #2637, #2638, #2694, #3212, #3424, #4257, #4259, #4260
Last Reviewed: 2026-09-21
---

# Chromebook Runner and Dispatcher Capability Expansion Decision Brief (#2871)

## Purpose

Reconcile the live Chromebook runner/dispatch as-built against the evidence already recorded
across #2636, #2694, #3212, and #3424, and render the two decisions #2871's launch package
scoped to this project: whether task #2636 (evidence reconciliation) is closeable, and whether
task #2637 (a mutation-capable dispatcher pilot) is worth retaining. This closes out #2871 per
its own launch package ("Ordered work units after Graduation Go").

This document makes **no Production routing change**, adds no mutation authority, and does not
reopen completed Project #2294. It is a docs-only deliverable on
`docs/ops/reports/chromebook-runner-expansion-decision-brief.md`.

## Scope and non-goals

In scope: as-built reconciliation of #2636 against later evidence; the #2637 RETAIN / DEFER /
NOT-PLANNED decision; the #2638 terminal closeout record.

Out of scope (non-goals): reopening #2294; Production routing or protected-branch automation;
automatic `main` merge; secret-bearing workloads; paid relay, cloud-agent, or OpenAI API
infrastructure; a second concurrent Cursor implementation lane.

## Current known truth

| Field | Value |
| --- | --- |
| Primary local Cursor transport | GitHub Actions `lgfc-cursor-dispatch` on runner label `lgfc-cursor` (per #3212/#3424 as-built) |
| Cursor Local Bridge | Decommissioned as primary auto-start (#3424 closed complete) |
| Host runner (current) | `lgfc-cursor-chromebook` (runner id 22) — online, `busy=false`, labels `self-hosted`, `Linux`, `X64`, `lgfc-cursor`; systemd unit active and enabled (observed 2026-09-21T02:38Z, recorded on #2636) |
| Host runner (historical, #2294) | `lgfc-chromebook-linux` (runner id 21) — superseded; persistence/disable/rollback/recovery proven against this runner in the 2026-07-20 `CHATGPT HANDOFF` on #2636 |
| Production routing | NO-GO (unchanged; this brief does not authorize it) |
| Accepted capability boundary | Manual repository-runner health execution; identifiers-only wake-packet dispatch to Cursor. No mutation authority. |

## #2636 — Reconcile runner persistence, disable, and recovery evidence

### Evidence already mapped (no duplication)

| Source | What it proves | Disposition |
| --- | --- | --- |
| #2636, 2026-07-20 `CHATGPT HANDOFF` | Manual health, `svc.sh` stop/start, disable/offline, rollback, approved-only routing on runner `lgfc-chromebook-linux` (id 21) | Retained as historical host proof |
| #2694 (closed complete) | Cursor Local Bridge watchdog / missed-handoff reconciliation | Historical; Bridge is not the primary transport after #3212/#3424 |
| #3212 / #3424 as-built | Primary transport is `lgfc-cursor-dispatch` on label `lgfc-cursor` | Controlling design; do not restore Bridge poll-wake |
| #2636, 2026-09-21T02:38Z live check | Runner `lgfc-cursor-chromebook` (id 22) online, correct labels; systemd unit active and enabled; boot_id recorded | Current persistence surface |

### Residuals identified on #2636 and their disposition

1. **Actor gate on manual `workflow_dispatch`** (`lgfc-cursor-dispatch.yml`, `lgfc-cursor-runner-health.yml`) required the retired `wdhunter645` login. **Fixed and merged**: PR #4257.
2. **`scripts/cursor-bridge/lib/wake-ingress.mjs` actor check** still compared against `wdhunter645`, causing a live dispatch dry-run to fail `dispatch_actor_not_authorized`. **Fixed and merged**: PR #4259 (confirmed on `main`: `wake-ingress.mjs` now checks `event.actor !== 'wdhunter465'`; no `wdhunter645` references remain in this file or in `lgfc-cursor-dispatch.yml` / `lgfc-cursor-runner-health.yml`).
3. **`LGFC Cursor Runner Health` returns 403** (`Resource not accessible by integration`) calling `github.rest.actions.listSelfHostedRunnersForRepo`, on every run observed to date — scheduled and `workflow_dispatch` alike, including the 2026-09-21T11:25 scheduled run after PR #4257 merged. Root cause: the workflow's `permissions:` block grants only `contents: read` and `actions: read`; listing self-hosted runners requires the repository's Administration permission. **Fix identified, not yet merged** — see "Open item" below.
4. **`config/github-actions/cursor-dispatch-runner.json` `trustedActors`** still lists `wdhunter645` — recorded as out of scope on both #4257 and #4259 (#4259: "left unchanged: ... correctly reject the old `wdhunter645` repo-slug as a security check" does not cover this file; it was simply not touched by either PR). This is a config value, not a live authorization gate the way the workflow `github.actor ==` checks are — no evidence any workflow currently reads `trustedActors` from this JSON to authorize a live actor. Recorded here as a known stale value, not a blocker.
5. **Host-side items** — Chromebook not reliably online at the daily 11:17 UTC cron (example: run 35507575264), the Chromebook worktree's git remote still pointing at the retired `wdhunter645` slug, and a full host reboot persistence check — are host/operational, not repository content, and are out of scope for a repository PR. They do not block this reconciliation; #2694's watchdog evidence remains the accepted persistence/recovery proof per the project's own Graduation-prep review (2026-09-18).

### Open item

`.github/workflows/lgfc-cursor-runner-health.yml` needs one additional permission line:

```diff
 permissions:
   contents: read
   actions: read
+  administration: read
```

This is a read-only repository-metadata scope (list self-hosted runners), not a mutation or
Production grant. The local sandbox's own safety classifier flags any workflow `permissions:`
diff for explicit human sign-off regardless of content, so this change is presented here rather
than pushed autonomously. Once applied and merged, the next scheduled or manually dispatched
health run is the closing evidence for this item.

### #2636 disposition

**Not yet closed.** Items 1 and 2 are resolved and merged. Item 3 has an identified, minimal fix
pending Bill's direct application or explicit sign-off (workflow permission changes are not
something this session pushes autonomously). Items 4 and 5 are recorded as non-blocking. Close
#2636 once item 3 merges and one clean health run is observed.

## #2637 — RETAIN / DEFER / NOT-PLANNED decision

#2637's own decision gate offers exactly three outcomes. Evaluated against current evidence:

- **RETAIN** would mean defining authorized mutation action classes and running a bounded pilot.
  No concrete operational gap currently requires mutation capability: the accepted boundary
  (manual health + identifiers-only wake dispatch) already delivers reliable local Cursor
  invocation once the #2636 residuals above are cleared. Nothing in this project's history
  identifies a task that manual health + identifiers-only dispatch cannot accomplish.
- **DEFER** would keep the task prepared with no further action — appropriate only if a
  plausible near-term need is anticipated. None is recorded on #2871, #2636, or #2637.
- **NOT PLANNED** — "close the task because the current manual-health and wake-delivery
  capability is sufficient" — matches the current state precisely, and is consistent with
  #2871's own non-goals (no second Cursor lane, no expanded mutation authority, zero
  incremental cost, no paid relay/cloud-agent/OpenAI infrastructure).

**Decision: NOT PLANNED.** Close #2637 citing this brief. If a concrete operational need for
mutation-capable dispatch is identified in the future, it should be raised as a new, separately
authorized project rather than reopening this one.

## #2638 — Terminal closeout and routing decision

1. Final disposition of #2636: open pending the single workflow-permission item above (not
   blocked on any Product decision).
2. Final disposition of #2637: **NOT PLANNED** (this brief).
3. Allowed runner workload classes remain unchanged: manual repository-runner health execution
   and identifiers-only wake-packet dispatch. No mutation, no Production routing, no
   protected-branch automation, no secret-bearing workload.
4. Rollback/disable/recovery evidence: proven historically against `lgfc-chromebook-linux` (2026
   -07-20 handoff) and reconciled against the current runner `lgfc-cursor-chromebook` above; no
   retained expansion scope requires new rollback evidence since #2637 is NOT PLANNED.
5. **Terminal decision: complete**, contingent only on the #2636 workflow-permission item being
   applied. Production routing remains **NO-GO** and stays Bill's separate decision for any
   future project.

## Recommendation

Close #2637 and #2638 now on this brief's decisions. Close #2636 once the one-line
`administration: read` permission is applied to `lgfc-cursor-runner-health.yml` and one clean
health run is observed. Close #2871 once all three children are closed.
