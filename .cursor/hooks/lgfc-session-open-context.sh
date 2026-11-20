#!/usr/bin/env bash
# Project sessionStart: inject continuous-workflow orientation (#5383).
# Host bind remains ~/.cursor/hooks/lgfc-session-start-bind.sh.
# Repo checkout is the source of truth.
set -euo pipefail
input="$(cat || true)"
printf '%s' "$input" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    j = json.loads(raw) if raw.strip() else {}
except Exception:
    j = {}
bg = bool(j.get("is_background_agent"))
mode = (j.get("composer_mode") or "agent").lower()
if bg or mode in ("ask", "edit", "cmd_k", "cmdk"):
    print(json.dumps({"additional_context": "LGFC continuous-pass inject skipped (non-agent session)."}))
    raise SystemExit(0)

ctx = """LGFC new-session contract (#5383) — repo checkout is the source of truth (`docs/ops/ai/CURSOR-RULES.md`, `.cursor/rules/30-*.mdc`, `.cursor/rules/40-*.mdc`).

Background services (wake loop, tick, poller, runner) are keepalives only. They are not the assignment and not a stop.

Required in this same turn after orientation:
1. Review prior agent transcripts under the project agent-transcripts folder (and compaction INDEX when present) for open Issue/PR context — do not wait for Product Authority to re-explain.
2. End startup; begin Session lifecycle phase 2 continuous assigned-queue pass immediately.
3. Read GitHub via ~/.cursor/lgfc-ready-queue.txt; act on the first Issue that can move. Do not require an Issue to be named in this chat.
4. Do not idle because a tick was empty, the loop is stopped, startup finished, or a person was answered.
5. Do not self-merge Production-tier PRs. handoff:ready is not website Go.
"""
print(json.dumps({"additional_context": ctx}))
'
exit 0
