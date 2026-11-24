#!/usr/bin/env bash
# Check the LGFC 1-minute always-on wake loop every 8 minutes.
# An aborted loop is reported and left stopped (#4783, #5406).
# After 30 minutes stopped, with no halt file, open one Operations Issue (#5489).
# Never touches the Actions runner. Never starts the loop.
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
CTL="${LGFC_WAKE_CTL:-${HOME}/.cursor/lgfc-wake-ctl.sh}"
ALERT_AFTER_SEC="${LGFC_WATCHDOG_ALERT_AFTER_SEC:-1800}"
STOPPED_SINCE_FILE="${LGFC_WATCHDOG_STOPPED_SINCE_FILE:-/tmp/lgfc-wake-stopped-since}"
ALERT_MARK_FILE="${LGFC_WATCHDOG_ALERT_MARK_FILE:-/tmp/lgfc-wake-stopped-alert}"
HALT_FILE="${LGFC_WAKE_HALT_FILE:-${HOME}/.cursor/lgfc-wake-halt}"
REPO="${LGFC_WATCHDOG_REPO:-wdhunter465/next-starter-template}"

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

BIND_GRACE_FILE="${LGFC_WAKE_BIND_GRACE_FILE:-/tmp/lgfc-wake-bind-grace}"

in_bind_grace() {
  [[ -f "$BIND_GRACE_FILE" ]] || return 1
  local until
  until="$(cat "$BIND_GRACE_FILE" 2>/dev/null || echo 0)"
  [[ "$until" =~ ^[0-9]+$ ]] || return 1
  (( "$(date +%s)" < until ))
}

clear_stop_alert() {
  rm -f "$STOPPED_SINCE_FILE" "$ALERT_MARK_FILE"
}

alert_if_stopped_long_enough() {
  local state="$1" now since age
  now="$(date +%s)"
  if [[ ! -f "$STOPPED_SINCE_FILE" ]]; then
    echo "$now" >"$STOPPED_SINCE_FILE"
    echo "LGFC_WAKE_WATCHDOG stop_timer_started state=$state"
    return 0
  fi
  since="$(cat "$STOPPED_SINCE_FILE" 2>/dev/null || echo "$now")"
  [[ "$since" =~ ^[0-9]+$ ]] || since="$now"
  age=$((now - since))
  if (( age < ALERT_AFTER_SEC )); then
    echo "LGFC_WAKE_WATCHDOG stop_timer age=${age}s threshold=${ALERT_AFTER_SEC}s"
    return 0
  fi
  if [[ -f "$ALERT_MARK_FILE" ]]; then
    echo "LGFC_WAKE_WATCHDOG alert_already_open issue=$(cat "$ALERT_MARK_FILE" 2>/dev/null || true)"
    return 0
  fi
  local title body url
  title="OPS: Cursor wake loop stopped for 30 minutes"
  body=$(cat <<EOF
The Cursor wake loop has been status=${state} for ${age} seconds. The halt file is absent. The watchdog did not start the loop (#5406 Option 1, #5489).

Release: a person says take over, or the loop is status=ok again. This Issue opens once per stop. The next ok status clears the marker.
EOF
)
  if [[ "${LGFC_WATCHDOG_ALERT_DRY:-}" == "1" ]]; then
    echo "dry" >"$ALERT_MARK_FILE"
    echo "LGFC_WAKE_WATCHDOG alert_dry title=$title"
    return 0
  fi
  url="$(gh issue create --repo "$REPO" --title "$title" --label "team:operations" --label "ops:priority:2" --body "$body" 2>/dev/null || true)"
  if [[ -z "$url" ]]; then
    log "alert create failed state=$state age=${age}s"
    echo "LGFC_WAKE_WATCHDOG alert_failed age=${age}s"
    return 0
  fi
  echo "$url" >"$ALERT_MARK_FILE"
  log "alert opened $url"
  echo "LGFC_WAKE_WATCHDOG alert_opened $url"
}

check_once() {
  local line state live
  if [[ -f "$HALT_FILE" ]]; then
    log "skipped reason=halt"
    echo "LGFC_WAKE_WATCHDOG skipped reason=halt"
    return 0
  fi
  line="$("$CTL" status)"
  echo "$line"
  state="$(sed -n 's/.*status=\([^ ]*\).*/\1/p' <<<"$line")"
  if [[ "$state" == "ok" ]]; then
    clear_stop_alert
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
  alert_if_stopped_long_enough "$state"
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
