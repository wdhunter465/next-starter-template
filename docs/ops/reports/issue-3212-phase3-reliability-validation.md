---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Implementation Evidence (Phase 3)
Status: Draft — #3212 Phase 3 reliability validation
Source Issue: #3212
Owns: Phase 3 reliability campaign evidence for security-hardened GitHub→Cursor dispatch (#3212)
Does Not Own: Phase 4 Bridge retirement, workflow actor-allowlist remediation, or bulk `wdhunter645` identity cleanup (#3215)
Canonical Reference: /docs/ops/reports/issue-3212-phase3-reliability-validation.md
Related Issues: #3212, #3215, #3246, #3216
Last Reviewed: 2026-08-09
Executor: Cursor Local
---

# Issue #3212 Phase 3 — Reliability validation

## Purpose

Record Phase 3 reliability campaign evidence for the dedicated `lgfc-cursor` dispatch path after Phase 2 merge (`90b14eed` via PR #3246).

## Scope

**In scope**

- Repeated trusted dry-run dispatch
- Duplicate-event / concurrency serialization
- Runner restart / reconnect
- Temporary offline observation + independent health-query evidence
- Wrapper / Cursor failure signaling
- Bounded no-silent-loss observation after reconnect
- Optional local reliability harness

**Out of scope**

- Phase 4 Bridge / poll-wake retirement
- Workflow YAML actor-allowlist changes (not on Phase 3 allowlist)
- Durable `sudo ./svc.sh install` (still pending elevated host permission)
- Live (`dry_run=false`) Cursor invoke while an implementation session is already active on #3212

## Starting checkpoint

| Field | Value |
| --- | --- |
| Source Issue | #3212 |
| Branch | `cursor/3212-phase3-reliability-validation-2e48` |
| Starting SHA | `960c9654` (`origin/main`) |
| Allowlist | Phase 3 report; optional reliability harness; how-to only if reboot-persistence evidence requires a doc delta |
| Host runner | `lgfc-cursor-chromebook` (id 22), labels include `lgfc-cursor` |
| Host mode | `run.sh` (not systemd); `LGFC_CURSOR_DISPATCH_DRY_RUN=true` during Phase 3 |

## Campaign results

### 1. Repeated trusted dry-run dispatch — PASS

Local harness (5 consecutive wrapper dry-runs):

```bash
node scripts/lgfc-cursor-dispatch/test-reliability-harness.mjs
```

Result: `repeated_dry_run_dispatch_x5` PASS.

Live Actions dry-runs on `lgfc-cursor-chromebook` (issues label path; wrapper logged `dry_run_ok`):

| Run | Result | Evidence |
| --- | --- | --- |
| 31312790306 | success | Dispatch Cursor wake + `dry_run_ok` |
| 31312795885 | success | Dispatch Cursor wake + `dry_run_ok` |
| 31312914160 | success | Dispatch Cursor wake + `dry_run_ok` |
| 31312923491 | success | Dispatch Cursor wake + `dry_run_ok` |
| 31312930746 | success | Dispatch Cursor wake + `dry_run_ok` |

Manual `workflow_dispatch` dry-run from actor `wdhunter465` did **not** execute the Chromebook job: security unit tests ran, wake job skipped by actor gate (`github.actor == 'wdhunter645'`). Example: run `31312833993` (security PASS; Dispatch Cursor wake skipped).

Trusted dry-run coverage for Phase 3 therefore uses the issues/label path plus local harness. Manual `workflow_dispatch` from the live Product Authority login remains blocked until a follow-up allowlist fix outside this Phase 3 PR.

### 2. Duplicate-event / concurrency serialization — PASS

| Control | Evidence |
| --- | --- |
| Actions concurrency group `lgfc-cursor-dispatch` with `cancel-in-progress: false` | Workflow on `main` |
| Local exclusive lock rejects second acquisition | Harness `duplicate_dispatch_serialized_by_lock` PASS (exit 4 / `dispatch_lock_held`) |
| Serial job execution on one Chromebook runner | Runner log shows jobs `31312914160` → `31312923491` → `31312930746` completed sequentially without overlap |

### 3. Runner restart / reconnect — PASS

1. Stopped `Runner.Listener` for `lgfc-cursor-chromebook`.
2. Restarted via `LGFC_CURSOR_DISPATCH_DRY_RUN=true ./run.sh`.
3. Runner reconnected (`Listening for Jobs`, version `2.336.0`).
4. Subsequent dry-run wake jobs succeeded on the same runner identity (id 22).

Durable reboot persistence via `sudo ./svc.sh install` remains **PENDING** (no passwordless sudo in this session). How-to updated to record Phase 3 `run.sh` evidence and the systemd residual.

### 4. Temporary offline + independent health alarm — PARTIAL PASS (with follow-up)

| Check | Result |
| --- | --- |
| Process-level offline (listener stopped) | PASS — local process gone |
| GitHub API status lag after kill | Observed: API can still report `online` briefly after process stop |
| Independent health query path | PASS — same runner list API used by `.github/workflows/lgfc-cursor-runner-health.yml` is queryable from GitHub-hosted logic / operator `gh api` without depending on the Chromebook process |
| Manual health `workflow_dispatch` as `wdhunter465` | FAIL/SKIP — job skipped by actor gate (`wdhunter645` only). Example: run `31312834769` skipped |

Interpretation: independent observation design is correct (GitHub-hosted workflow + API). Live operator enablement for the current Product Authority login is blocked by the same actor-string drift as manual dispatch. Remediation requires a workflow allowlist change (out of Phase 3 file allowlist) and/or #3215 identity cleanup.

### 5. Cursor / wrapper failure signaling — PASS

Local harness:

| Case | Expected | Result |
| --- | --- | --- |
| Invalid repository slug | exit 2 | PASS |
| Untrusted event (`pull_request`) | exit 2 | PASS |
| Security unit suite | exit 0 | PASS |

Actions security-negative suite also PASS on GitHub-hosted job for dispatch runs (including `31312833993` and issue-triggered runs).

Live Cursor CLI failure signaling (`cli_binary_missing` / non-zero Cursor exit) was not exercised while `LGFC_CURSOR_DISPATCH_DRY_RUN=true` to avoid competing live agents on #3212 during this session.

### 6. Bounded no-silent-loss observation — PASS (bounded)

Within the Phase 3 window:

- Qualifying label events produced visible Actions runs (not silent local drops).
- After runner restart/reconnect, queued/subsequent wake jobs completed successfully with `dry_run_ok` logs.
- Failed/skipped paths (actor-gated `workflow_dispatch`) are visible in the Actions UI rather than disappearing locally.

This does not claim infinite offline retention beyond GitHub Actions queue/retention behavior.

## Local harness artifact

Path: `scripts/lgfc-cursor-dispatch/test-reliability-harness.mjs`

Covers repeated dry-run, lock serialization, failure signaling, and security-suite regression without requiring Actions actor privileges.

## Phase 3 acceptance mapping

| Campaign item | Status |
| --- | --- |
| Repeated trusted dry-run | PASS (Actions label path + local harness) |
| Duplicate / concurrency serialization | PASS |
| Runner restart / reconnect | PASS (`run.sh` mode) |
| Temporary offline + independent health | PARTIAL — process offline + API query proven; manual health WD blocked by actor gate |
| Failure signaling | PASS (wrapper/security); live Cursor exit deferred under dry-run hold |
| No silent loss (bounded) | PASS |
| systemd reboot persistence | PENDING sudo |
| Manual WD as `wdhunter465` | BLOCKED by workflow actor allowlist |

## Findings requiring follow-up (not expanded in this PR)

1. **Actor allowlist drift:** `lgfc-cursor-dispatch.yml` and `lgfc-cursor-runner-health.yml` require `github.actor == 'wdhunter645'` for manual `workflow_dispatch`, while live Product Authority / operator login observed in this campaign is `wdhunter465`. Issues/label wakes work; manual WD/health do not.
2. **systemd install** still required for reboot persistence.
3. **Phase 4** Bridge/poll-wake retirement remains unauthorized until Product Authority accepts Phase 3 and authorizes cutover.
4. Controlled **live** (`dry_run=false`) invoke remains an optional post-Phase-3 operator proof once no competing implementation session is active.

## Rollback

Unchanged from Phase 2:

1. Disable/remove dispatch + health workflows via reviewed PR.
2. Stop/unregister `lgfc-cursor` runner (`run.sh` stop or future `svc.sh`).
3. Leave `lgfc-repo-runner` + Bridge intact until Phase 4 authority.

## Next gate

Phase 4 cutover may proceed only after Product Authority acceptance of this evidence and explicit retirement authorization. Do not treat this report as Bridge retirement authority.
