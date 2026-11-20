#!/usr/bin/env bash
# Place the repository wake scripts into the Cursor host directory.
# Does not rebind, stop, or start a loop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${ROOT}/scripts/cursor-wake"
DEST="${LGFC_CURSOR_HOME:-${HOME}/.cursor}"
HOOKS_SRC="${SRC}/hooks"

mkdir -p "${DEST}/github-poller" "${DEST}/hooks"
install -m 0755 "${SRC}/lgfc-wake-ctl.sh" "${DEST}/lgfc-wake-ctl.sh"
install -m 0755 "${SRC}/lgfc-always-on-loop.sh" "${DEST}/lgfc-always-on-loop.sh"
install -m 0755 "${SRC}/lgfc-wake-watchdog.sh" "${DEST}/lgfc-wake-watchdog.sh"
install -m 0644 "${SRC}/poll-github.mjs" "${DEST}/github-poller/poll-github.mjs"
install -m 0644 "${SRC}/tick-prompt.txt" "${DEST}/lgfc-tick-prompt.txt"
install -m 0644 "${SRC}/lgfc-ready-queue.txt" "${DEST}/lgfc-ready-queue.txt"

# Host hooks (#5383): continuous-workflow orientation + stop nudge.
install -m 0755 "${HOOKS_SRC}/lgfc-session-start-bind.sh" "${DEST}/hooks/lgfc-session-start-bind.sh"
install -m 0755 "${HOOKS_SRC}/lgfc-stop-continuous-pass.sh" "${DEST}/hooks/lgfc-stop-continuous-pass.sh"
if [[ -f "${HOOKS_SRC}/lgfc-session-end-release.sh" ]]; then
  install -m 0755 "${HOOKS_SRC}/lgfc-session-end-release.sh" "${DEST}/hooks/lgfc-session-end-release.sh"
fi
install -m 0644 "${HOOKS_SRC}/user-hooks.json" "${DEST}/hooks.json"

echo "installed dest=${DEST}"
