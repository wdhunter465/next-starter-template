#!/usr/bin/env bash
# Canonical LGFC wake-loop control. Watchdog, session hooks, and agent
# startup must all use this same stop routing so every other session's
# loop is halted the same way.
#
#   ~/.cursor/lgfc-wake-ctl.sh stop
#   ~/.cursor/lgfc-wake-ctl.sh halt
#   ~/.cursor/lgfc-wake-ctl.sh resume
#   ~/.cursor/lgfc-wake-ctl.sh bind --session <id>
#   ~/.cursor/lgfc-wake-ctl.sh rebind --session <id>
#   ~/.cursor/lgfc-wake-ctl.sh startup --session <id>
#   ~/.cursor/lgfc-wake-ctl.sh doctor
#   ~/.cursor/lgfc-wake-ctl.sh release [--session <id>]
#   ~/.cursor/lgfc-wake-ctl.sh status
#   ~/.cursor/lgfc-wake-ctl.sh start-fallback
#
# `stop` kills matching wake processes and leaves the recorded owner in place.
# `halt` stops the loop and the watchdog, clears the owner, and refuses a
# new loop until `resume`. The halt file is ~/.cursor/lgfc-wake-halt.
# `release` stops wake processes and clears the owner when this chat owns it.
# `rebind` stops other wake processes and binds this chat. It is the takeover
# command, and it is not a startup step (#5034).
#
# Product Authority "close prior sessions" means `halt`.
# Product Authority "take over" means `resume` when halted, then
# `rebind --session <this chat uuid>`. Startup never runs that sequence.
#
# `startup` reports status. It does not take ownership from another chat.
# A second chat may bind only when the live-session file is empty (#4783).
# An aborted loop is left stopped.
# Poll results: ~/.cursor/lgfc-wake-poll-inbox.json
# First-turn bind MUST pass --session <this chat uuid>.
# Product `run startup` executes the PRODUCT STARTUP FRAMEWORK in
# docs/governance/AGENT-EXECUTION.md, then Cursor's contract in
# docs/ops/ai/CURSOR-RULES.md. CORE-RULES.md is only a pointer.
# Host bind is step 0 of that Cursor Local contract, not a substitute.
# Startup authorizes no Issue, PR, or edit.
# Never touches the GitHub Actions runner.
set -euo pipefail

CTL_LOG="${LGFC_WAKE_CTL_LOG:-/tmp/lgfc-wake-ctl.log}"
LIVE_FILE="/tmp/lgfc-wake-live-session"
GRACE_FILE="/tmp/lgfc-wake-bind-grace"
HALT_FILE="${HOME}/.cursor/lgfc-wake-halt"
WATCHDOG_PID_FILE="/tmp/lgfc-wake-watchdog.pid"
LOOP_PID_FILE="/tmp/lgfc-always-on-loop.pid"
HEARTBEAT="/tmp/lgfc-always-on-loop.heartbeat"
LOOP_SRC="${HOME}/.cursor/lgfc-always-on-loop.sh"
LOOP_RUN="/tmp/lgfc-always-on-loop.sh"
LOOP_LOG="/tmp/lgfc-always-on-loop.log"
POLLER="${HOME}/.cursor/github-poller/poll-github.mjs"
REPO_ROOT_CACHE="${LGFC_WAKE_REPO_ROOT_CACHE:-/tmp/lgfc-wake-repo-root}"
RUNNER_UNIT="${LGFC_RUNNER_UNIT:-actions.runner.wdhunter465-next-starter-template.lgfc-cursor-chromebook.service}"
GRACE_SEC="${LGFC_WAKE_BIND_GRACE_SEC:-120}"
STALL_SEC="${LGFC_WATCHDOG_STALL_SEC:-180}"

# Same match list everywhere. Kill these in every session; never the runner.
WAKE_MATCH_PATTERNS=(
  'lgfc-always-on-loop\.sh'
  'poll-wake-loop'
  'github-poller/poll-loop\.sh'
)

log() {
  echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] $*" >>"$CTL_LOG"
  echo "$*"
}

is_repo_root() {
  local c="${1:-}"
  [[ -n "$c" && -f "$c/Agent.md" && -f "$c/docs/governance/AGENT-EXECUTION.md" && -f "$c/docs/governance/AGENT-TEAM.md" && -f "$c/docs/ops/ai/CURSOR-RULES.md" ]]
}

