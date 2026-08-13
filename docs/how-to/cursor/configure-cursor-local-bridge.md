---
Doc Type: How-To
Audience: Bill, ChatGPT, Day-2 Operations
Authority Level: Operational Procedure
Owns: Chromebook install, auth preflight, systemd enablement, transactional launch verification, heartbeat/watchdog/reconciliation verification, and rollback for Cursor Local Bridge
Does Not Own: Wake workflow gates, runner registration, or Background Agents
Canonical Reference: /docs/reference/ci/cursor-local-bridge-contract.md
Related Issues: #2294, #2667, #2669, #2681, #2694, #2739, #2746, #2814, #2997, #3013, #3212, #3424
Last Reviewed: 2026-08-13
---

# Configure Cursor Local Bridge

## Status (#3212 Phase 4 / #3424)

**Decommissioned / superseded as the primary Cursor auto-start path.** Product Authority (#3424) records Bridge as operationally down for primary local auto-start. Automatic wake-packet delivery is disabled; host Bridge systemd units should remain stopped/disabled unless Product Authority authorizes temporary diagnostics. Primary wake: `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`.

This how-to remains for rollback/diagnostic install of the Bridge package only.

## Purpose

Install the host Bridge that historically consumed wake packets from the Chromebook Actions runner and launched an authenticated local Cursor Agent after a positive lifecycle acceptance event.

Design rationale: `docs/explanation/operations/cursor-local-auto-start-architecture.md`.

## Prerequisites

1. Repository runner `lgfc-chromebook-linux` is online.
2. `cursor agent` / `agent` is installed.
3. CLI auth works through `cursor agent login` or an approved systemd user environment. Never commit a key.
4. One manual non-interactive structured-output run succeeds before auto-start is enabled.

## Procedure

Execute the following sections in order on the Chromebook host. Do not skip auth proof before enabling auto-start, and do not mark #2739 host closeout complete until the stalled-connection and service-restart verifications pass.

1. Authenticate and prove the local CLI.
2. Install the Bridge service and watchdog.
3. Confirm configuration controls.
4. Verify wake delivery without launch.
5. Verify successful transactional launch.
6. Verify stalled-connection recovery.
7. Verify service restart recovery.
8. Verify heartbeat, watchdog, and reconciliation.
9. Use service control and rollback only when authorized.

## Acceptance evidence status

| Criterion | Status | Authority |
| --- | --- | --- |
| Independently reviewed Production merge of the Bridge launch-acceptance fix to `main` | Satisfied — PR #2740 merged at `b351d7712350005bdbad652cb7d1f795a4d773a4` | #2739 / #2746 |
| Chromebook reset/reconnect, deliberate-stall, service-restart, and post-install direct-host verification | Pending — keep #2739 open; track under #2694 | #2739 / #2694 / #2746 |
| Crash-consistent in-flight clear after durable requeue/archive; distinct launch-retry and accepted-run fallback classifications | Addressed by #2746 remediation (repository fix; host soak still pending under #2694) | #2746 |

Do not close #2739 or authorize Production routing expansion from documentation updates alone.


## Verify preflight readiness (#2681)

```bash
export LGFC_CURSOR_BRIDGE_HOME="${LGFC_CURSOR_BRIDGE_HOME:-$HOME/lgfc-cursor-bridge}"
node "$LGFC_CURSOR_BRIDGE_HOME/scripts/bridge.mjs" preflight
node "$LGFC_CURSOR_BRIDGE_HOME/scripts/bridge.mjs" status | jq '.bridge.lastPreflight'
```

A non-ready result must not claim work. Periodic preflight reuses `lgfc-cursor-bridge-watchdog.timer` (no second timer). Rollback: set `"preflight": { "enforce": false }` in `bridge.json` for status-only mode, or revert the #2681 change and reinstall the prior Bridge revision while preserving queue/claim/consumed/heartbeat state.

## Authenticate and prove the local CLI

```bash
export PATH="$HOME/.local/bin:$PATH"
cursor agent login
cursor agent status
```

If status is not authenticated, the Bridge must not consume a handoff.

Manual structured proof:

```bash
cursor agent -p "Respond with the single word OK" \
  --output-format stream-json \
  --workspace "$PWD" \
  --trust
```

Confirm the stream begins with a valid event containing:

```json
{"type":"system","subtype":"init","session_id":"..."}
```

The Bridge treats that event—not process spawn or connection-window display—as agent acceptance.

## Install the Bridge service and watchdog

From the repository root on the approved revision:

```bash
bash scripts/cursor-bridge/install.sh
node ~/lgfc-cursor-bridge/scripts/bridge.mjs status
systemctl --user status lgfc-cursor-bridge.service
systemctl --user status lgfc-cursor-bridge-watchdog.timer
```

Confirm:

- `cursorCliAuth.ok` is `true`;
- Bridge service is active;
- watchdog timer is active;
- `bridge.heartbeat` is fresh;
- `launchTransaction.state` is `none` when idle;
- `claim.state` is `none` when idle.

## Configuration controls

Host config is `~/lgfc-cursor-bridge/bridge.json`, copied from `config/cursor-bridge/bridge.json`.

| Key | Default | Role |
| --- | ---: | --- |
| `inFlightPath` | `in-flight.json` | Atomic spawned/accepted/running transaction record |
| `launchStartupTimeoutSeconds` | `60` | Maximum wait for Cursor `system/init` |
| `launchExecutionTimeoutSeconds` | `7200` | Overall agent-process limit |
| `launchHeartbeatIntervalSeconds` | `5` | Heartbeat cadence during active work |
| `launchRetryBaseSeconds` | `30` | Initial pre-accept retry delay |
| `launchRetryMaxSeconds` | `900` | Maximum pre-accept retry delay |
| `reconcileEnabled` | `true` | Missed-handoff recovery switch |
| `reconcileIntervalSeconds` | `900` | Recovery cadence |
| `watchdog.heartbeatStaleSeconds` | `90` | Bridge restart threshold |
| `watchdog.opsFaultIssueNumber` | `null` | Optional debounced Operations fault target |
| `maintenance.identityPath` | `package-identity.json` | Recorded installed commit + package hashes |
| `maintenance.resultPath` | `maintenance-result.json` | Last Bridge Watch/Build classification |

Schema: `config/cursor-bridge/bridge.schema.json`.

## Verify Bridge Watch and Bridge Build (#2814)

```bash
export LGFC_CURSOR_BRIDGE_HOME="${LGFC_CURSOR_BRIDGE_HOME:-$HOME/lgfc-cursor-bridge}"
node "$LGFC_CURSOR_BRIDGE_HOME/scripts/bridge.mjs" status | jq '{packageIdentity,lastMaintenance,claim,launchTransaction}'
node scripts/cursor-bridge/bridge-watch.mjs check
# Authorized rebuild only when the serial lane is idle:
# node scripts/cursor-bridge/bridge-build.mjs <immutable-main-sha>
```

Healthy Watch results stay quiet. Active claim / `cli_spawned` / accepted / running state must classify as `rebuild_deferred` with no live promotion. Prefer isolated staging rehearsals while an Implementation run is active; do not mutate the live installation until the lane is idle.

Operator-visible fallback comment prefixes are distinct by class:

- mechanical eligibility/claim failures: `CURSOR BRIDGE FALLBACK: unclaimed`
- pre-accept launch retries: `CURSOR BRIDGE FALLBACK: launch-retry`
- post-accept duplicate-risk failures: `CURSOR BRIDGE FALLBACK: accepted-run-failure`

There is no comment-marker requirement (#3013): mechanical eligibility is decided from Issue labels/status only. Queue-routing/parent-project classification is delivered to Cursor as an informational finding, not a Bridge unclaimed fallback.

## Verify wake delivery without launch

```bash
bash scripts/cursor-bridge/write-wake-packet.sh <mechanically-ineligible-issue-number> manual-test-1 manual wdhunter645
node ~/lgfc-cursor-bridge/scripts/bridge.mjs once
```

Expected for mechanical ineligibility (closed Issue, missing `agent:cursor`, wrong repository): explicit eligibility fallback; no claim, consumed marker, in-flight transaction, or Cursor process.

ChatGPT/Atlas-directed, Claude/Claude Code-directed, other-agent, and unrelated GitHub traffic must never write a Chromebook Bridge wake packet. `.github/workflows/cursor-local-wake.yml` invokes `shouldDeliverCursorWake` from `scripts/cursor-bridge/lib/wake-ingress.mjs` before queue write. Those other lanes use their own notification paths.

A trusted open Issue with `agent:cursor` + `handoff:ready` must launch regardless of comment content — there is no comment-marker gate to satisfy (#3013).

## Verify successful transactional launch

Use a temporary bounded test Issue with `agent:cursor` and `handoff:ready`. No resume/response comment is needed or read for eligibility; Cursor reads any existing comments as ordinary context only after launch.

Observe in order:

1. Wake workflow writes a local queue packet only — **no** routine `CURSOR BRIDGE ACK` Issue comment.
2. Local status may briefly show `launchTransaction.state: cli_spawned`.
3. There is **no** repository-visible Bridge STARTED telemetry yet (acceptance is local-only).
4. Cursor emits `system/init`.
5. Status shows `launchTransaction.state: running`, `acceptedAt`, and `sessionId`.
6. Cursor updates Issue status to `status:implementation` (shared lifecycle; Bridge does not post `CURSOR BRIDGE STARTED`).
7. The agent evaluates live Issue/comment context and either performs one bounded action or posts hold/correction/no-action.
8. Cursor posts `IMPLEMENTATION HANDOFF` (or disposition) and updates Issue status to `status:review` (or matching hold status). Bridge does **not** post `CURSOR BRIDGE COMPLETED`.
9. Claim and in-flight state clear locally; the delivery key is consumed exactly once.

Useful commands:

```bash
node ~/lgfc-cursor-bridge/scripts/bridge.mjs status | jq '{bridge,launchTransaction,claim,queue}'
journalctl --user -u lgfc-cursor-bridge.service -f
ls -la ~/lgfc-cursor-bridge/queue ~/lgfc-cursor-bridge/consumed
```

Per-run logs contain event metadata only. They must not contain prompts, assistant text, tokens, or API keys.

## Verify stalled-connection recovery

This test is mandatory for #2739 closeout and must use a bounded test handoff. Keep the criterion pending under #2694 until the Chromebook host proves it.

1. Configure a short temporary `launchStartupTimeoutSeconds` suitable for the test.
2. Create or simulate a Cursor connection that spawns but does not emit `system/init`.
3. Deliver the eligible packet.
4. Confirm:
   - no routine Bridge ACK/STARTED/COMPLETED telemetry comments are posted;
   - no consumed-resume marker is created;
   - the child is terminated at startup timeout;
   - the claim is released;
   - the same packet returns to `queue/` with `launchAttempts`, `lastLaunchFailure`, and future `notBefore`;
   - only one `CURSOR BRIDGE FALLBACK: launch-retry` comment is posted for the packet (actionable fault);
   - in-flight is cleared only after the packet is durably restored to `queue/`.
5. Restore the normal timeout and restart the service.
6. Confirm the packet is retried after `notBefore` and can complete after Cursor accepts it.

Do not repeatedly test against a real implementation Issue. Use a disposable bounded soak Issue.

## Verify service restart recovery

### Restart before acceptance

1. Deliver a test packet and stop/restart the Bridge while state is `cli_spawned` and `acceptedAt` is null.
2. Confirm the claim clears and the processing packet is restored to bounded retry.
3. Confirm no consumed marker or duplicate agent exists.
4. Confirm in-flight clears only after durable requeue.

### Restart after acceptance

1. Deliver a bounded test that reaches `running`.
2. Restart the Bridge during execution only in a safe disposable test.
3. Confirm the resume remains consumed and no automatic duplicate launches.
4. Confirm the packet is archived as interrupted after acceptance and `CURSOR BRIDGE FALLBACK: accepted-run-failure` is posted.
5. Confirm in-flight clears only after the packet is moved to `consumed/`.

## Verify heartbeat and watchdog

```bash
node ~/lgfc-cursor-bridge/scripts/bridge.mjs status | jq '.bridge.heartbeat'
node ~/lgfc-cursor-bridge/scripts/watchdog.mjs check
```

During a long-running accepted agent, `bridge.heartbeat.updatedAt` must continue advancing and `bridge.activeLaunch` must remain present. The watchdog must not restart a healthy Bridge merely because `processPacket()` is awaiting child completion.

To test stale-Bridge recovery on a non-production soak:

```bash
systemctl --user stop lgfc-cursor-bridge.service
node ~/lgfc-cursor-bridge/scripts/watchdog.mjs check
systemctl --user status lgfc-cursor-bridge.service
```

Healthy intervals must not create GitHub comments.

## Verify reconciliation

```bash
node ~/lgfc-cursor-bridge/scripts/bridge.mjs reconcile
```

The sweep queues a recovery packet only for a fully eligible resume lacking pending or consumed evidence. Deferred pre-accept retry packets count as pending. Reconciliation never launches Cursor directly.

## Service control

```bash
systemctl --user status lgfc-cursor-bridge.service
systemctl --user restart lgfc-cursor-bridge.service
systemctl --user status lgfc-cursor-bridge-watchdog.timer
journalctl --user -u lgfc-cursor-bridge.service -n 100 --no-pager
journalctl --user -u lgfc-cursor-bridge-watchdog.service -n 50 --no-pager
```

## Stop, disable, or roll back

Stop automatic launch while preserving packets:

```bash
systemctl --user stop lgfc-cursor-bridge.service
```

Disable watchdog:

```bash
systemctl --user disable --now lgfc-cursor-bridge-watchdog.timer
```

Disable reconciliation:

```bash
# edit ~/lgfc-cursor-bridge/bridge.json and set reconcileEnabled=false
systemctl --user restart lgfc-cursor-bridge.service
```

Disable Bridge entirely:

```bash
systemctl --user disable --now lgfc-cursor-bridge.service
```

Preserve `queue/`, `consumed/`, `claim.json`, `in-flight.json`, `heartbeat.json`, runtime metadata, and logs unless cleanup is proven safe. Manual Cursor pickup remains the fallback operating path.

Do not remove the Actions runner unless `.github/workflows/cursor-local-wake.yml` is also disabled through authorized change control.

## Related

- `docs/explanation/operations/cursor-local-auto-start-architecture.md`
- `docs/reference/ci/cursor-local-bridge-contract.md`
- `docs/how-to/ci/configure-lgfc-repository-runner.md`
- `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`
