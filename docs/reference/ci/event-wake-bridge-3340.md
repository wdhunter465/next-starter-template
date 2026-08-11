---
Doc Type: Reference
Audience: Human + AI
Authority Level: Informational
Owns: #3340 event-driven GitHub → Cursor Local wake bridge design, prototype evidence, and Adopt/Adapt/Reject recommendation
Does Not Own: Permanent operating-model change, Production website behavior, or Cursor Cloud / My Machines routing
Canonical Reference: /docs/reference/ci/event-wake-bridge-3340.md
Related Issues: #3340, #3332, #3212, #3013
Last Reviewed: 2026-08-11
---

# Event-driven GitHub → Cursor Local wake bridge (#3340)

> **Operating status (#3347 / Product Authority 2026-08-11): ABANDONED as an LGFC connection type.**  
> Do **not** run `scripts/lgfc-event-wake` as the live pager. Primary wake is the `lgfc-cursor` self-hosted runner + `lgfc-cursor-dispatch` (#3212 Phase 4 / #3347). This document remains historical prototype evidence only.

## Purpose

Replace or augment Cursor Local’s **one-minute AI tick loop** with a **non-AI idle listener** that wakes the existing Chromebook Local agent only when repository state becomes actionable — without Cloud Agent / My Machines.

## Scope

**In scope**

- Design options, security model, reversible local prototype, unit evidence, credit comparison, recommendation.
- Reuse of identifiers-only `scripts/lgfc-cursor-dispatch/dispatch.mjs`.

**Out of scope**

- Disabling the AI tick before equivalent reliability.
- Paid relays, public inbound Chromebook listeners, Production credentials, `@cursor` Cloud wake.
- Permanent operating-model change (requires WORK review + Bill Go).

## Current known truth

| Path | Role | Idle cost |
| --- | --- | --- |
| Session 1-minute AI tick | Local chat polls GitHub with model inference | **Cursor Models** every tick |
| `lgfc-cursor-dispatch` (#3212 Phase 4) | GitHub Actions on `lgfc-cursor` runner → identifiers-only CLI | Zero model credits while idle; wakes on `agent:cursor` + `handoff:ready` label events |
| Retired Bridge / poll-wake | Historical; not execution dependency | N/A |
| My Machines / `@cursor worker=` | Cloud Agent loop + local tools | Cloud / Other credits on **runs**; does not wake IDE Local |

### Current-state diagram (one-minute AI tick)

```text
IDE Local chat open
  → every ~60s: model wake (credits)
  → agent inspects GitHub (Ops / eng queue)
  → acts if actionable; else idle until next tick
```

### Current-state diagram (label dispatch)

```text
Issue labeled agent:cursor + handoff:ready
  → GHA lgfc-cursor-dispatch (ubuntu security tests + lgfc-cursor runner)
  → dispatch.mjs identifiers-only → agent/cursor agent -p
  → Cursor fetches live Issue + repo authority
```

## Candidate options

| Option | Transport | Idle AI? | Fit |
| --- | --- | --- | --- |
| A. Extend GHA events only | More Actions triggers → same dispatch | No | Strong for label/handoff; weak for “always discover Ops without labels”; runner must be online |
| B. Non-AI local poller → dispatch | Outbound `gh`/API + watermark → dispatch.mjs | No | Direct replacement for AI tick discovery; uses GitHub API budget |
| C. Public inbound webhook to Chromebook | Tunnel/webhook | No | Reject for public repo / exposure unless separately approved |
| D. My Machines | Cloud Agent | No (idle worker) but Cloud credits on wake | Reject as Local wake; wrong product + credit cliff |
| E. Hybrid A+B | Label dispatch + local poller backup | No | Best reliability vs tick |

**Selected for prototype:** Option B (with Hybrid E as operating recommendation).

## Trust boundaries

1. **Transport wake ≠ execution authority.** Poller may only pass repo/issue/event/delivery identifiers.
2. **No Issue/comment body** in shell or CLI argv (same as dispatch security contract).
3. **Revalidate** live Issue labels/status after start before mutating work.
4. **Dedup** by wake key `issue:reason:updated_at`.
5. **Pilot** defaults to `--status-only` / `--dry-run` (dispatch dry-run).
6. Prefer **outbound-only** Chromebook connectivity.

### Actionable predicates (PoC)

- `agent:cursor` + `handoff:ready` (and not handed-off status)
- `ops:priority:1`
- `agent:cursor` + `post-merge-failure`

## Prototype layout

| Path | Role |
| --- | --- |
| `scripts/lgfc-event-wake/poll.mjs` | Non-AI poller / once mode |
| `scripts/lgfc-event-wake/lib/actionable.mjs` | Predicates |
| `scripts/lgfc-event-wake/lib/watermark.mjs` | `~/.lgfc-event-wake/state.json` |
| `tests/lgfc-event-wake.test.mjs` | Unit evidence |
| Reuses | `scripts/lgfc-cursor-dispatch/dispatch.mjs` |

### Operator commands

```bash
# Unit tests (no network; vitest)
npx vitest run tests/lgfc-event-wake.test.mjs

# One-shot status-only poll (GitHub read + dispatch --dry-run)
node scripts/lgfc-event-wake/poll.mjs --once --status-only

# Continuous non-AI loop (still dry-run until Go)
node scripts/lgfc-event-wake/poll.mjs --interval-sec 60 --status-only
```

## Threat / security assessment (public repo)

| Threat | Mitigation in PoC |
| --- | --- |
| Prompt/event injection via public comments | Identifiers-only; Cursor loads Issue after start under repo authority |
| Forged webhook | No inbound webhook in PoC; uses authenticated `gh` as logged-in operator |
| Replay / duplicate wakes | Watermark `seenWakeKeys` |
| Untrusted actor → local exec | Predicates require specific labels; dry-run pilot; no yolo/force |
| Chromebook exposure | Outbound-only |
| Impersonating Bill | Does not forge human approvals; no authority invention |

## Evidence (this PR / branch)

| Check | Result |
| --- | --- |
| `node --test tests/lgfc-event-wake.test.mjs` | Recorded in PR verification |
| `--once --status-only` live poll | Record latency / newWakes in Issue comment when run |
| Offline recovery | State file persists; next poll resumes; missed events reappear if still actionable and `updated_at` changes — note: unchanged issues already seen stay suppressed (document as Adapt item: TTL / label-change detection) |

## Comparison vs one-minute AI tick

| Dimension | AI tick | Event-wake poller (PoC) | Label dispatch |
| --- | --- | --- | --- |
| Detection latency | ~60s | Configurable (default 60s poll) | Seconds after label (if runner online) |
| Idle Cursor credits | **High** (every tick) | **Zero** | Zero |
| Reliability | High while chat open | High while poller + `gh` auth up | Depends on `lgfc-cursor` runner |
| Duplicate risk | Agent discipline | Watermark | Workflow concurrency + lock |
| Chromebook overhead | Model + tools | Light Node + `gh` | Only on wake |
| GitHub API use | Per tick via agent tools | Search API per poll | Actions only |
| Security exposure | Chat session | Local state + `gh` creds | Runner contract |
| All-day online | Requires IDE chat | systemd/user service candidate | Runner service |

## Recommendation (superseded)

**Historical PoC recommendation was Adapt (hybrid).** That operating recommendation is **superseded by #3347**:

1. **Primary:** `lgfc-cursor-dispatch` on `lgfc-cursor-chromebook` when the runner is healthy.
2. **Backup (optional):** wider-interval AI tick only if Product Authority restores it to cover runner gaps — not a permanent 1-minute burn.
3. **Abandoned:** non-AI `lgfc-event-wake` / #3340 bridge as an LGFC connection type — do not adopt as the pager.
4. **Reject:** My Machines / public inbound webhook as the Local pager.

## Rollback

No live poller service was commissioned. Optional host cleanup: delete `~/.lgfc-event-wake`. Retain runner + optional AI tick per #3347.
