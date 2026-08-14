---
Doc Type: How-To
Audience: Human + AI implementation agents operating a Chatterbox room
Authority Level: Operational
Owns: Bounded operating procedure for the #3415 Chatterbox prototype — creating a room, registering participants, ingesting a task graph, claiming/releasing work, posting events, and checking in
Does Not Own: Schema/field definitions (see chatterbox-event-schema.md); role authority (see chatterbox-role-model.md and chatterbox-authority-boundary.md)
Canonical Reference: /docs/how-to/chatterbox-operate-a-room.md
Related Issues: #3415
Last Reviewed: 2026-08-14
---

# Operate a Chatterbox room (prototype)

All calls require the `x-admin-token` header (or `Authorization: Bearer
<token>`), matching every other `functions/api/admin/**`-style route in this
repository. This prototype has not built per-agent credentials yet — see
chatterbox-authority-boundary.md.

## Procedure

### 1. Create the room

One room per GitHub program/project.

```bash
curl -X POST "$BASE/api/chatterbox/room" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"room_key":"lgfc-website","source_issue_ref":"wdhunter465/next-starter-template#3415","title":"LGFC website program"}'
```

A room is never auto-created by any other route — an unknown `room_key`
elsewhere in this API returns `404`.

### 2. Register participants

Every field is required except `capability_summary`. `assigned_by` and
`source_authority` must cite a real authorization, not a placeholder.

```bash
curl -X POST "$BASE/api/chatterbox/participants" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "participant_key": "claude-code",
    "display_name": "Claude Code",
    "role_class": "implementation_agent",
    "assigned_by": "Bill",
    "source_authority": "issue:3415#5293919218"
  }'
```

### 3. Ingest the task graph

One call per task; re-posting the same `task_key` updates it (title, state,
`collision_domain`, `depends_on`) rather than duplicating it.

```bash
curl -X POST "$BASE/api/chatterbox/tasks" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "room_key": "lgfc-website",
    "task_key": "3416",
    "title": "Chatterbox work unit 4: bounded catch-up UI",
    "state": "AVAILABLE",
    "collision_domain": ["functions/api/chatterbox/**"],
    "depends_on": []
  }'
```

### 4. Claim and release

```bash
curl -X POST "$BASE/api/chatterbox/claim" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"room_key":"lgfc-website","task_key":"3416","participant_key":"claude-code"}'
```

A `409` with `"error":"already_claimed"` means another participant won a
genuine race — not an error to retry blindly. A `409` with
`"task_not_available:<state>"` or `"unsatisfied_dependencies"` means the
precondition, not the race, failed.

Release only succeeds for the current claimant:

```bash
curl -X POST "$BASE/api/chatterbox/release" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"room_key":"lgfc-website","task_key":"3416","participant_key":"claude-code"}'
```

### 5. Post events

Use `idempotency_key` on any call an agent might retry after a missed
response (a `CLAIM` or `COMPLETE` should never be posted twice by accident).

```bash
curl -X POST "$BASE/api/chatterbox/events" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "room_key": "lgfc-website",
    "participant_key": "claude-code",
    "event_type": "COMPLETE",
    "task_ref": "3416",
    "body": "COMPLETE #3416 — PR #9001 merged and verification recorded on the Issue.",
    "github_ref": {"issue": 3416, "pr": 9001, "sha": "abc1234"},
    "idempotency_key": "3416-complete-1"
  }'
```

To ask a durable question:

```bash
curl -X POST "$BASE/api/chatterbox/events" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "room_key": "lgfc-website",
    "participant_key": "claude-code",
    "event_type": "QUESTION",
    "task_ref": "3416",
    "target_participant_key": "cursor-local",
    "body": "Does #3420 depend on this schema?"
  }'
```

Omit `target_participant_key` for a broadcast question anyone eligible may
answer. Answer with `event_type: "ANSWER"` and `in_reply_to_event_id` set to
the question's `id`.

### 6. Check in

Returns the bounded catch-up digest (open questions, recent PMO
instructions, capped tail) and the caller's own active claims — not a full
event replay.

```bash
curl -X POST "$BASE/api/chatterbox/check-in" \
  -H "x-admin-token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"room_key":"lgfc-website","participant_key":"claude-code"}'
```

Call this on every session start for a room. It is the baseline resilience
path — it works correctly with zero push/notification adapters configured.
