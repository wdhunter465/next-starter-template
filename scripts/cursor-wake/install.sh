#!/usr/bin/env bash
# Place the repository wake scripts into the Cursor host directory.
# Does not rebind, stop, or start a loop.
# File list: host-manifest.txt (#5427).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SRC="${ROOT}/scripts/cursor-wake"
DEST="${LGFC_CURSOR_HOME:-${HOME}/.cursor}"
MANIFEST="${SRC}/host-manifest.txt"

while read -r mode repo_rel dest_rel; do
  [[ -z "${mode:-}" || "${mode}" == \#* ]] && continue
  src_path="${SRC}/${repo_rel}"
  dest_path="${DEST}/${dest_rel}"
  mkdir -p "$(dirname "${dest_path}")"
  install -m "${mode}" "${src_path}" "${dest_path}"
done <"${MANIFEST}"

echo "installed dest=${DEST}"
