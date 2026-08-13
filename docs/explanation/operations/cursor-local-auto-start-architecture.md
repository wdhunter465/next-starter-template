---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Controlled
Owns: Conceptual as-built architecture for Cursor Local Auto-Start, component roles, transactional launch flow, health/recovery paths, cost model, and rejected alternatives
Does Not Own: Host install runbooks, executable wake gates, Background Agents, or workflow migration Go decisions
Canonical Reference: /docs/governance/standards/CURSOR-RUNTIME-ROUTING.md
Related Issues: #2294, #2667, #2669, #2694, #2739, #2814, #2997, #3013, #3212, #3424
Last Reviewed: 2026-08-13
---

# Cursor Local Auto-Start Architecture

## Status (#3212 Phase 4 / #3424)

**Superseded / decommissioned as current architecture.** Cursor Local Bridge is no longer the operationally supported primary local auto-start path. Current primary transport is GitHub Actions `lgfc-cursor-dispatch` on runner label `lgfc-cursor` — see `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` and `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`.

This explanation remains as historical as-built design for the retired Bridge package. Do not treat the Decision table below as the active default route.

## Purpose

Explain the **historical** event-driven **GitHub Actions wake delivery → Chromebook runner → Cursor Local Bridge → local `cursor agent`** path: why the Actions runner alone was not a Cursor notifier, and why a spawned CLI process is not proof that the agent accepted work.

This document records the as-built Bridge design derived from Issue #2667 / PR #2669, extended by #2694 for heartbeat, watchdog recovery, and missed-handoff reconciliation, corrected by #2739 for transactional launch acceptance, extended by #2681 for deterministic preflight before claim/launch, and extended by #2814 for Bridge Watch / Bridge Build package maintenance. It is not standing authority for current wake routing after #3424.

## Problem

GitHub Issues are the source of work. Cursor Local is the implementation agent. The legacy poll-wake loop depended on an open Cursor session, only printed a sentinel, and never started work without human initiation.

Mode B therefore added event delivery and a persistent local Bridge. Subsequent live operation exposed three distinct reliability boundaries:

1. a hung Bridge process could stay “active” without proving useful health;
2. a fully eligible handoff could remain unclaimed if the wake event or host packet was missed;
3. the CLI could spawn and open a connection without the Cursor agent accepting the task, while the Bridge prematurely marked the handoff consumed and treated spawn as acceptance evidence.

The third boundary is critical. Transport success, process creation, connection establishment, agent acceptance, and completed work are different states and must not be collapsed. Shared operator evidence is Issue status plus Cursor's substantive handoff, not routine Bridge ACK/STARTED/COMPLETED comments (#2997).

A fourth reliability boundary surfaced later: the eligibility/routing logic had drifted into parsing specific comment text (`LOCAL CURSOR RESUME`, `CHATGPT RESPONSE`, action-count and chronology checks) as a de-facto second gate on top of labels, even though #2997 had already established labels as the routing signal. That made the handoff brittle — a missing or malformed comment could block a Cursor-labeled, ready Issue indefinitely — and duplicated notification steps (ACK/STARTED/COMPLETED-style comments) added noise without adding safety. #3013 removed comment-text parsing entirely: routing and gating are decided from Issue **labels and status only**.

## Decision

**Auto-start local CLI agent with transactional acceptance, local health, and recovery.**

| Decision | Choice |
| --- | --- |
| Delivery | GitHub Actions job on `lgfc-repo-runner` writes a host wake packet |
| Execution owner | Cursor Local Bridge systemd service |
| Agent runtime | Authenticated local `cursor agent` / `agent -p --output-format stream-json` |
| Safety gate | Full Issue eligibility contract plus one serial claim |
| Acceptance signal | First valid Cursor NDJSON `system/init` event |
| Pre-accept failure | Release claim, leave resume unconsumed, retain one packet with bounded backoff |
| Post-accept failure | Keep consumed marker, suppress automatic retry, require manual verification |
| Health | Local heartbeat + systemd timer watchdog, including active-launch pulses |
| Package maintenance | Bridge Watch classifies drift/health; Bridge Build promotes immutable `main` packages with rollback |
| Missed-handoff recovery | Bounded local reconciliation into the normal packet path |
| Prohibited | Background Agents, cloud APIs, paid relays, GitHub keepalive spam, `--force`, automatic merge or Production authority |

