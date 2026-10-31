#!/usr/bin/env bash
# Check the LGFC 1-minute always-on wake loop every 8 minutes.
# An aborted loop is reported and left stopped (#4783).
# Never touches the Actions runner.
#
# Usage:
#   ~/.cursor/lgfc-wake-watchdog.sh           # daemon (8-minute interval)
#   ~/.cursor/lgfc-wake-watchdog.sh --once    # one check/restart, then exit
#   ~/.cursor/lgfc-wake-watchdog.sh --status  # print state, do not restart
# Stop: kill "$(cat /tmp/lgfc-wake-watchdog.pid)"
set -euo pipefail

INTERVAL_SEC="${LGFC_WATCHDOG_INTERVAL_SEC:-480}"
PID_FILE="/tmp/lgfc-wake-watchdog.pid"
WATCHDOG_LOG="/tmp/lgfc-wake-watchdog.log"
CTL="${HOME}/.cursor/lgfc-wake-ctl.sh"

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*"
}

already_running_daemon() {
  local old cmd
  [[ -f "$PID_FILE" ]] || return 1
  old="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ "$old" =~ ^[0-9]+$ ]] || return 1
  [[ "$old" != "$$" ]] || return 1
  [[ -d "/proc/$old" ]] || return 1
  cmd="$(tr '\0' ' ' <"/proc/$old/cmdline" 2>/dev/null || true)"
  [[ "$cmd" == *lgfc-wake-watchdog.sh* ]]
}

status_line() {
  "$CTL" status
}

in_bind_grace() {
  [[ -f /tmp/lgfc-wake-bind-grace ]] || return 1
  local until
  until="$(cat /tmp/lgfc-wake-bind-grace 2>/dev/null || echo 0)"
  [[ "$until" =~ ^[0-9]+$ ]] || return 1
  (( "$(date +%s)" < until ))
}

check_once() {
  local line state live
  if [[ -f "${HOME}/.cursor/lgfc-wake-halt" ]]; then
    log "skipped reason=halt"
    echo "LGFC_WAKE_WATCHDOG skipped reason=halt"
    return 0
  fi
  line="$("$CTL" status)"
  echo "$line"
  state="$(sed -n 's/.*status=\([^ ]*\).*/\1/p' <<<"$line")"
  if [[ "$state" == "ok" ]]; then
    log "ok"
    echo "LGFC_WAKE_WATCHDOG ok"
    return 0
  fi
  if in_bind_grace; then
    log "$state during session-bind grace — skip restart"
    echo "LGFC_WAKE_WATCHDOG skipped reason=bind_grace state=$state"
    return 0
  fi
  live="$(awk -F= '/^session_id=/{print $2; exit}' /tmp/lgfc-wake-live-session 2>/dev/null || true)"
  log "$state left stopped live_session=${live:-none} (#4783)"
  echo "LGFC_WAKE_WATCHDOG left_stopped state=$state session=${live:-none}"
  return 0
}

case "${1:-}" in
  --once)
    check_once
    exit 0
    ;;
  --status)
    status_line
    exit 0
    ;;
  ""|--daemon)
    ;;
  *)
    echo "usage: $0 [--once|--status|--daemon]" >&2
    exit 2
    ;;
esac

if already_running_daemon; then
  echo "watchdog already running pid=$(cat "$PID_FILE")"
  exit 0
fi

echo $$ >"$PID_FILE"
log "WATCHDOG STARTED pid=$$ interval=${INTERVAL_SEC}s ctl=$CTL"
check_once
while true; do
  sleep "$INTERVAL_SEC"
  check_once
done
