---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Implementation Evidence (Phase 4)
Status: Draft — #3212 Phase 4 Bridge cutover
Source Issue: #3212
Owns: Phase 4 cutover evidence retiring Bridge/poll-wake as Cursor execution dependencies and promoting lgfc-cursor dispatch
Does Not Own: Deleting the entire Bridge package/tests, actor-allowlist expansion to wdhunter465, or durable `svc.sh` install
Canonical Reference: /docs/ops/reports/issue-3212-phase4-bridge-cutover.md
Related Issues: #3212
Last Reviewed: 2026-08-09
Executor: Cursor Local
---

# Issue #3212 Phase 4 — Bridge / poll-wake cutover

## Purpose

Retire the Cursor Local Bridge automatic wake path and the local 12-minute poll-wake loop as **execution dependencies**, promote `lgfc-cursor-dispatch` as primary local transport, preserve an explicitly gated diagnostic fallback, and update canonical routing documentation without duplicate authority.

## Scope

**In scope**

- Disable automatic `issues` wake delivery; keep trusted diagnostic `workflow_dispatch`
- Remove scheduled/push Bridge watch triggers; keep manual watch dispatch
- Flip runner contracts (`wakeDelivery.enabled: false`, dispatch `legacyBridgeRetirement: retired-phase-4`)
- Update health gate to accept retired wakeDelivery
- Update binding routing docs / how-tos / AGENTS bootstrap
- Stop/disable host Bridge units; mark poller retired on host

**Out of scope**

- Deleting `scripts/cursor-bridge/**` (wake-ingress still required by dispatch)
- Changing trusted actor allowlist (`wdhunter645`)
- Live non-dry-run Cursor invoke policy change

## Delivered changes

| Area | Change |
| --- | --- |
| Wake workflow | Automatic labeled delivery removed; diagnostic confirmation `CURSOR_WAKE_DIAGNOSTIC` required |
| Bridge watch | Cron/push removed; manual only |
| `repository-runner.json` | `wakeDelivery.enabled: false`, rollout `wake-delivery-retired-phase-4` |
| `cursor-dispatch-runner.json` | `phase-4-primary`, `legacyBridgeRetirement: retired-phase-4` |
| Runner health | Accepts enabled false when rollout state matches |
| Routing standard | Primary = lgfc-cursor dispatch |
| Host | Bridge service inactive; poller `RETIRED-3212-PHASE4.txt` written |

## Diagnostic fallback (explicitly approved)

Trusted actor `wdhunter645` may run `cursor-local-wake.yml` with confirmation `CURSOR_WAKE_DIAGNOSTIC` for temporary Bridge packet diagnostics. This is **not** an automatic execution path.

## Host evidence (2026-08-09)

| Check | Result |
| --- | --- |
| `lgfc-cursor-bridge.service` | inactive (stopped) |
| Bridge `bridge.mjs` / `watchdog.mjs` processes | cleared |
| `~/.cursor/github-poller/RETIRED-3212-PHASE4.txt` | present |
| `lgfc-cursor-chromebook` | remains the primary wake runner (Phase 2/3) |

## Acceptance mapping

| Criterion | Status |
| --- | --- |
| Retire/disable legacy Cursor polling bridge as execution dependency | PASS |
| Retire 12-minute loop-wake as execution dependency | PASS |
| Preserve approved diagnostic fallback only | PASS |
| Update canonical agent/ops docs without duplicate authority | PASS |
| Keep wake-ingress for dispatch | PASS |

## Rollback

1. Revert this PR on `main`.
2. Set `wakeDelivery.enabled: true` and restore wake/watch triggers from prior revision.
3. `systemctl --user enable --now lgfc-cursor-bridge.service` (+ watchdog timer) only if PA re-authorizes Bridge.
4. Do not restart poll-wake as primary without PA decision.

## Recommendation

**PHASE 4 READY FOR PRODUCT AUTHORITY ACCEPTANCE.** After accept/merge, #3212 may close complete. Next ops-queue issue proceeds only after this PR merges (or PA redirects).
