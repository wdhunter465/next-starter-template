#!/usr/bin/env bash
# sessionStart (host): wake status + continuous-workflow orientation (#5383).
# Product `run startup` remains orientation. This hook does not authorize Issues.
# Repo checkout is the source of truth; this file is installed to ~/.cursor/hooks/.
set -euo pipefail
CTL="${HOME}/.cursor/lgfc-wake-ctl.sh"
input="$(cat || true)"
parsed="$(printf '%s' "$input" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    j = json.loads(raw) if raw.strip() else {}
except Exception:
    j = {}
sid = j.get("session_id") or "unknown"
bg = bool(j.get("is_background_agent"))
mode = (j.get("composer_mode") or "agent").lower()
skip = "1" if bg or mode in ("ask", "edit", "cmd_k", "cmdk") else "0"
print(sid)
print(skip)
print(mode)
')"
sid="$(printf '%s\n' "$parsed" | sed -n '1p')"
skip="$(printf '%s\n' "$parsed" | sed -n '2p')"

if [[ "$skip" == "1" ]]; then
  python3 -c 'import json; print(json.dumps({"additional_context":"LGFC wake bind skipped (non-agent or background session)."}))'
  exit 0
fi

if [[ -f "${HOME}/.cursor/lgfc-wake-halt" ]]; then
  python3 -c 'import json; print(json.dumps({"additional_context":"LGFC wake services are halted (~/.cursor/lgfc-wake-halt). Do not bind, rebind, start a loop, or start the watchdog. Clear only with ~/.cursor/lgfc-wake-ctl.sh resume, and only when Product Authority asks for the poll to run. Continuous workflow still applies to any Issue work this chat can own once resume is authorized."}))'
  exit 0
fi

startup_out="$("$CTL" startup --session "$sid" 2>&1 || true)"
printf '%s\n' "$startup_out" >/tmp/lgfc-wake-ctl.last
export LGFC_HOOK_SESSION_ID="$sid"

python3 -c '
import json, os
sid = os.environ.get("LGFC_HOOK_SESSION_ID", "unknown")
packet = open("/tmp/lgfc-wake-ctl.last").read()
ctx = (
    "LGFC host startup already ran via ~/.cursor/lgfc-wake-ctl.sh startup "
    f"--session {sid}. "
    "Repo checkout is the local source of truth (#5383): docs/ops/ai/CURSOR-RULES.md "
    "and .cursor/rules/*.mdc. Host ~/.cursor copies are installs only. "
    "Product `run startup` is still orientation (AGENTS.md / CURSOR-RULES); "
    "do not skip it, and do not treat host bind as Issue authorization. "
    "Background services (wake loop, tick, poller, runner) are keepalives only. "
    "Continuous workflow is this agent'\''s job. "
    "Do not rebind. Do not stop another session loop. "
    "When this chat is the recorded owner and the loop is stopped or aborted "
    "(not halted), start exactly one loop and report its PID (#5012). "
    "Read the latest poll from ~/.cursor/lgfc-wake-poll-inbox.json as a keepalive record. "
    "Do not kill the Actions runner or lgfc-wake-watchdog. "
    "REQUIRED same turn after orientation: (1) review prior agent transcripts "
    "for open Issue/PR context; (2) begin the continuous assigned-queue pass "
    "from ~/.cursor/lgfc-ready-queue.txt; (3) act on the first Issue that can move. "
    "Do NOT wait for an Issue to be named in this chat. "
    "Do not idle on an empty tick, a finished startup, or an answered question. "
    "handoff:ready is not website Go. Do not self-merge.\n\n"
    + packet
)
print(json.dumps({"additional_context": ctx}))
'
exit 0
