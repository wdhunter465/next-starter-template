---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Implementation Evidence (Phase 3)
Status: Draft — #3212 Phase 3 reliability validation
Source Issue: #3212
Owns: Phase 3 reliability validation evidence for security-hardened GitHub→Cursor dispatch (#3212)
Does Not Own: Phase 4 Bridge retirement, durable systemd runner install, or trusted-actor (`wdhunter645`) manual workflow_dispatch wake
Canonical Reference: /docs/ops/reports/issue-3212-phase3-reliability-validation.md
Related Issues: #3212, #3227
Last Reviewed: 2026-08-09
Executor: Cursor Local
---

# Issue #3212 Phase 3 — Reliability validation

## Purpose

Record Phase 3 reliability evidence for the Phase 2 Cursor dispatch path: repeated dispatch, duplicate/concurrency serialization, runner restart/reconnect, temporary offline observation, independent health alarm path, failure signaling, and no silent loss in a bounded window.

## Scope

**In scope**

- Local reliability harness for wrapper behavior
- Live label-driven dry-run wakes on `lgfc-cursor-chromebook`
- Runner stop → GitHub offline → restart reconnect
- Unauthorized-actor gate checks for manual dispatch/health
- Phase 3 evidence report

**Out of scope**

- Phase 4 Bridge retirement
- Live (non-dry-run) Cursor invoke
- Trusted-actor (`wdhunter645`) `workflow_dispatch` wake (actor gate; not available as `wdhunter465`)
- `sudo ./svc.sh install` reboot persistence

## Current known truth

1. Phase 2 merged via PR #3246 (`90b14eed…`) and was Product Authority–accepted with advance to Phase 3.
2. Post-merge exception #3227 (and related #3247 disposition work) is **CLOSED**; it was a reviewer-disposition clerical defect, not a Phase 2 design failure.
3. Post-merge closeout briefly closed #3212 after Phase 1/2 replay; issue was **reopened** because Phases 3–4 remain in scope.
4. Host runner `lgfc-cursor-chromebook` was restarted for Phase 3 with `LGFC_CURSOR_DISPATCH_DRY_RUN=true` so label wakes exercise the path without live Cursor invoke.

## Delivered artifacts

| Artifact | Path |
| --- | --- |
| Reliability harness | `scripts/lgfc-cursor-dispatch/test-reliability-harness.mjs` |
| This evidence report | `docs/ops/reports/issue-3212-phase3-reliability-validation.md` |

## Local harness results

Command:

```bash
node scripts/lgfc-cursor-dispatch/test-reliability-harness.mjs
```

Result (**PASS**, 5/5):

| Case | Result |
| --- | --- |
| `repeated_dry_run_dispatch_x5` | PASS |
| `duplicate_dispatch_serialized_by_lock` | PASS (second exit 4 / `dispatch_lock_held`) |
| `failure_signal_invalid_repo` | PASS (exit 2) |
| `failure_signal_untrusted_event` | PASS (exit 2) |
| `security_unit_suite` | PASS |

## Live evidence (2026-08-09)

### Runner restart / temporary offline / reconnect

| Step | Evidence |
| --- | --- |
| Before | `lgfc-cursor-chromebook` **online** (`/tmp/lgfc-3212-phase3-evidence/runners-before.json`) |
| Stop | Local `Runner.Listener` for `actions-runners/lgfc-cursor` terminated |
| Offline observation | API status **offline** at ~12:13:13Z (`runners-offline.json`, `offline_result=offline`) |
| Restart | `nohup env LGFC_CURSOR_DISPATCH_DRY_RUN=true ./run.sh` |
| Reconnect | API status **online** on first up-poll; listener PID active (`runners-after-restart.json`) |

This covers Phase 3 runner restart, temporary outage (process stop), and reconnection. Full Chromebook network cut was not required once GitHub registered the runner offline and later online.

### Independent health alarm path

| Check | Result |
| --- | --- |
| Health workflow actor gate | `workflow_dispatch` as `wdhunter465` → run [31312783596](https://github.com/wdhunter465/next-starter-template/actions/runs/31312783596) **skipped** (expected; only `wdhunter645` + confirmation string) |
| API-mirrored health query (post-reconnect) | **ONLINE** — 1 match `lgfc-cursor-chromebook` |
| Offline fail semantics | Workflow `setFailed` when no online `lgfc-cursor` match — validated by offline API window above; trusted scheduled/`wdhunter645` run not executed in this session |

### Unauthorized manual dispatch (failure signaling / no silent wake)

Run [31312675870](https://github.com/wdhunter465/next-starter-template/actions/runs/31312675870) (`workflow_dispatch` as `wdhunter465`):

- Security unit tests: **success**
- Dispatch Cursor wake: **skipped** (actor gate)

### Repeated + concurrent label-driven dry-run wakes (no silent loss)

Two `handoff:ready` label cycles on #3212 while host dry-run env was set:

| Run | Result | Runner | Dry-run |
| --- | --- | --- | --- |
| [31312790306](https://github.com/wdhunter465/next-starter-template/actions/runs/31312790306) | **success** | `lgfc-cursor-chromebook` | `DRY_RUN=true` → `dry_run_ok` |
| [31312795885](https://github.com/wdhunter465/next-starter-template/actions/runs/31312795885) | **success** | `lgfc-cursor-chromebook` | `DRY_RUN=true` → `dry_run_ok` |

Serialization evidence:

- Workflow concurrency group `lgfc-cursor-dispatch` with `cancel-in-progress: false`
- Host log: job 1 `12:14:48Z`…`Succeeded` then job 2 `12:15:06Z`…`Succeeded` (no cancel / no silent drop)
- Local lock harness separately proves in-process duplicate rejection

Delivery IDs observed: `wake-31312790306-3212`, `wake-31312795885-3212`.

### Cursor / wrapper failure signaling

| Signal | Evidence |
| --- | --- |
| Invalid repo argv | harness exit 2 |
| Untrusted event (`pull_request`) | harness exit 2 |
| Lock held / duplicate | harness exit 4 |
| Unauthorized manual wake | job skipped (not silent success) |
| Successful dry-run path | `dry_run_ok` JSON log lines on both live wakes |

## Phase 3 acceptance mapping

| Criterion | Status |
| --- | --- |
| Repeated dispatch | PASS (local x5 + two live dry-run wakes) |
| Duplicate event | PASS (lock harness + queued second live wake) |
| Runner restart | PASS (stop/start + online) |
| Temporary outage + reconnect | PASS (API offline → online) |
| Runner offline detection | PASS (API offline window; health workflow fail-closed design + unauthorized skip) |
| Cursor/wrapper failure signal | PASS (exit codes + skipped unauthorized wake) |
| Concurrent serialization | PASS (Actions concurrency + sequential runner jobs + lock) |
| No event loss in bounded window | PASS (both label wakes completed success with distinct delivery IDs) |

## Remaining follow-through (not Phase 3 blockers)

1. Trusted-actor (`wdhunter645`) manual dry-run/`CURSOR_DISPATCH` and health `CURSOR_RUNNER_HEALTH` proofs.
2. Clear host `LGFC_CURSOR_DISPATCH_DRY_RUN` only when authorizing a live Cursor invoke.
3. Durable `sudo ./svc.sh install` for reboot persistence.
4. Phase 4 Bridge retirement after Phase 3 acceptance.

## Rollback

Revert this PR (delete harness + report). Does not change Phase 2 workflows on `main` beyond evidence/docs.

## Recommendation

**PHASE 3 READY FOR PRODUCT AUTHORITY ACCEPTANCE** — proceed to Phase 4 only after explicit Phase 3 accept on #3212. Keep #3212 open across remaining phases.
