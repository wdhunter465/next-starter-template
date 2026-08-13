---
Doc Type: Reference
Audience: Human + AI
Authority Level: Superseded
Owns: Historical Cursor Local Bridge component inventory, eligibility auto-start gates, transactional launch acceptance, wake-packet authority boundary, health/watchdog/reconciliation contract, and fallback taxonomy
Does Not Own: Current Cursor auto-start routing, Product decisions, PR approval, Background Agents, or unrestricted workflow migration onto the Chromebook runner
Canonical Reference: /docs/governance/standards/CURSOR-RUNTIME-ROUTING.md
Related Issues: #2294, #2667, #2669, #2681, #2694, #2739, #2814, #2997, #3013, #3212, #3424
Last Reviewed: 2026-08-13
---

# Cursor Local Bridge Contract

## Status (#3212 Phase 4 / #3424)

**Decommissioned / superseded.** Cursor Local Bridge is not the current primary auto-start contract. Automatic wake-packet delivery is disabled (`wakeDelivery.enabled: false`). Primary transport is `lgfc-cursor-dispatch` / `config/github-actions/cursor-dispatch-runner.json`. This document remains the historical Bridge package contract and documents the approved diagnostic fallback (`workflow_dispatch` + `CURSOR_WAKE_DIAGNOSTIC`). Shared module `scripts/cursor-bridge/lib/wake-ingress.mjs` remains live for dispatch routing.

## Purpose