## Cost model

| Path | Cursor subscription impact |
| --- | --- |
| Idle runner + idle Bridge | None |
| Wake delivery job | None |
| Preflight (#2681) | Local status/alert only; no Cursor launch |
| Local heartbeat / watchdog | None; local only |
| Reconciliation sweep | None for Cursor until an eligible packet launches |
| Local Cursor Agent run | Existing account model/agent allowance |
| Background Agents / cloud agent APIs | Prohibited |

Auto-start can consume allowance without Bill opening a chat. The controls are full eligibility, one serial claim, transaction state, positive acceptance, deduplication by resume id, bounded pre-accept retry, and no automatic retry after possible mutation.

## Architecture

```mermaid
flowchart LR
  subgraph github [GitHub]
    Issue[Source_Issue_labels_and_status]
    WF[cursor_local_wake]
  end

  subgraph chromebook [Chromebook_Debian]
    Runner[Actions_Runner]
    Queue[Wake_Packet_Queue]
    Bridge[Cursor_Local_Bridge]
    Claim[Serial_Claim]
    Tx[Atomic_In_Flight_Transaction]
    CLI[Cursor_Agent_CLI]
    Heartbeat[Local_Heartbeat]
    Watchdog[Local_Watchdog]
    Reconcile[Slow_Reconcile]
    Notify[Fallback]
  end

  Issue -->|agent:cursor + handoff:ready labeled| WF
  WF -->|delivery only| Runner
  Runner --> Queue
  Reconcile -->|recovery packet| Queue
  Reconcile -->|re-read eligibility| Issue
  Queue --> Bridge
  Bridge -->|revalidate| Issue
  Bridge --> Claim
  Claim --> Tx
  Tx -->|spawn stream-json| CLI
  CLI -->|system/init acceptance| Tx
  Tx -->|accepted only| Heartbeat
  Bridge --> Heartbeat
  Watchdog --> Heartbeat
  Watchdog -->|restart or alert| Bridge
  Bridge -->|pre-accept retry or post-accept hold| Notify
```

Critical boundaries:

- The runner **delivers**; it never launches Cursor.
- The Bridge **validates, claims, launches, and supervises**.
- `spawn()` means only `CLI_SPAWNED`.
- Cursor `system/init` means `AGENT_ACCEPTED`.
- Only acceptance permits the consumed marker and local `running` transaction evidence.

## Launch state machine

```text
DELIVERED
  -> ELIGIBLE
  -> CLAIMED
  -> CLI_SPAWNED
  -> AGENT_ACCEPTED
  -> RUNNING
  -> COMPLETED
```

### Before acceptance

`in-flight.json` records the packet, claim identity, process id, and `cli_spawned` state. The resume remains unconsumed. A startup timeout, connection failure, auth transition, process error, or exit before `system/init` kills the child, releases the claim, restores the same packet with bounded exponential backoff, and emits one deduplicated fallback.

If the Bridge restarts in this state, the processing packet returns to the retry path. No duplicate work is possible because no agent acceptance occurred.

### At acceptance

The Bridge parses newline-delimited JSON from stdout. A valid event must contain:

```json
{"type":"system","subtype":"init","session_id":"..."}
```

The Bridge then, in order:

1. writes the consumed-resume marker;
2. updates `in-flight.json` to `running` with `acceptedAt` and `sessionId`;
3. continues heartbeat updates while the child executes.

It does **not** post routine `CURSOR BRIDGE STARTED` / `COMPLETED` Issue comments. Cursor updates Issue status (`status:implementation` → `status:review` or hold disposition) and posts the authoritative `IMPLEMENTATION HANDOFF` or hold/correction/no-action result.

### After acceptance

A zero exit releases the claim, clears transaction state, and archives the packet locally. A nonzero exit, execution timeout, Bridge restart, or supervision error preserves the consumed marker and suppresses auto-retry because repository mutation may already have occurred.

## Component responsibilities

| Component | Purpose | Must not |
| --- | --- | --- |
| Source Issue | Task authority and eligibility | Be treated as pickup evidence |
| Wake workflow | Deliver a packet | Launch Cursor, hold keys, or claim the lane |
| Actions runner | Receive gated delivery jobs | Own Cursor auth or lifetime |
| Packet queue | Decouple delivery and execution | Become authority |
| Bridge | Validate, claim, launch, supervise, recover | Report started on spawn alone |
| In-flight transaction | Preserve launch state across supervision/restart | Contain prompts, secrets, or private output |
| Cursor CLI | Execute one bounded action and emit lifecycle NDJSON | Use cloud handoff or `--force` |
| Heartbeat | Prove useful health during idle and execution | Stop refreshing while awaiting child exit |
| Watchdog | Recover stale Bridge process | Clear valid claims arbitrarily |
| Reconciliation | Reconstruct missed eligible packets | Bypass the queue or launch directly |
| Fallback | Make failures visible | Trigger duplicate execution |

## Event flow

1. Engineering applies `agent:cursor` and `handoff:ready` to the Issue (order-independent — whichever label lands second fires delivery). No resume comment is posted or required; the Issue body and any existing comments are ordinary context Cursor reads after launch, not a routing signal.
2. The wake workflow writes a local host packet only (no routine `CURSOR BRIDGE ACK` Issue comment).
3. The Bridge dequeues the packet, re-fetches Issue state, and validates mechanical eligibility/auth.
4. The Bridge acquires the serial claim and writes `cli_spawned` transaction state.
5. The CLI starts in `stream-json` mode.
6. If no `system/init` arrives before timeout, the child is terminated and the packet is retryable; no consumed marker exists.
7. On `system/init`, the Bridge marks consumed and records the session locally.
8. Heartbeats continue while the agent runs; Cursor owns Issue status transitions and substantive handoff.
9. Completion or post-accept failure releases the claim and records the correct duplicate-safety disposition locally (actionable FALLBACK comments only when intervention is required).
10. Reconciliation remains an independent recovery path for eligible work lacking pending or consumed evidence.

## Why this design is required

1. GitHub delivery no longer depends on an open chat.
2. A connection window is not mistaken for agent execution.
3. Pre-accept faults recover automatically without losing the handoff.
4. Post-accept faults fail safe against duplicate repository mutation.
5. The watchdog sees a fresh heartbeat during long-running work.
6. Operators can distinguish queue, claim, spawned, accepted, running, and completed state.

## Rejected alternatives

| Option | Verdict |
| --- | --- |
| Treat successful `spawn()` as started | False-positive pickup; caused #2739 |
| Mark consumed before acceptance | Can permanently suppress retry |
| Retry automatically after acceptance | Duplicate mutation risk |
| Runner invokes Cursor inside Actions | Conflates transport and execution; timeout/credential risk |
| Poll-wake only | Requires open session; not auto-start |
| Public webhook/tunnel | Unnecessary exposure and moving parts |
| Background Agents / cloud runtime | Prohibited cost/runtime path |
| Synthetic keepalive comments | Noise; not health evidence |
| Reconciliation launches directly | Bypasses the normal safety path |
| Comment-marker parsing as a routing/gating signal (`LOCAL CURSOR RESUME`, `CHATGPT RESPONSE`, action-count/chronology matching) | Brittle second gate duplicating labels; a missing/malformed comment could block a ready, Cursor-labeled Issue indefinitely — removed by #3013 |

## Verification obligations

Repository tests must prove spawn-without-acceptance timeout, pre-accept retryability, single acceptance, heartbeat continuity, secret-safe diagnostics, and restart classification. Chromebook verification must additionally prove reset/reconnect success, an intentional stalled connection, claim release, retryability, and no duplicate launch after service restart.

#2694 and #2638 cannot receive terminal closeout from repository-only tests; the direct-host acceptance evidence remains mandatory.

## Related documents

- **Current primary wake:** `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`
- **Current runtime routing:** `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`
- Historical Bridge contract (superseded): `docs/reference/ci/cursor-local-bridge-contract.md`
- Historical Bridge install (superseded): `docs/how-to/cursor/configure-cursor-local-bridge.md`
- Runner contract: `docs/reference/ci/repository-runner-contract.md`
- Retired poll-wake archive: `docs/how-to/cursor/github-poll-wake-loop.md`
