#!/usr/bin/env bash
set -euo pipefail

# ZIP history purge for wdhunter465/next-starter-template
# Removes all *.zip from git history and force-pushes rewritten history.
# SAFETY: creates a remote backup tag first.

REPO_URL="${REPO_URL:-https://github.com/wdhunter465/next-starter-template.git}"
WORKDIR="${WORKDIR:-/tmp/lgfc-zip-history-rewrite}"
ZIP_GLOB="${ZIP_GLOB:-*.zip}"
DRY_RUN="${DRY_RUN:-0}"

log(){ printf "%s %s\n" "[$(date -u +'%Y-%m-%dT%H:%M:%SZ')]" "$*"; }
die(){ log "ERROR: $*"; exit 1; }

command -v git >/dev/null 2>&1 || die "git not found"
command -v python3 >/dev/null 2>&1 || die "python3 not found"

log "Starting ZIP history purge"
log "REPO_URL=$REPO_URL"
log "WORKDIR=$WORKDIR"
log "ZIP_GLOB=$ZIP_GLOB"
log "DRY_RUN=$DRY_RUN"

git config --global http.postBuffer 524288000 >/dev/null 2>&1 || true
git config --global core.compression 1 >/dev/null 2>&1 || true
git config --global pack.threads 1 >/dev/null 2>&1 || true

git ls-remote "$REPO_URL" >/dev/null 2>&1 || die "Cannot access remote (auth/network)."

rm -rf "$WORKDIR"
mkdir -p "$WORKDIR"
cd "$WORKDIR"

git clone --mirror "$REPO_URL" repo.git
cd repo.git

python3 -m pip install --user --upgrade git-filter-repo >/dev/null
export PATH="$HOME/.local/bin:$PATH"
command -v git-filter-repo >/dev/null 2>&1 || die "git-filter-repo install failed"

BACKUP_TAG="backup/pre-zip-purge-$(date -u +'%Y%m%d-%H%M%S')"
log "Creating backup tag: $BACKUP_TAG"
if git show-ref --verify --quiet "refs/remotes/origin/main"; then
  git tag -f "$BACKUP_TAG" "refs/remotes/origin/main"
else
  git tag -f "$BACKUP_TAG" HEAD
fi
git push origin "refs/tags/$BACKUP_TAG" --force

log "Rewriting history to remove: $ZIP_GLOB"
git filter-repo --force --path-glob "$ZIP_GLOB" --invert-paths

log "Verifying no ZIPs remain..."
if git rev-list --objects --all | grep -Eim 1 '\.zip$'; then
  die "ZIPs still present after rewrite. Aborting."
fi
log "Verification PASS."

if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN=1: not pushing. Rewritten mirror at $WORKDIR/repo.git"
  exit 0
fi

log "Force-pushing rewritten history..."
git push --force --mirror

log "DONE. Rollback tag: $BACKUP_TAG"
