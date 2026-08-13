---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Implementation Evidence (Phase 2)
Status: Draft — #3212 Phase 2 bounded prototype
Source Issue: #3212
Owns: Phase 2 bounded prototype evidence for security-hardened GitHub→Cursor dispatch (#3212)
Does Not Own: Phase 3 reliability campaign, Phase 4 Bridge retirement, or #3215 bulk identity cleanup
Canonical Reference: /docs/ops/reports/issue-3212-phase2-bounded-prototype.md
Related Issues: #3212, #3215, #3227
Last Reviewed: 2026-08-09
Executor: Cursor Local
---

# Issue #3212 Phase 2 — Bounded Cursor dispatch prototype

## Purpose

Record Phase 2 prototype delivery for replacing Cursor polling wake dependency with a dedicated `lgfc-cursor` runner, fail-closed dispatch workflow, identifiers-only local wrapper, and GitHub-hosted offline observation.

## Scope

**In scope**

- Runner contract + host registration how-to
- Dispatch workflow with trusted triggers only
- Fixed wrapper + security-negative unit tests
- Independent `ubuntu-latest` runner health workflow
- Evidence of Phase 1 acceptance and remaining host/enablement gates

**Out of scope**

- Legacy Bridge retirement (Phase 4)
- Full reliability campaign (Phase 3)
- Bulk `wdhunter645` repository-slug cleanup (#3215)

## Current known truth

1. Phase 1 design evidence is on `main` via PR #3216 (`docs/ops/reports/issue-3212-phase1-cursor-runner-dispatch-security-design.md`).
2. Existing `lgfc-repo-runner` remains delivery/health only and must not gain Cursor launch authority.
3. Phase 2 repository artifacts land in this change set under source Issue #3212.
4. Host registration of a second runner labeled `lgfc-cursor` is required before a live (non-dry-run) wake can complete on the Chromebook.
5. Post-merge exception #3227 for PR #3216 is a clerical reviewer-disposition defect and does not invalidate Phase 1 design content; #3212 correctly remains open across phases.

## Delivered artifacts

| Artifact | Path |
| --- | --- |
| Runner contract | `config/github-actions/cursor-dispatch-runner.json` |
| Dispatch workflow | `.github/workflows/lgfc-cursor-dispatch.yml` |
| Independent health workflow | `.github/workflows/lgfc-cursor-runner-health.yml` |
| Wrapper | `scripts/lgfc-cursor-dispatch/dispatch.mjs` |
| Security tests | `scripts/lgfc-cursor-dispatch/test-dispatch-security.mjs` |
| Registration how-to | `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md` |

## Security controls implemented

| Control | Evidence |
| --- | --- |
| No `pull_request` / `pull_request_target` triggers | Workflow YAML + unit test |
| Checkout trusted `main` only | Dispatch job checkout step |
| Identifiers-only argv + prompt | `lib/argv.mjs` + wrapper |
| Reject unexpected repo / event / injection flags | Unit tests |
| Exclusive local lock | `acquireDispatchLock` |
| Dirty worktree fail-closed | Preflight (override only for dry-run unit tests) |
| No `--yolo` / `--force` | Wrapper invoke path |
| Independent offline observation | Health workflow on `ubuntu-latest` |
| Actor allowlist for manual dispatch | `github.actor == 'wdhunter645'` + confirmation string |

## Validation performed

Local:

```bash
node scripts/lgfc-cursor-dispatch/test-dispatch-security.mjs
```

Expected: all PASS.

## Host registration status

Recorded 2026-08-09 on Chromebook Linux VM (`penguin`):

| Check | Status |
| --- | --- |
| `lgfc-repo-runner` online | PASS — `lgfc-chromebook-linux` |
| `lgfc-cursor` registered | PASS — `lgfc-cursor-chromebook` (agentId 22), labels `self-hosted,linux,x64,lgfc-cursor` |
| Runner online via API | PASS |
| Durable systemd install | PENDING sudo — currently started via `~/actions-runners/lgfc-cursor/run.sh` (needs `sudo ./svc.sh install` for reboot persistence) |
| Manual dry-run dispatch proof | PENDING after this PR merges to `main` (workflow checks out `main`) |
| Live Cursor invoke proof | PENDING after dry-run proof |

## Phase 2 acceptance mapping

| Criterion | Status |
| --- | --- |
| Dedicated runner identity defined | Done (contract + how-to) |
| Tightly restricted dispatch workflow | Done |
| Fixed local wrapper | Done |
| Untrusted event/PR path absent | Done (tests + YAML) |
| Trusted wake proof | Host runner registered/online; dry-run/live proofs pending post-merge `main` workflow |
| Negative actor/event proof | Covered by unit tests + workflow `if:` gates |
| Independent offline visibility | Done (health workflow) |

## Rollback

1. Disable/remove dispatch + health workflows via reviewed PR.
2. Unregister `lgfc-cursor` runner on host.
3. Leave `lgfc-repo-runner` + Bridge intact.

## Next phase gate

Phase 3 starts only after:

1. `lgfc-cursor` is registered and online
2. Manual dry-run dispatch succeeds
3. At least one trusted live wake is observed
4. Health workflow reports ONLINE