# Nested lgfc-* worktrees also contain Agent.md. Prefer the parent checkout
# so startup does not read a stale copy of the governance chain.
is_nested_checkout() {
  local c="${1:-}" parent
  [[ -n "$c" ]] || return 1
  parent="$(dirname "$c")"
  [[ "$parent" != "$c" && -f "$parent/Agent.md" && -f "$parent/docs/governance/AGENT-EXECUTION.md" ]]
}

accept_repo_root() {
  local c="${1:-}"
  is_repo_root "$c" && ! is_nested_checkout "$c"
}

resolve_repo_root() {
  local c git_top d newest=""
  if accept_repo_root "${LGFC_REPO_ROOT:-}"; then
    printf '%s\n' "$LGFC_REPO_ROOT"
    return 0
  fi
  if accept_repo_root "${PWD:-}"; then
    printf '%s\n' "$PWD"
    return 0
  fi
  git_top="$(git rev-parse --show-toplevel 2>/dev/null || true)"
  if accept_repo_root "$git_top"; then
    printf '%s\n' "$git_top"
    return 0
  fi
  if [[ -f "$REPO_ROOT_CACHE" ]]; then
    c="$(tr -d '\n' <"$REPO_ROOT_CACHE" 2>/dev/null || true)"
    if accept_repo_root "$c"; then
      printf '%s\n' "$c"
      return 0
    fi
  fi
  if accept_repo_root "${HOME}/next-starter-template"; then
    printf '%s\n' "${HOME}/next-starter-template"
    return 0
  fi
  if accept_repo_root "${HOME}/next-starter-template/next-starter-template"; then
    printf '%s\n' "${HOME}/next-starter-template/next-starter-template"
    return 0
  fi
  if [[ -d "${HOME}/next-starter-template" ]]; then
    while read -r _stamp dir; do
      if accept_repo_root "$dir"; then
        printf '%s\n' "$dir"
        return 0
      fi
    done < <(find "${HOME}/next-starter-template" -maxdepth 2 -name Agent.md -printf '%T@ %h\n' 2>/dev/null | sort -nr)
  fi
  printf '%s\n' "${HOME}/next-starter-template/next-starter-template"
}

repo_root() {
  local c
  c="$(resolve_repo_root)"
  if accept_repo_root "$c"; then
    printf '%s\n' "$c" >"$REPO_ROOT_CACHE"
  fi
  printf '%s\n' "$c"
}

halted() {
  [[ -f "$HALT_FILE" ]]
}

refuse_if_halted() {
  local action="$1"
  if ! halted; then
    return 1
  fi
  log "refused $action while halt file exists ($HALT_FILE)"
  echo "refused $action reason=halt file=$HALT_FILE"
  return 0
}

