#!/usr/bin/env bash
# sessionEnd: if THIS session still owns the live wake loop, stop it with the
# same routing used at bind. A newer session that already rebound is left alone.
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
sid = j.get("session_id") or ""
reason = (j.get("reason") or "").lower()
# Only halt on real conversation teardown, not ordinary turn completion.
stop = "1" if reason in ("window_close", "user_close", "aborted") else "0"
print(sid)
print(stop)
print(reason)
')"
sid="$(printf '%s\n' "$parsed" | sed -n '1p')"
stop="$(printf '%s\n' "$parsed" | sed -n '2p')"

if [[ "$stop" != "1" || -z "$sid" ]]; then
  echo '{}'
  exit 0
fi

"$CTL" release --session "$sid" >/tmp/lgfc-wake-ctl.last 2>&1 || true
echo '{}'
exit 0
