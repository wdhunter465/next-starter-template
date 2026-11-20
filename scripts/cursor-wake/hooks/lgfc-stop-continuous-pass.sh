#!/usr/bin/env bash
# Host stop hook: nudge continuous assigned-queue pass after the agent goes quiet (#5383).
set -euo pipefail
input="$(cat || true)"
parsed="$(printf '%s' "$input" | python3 -c '
import json, sys
raw = sys.stdin.read()
try:
    j = json.loads(raw) if raw.strip() else {}
except Exception:
    j = {}
print((j.get("status") or "").lower())
print(int(j.get("loop_count") or 0))
')"
status="$(printf '%s\n' "$parsed" | sed -n '1p')"
loop="$(printf '%s\n' "$parsed" | sed -n '2p')"

# First quiet only — catches new-session idle after orientation without
# re-nudging every later completed turn (#5383).
if [[ "$status" != "completed" || "$loop" != "0" ]]; then
  echo '{}'
  exit 0
fi

msg='Continue LGFC continuous workflow now (#5383). Repo docs win over chat memory. Review prior agent transcripts for open Issue/PR context, then run the assigned-queue pass from ~/.cursor/lgfc-ready-queue.txt and act on the first Issue that can move. Wake/runner are keepalives only — an empty tick is not a stop. Do not wait for an Issue to be named in this chat. End with one pass-coverage line.'
LGFC_STOP_MSG="$msg" python3 -c 'import json, os; print(json.dumps({"followup_message": os.environ["LGFC_STOP_MSG"]}))'
exit 0