stop_watchdog() {
  local p still="" round
  local -a pids=()
  if [[ -f "$WATCHDOG_PID_FILE" ]]; then
    p="$(tr -d '[:space:]' <"$WATCHDOG_PID_FILE" 2>/dev/null || true)"
    if [[ "$p" =~ ^[0-9]+$ && -d "/proc/$p" ]]; then
      pids+=("$p")
    fi
  fi
  while read -r p; do
    [[ "$p" =~ ^[0-9]+$ ]] || continue
    pids+=("$p")
  done < <(pgrep -f 'lgfc-wake-watchdog\.sh' || true)
  if [[ ${#pids[@]} -eq 0 ]]; then
    rm -f "$WATCHDOG_PID_FILE"
    echo "watchdog stopped pids=none"
    return 0
  fi
  log "halt stopping watchdog ${pids[*]}"
  for p in "${pids[@]}"; do
    kill "$p" 2>/dev/null || true
  done
  for round in 1 2 3 4 5; do
    still=""
    sleep 0.3
    for p in "${pids[@]}"; do
      if [[ -d "/proc/$p" ]]; then
        still+="$p "
      fi
    done
    [[ -z "$still" ]] && break
  done
  if [[ -n "$still" ]]; then
    log "halt killing watchdog $still"
    for p in $still; do
      kill -9 "$p" 2>/dev/null || true
    done
  fi
  rm -f "$WATCHDOG_PID_FILE"
  echo "watchdog stopped"
}

halt_services() {
  cat >"$HALT_FILE" <<EOF
halted_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
reason=product-authority-stop
EOF
  log "halt set file=$HALT_FILE"
  stop_all || true
  stop_watchdog || true
  rm -f "$LIVE_FILE" "$GRACE_FILE" "$LOOP_PID_FILE"
  echo "halted file=$HALT_FILE loops_stopped watchdog_stopped"
}

resume_services() {
  rm -f "$HALT_FILE"
  log "halt cleared (loop not started)"
  echo "resumed halt_cleared loop_not_started"
}

in_grace() {
  [[ -f "$GRACE_FILE" ]] || return 1
  local until
  until="$(cat "$GRACE_FILE" 2>/dev/null || echo 0)"
  [[ "$until" =~ ^[0-9]+$ ]] || return 1
  (( "$(date +%s)" < until ))
}

write_grace() {
  echo "$(( $(date +%s) + GRACE_SEC ))" >"$GRACE_FILE"
}

live_session() {
  [[ -f "$LIVE_FILE" ]] || return 0
  awk -F= '/^session_id=/{print $2; exit}' "$LIVE_FILE" 2>/dev/null || true
}

write_live() {
  local sid="${1:-unknown}"
  cat >"$LIVE_FILE" <<EOF
session_id=$sid
bound_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
pid=$$
EOF
}

cmdline_of() {
  tr '\0' ' ' <"/proc/$1/cmdline" 2>/dev/null || true
}

is_protected_pid() {
  local pid="$1" cmd
  cmd="$(cmdline_of "$pid")"
  [[ "$cmd" == *actions.runner* ]] && return 0
  [[ "$cmd" == *lgfc-cursor-chromebook* ]] && return 0
  [[ "$cmd" == *lgfc-wake-watchdog.sh* ]] && return 0
  [[ "$cmd" == *lgfc-wake-ctl.sh* ]] && return 0
  [[ "$pid" == "$$" ]] && return 0
  return 1
}

is_wake_pid() {
  local pid="$1" cmd pat
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  [[ -d "/proc/$pid" ]] || return 1
  is_protected_pid "$pid" && return 1
  cmd="$(cmdline_of "$pid")"
  for pat in "${WAKE_MATCH_PATTERNS[@]}"; do
    if [[ "$cmd" =~ $pat ]]; then
      return 0
    fi
  done
  return 1
}

matching_pids() {
  local pat p
  local -A seen=()
  for pat in "${WAKE_MATCH_PATTERNS[@]}"; do
    for p in $(pgrep -f "$pat" || true); do
      if is_wake_pid "$p" && [[ -z "${seen[$p]:-}" ]]; then
        seen[$p]=1
        echo "$p"
      fi
    done
  done
  if [[ -f "$LOOP_PID_FILE" ]]; then
    p="$(cat "$LOOP_PID_FILE" 2>/dev/null || true)"
    if is_wake_pid "${p:-}" && [[ -z "${seen[$p]:-}" ]]; then
      echo "$p"
    fi
  fi
}

stop_all() {
  local p still="" round
  local -a pids=()
  mapfile -t pids < <(matching_pids | sort -u)
  if [[ ${#pids[@]} -eq 0 ]]; then
    rm -f "$LOOP_PID_FILE"
    echo "stopped pids=none"
    return 0
  fi
  log "stop sending TERM to ${pids[*]}"
  for p in "${pids[@]}"; do
    kill "$p" 2>/dev/null || true
  done
  for round in 1 2 3 4 5; do
    still=""
    sleep 0.4
    for p in "${pids[@]}"; do
      if is_wake_pid "$p"; then
        still+="$p "
      fi
    done
    [[ -z "$still" ]] && break
  done
  if [[ -n "$still" ]]; then
    log "stop sending KILL to $still"
    for p in $still; do
      kill -9 "$p" 2>/dev/null || true
    done
    sleep 0.3
  fi
  rm -f "$LOOP_PID_FILE"
  mapfile -t pids < <(matching_pids | sort -u)
  if [[ ${#pids[@]} -gt 0 ]]; then
    log "stop leftover ${pids[*]}"
    echo "stopped leftover=${pids[*]}"
    return 1
  fi
  echo "stopped pids=${pids[*]:-none} (cleared)"
}

loop_pid() {
  [[ -f "$LOOP_PID_FILE" ]] || return 0
  cat "$LOOP_PID_FILE" 2>/dev/null || true
}

is_loop_pid() {
  local pid="${1:-}" cmd
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  [[ -d "/proc/$pid" ]] || return 1
  cmd="$(cmdline_of "$pid")"
  [[ "$cmd" == *lgfc-always-on-loop.sh* ]]
}

loop_state() {
  local pid
  pid="$(loop_pid)"
  if ! is_loop_pid "${pid:-}"; then
    echo "stopped"
    return
  fi
  if [[ -f "$HEARTBEAT" ]]; then
    local age
    age="$(( $(date +%s) - $(stat -c %Y "$HEARTBEAT") ))"
    if (( age > STALL_SEC )); then
      echo "stalled"
      return
    fi
  fi
  echo "ok"
}

start_fallback() {
  local live
  if refuse_if_halted start-fallback; then
    return 0
  fi
  live="$(live_session)"
  if [[ -n "$live" && "$live" != "none" ]]; then
    log "refuse start-fallback while live_session=$live (Composer notify required; nohup is not inject)"
    echo "refused start-fallback composer_inject_required session=$live"
    return 0
  fi
  if [[ ! -f "$LOOP_SRC" ]]; then
    log "ERROR missing $LOOP_SRC"
    return 1
  fi
  cp -f "$LOOP_SRC" "$LOOP_RUN"
  chmod +x "$LOOP_RUN" "$LOOP_SRC"
  nohup bash "$LOOP_RUN" >>"$LOOP_LOG" 2>&1 &
  local newpid=$!
  sleep 0.3
  if ! is_loop_pid "$newpid"; then
    newpid="$(loop_pid)"
  fi
  log "start-fallback pid=${newpid:-unknown}"
  echo "started pid=${newpid:-unknown}"
}

print_status() {
  local state pid hb_age="none" grace="no"
  state="$(loop_state)"
  pid="$(loop_pid)"
  in_grace && grace="yes"
  if [[ -f "$HEARTBEAT" ]]; then
    hb_age="$(( $(date +%s) - $(stat -c %Y "$HEARTBEAT") ))s"
  fi
  echo "LGFC_WAKE status=$state loop_pid=${pid:-none} heartbeat_age=$hb_age live_session=$(live_session) bind_grace=$grace halt=$(halted && echo yes || echo no)"
}

check_file() {
  local path="$1"
  if [[ -f "$path" ]]; then
    echo "PASS $path"
    return 0
  fi
  echo "FAIL missing $path"
  return 1
}

doctor() {
  local fail=0 root
  root="$(repo_root)"
  echo "LGFC_WAKE doctor repo_root=$root"
  check_file "$LOOP_SRC" || fail=1
  check_file "$POLLER" || fail=1
  check_file "$root/Agent.md" || fail=1
  check_file "$root/docs/governance/REPOSITORY-AUTHORITY.md" || fail=1
  check_file "$root/docs/governance/AGENT-TEAM.md" || fail=1
  check_file "$root/docs/governance/AGENT-EXECUTION.md" || fail=1
  check_file "$root/docs/ops/ai/CORE-RULES.md" || fail=1
  check_file "$root/docs/ops/ai/CURSOR-RULES.md" || fail=1
  if command -v gh >/dev/null 2>&1 && timeout 5 gh auth status >/dev/null 2>&1; then
    echo "PASS gh auth"
  else
    echo "FAIL gh auth"
    fail=1
  fi
  if command -v systemctl >/dev/null 2>&1; then
    if systemctl is-active --quiet "$RUNNER_UNIT" 2>/dev/null; then
      echo "PASS runner $RUNNER_UNIT"
    else
      echo "FAIL runner $RUNNER_UNIT inactive"
      fail=1
    fi
  else
    echo "FAIL systemctl missing"
    fail=1
  fi
  print_status
  if [[ "$fail" -eq 0 ]]; then
    echo "LGFC_WAKE doctor=PASS"
    return 0
  fi
  echo "LGFC_WAKE doctor=FAIL"
  return 1
}

print_session_ready() {
  local root
  root="$(repo_root)"
  if halted; then
    cat <<EOF
LGFC_SESSION_HALTED
Wake loop, watchdog restart, bind, and rebind are refused while $HALT_FILE exists.
Do not start a loop. Do not rebind. Do not start the watchdog.
Clear only with: ~/.cursor/lgfc-wake-ctl.sh resume
Product Authority "take over" is that resume, then: ~/.cursor/lgfc-wake-ctl.sh rebind --session <this chat uuid>
Startup does not run that sequence.
EOF
    return 0
  fi
  cat <<EOF
LGFC_SESSION_READY
The literal command \`run startup\` is mandatory for Cursor Local. Do it
before any other repo work, then stop. Host bind is step 0, not a substitute.

Cursor Local \`run startup\`:
0. Report wake status from startup --session. Do not rebind. Start one
   loop only when the live-session file is empty and the halt file is
   absent. Report owner, runner, and loop PID.
1. Read, from the doctor repo_root above (never a nested lgfc-* worktree):
   - Agent.md
   - docs/governance/REPOSITORY-AUTHORITY.md
   - docs/governance/AGENT-TEAM.md
   - docs/governance/AGENT-EXECUTION.md (PRODUCT STARTUP FRAMEWORK is the
     contract). docs/ops/ai/CORE-RULES.md is a pointer, not the contract.
   - docs/ops/ai/CURSOR-RULES.md
2. Report each file as read.
3. From AGENT-TEAM, report Cursor's primary and secondary roles and the
   work-selection order for Operations, Engineering, Governance, and PMO Admin.
4. Declare product Cursor, orientation only. Startup authorizes no Issue,
   PR, or file edit.
5. Stop. Do not pick a queue item.

Wake ownership (#4783):
- One owner. Identify this chat uuid. Never run unnamed \`bind\`.
- Do not \`rebind\` during startup. Do not stop another session's loop.
- If live_session is another chat: that chat stays the owner. Name the
  next command and do not run it: \`resume\` when halted, then
  \`rebind --session <this chat uuid>\`. Report the PID when the loop is
  ok. If the loop is stopped or stalled, report it and leave it stopped.
- A chat may start exactly one loop only when the live-session file is
  empty, the halt file is absent, and Product Authority asked for the poll.
- Latest poll for every open chat: ~/.cursor/lgfc-wake-poll-inbox.json
- Do not kill the Actions runner or lgfc-wake-watchdog.
- Retired poll-wake-loop.sh stays stopped.

GitHub does not wake Cursor through the Notifications inbox.
1. In-session awareness: one owner runs lgfc-always-on-loop.sh. It sleeps
   60s, runs ~/.cursor/github-poller/poll-github.mjs, prints
   AGENT_LOOP_TICK_lgfc_always_on, and writes
   ~/.cursor/lgfc-wake-poll-inbox.json for every open chat.
2. Cold auto-start when no Composer chat is live: GitHub Actions
   lgfc-cursor-dispatch on runner lgfc-cursor-chromebook (label lgfc-cursor)
   launches identifiers-only agent -p. It does not inject into an open chat.
Not in use: Cursor Local Bridge, a webhook pager, and notification email.

Read this documentation stack now, from $root, then report each file as read:
1. $root/Agent.md
2. $root/docs/governance/REPOSITORY-AUTHORITY.md
3. $root/docs/governance/AGENT-TEAM.md
4. $root/docs/governance/AGENT-EXECUTION.md
5. $root/docs/ops/ai/CURSOR-RULES.md
Pointer only, after the framework: $root/docs/ops/ai/CORE-RULES.md

Host startup does not authorize Issues, PRs, or file edits.
After the first-response checklist, the session is ready.
Work only Issues Product Authority names in this chat.
Do not occupy the session with standing-queue tick reports.
handoff:ready is not website Go. Do not self-merge.
EOF
}

startup() {
  local sid="${1:-unknown}" current state
  if halted; then
    log "startup halted session=$sid (no bind, no loop)"
    echo "Wake services are halted. Do not bind, rebind, or start a loop."
    doctor || true
    print_session_ready
    return 0
  fi
  current="$(live_session)"
  state="$(loop_state)"
  if [[ -n "$current" && "$current" != "unknown" && "$current" != "$sid" ]]; then
    log "startup left session=$sid live=$current loop=$state pid=$(loop_pid)"
    echo "Wake owner is session=$current loop=$state pid=$(loop_pid)."
    echo "Startup does not take over. Do not start a second loop. An aborted loop stays stopped."
    echo "After Product Authority says \"take over\", run: ~/.cursor/lgfc-wake-ctl.sh resume"
    echo "then: ~/.cursor/lgfc-wake-ctl.sh rebind --session $sid"
    echo "Poll inbox: ${HOME}/.cursor/lgfc-wake-poll-inbox.json"
  elif [[ -n "$current" && "$current" != "unknown" ]]; then
    log "startup left session=$sid live=$current loop=$state pid=$(loop_pid)"
    echo "Wake owner is this chat session=$current loop=$state pid=$(loop_pid)."
    echo "Do not start a second loop. An aborted loop stays stopped."
    echo "Poll inbox: ${HOME}/.cursor/lgfc-wake-poll-inbox.json"
  elif [[ "$state" == "ok" ]]; then
    write_live "$sid"
    log "startup claimed running loop session=$sid pid=$(loop_pid)"
    echo "Claimed the running loop without restarting it. session=$sid pid=$(loop_pid)"
  else
    bind "$sid"
    echo "Live session was empty and the loop was stopped."
    echo "This chat may start exactly one loop. Do not rebind."
  fi
  doctor || true
  print_session_ready
}

bind() {
  local sid="${1:-unknown}" current
  if refuse_if_halted "bind session=$sid"; then
    return 0
  fi
  current="$(live_session)"
  if [[ -n "$current" && "$current" == "$sid" && "$(loop_state)" == "ok" ]]; then
    echo "already-bound session=$sid pid=$(loop_pid)"
    return 0
  fi
  # bind never steals a named owner. Explicit takeover is `rebind` only,
  # and startup must not call rebind (#4783).
  if [[ -n "$current" && "$current" != "unknown" && "$current" != "$sid" ]]; then
    log "bind refused session=$sid live=$current loop=$(loop_state)"
    echo "bind refused session=$sid live=$current"
    echo "Do not rebind during startup. Owner stays $current."
    echo "After Product Authority says \"take over\": ~/.cursor/lgfc-wake-ctl.sh resume && ~/.cursor/lgfc-wake-ctl.sh rebind --session $sid"
    return 0
  fi
  if [[ "$sid" == "unknown" && -n "$current" && "$current" != "unknown" ]]; then
    log "bind skipped session=unknown live=$current loop=$(loop_state)"
    echo "bind skipped session=unknown live=$current"
    return 0
  fi
  write_live "$sid"
  write_grace
  log "bind session=$sid (stop all other-session wake processes)"
  stop_all
  write_live "$sid"
  echo "bound session=$sid prior_loops_stopped"
}

rebind() {
  local sid="${1:-unknown}"
  if refuse_if_halted "rebind session=$sid"; then
    return 0
  fi
  if [[ -z "$sid" || "$sid" == "unknown" ]]; then
    echo "rebind requires --session <this chat uuid>" >&2
    return 2
  fi
  log "rebind session=$sid (stop then exclusive bind)"
  stop_all
  rm -f "$LIVE_FILE"
  bind "$sid"
}

release() {
  local sid="${1:-}" current
  current="$(live_session)"
  if [[ -n "$sid" && -n "$current" && "$current" != "$sid" ]]; then
    echo "release skipped session=$sid live=$current"
    return 0
  fi
  log "release session=${sid:-$current} (same stop routing)"
  stop_all
  rm -f "$LIVE_FILE"
  echo "released session=${sid:-$current}"
}

usage() {
  echo "usage: $0 stop|halt|resume|bind --session id|rebind --session id|startup --session id|doctor|release [--session id]|status|start-fallback" >&2
  exit 2
}

cmd="${1:-}"
shift || true
session=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --session)
      session="${2:-}"
      shift 2
      ;;
    *)
      usage
      ;;
  esac
done

case "$cmd" in
  stop) stop_all ;;
  halt) halt_services ;;
  resume) resume_services ;;
  bind) bind "${session:-unknown}" ;;
  rebind) rebind "${session:-unknown}" ;;
  startup) startup "${session:-unknown}" ;;
  doctor) doctor ;;
  release) release "$session" ;;
  status) print_status ;;
  start-fallback) start_fallback ;;
  *) usage ;;
esac