Define the **Cursor Local Bridge** package that historically turned trusted GitHub wake delivery into an authenticated local `cursor agent` launch after mechanical safety gates — or an explicit unclaimed fallback when those mechanical gates fail. Semantic task readiness is evaluated by Cursor (#2997).

The Chromebook `lgfc-repo-runner` path is **no longer the primary Cursor wake bus** after Phase 4.

Conceptual architecture and as-built evidence: `docs/explanation/operations/cursor-local-auto-start-architecture.md`.

## Component inventory

Every component has a role. No infrastructure may be introduced without purpose, inputs, outputs, and dependencies.

| Component | Purpose | Inputs | Outputs | Dependencies |
| --- | --- | --- | --- | --- |
| Source Issue | Task authority | Labels (`agent:cursor`, `handoff:ready`) and status | Live state Bridge re-reads | Governance handoff contracts |
| Wake workflow (`.github/workflows/cursor-local-wake.yml`) | Near-real-time delivery | Trusted `issues` (`labeled`) / manual dispatch | Host wake packet JSON | `lgfc-repo-runner` |
| Actions runner service | Host job receiver | Jobs with `lgfc-repo-runner` | Process that can write packets | systemd runner unit |
| Wake packet queue (`~/lgfc-cursor-bridge/queue/`) | Decouple job vs agent lifetime | Packets from wake workflow or reconciliation recovery | Files for Bridge | Host user permissions |
| Cursor Local Bridge (`scripts/cursor-bridge/bridge.mjs`) | Historical Cursor launcher and supervisor (decommissioned) | Packets, live Issue via `gh`, claim store, CLI auth | Transactional launch, local evidence, actionable fallback, heartbeat | `gh`, `cursor agent`/`agent` |
| Launch transaction (`in-flight.json`) | Distinguish process spawn from agent acceptance | Claim, packet, Cursor stream events | `cli_spawned`, `running`, recovery disposition | Atomic local storage |
| Local heartbeat | Prove useful Bridge health during idle and active launches | Watch-loop and launch state | `heartbeat.json` (atomic, mode `0600`) | Bridge process |
| Local watchdog (`watchdog.mjs` + systemd timer) | Detect hung/stale Bridge and restart or alert | Heartbeat age, service, queue, workspace, `gh`/CLI auth, claim TTL, disk | Local restart/alert; optional debounced GitHub ops fault | systemd user timer |
| Bridge Watch (`bridge-watch.mjs` + `cursor-bridge-watch.yml`) | Classify health and repository-to-host package drift | Installed package hashes, claim/in-flight, heartbeat, units | `healthy` / `rebuild_required` / `rebuild_deferred` / `manual_review_required` / `failed` | Host Bridge home + `main` checkout |
| Bridge Build (`bridge-build.mjs` + `cursor-bridge-build.yml`) | Stage, validate, atomically promote, or roll back Bridge package | Immutable `main` commit SHA | Promoted package identity or automatic restore | Idle serial lane; same-filesystem rename |
| Missed-handoff reconciliation | Recover mechanically routable handoffs when wake packet was missed | `reconcileIntervalSeconds` cadence + live Issue mechanical eligibility | Recovery packet into normal queue | `gh`, mechanical eligibility contract |
| Eligibility validator | Mechanical fail-closed + informational findings for Cursor | Issue labels/status (comments not required) | mechanical ok/errors + informational findings | Delivery-first checklist below |
| Serial claim store | One Implementation stream | Claim requests | Exclusive lease | Local `claim.json` |
| Local Cursor CLI | Execute one bounded action | Bridge prompt + workspace | NDJSON lifecycle events, result, exit | Cursor login or `CURSOR_API_KEY` |
| Notify fallback | Operator-visible failure | Failure class | Desktop/log + Issue comment | `notify-send` optional |
| Preflight engine (`lib/preflight.mjs`) | Fail-closed readiness before claim/launch | Injected or host probes | Taxonomy result + `lastPreflight` | Bridge home, watchdog timer |
| Status command (`bridge.mjs status`) | Bidirectional readiness view | Local Bridge + auth surfaces | Secret-safe JSON status | Host only |
| Poll-wake loop | Retired backup detector (not current wake) | GitHub poll | Stdout sentinel only | Open IDE chat |

## Historical primary, recovery, and health paths

The following paths describe the **decommissioned** Bridge package. They are not the current Cursor wake bus.

```text
Historical Bridge path:
GitHub event -> wake workflow -> repository runner -> local packet -> Bridge
  -> eligibility -> claim -> CLI spawn -> system/init acceptance -> running

Recovery path:
local slow reconciliation -> detect missed eligible handoff -> local packet -> normal Bridge processing

Health path:
local heartbeat <- Bridge watch loop and active launch monitor
local watchdog -> restart or alert (GitHub ops fault only when persistent/actionable)
Bridge Watch -> classify drift/health; quiet when healthy
Bridge Build -> stage/validate/promote or restore prior package (idle lane only)
```

Rules (historical Bridge package; do not treat as current routing):

- Event-driven Bridge wake delivery is **not** the current primary path. Current primary transport is `lgfc-cursor-dispatch` (`docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`).
- Reconciliation is recovery only, rate-limited (`reconcileIntervalSeconds`, default `900`), and fail-closed on API/ambiguity.
- Reconciliation must not launch Cursor, bypass the packet path, reinterpret authority, or claim beyond the serial lane.
- Routine healthy checks stay local and quiet — no synthetic GitHub keepalive traffic.
- `cursor-local-wake.yml` remains delivery-only and must not own rebuild behavior.
- Bridge Build refuses promotion while a claim, `cli_spawned`, accepted, or running transaction exists.
- Runtime evidence (`queue/`, `consumed/`, `claim.json`, `in-flight.json`, `heartbeat.json`, `runtime-meta.json`, alerts/logs/preflight/watchdog state) is never deleted by rebuild.

## Eligibility (label/status-driven — #2997, simplified #3013)

The following eligibility rules describe the **decommissioned** Bridge package. Current Cursor wake uses `lgfc-cursor-dispatch`; labels/status remain the routing signal (`docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`).

Historically, the Bridge was the secure transport, host-readiness, deduplication, and serial-concurrency controller. It was **not** the final semantic task-authority decision-maker. Trusted Cursor-routed notifications still reach Cursor for evaluation through the current dispatch path unless a mechanical safety gate prevents launch.

There is **no comment-marker protocol**. The Bridge does not parse, search for, or require any specific text in an Issue comment (no `LOCAL CURSOR RESUME`, `CHATGPT RESPONSE`, `Action:`/`Response:` line forms, or resume/issue chronology matching). Comments are read by Cursor as ordinary context after launch, the same way Cursor reads the Issue body — they carry no routing or gating authority. Routing and gating are decided **only** from the Issue's current labels and status.

### Locked routing rule (Cursor-only Chromebook Bridge queue)

Routing is by intended agent identity, not semantic task readiness:

| Traffic | Chromebook Bridge queue / Cursor launch |
| --- | --- |
| `agent:cursor` + `handoff:ready` both present on the Issue | Must cross when mechanical safety allows |
| `agent:cursor` + any other `agent:*` (mixed routing) | Must not enter — fail closed with `conflicting_agent_routing_labels:<sorted>` |
| `agent:engineering` or other non-Cursor `agent:*` labels | Must not enter |
| ChatGPT/Atlas-directed notifications (`agent:ChatGPT`, …) | Must not enter |
| Claude/Claude Code-directed notifications (`agent:claude`, …) | Must not enter |
| Generic unrelated GitHub Issue/PR/workflow/review/bot activity | Must not enter |

Canonical ingress predicate: `scripts/cursor-bridge/lib/wake-ingress.mjs` (`shouldDeliverCursorWake`). Wake workflow `.github/workflows/cursor-local-wake.yml` must invoke that predicate before writing a Chromebook queue packet (job-level `if:` is only a coarse filter). The only trigger is an `issues` `labeled` event where the label applied is `agent:cursor` or `handoff:ready` **and** the Issue's current label set carries both (order-independent — whichever of the two labels lands second is the one that fires delivery), plus authorized manual dispatch. There is no `issue_comment` trigger. Claude Code wake (`.github/workflows/claude-code-wake.yml`) is a separate notification path and must never write Chromebook Bridge packets.

### Mechanical gates (Bridge may reject before launch)

1. Source Issue is present and open (`open` / `OPEN`; null Issue fails closed).
2. Required routing labels from Bridge config are present (default: `agent:cursor` and `handoff:ready`).
3. Positive Cursor routing signal is present (`agent:cursor`), and **exactly one** `agent:*` label is present. Multiple/conflicting `agent:*` labels fail closed with deterministic reason `conflicting_agent_routing_labels:<sorted-labels>` (#3013 remediation). Non-Cursor-only `agent:*` traffic is rejected as `non_cursor_directed_traffic`.
4. Issue does not already carry an already-handed-off status label (`status:review`, `status:complete`, `status:post-merge-verify`) — a stale label/status pairing does not re-launch a finished handoff. `status:implementation` does not block (Cursor may still be actively working it).
5. Repository matches the configured expected repository (`wdhunter465/next-starter-template`).
6. Serial lane has no active conflicting claim.
7. Delivery key is not already consumed (wake packet `deliveryId`; otherwise issue-number fallback). Unsafe delivery identities are encoded as a stable SHA-256 digest of the complete original value (`enc-<hex>`) before use in `consumed/`, recovery filenames, and claims — never a truncated reversible encoding.
8. Bridge, workspace, GitHub, and Cursor authentication/preflight readiness succeed.
9. Wake packet Issue identity is valid and the wake source is trusted.

### Informational findings (Bridge delivers to Cursor; does not reject)

Cursor evaluates live Issue/comment context after launch and returns act, hold, correction-needed, or no-action. The Bridge records only queue-routing / parent-project classification outcomes as informational findings in the launch prompt (not as repository-visible Bridge telemetry comments) — there is no comment-marker finding of any kind.

Reconciliation applies the same mechanical Cursor-routing contract before writing a recovery packet (issues listed with required Cursor labels only, not already handed off). Deduplication keys are sanitized delivery keys (packet `deliveryId`, else issue identity).

## Shared operational lifecycle (#2997 design simplification)

The GitHub Issue is the sole shared operational status surface for Cursor Local work. The Bridge is transport, launch safety, deduplication, and local runtime control only.

Repository-visible lifecycle:

1. Engineering assigns Cursor by applying routing labels (`agent:cursor` + `handoff:ready`) — no resume comment is required or read by the Bridge.
2. After Cursor accepts the session, Cursor updates the Issue to the canonical in-progress status (`status:implementation`).
3. Cursor performs the work.
4. On finish, Cursor posts an `IMPLEMENTATION HANDOFF` and updates the Issue to the canonical Engineering-review status (`status:review`).
5. On hold/correction/no-action, Cursor posts that disposition and updates the Issue to the matching canonical status.

Prohibited routine Bridge telemetry comments:

- `CURSOR BRIDGE ACK`
- `CURSOR BRIDGE STARTED`
- `CURSOR BRIDGE COMPLETED`

Retain local safety/diagnostics (`queue/`, `consumed/`, `claim.json`, `in-flight.json`, heartbeat, retry, watchdog, Bridge Watch/Build). Retain actionable GitHub fault reporting only when local recovery fails or human intervention is required (`CURSOR BRIDGE FALLBACK:*` and watchdog ops faults). `Bridge up/healthy` plus Issue status transitions are sufficient shared evidence. Cursor's `IMPLEMENTATION HANDOFF` or explicit disposition is the authoritative work result.

## Transactional launch acceptance

An operating-system process spawn is **not** proof that Cursor accepted work.

```text
DELIVERED -> ELIGIBLE -> CLAIMED -> CLI_SPAWNED -> AGENT_ACCEPTED -> RUNNING -> COMPLETED
```

Mandatory behavior:

1. Launch Cursor in non-interactive `stream-json` mode.
2. Record `CLI_SPAWNED` in atomic `in-flight.json`; do not mark the resume consumed yet.
3. Treat the first valid Cursor event with `type: system` and `subtype: init` as `AGENT_ACCEPTED`.
4. Only after acceptance:
   - mark the resume consumed exactly once;
   - update the in-flight record to `running` with the Cursor session id;
   - record acceptance locally (log/heartbeat/in-flight) — do not post routine `CURSOR BRIDGE STARTED`.
5. Continue heartbeat updates while the child runs.
6. On success, release the claim, clear in-flight state, and archive the packet locally — do not post routine `CURSOR BRIDGE COMPLETED`.

### Pre-accept failure

Startup timeout, connection failure, authentication transition, CLI crash, or exit before `system/init` must:

- terminate the child safely;
- release the claim;
- leave the resume unconsumed;
- requeue the same packet with bounded exponential backoff;
- post at most one actionable fallback for that packet;
- preserve secret-safe local diagnostics.

A Bridge restart with `cli_spawned` and no `acceptedAt` restores the processing packet to the retry path.

### Post-accept failure

After acceptance, automatic retry is prohibited because work may have mutated the repository. The Bridge keeps the resume consumed, releases the claim, archives the interrupted packet, and posts a manual-verification fallback. A Bridge restart after acceptance must not launch a duplicate agent.


## Preflight (#2681)

Shared engine `scripts/cursor-bridge/lib/preflight.mjs` runs on Bridge startup, via `bridge.mjs preflight`, on the existing watchdog timer (periodic), immediately before claim/launch (preclaim), and after auth/capacity/pre-accept failure.

Top-level results: `ready`, `runner_unavailable`, `bridge_unavailable`, `github_not_authenticated`, `cursor_not_authenticated`, `cursor_capacity_unavailable`, `workspace_unavailable`, `queue_unavailable`, `stale_claim`, `configuration_invalid`, `unknown_failure`.

When `preflight.enforce` is true (default), a non-ready preclaim result leaves the resume unconsumed and does not acquire the serial claim or start Cursor. Set `preflight.enforce` to `false` for status-only diagnostics during rollback.

## Heartbeat and watchdog

Heartbeat fields (local only): timestamp, process identity, service mode, queue depth, active claim summary, active launch summary, last drain/reconcile result, last inbound packet time, and last outbound GitHub acknowledgment time.

Watchdog checks:

- Bridge systemd unit active;
- heartbeat age within threshold (`watchdog.heartbeatStaleSeconds`, default `90`);
- packet queue readable/writable;
- workspace present;
- `gh` authentication available;
- Cursor CLI authentication observable;
- claim not stale beyond configured TTL;
- adequate local disk (`watchdog.minDiskMb`).

Restart when the service is inactive or the heartbeat is missing/stale. Local alert on recovery failure. Optional GitHub ops fault comment only when `watchdog.opsFaultIssueNumber` is set and the restart budget is exceeded.

## Status surface

`node ~/lgfc-cursor-bridge/scripts/bridge.mjs status` reports runner/transport observation, Bridge service/heartbeat, active launch, atomic launch transaction state, queue depth and oldest packet age, claim state, GitHub and Cursor CLI auth, last inbound/outbound times, last reconciliation result, disk headroom, secret-safe package identity, and last Bridge Watch/Build maintenance classification. It must not print tokens, API keys, prompts, assistant content, or private logs.

## Bridge Watch and Bridge Build (#2814)

Bridge Watch compares the installed package manifest to the exact checked-out `main` commit hashes for the allowlisted Bridge package files, reuses existing preflight/status/heartbeat/claim/in-flight evidence, and classifies:

| Classification | Meaning |
| --- | --- |
| `healthy` | Quiet; no alert or rebuild |
| `rebuild_required` | Drift or rebuildable failure with idle serial lane |
| `rebuild_deferred` | Rebuild needed but claim / `cli_spawned` / accepted / running work is active |
| `manual_review_required` | Incompatible schema or ambiguous package identity |
| `failed` | Runtime failure after bounded local recovery path |

Bridge Build accepts only an immutable commit SHA that is an ancestor of `main`, stages outside `~/lgfc-cursor-bridge`, validates, re-reads active-work state before promotion, snapshots the prior package, promotes via same-filesystem atomic rename, restarts Bridge + watchdog, verifies, and restores the prior package on post-install failure.

## Configuration

| Key | Default | Meaning |
| --- | ---: | --- |
| `launchStartupTimeoutSeconds` | `60` | Maximum wait for Cursor `system/init` acceptance |
| `launchExecutionTimeoutSeconds` | `7200` | Overall child execution limit |
| `launchHeartbeatIntervalSeconds` | `5` | Heartbeat cadence while a child is active |
| `launchRetryBaseSeconds` | `30` | Initial pre-accept retry delay |
| `launchRetryMaxSeconds` | `900` | Maximum pre-accept retry delay |
| `inFlightPath` | `in-flight.json` | Atomic launch transaction record |

## Cost and prohibited paths

- Idle runner + idle Bridge: no Cursor usage.  
- Local `cursor agent -p`: uses existing Cursor account model/agent allowance when a run executes.  
- **Prohibited:** Cursor Background Agents, Cloud Agents REST, SDK cloud runtime, paid webhook relays, scheduled GitHub keepalive, synthetic Issue comments used only to create traffic, public inbound host tunnels, runner-held Cursor credentials, concurrent Implementation claims, `--force`, or automatic Production/merge authority.  

## Fallback taxonomy

- Mechanical eligibility or claim failure: no launch; explicit unclaimed fallback.
- Informational queue-routing findings: launch proceeds; Cursor dispositions act/hold/correction/no-action.
- Pre-accept launch failure: claim released, resume unconsumed, one packet retained for bounded retry.
- Post-accept failure: resume remains consumed; automatic retry suppressed; manual verification required.
- Usage/plan failure after acceptance: same post-accept duplicate-safety rule.

## Rollback

1. Stop `lgfc-cursor-bridge.service` to disable automatic launch while preserving packets.  
2. Set `reconcileEnabled` to `false` and disable `lgfc-cursor-bridge-watchdog.timer` if required.  
3. Restore prior `bridge.json` / Bridge scripts from the previous `main` revision.  
4. Preserve `queue/`, `consumed/`, `claim.json`, `in-flight.json`, heartbeat, and logs unless cleanup is proven safe.  
5. Confirm ordinary wake-packet delivery still works; use manual Cursor pickup until the transaction is verified.  

## Canonical files

- `docs/explanation/operations/cursor-local-auto-start-architecture.md`
- `config/cursor-bridge/bridge.json`
- `config/cursor-bridge/bridge.schema.json`
- `config/cursor-bridge/bridge-maintenance-result.schema.json`
- `config/github-actions/repository-runner.json` (`wakeDelivery`)
- `.github/workflows/cursor-local-wake.yml`
- `.github/workflows/cursor-bridge-watch.yml`
- `.github/workflows/cursor-bridge-build.yml`
- `scripts/cursor-bridge/**`
- `tests/cursor-bridge-launch-transaction.test.ts`
- `tests/cursor-bridge-preflight.test.ts`
- `tests/cursor-bridge-watch-build.test.ts`
- `docs/how-to/cursor/configure-cursor-local-bridge.md`
