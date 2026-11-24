#!/usr/bin/env bash
# Dry-run the 30-minute stopped-loop alert (#5489). Does not call gh.
set -euo pipefail

dir="$(cd "$(dirname "$0")" && pwd)"
watchdog="$dir/lgfc-wake-watchdog.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

cat >"$tmp/stopped" <<'EOF'
#!/bin/sh
echo "LGFC_WAKE status=stopped loop_pid=none heartbeat_age=none live_session=test bind_grace=no halt=no"
EOF
cat >"$tmp/ok" <<'EOF'
#!/bin/sh
echo "LGFC_WAKE status=ok loop_pid=1 heartbeat_age=1s live_session=test bind_grace=no halt=no"
EOF
chmod +x "$tmp/stopped" "$tmp/ok"

export LGFC_WAKE_CTL="$tmp/stopped"
export LGFC_WATCHDOG_ALERT_DRY=1
export LGFC_WATCHDOG_ALERT_AFTER_SEC=1800
export LGFC_WATCHDOG_STOPPED_SINCE_FILE="$tmp/since"
export LGFC_WATCHDOG_ALERT_MARK_FILE="$tmp/mark"
export LGFC_WAKE_HALT_FILE="$tmp/halt-absent"
export LGFC_WAKE_BIND_GRACE_FILE="$tmp/grace-absent"

out="$("$watchdog" --once)"
grep -q 'stop_timer_started' <<<"$out"

echo $(( $(date +%s) - 1801 )) >"$tmp/since"
out="$("$watchdog" --once)"
grep -q 'alert_dry' <<<"$out"
test -f "$tmp/mark"

out="$("$watchdog" --once)"
grep -q 'alert_already_open' <<<"$out"

echo halt >"$tmp/halt-present"
export LGFC_WAKE_HALT_FILE="$tmp/halt-present"
out="$("$watchdog" --once)"
grep -q 'skipped reason=halt' <<<"$out"
test -f "$tmp/mark"

export LGFC_WAKE_HALT_FILE="$tmp/halt-absent"
export LGFC_WAKE_CTL="$tmp/ok"
out="$("$watchdog" --once)"
grep -q 'LGFC_WAKE_WATCHDOG ok' <<<"$out"
test ! -f "$tmp/mark"
test ! -f "$tmp/since"

echo PASS
