#!/usr/bin/env bash
# Compare installed Cursor wake files with the repository copies.
# Prints match or drift per file. Exit 0 only when every file matches
# and no unexpected LGFC-shaped host files are present (#5427).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${ROOT}/scripts/cursor-wake"
DEST="${LGFC_CURSOR_HOME:-${HOME}/.cursor}"
MANIFEST="${SRC}/host-manifest.txt"
fail=0

declare -A EXPECTED=()

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

while read -r mode repo_rel dest_rel; do
  [[ -z "${mode:-}" || "${mode}" == \#* ]] && continue
  EXPECTED["${dest_rel}"]=1
  check "${SRC}/${repo_rel}" "${DEST}/${dest_rel}" "${dest_rel}"
done <"${MANIFEST}"

# Unexpected LGFC-shaped host files (second rulebook / install bloat).
if [[ -f "${DEST}/AGENTS.md" ]]; then
  echo "unexpected AGENTS.md"
  fail=1
fi
if [[ -d "${DEST}/rules" ]]; then
  echo "unexpected rules/"
  fail=1
fi
if [[ -d "${DEST}/skills" ]]; then
  while IFS= read -r -d '' skilldir; do
    echo "unexpected skills/$(basename "$skilldir")/"
    fail=1
  done < <(find "${DEST}/skills" -mindepth 1 -maxdepth 1 -type d -name 'lgfc-*' -print0 2>/dev/null || true)
fi

# Any lgfc-* file under DEST not listed in the manifest.
# Skip known runtime state files that are not install targets.
while IFS= read -r -d '' f; do
  rel="${f#"${DEST}"/}"
  case "$rel" in
    lgfc-wake-poll-inbox.json|lgfc-wake-live-session|lgfc-wake-halt|lgfc-wake-ctl.log|lgfc-wake-watchdog.log|lgfc-always-on-loop.pid|lgfc-wake-status.json)
      continue
      ;;
  esac
  if [[ -z "${EXPECTED[$rel]+x}" ]]; then
    echo "unexpected ${rel}"
    fail=1
  fi
done < <(find "${DEST}" -type f -name 'lgfc-*' -print0 2>/dev/null || true)

exit "$fail"
