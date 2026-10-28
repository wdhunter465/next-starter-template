#!/usr/bin/env bash
# Compare installed Cursor wake files with the repository copies.
# Prints match or drift per file. Exit 0 only when every file matches.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${ROOT}/scripts/cursor-wake"
DEST="${LGFC_CURSOR_HOME:-${HOME}/.cursor}"
fail=0

check() {
  local repo="$1"
  local dest="$2"
  local label="$3"
  local repo_hash dest_hash
  if [[ ! -f "$dest" ]]; then
    echo "drift ${label} missing"
    fail=1
    return
  fi
  repo_hash="$(sha256sum "$repo" | awk '{print $1}')"
  dest_hash="$(sha256sum "$dest" | awk '{print $1}')"
  if [[ "$repo_hash" == "$dest_hash" ]]; then
    echo "match ${label}"
  else
    echo "drift ${label}"
    fail=1
  fi
}

check "${SRC}/lgfc-wake-ctl.sh" "${DEST}/lgfc-wake-ctl.sh" "lgfc-wake-ctl.sh"
check "${SRC}/lgfc-always-on-loop.sh" "${DEST}/lgfc-always-on-loop.sh" "lgfc-always-on-loop.sh"
check "${SRC}/lgfc-wake-watchdog.sh" "${DEST}/lgfc-wake-watchdog.sh" "lgfc-wake-watchdog.sh"
check "${SRC}/poll-github.mjs" "${DEST}/github-poller/poll-github.mjs" "github-poller/poll-github.mjs"
check "${SRC}/tick-prompt.txt" "${DEST}/lgfc-tick-prompt.txt" "lgfc-tick-prompt.txt"
check "${SRC}/lgfc-ready-queue.txt" "${DEST}/lgfc-ready-queue.txt" "lgfc-ready-queue.txt"

exit "$fail"
