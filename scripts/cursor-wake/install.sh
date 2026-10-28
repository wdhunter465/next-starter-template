#!/usr/bin/env bash
# Place the repository wake scripts into the Cursor host directory.
# Does not rebind, stop, or start a loop.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${ROOT}/scripts/cursor-wake"
DEST="${LGFC_CURSOR_HOME:-${HOME}/.cursor}"

mkdir -p "${DEST}/github-poller"
install -m 0755 "${SRC}/lgfc-wake-ctl.sh" "${DEST}/lgfc-wake-ctl.sh"
install -m 0755 "${SRC}/lgfc-always-on-loop.sh" "${DEST}/lgfc-always-on-loop.sh"
install -m 0755 "${SRC}/lgfc-wake-watchdog.sh" "${DEST}/lgfc-wake-watchdog.sh"
install -m 0644 "${SRC}/poll-github.mjs" "${DEST}/github-poller/poll-github.mjs"
install -m 0644 "${SRC}/tick-prompt.txt" "${DEST}/lgfc-tick-prompt.txt"
install -m 0644 "${SRC}/lgfc-ready-queue.txt" "${DEST}/lgfc-ready-queue.txt"

echo "installed dest=${DEST}"
