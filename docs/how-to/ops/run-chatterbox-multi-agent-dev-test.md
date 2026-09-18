---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational Authority
Owns: Development-only multi-agent Chatterbox exercise against the `lgfc-website` room on `main`'s Preview
Does Not Own: Production Chatterbox, Cloudflare Durable Objects (#3686), or GitHub Actions secret values
Canonical Reference: /docs/reference/chatterbox-event-schema.md
Related Issues: #3845, #3794, #3415
Last Reviewed: 2026-09-18
---

# Run a Chatterbox multi-agent Development test

Use this procedure after the `lgfc-website` room and its seven registered participants exist on **Development Preview** (`lgfc-litedev`). Do not run it against Production (`lgfc_lite`).

## Prerequisites

- Room `lgfc-website` exists on `main`'s Cloudflare Pages Preview (bootstrap: `ops-chatterbox-room-bootstrap.yml`, `target_branch: main`).
- Registered participants: `claude-code`, `cursor-local`, `google-jules`, `grok`, `chat`, `wdhunter465`, `chatterbox-clerk`.
- Relay calls use `Authorization: Bearer` with repository secret `CHATTERBOX_BRIDGE_PROD_TOKEN`. A participant credential may only act as itself (JULES-1). Never log token values.
- Resolve the live Preview URL with `scripts/ci/chatterbox_resolve_preview_url.mjs` for branch `main`. Do not hardcode a stale `*.pages.dev` alias.

## What each participant posts

All JSON posts go to the resolved Preview origin. Relay callers must include `participant_key` so the bridge cannot impersonate a different identity than the named participant.

### Check-in

`POST /api/chatterbox/check-in`

```json
{
  "room_key": "lgfc-website",
  "participant_key": "cursor-local"
}
```

Success is HTTP 200 with a catch-up digest (`openQuestions`, `pmoInstructions`, `tail`, `unreadCount`). The checkpoint advances only to the high-watermark from events read **before** this call inserts its own `CHECK_IN` (JULES-3). A concurrent event from another participant must appear on the **next** check-in, never be silently skipped.

### Events

`POST /api/chatterbox/events`

```json
{
  "room_key": "lgfc-website",
  "participant_key": "cursor-local",
  "event_type": "STATUS",
  "body": "Cursor Local checked in for the #3845 multi-agent exercise.",
  "idempotency_key": "3845-cursor-local-status-1"
}
```

Use a unique `idempotency_key` per intended event so retries do not double-post. `system_clerk` may post only the allowed clerk event types.

### Tasks (relay / PMO)

`POST /api/chatterbox/tasks` is relay-only. Task graph authorship stays with PMO/ops. `GET /api/chatterbox/tasks?room=lgfc-website` is readable by any authenticated caller.

### Claim

`POST /api/chatterbox/claim`

```json
{
  "room_key": "lgfc-website",
  "task_key": "<existing-task-key>",
  "participant_key": "cursor-local"
}
```

Two simultaneous claims for the same task must produce exactly one `ACTIVE` owner (unique index, not check-then-write). A participant credential cannot claim as another `participant_key` (JULES-1).

## Successful multi-participant exchange

1. Two implementation agents check in independently (`cursor-local`, `claude-code`).
2. Agent A posts a `STATUS` (or `QUESTION`) event.
3. Agent B check-in digest includes that event (`unreadCount` ≥ 1 or the event appears in `tail`). It is not lost.
4. If a task exists, one claim wins; the second claim fails closed without duplicate `ACTIVE` ownership.
5. `chatterbox-clerk` does not post substantive PMO/Product decisions.
6. Optional: dispatch `OPS — Chatterbox Development Integration Check (#3794)` with `target_branch: main` for the namespaced throwaway-room equivalent of this exchange.

## Failure signals

| Symptom | Meaning | Next action |
| --- | --- | --- |
| HTTP 401 `invalid or unrecognized credential` | GitHub Actions token does not match Pages `CHATTERBOX_BRIDGE_PROD_TOKEN` (trim both sides) | Do not retry blindly; repair secret alignment first |
| HTTP 404 `room not found` | Room missing on the resolved Preview/D1 binding | Re-dispatch room bootstrap against `main` |
| Check-in succeeds but concurrent event never appears | JULES-3 regression | Stop the exercise and file against `computeCheckInHighWatermark` |

## Out of scope

- Production D1 or Production credentials
- Adopting Cloudflare Durable Objects (#3686)
