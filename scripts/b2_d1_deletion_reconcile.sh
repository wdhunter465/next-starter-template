#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# B2 → D1 Deletion Reconciliation (#2519)
# ============================================================================
# Detects photos rows whose object key is absent from B2 and retires them from
# public selection (is_matchup_eligible = -1 + PURGE_ELIGIBLE rights note).
#
# This is the governed reverse of additive incremental sync: B2 remains canonical
# blob store; D1 rows are soft-retired (not hard-deleted) to preserve historical
# matchup references.
#
# Required env vars: same as scripts/b2_d1_incremental_sync.sh
# After soft-retire, also repairs active weekly_matchups that still reference
# excluded photos (keep healthy slot when possible) and clears weekly_votes when
# the pair changes. Emits findings outputs for GitHub Actions issue upsert.
#
# Optional:
#   DRY_RUN=1
#   D1_BATCH_SIZE=250
# ============================================================================

log() { echo "[b2_d1_deletion_reconcile] $*" >&2; }

require_cmd() {
  local c="$1"
  if ! command -v "$c" >/dev/null 2>&1; then
    log "ERROR: Missing required command: $c"
    exit 90
  fi
}

require_cmd aws
require_cmd jq
require_cmd sort
require_cmd comm
require_cmd mktemp
require_cmd wc
require_cmd grep
require_cmd sed
require_cmd cut
require_cmd tr
require_cmd split
require_cmd npx

if [[ -z "${CLOUDFLARE_API_TOKEN:-}" && -n "${CF_API_TOKEN:-}" ]]; then
  export CLOUDFLARE_API_TOKEN="$CF_API_TOKEN"
fi
if [[ -z "${CLOUDFLARE_ACCOUNT_ID:-}" && -n "${CF_ACCOUNT_ID:-}" ]]; then
  export CLOUDFLARE_ACCOUNT_ID="$CF_ACCOUNT_ID"
fi
if [[ -z "${D1_DATABASE_NAME:-}" ]]; then
  if [[ -n "${D1_DATABASE_ID:-}" ]]; then
    export D1_DATABASE_NAME="$D1_DATABASE_ID"
  else
    export D1_DATABASE_NAME="lgfc_lite"
  fi
fi

REQUIRED_VARS=(
  "B2_ENDPOINT"
  "B2_BUCKET"
  "B2_KEY_ID"
  "B2_APP_KEY"
  "D1_DATABASE_NAME"
  "CLOUDFLARE_API_TOKEN"
  "CLOUDFLARE_ACCOUNT_ID"
)
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    log "ERROR: Required env var $var is not set"
    exit 1
  fi
done

DB_REF="$D1_DATABASE_NAME"
DRY_RUN="${DRY_RUN:-0}"
D1_BATCH_SIZE="${D1_BATCH_SIZE:-250}"

ENDPOINT_HOST="${B2_ENDPOINT#https://}"
ENDPOINT_HOST="${ENDPOINT_HOST%%/*}"
if [[ "$ENDPOINT_HOST" =~ ^s3\.([^.]+)\.backblazeb2\.com$ ]]; then
  export AWS_DEFAULT_REGION="${BASH_REMATCH[1]}"
else
  log "ERROR: B2_ENDPOINT must look like https://s3.<region>.backblazeb2.com"
  exit 2
fi

DEFAULT_PUBLIC_BASE_URL="https://${ENDPOINT_HOST}/${B2_BUCKET}"
PUBLIC_BASE_URL="${PUBLIC_B2_BASE_URL:-${DEFAULT_PUBLIC_BASE_URL}}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"

export AWS_ACCESS_KEY_ID="$B2_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$B2_APP_KEY"
export AWS_EC2_METADATA_DISABLED=true
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID

if [[ -x "./node_modules/.bin/wrangler" ]]; then
  WRANGLER_CMD=(./node_modules/.bin/wrangler)
elif command -v wrangler >/dev/null 2>&1; then
  WRANGLER_CMD=(wrangler)
else
  WRANGLER_CMD=(npx --no-install wrangler)
fi

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

OBJECTS_FILE="$WORKDIR/b2_objects.json"
EXISTING_KEYS_FILE="$WORKDIR/existing_keys.txt"
B2_KEYS_FILE="$WORKDIR/b2_keys.txt"
STALE_KEYS_FILE="$WORKDIR/stale_keys.txt"
SQL_FILE="$WORKDIR/retire.sql"
SQL_DIR="$WORKDIR/sql_batches"
mkdir -p "$SQL_DIR"

wrangler_exec() {
  local mode="$1" payload="$2"
  if [[ "$mode" == "command" ]]; then
    "${WRANGLER_CMD[@]}" d1 execute "$DB_REF" --remote --command "$payload" --json 2>&1 || \
      "${WRANGLER_CMD[@]}" d1 execute "$DB_REF" --remote --command "$payload" 2>&1
    return $?
  fi
  if [[ "$mode" == "file" ]]; then
    "${WRANGLER_CMD[@]}" d1 execute "$DB_REF" --remote --file "$payload" --json 2>&1 || \
      "${WRANGLER_CMD[@]}" d1 execute "$DB_REF" --remote --file "$payload" 2>&1
    return $?
  fi
  return 99
}

sql_escape() { echo "${1//\'/\'\'}"; }

# Extract first JSON row-array whose objects have key $1 from wrangler output.
extract_d1_rows() {
  local field="$1"
  jq -c --arg f "$field" '
    [.. | arrays?] as $arrs
    | ($arrs | map(select((.[0]?|type)=="object" and (.[0]?|has($f))))) as $cands
    | ($cands[0] // [])
  ' 2>/dev/null || echo "[]"
}

emit_github_outputs() {
  local retired="$1" repaired="$2" sample="$3" media_retired="${4:-0}"
  local has_findings="false"
  if [[ "$retired" -gt 0 || "$repaired" -gt 0 || "$media_retired" -gt 0 ]]; then
    has_findings="true"
  fi
  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    {
      echo "retired_count=${retired}"
      echo "repaired_matchups=${repaired}"
      echo "has_findings=${has_findings}"
      echo "stale_key_sample=${sample}"
      echo "media_assets_retired_count=${media_retired}"
    } >> "$GITHUB_OUTPUT"
  fi
  log "Outputs: retired_count=${retired} repaired_matchups=${repaired} media_assets_retired_count=${media_retired} has_findings=${has_findings}"
}

pick_eligible_photo_id() {
  local exclude_sql="$1"
  local q="SELECT id FROM photos WHERE url IS NOT NULL AND TRIM(url) != '' AND is_matchup_eligible >= 0 AND id NOT IN (${exclude_sql}) ORDER BY RANDOM() LIMIT 1;"
  local out id
  out="$(wrangler_exec command "$q")" || return 1
  id="$(echo "$out" | extract_d1_rows id | jq -r '.[0].id // empty')"
  if [[ -z "$id" || "$id" == "null" ]]; then
    return 1
  fi
  echo "$id"
}

# ----------------------------------------------------------------------------
# Schema + key mode (same strategy as incremental sync)
# ----------------------------------------------------------------------------
log "Reading D1 photos schema..."
SCHEMA_OUT="$(wrangler_exec command "PRAGMA table_info(photos);")" || {
  log "ERROR: Failed PRAGMA table_info(photos)"
  exit 3
}

SCHEMA_ROWS_JSON="$(echo "$SCHEMA_OUT" | jq -c '
  [.. | arrays?] as $arrs
  | ($arrs | map(select((.[0]?|type)=="object" and (.[0]?|has("name"))))) as $cands
  | ($cands[0] // [])
' 2>/dev/null || echo "[]")"

if [[ "$SCHEMA_ROWS_JSON" == "[]" ]]; then
  SCHEMA_ROWS_JSON='[{"name":"id","type":"INTEGER"},{"name":"url","type":"TEXT"},{"name":"photo_id","type":"TEXT"},{"name":"is_matchup_eligible","type":"INTEGER"},{"name":"rights_notes","type":"TEXT"}]'
fi

has_col() { echo "$SCHEMA_ROWS_JSON" | jq -e --arg c "$1" 'map(.name==$c) | any' >/dev/null 2>&1; }
col_type() { echo "$SCHEMA_ROWS_JSON" | jq -r --arg c "$1" 'map(select(.name==$c))[0].type // ""' 2>/dev/null; }

URL_COL="url"
if ! has_col "$URL_COL"; then
  if has_col "public_url"; then URL_COL="public_url"
  elif has_col "link"; then URL_COL="link"
  else
    log "ERROR: photos table missing a URL-like column"
    exit 3
  fi
fi

KEY_COL=""
KEY_MODE=""
if has_col "photo_id" && [[ "$(col_type "photo_id" | tr '[:lower:]' '[:upper:]')" == *"TEXT"* ]]; then
  KEY_COL="photo_id"
  KEY_MODE="photo_id"
else
  KEY_COL="$URL_COL"
  KEY_MODE="url"
fi

if ! has_col "is_matchup_eligible"; then
  log "ERROR: photos.is_matchup_eligible is required for deletion reconciliation"
  exit 3
fi

HAS_RIGHTS=0
has_col "rights_notes" && HAS_RIGHTS=1

log "Using KEY_MODE=$KEY_MODE KEY_COL=$KEY_COL URL_COL=$URL_COL"

# ----------------------------------------------------------------------------
# List B2
# ----------------------------------------------------------------------------
log "Listing B2 objects from bucket: $B2_BUCKET"
ALL_OBJECTS='[]'
TOKEN=""
while true; do
  AWS_ARGS=(--endpoint-url "$B2_ENDPOINT" s3api list-objects-v2 --bucket "$B2_BUCKET" --max-keys 1000)
  [[ -n "$TOKEN" ]] && AWS_ARGS+=(--continuation-token "$TOKEN")

  RESPONSE="$(aws "${AWS_ARGS[@]}" 2>&1)" || {
    log "ERROR: aws s3api list-objects-v2 failed"
    log "$RESPONSE"
    exit 2
  }

  CONTENTS="$(echo "$RESPONSE" | jq -c '.Contents // []')"
  ALL_OBJECTS="$(echo "$ALL_OBJECTS" | jq -c --argjson n "$CONTENTS" '. + $n')"

  if [[ "$(echo "$RESPONSE" | jq -r '.IsTruncated // false')" == "true" ]]; then
    TOKEN="$(echo "$RESPONSE" | jq -r '.NextContinuationToken // ""')"
    [[ -z "$TOKEN" ]] && break
  else
    break
  fi
done

echo "$ALL_OBJECTS" | jq --arg base "$PUBLIC_BASE_URL" '{
  objects: [
    .[] | {
      external_id: .Key,
      public_url: ($base + "/" + .Key)
    }
  ]
}' > "$OBJECTS_FILE"

TOTAL_OBJECTS="$(jq '.objects | length' "$OBJECTS_FILE")"
log "Total B2 objects discovered: $TOTAL_OBJECTS"

# Safety: never retire the whole catalog if B2 enumeration is empty (auth/API failure mode).
if [[ "$TOTAL_OBJECTS" -eq 0 ]]; then
  log "ERROR: B2 inventory is empty; refusing deletion reconciliation (fail closed)."
  exit 2
fi

if [[ "$KEY_MODE" == "photo_id" ]]; then
  jq -r '.objects[].external_id' "$OBJECTS_FILE" | LC_ALL=C sort -u > "$B2_KEYS_FILE"
else
  jq -r '.objects[].public_url' "$OBJECTS_FILE" | LC_ALL=C sort -u > "$B2_KEYS_FILE"
fi

# ----------------------------------------------------------------------------
# Read eligible/unreviewed D1 keys that should be reconciled
# ----------------------------------------------------------------------------
log "Querying D1 for candidate keys (is_matchup_eligible >= 0)..."
D1_OUT="$(wrangler_exec command "SELECT \"$KEY_COL\" AS k FROM photos WHERE \"$KEY_COL\" IS NOT NULL AND TRIM(\"$KEY_COL\") != '' AND is_matchup_eligible >= 0;")" || {
  log "ERROR: Failed SELECT candidate keys"
  log "$D1_OUT"
  exit 3
}

: > "$EXISTING_KEYS_FILE"
if echo "$D1_OUT" | jq -e '.' >/dev/null 2>&1; then
  echo "$D1_OUT" | jq -r '
    [.. | arrays?] as $arrs
    | ($arrs | map(select((.[0]?|type)=="object" and (.[0]?|has("k"))))) as $cands
    | ($cands[0] // [])
    | .[]?
    | .k? // empty
  ' 2>/dev/null >> "$EXISTING_KEYS_FILE" || true
fi
if [[ ! -s "$EXISTING_KEYS_FILE" ]]; then
  echo "$D1_OUT" | grep -oE '"k"\s*:\s*"[^"]*"' | sed -E 's/.*"k"\s*:\s*"([^"]*)".*/\1/' >> "$EXISTING_KEYS_FILE" || true
fi

LC_ALL=C sort -u "$EXISTING_KEYS_FILE" | grep -v '^$' > "$EXISTING_KEYS_FILE.sorted" || true
mv "$EXISTING_KEYS_FILE.sorted" "$EXISTING_KEYS_FILE" 2>/dev/null || true
EXISTING_COUNT="$(wc -l < "$EXISTING_KEYS_FILE" | tr -d ' ')"
log "Candidate D1 key count (eligible/unreviewed): $EXISTING_COUNT"

# Keys in D1 but not in B2
comm -23 "$EXISTING_KEYS_FILE" "$B2_KEYS_FILE" > "$STALE_KEYS_FILE" || true
STALE_COUNT="$(wc -l < "$STALE_KEYS_FILE" | tr -d ' ')"
log "Stale keys to retire: $STALE_COUNT"

TOTAL_BATCHES=0
STALE_SAMPLE="$(head -n 20 "$STALE_KEYS_FILE" | paste -sd',' - || true)"

if [[ "$STALE_COUNT" -eq 0 ]]; then
  log "No stale D1 rows to soft-retire."
else
  # --------------------------------------------------------------------------
  # Build retirement SQL (soft-retire; preserve historical rows)
  # --------------------------------------------------------------------------
  NOTE_BASE="PURGE_ELIGIBLE: B2 object missing during deletion reconciliation (#2519)"

  cat > "$SQL_FILE" <<SQL_HEADER
-- B2 → D1 Deletion Reconciliation
-- Generated by scripts/b2_d1_deletion_reconcile.sh
SQL_HEADER

  while IFS= read -r stale_key; do
    [[ -z "$stale_key" ]] && continue
    esc_key="$(sql_escape "$stale_key")"
    esc_note="$(sql_escape "$NOTE_BASE; key=$stale_key")"

    if [[ "$HAS_RIGHTS" -eq 1 ]]; then
      printf "UPDATE photos SET is_matchup_eligible = -1, rights_notes = CASE WHEN rights_notes IS NULL OR TRIM(rights_notes) = '' THEN '%s' ELSE rights_notes || ' | ' || '%s' END WHERE \"%s\" = '%s' AND is_matchup_eligible >= 0;\n" \
        "$esc_note" "$esc_note" "$KEY_COL" "$esc_key" >> "$SQL_FILE"
    else
      printf "UPDATE photos SET is_matchup_eligible = -1 WHERE \"%s\" = '%s' AND is_matchup_eligible >= 0;\n" \
        "$KEY_COL" "$esc_key" >> "$SQL_FILE"
    fi
  done < "$STALE_KEYS_FILE"

  # Evidence log (keys only; no secrets)
  log "Stale key sample (up to 20):"
  head -n 20 "$STALE_KEYS_FILE" | while IFS= read -r k; do
    log "  - $k"
  done

  if [[ "$DRY_RUN" == "1" ]]; then
    log "DRY_RUN=1 — printing retire SQL (matchup repair still simulated)."
    cat "$SQL_FILE"
  else
    split -d -a 4 -l "$D1_BATCH_SIZE" <(grep -E '^UPDATE[[:space:]]+photos' "$SQL_FILE") "$SQL_DIR/batch_"
    TOTAL_BATCHES="$(ls -1 "$SQL_DIR"/batch_* 2>/dev/null | wc -l | tr -d ' ')"
    [[ "$TOTAL_BATCHES" -eq 0 ]] && { log "ERROR: Failed to create SQL batches."; exit 4; }

    for part in "$SQL_DIR"/batch_*; do
      log "Executing $(basename "$part") ..."
      OUT="$(wrangler_exec file "$part")" || {
        log "ERROR: Batch execution failed: $(basename "$part")"
        log "$OUT"
        exit 4
      }
    done
  fi
fi

# ----------------------------------------------------------------------------
# #3714 phase 2b: reconcile media_assets/content_items (the newer #3551/#3552
# pipeline) against the SAME B2 listing already fetched above -- no extra B2
# API calls. Soft-delete only, via content_items' own deleted_at/
# retention_reason columns (migration 0042), built for exactly this. Never
# touches media_assets itself: it deliberately carries no status column (see
# docs/reference/content-pipeline-rights-data-dictionary.md), so nothing
# renders a media_assets row directly -- soft-deleting the linked
# content_items row is what actually removes it from any query that filters
# WHERE deleted_at IS NULL.
# ----------------------------------------------------------------------------
log "Checking for media_assets/content_items tables before phase 2b reconciliation..."
MEDIA_TABLE_CHECK="$(wrangler_exec command "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('media_assets','content_items');")" || MEDIA_TABLE_CHECK=""
MEDIA_TABLES_PRESENT="$(echo "$MEDIA_TABLE_CHECK" | extract_d1_rows name 2>/dev/null | jq 'length' 2>/dev/null || echo 0)"

MEDIA_STALE_COUNT=0
if [[ "${MEDIA_TABLES_PRESENT:-0}" -lt 2 ]]; then
  log "media_assets/content_items not present in this database -- skipping phase 2b reconciliation."
else
  RAW_B2_KEYS_FILE="$WORKDIR/raw_b2_keys.txt"
  jq -r '.objects[].external_id' "$OBJECTS_FILE" | LC_ALL=C sort -u > "$RAW_B2_KEYS_FILE"

  log "Querying D1 for media_assets.b2_key..."
  MEDIA_D1_OUT="$(wrangler_exec command "SELECT b2_key AS k FROM media_assets WHERE b2_key IS NOT NULL AND TRIM(b2_key) != '';")" || {
    log "ERROR: Failed SELECT media_assets.b2_key"
    log "$MEDIA_D1_OUT"
    exit 3
  }

  MEDIA_EXISTING_KEYS_FILE="$WORKDIR/media_existing_keys.txt"
  : > "$MEDIA_EXISTING_KEYS_FILE"
  if echo "$MEDIA_D1_OUT" | jq -e '.' >/dev/null 2>&1; then
    echo "$MEDIA_D1_OUT" | jq -r '
      [.. | arrays?] as $arrs
      | ($arrs | map(select((.[0]?|type)=="object" and (.[0]?|has("k"))))) as $cands
      | ($cands[0] // [])
      | .[]?
      | .k? // empty
    ' 2>/dev/null >> "$MEDIA_EXISTING_KEYS_FILE" || true
  fi
  LC_ALL=C sort -u "$MEDIA_EXISTING_KEYS_FILE" | grep -v '^$' > "$MEDIA_EXISTING_KEYS_FILE.sorted" || true
  mv "$MEDIA_EXISTING_KEYS_FILE.sorted" "$MEDIA_EXISTING_KEYS_FILE" 2>/dev/null || true
  MEDIA_EXISTING_COUNT="$(wc -l < "$MEDIA_EXISTING_KEYS_FILE" | tr -d ' ')"
  log "media_assets candidate key count: $MEDIA_EXISTING_COUNT"

  MEDIA_STALE_KEYS_FILE="$WORKDIR/media_stale_keys.txt"
  comm -23 "$MEDIA_EXISTING_KEYS_FILE" "$RAW_B2_KEYS_FILE" > "$MEDIA_STALE_KEYS_FILE" || true
  MEDIA_STALE_COUNT="$(wc -l < "$MEDIA_STALE_KEYS_FILE" | tr -d ' ')"
  log "media_assets stale keys (missing from B2): $MEDIA_STALE_COUNT"

  if [[ "$MEDIA_STALE_COUNT" -eq 0 ]]; then
    log "No stale media_assets-linked content_items rows to reconcile."
  else
    MEDIA_NOTE_BASE="b2_object_missing_during_reconciliation_phase2b"
    MEDIA_SQL_FILE="$WORKDIR/media_retire.sql"
    : > "$MEDIA_SQL_FILE"
    while IFS= read -r stale_key; do
      [[ -z "$stale_key" ]] && continue
      esc_key="$(sql_escape "$stale_key")"
      printf "UPDATE content_items SET deleted_at = strftime('%%Y-%%m-%%dT%%H:%%M:%%fZ','now'), retention_reason = '%s: key=%s' WHERE media_asset_id = 'b2://%s' AND deleted_at IS NULL;\n" \
        "$MEDIA_NOTE_BASE" "$esc_key" "$esc_key" >> "$MEDIA_SQL_FILE"
    done < "$MEDIA_STALE_KEYS_FILE"

    log "Stale media_assets key sample (up to 20):"
    head -n 20 "$MEDIA_STALE_KEYS_FILE" | while IFS= read -r k; do log "  - $k"; done

    if [[ "$DRY_RUN" == "1" ]]; then
      log "DRY_RUN=1 -- printing media_assets/content_items retire SQL."
      cat "$MEDIA_SQL_FILE"
    else
      OUT="$(wrangler_exec file "$MEDIA_SQL_FILE")" || {
        log "ERROR: media_assets/content_items reconciliation batch failed"
        log "$OUT"
        exit 4
      }
    fi
  fi
  log "Phase 2b summary: media_assets_candidates=$MEDIA_EXISTING_COUNT media_assets_stale=$MEDIA_STALE_COUNT content_items_retired=$MEDIA_STALE_COUNT"
fi

# ----------------------------------------------------------------------------
# Repair active matchups that still reference excluded photos (#2519 design)
# ----------------------------------------------------------------------------
log "Scanning active weekly_matchups for excluded photo references..."
MATCHUP_OUT="$(wrangler_exec command "SELECT m.id AS id, m.week_start AS week_start, m.photo_a_id AS photo_a_id, m.photo_b_id AS photo_b_id, a.is_matchup_eligible AS a_elig, b.is_matchup_eligible AS b_elig FROM weekly_matchups m JOIN photos a ON a.id = m.photo_a_id JOIN photos b ON b.id = m.photo_b_id WHERE m.status = 'active' AND (a.is_matchup_eligible < 0 OR b.is_matchup_eligible < 0);")" || {
  log "ERROR: Failed to query active matchups needing repair"
  log "$MATCHUP_OUT"
  exit 3
}

MATCHUP_ROWS="$(echo "$MATCHUP_OUT" | extract_d1_rows id)"
MATCHUP_COUNT="$(echo "$MATCHUP_ROWS" | jq 'length')"
REPAIRED_COUNT=0
UNREPAIRED_COUNT=0
REPAIR_LOG_FILE="$WORKDIR/repair_log.txt"
: > "$REPAIR_LOG_FILE"

log "Active matchups needing repair: $MATCHUP_COUNT"

if [[ "$MATCHUP_COUNT" -gt 0 ]]; then
  while IFS= read -r row; do
    [[ -z "$row" || "$row" == "null" ]] && continue
    mid="$(echo "$row" | jq -r '.id')"
    week="$(echo "$row" | jq -r '.week_start')"
    pa="$(echo "$row" | jq -r '.photo_a_id')"
    pb="$(echo "$row" | jq -r '.photo_b_id')"
    a_elig="$(echo "$row" | jq -r '.a_elig')"
    b_elig="$(echo "$row" | jq -r '.b_elig')"

    next_a="$pa"
    next_b="$pb"
    a_broken=0
    b_broken=0
    [[ "$a_elig" -lt 0 ]] && a_broken=1
    [[ "$b_elig" -lt 0 ]] && b_broken=1

    if [[ "$a_broken" -eq 1 && "$b_broken" -eq 1 ]]; then
      r1="$(pick_eligible_photo_id "0" || true)"
      if [[ -z "${r1:-}" ]]; then
        log "WARN: cannot repair matchup id=$mid week=$week (no eligible replacement for both slots)"
        echo "unrepaired matchup_id=$mid week=$week reason=no_eligible_pair" >> "$REPAIR_LOG_FILE"
        UNREPAIRED_COUNT=$((UNREPAIRED_COUNT + 1))
        continue
      fi
      r2="$(pick_eligible_photo_id "$r1" || true)"
      if [[ -z "${r2:-}" ]]; then
        log "WARN: cannot repair matchup id=$mid week=$week (only one eligible photo)"
        echo "unrepaired matchup_id=$mid week=$week reason=single_eligible" >> "$REPAIR_LOG_FILE"
        UNREPAIRED_COUNT=$((UNREPAIRED_COUNT + 1))
        continue
      fi
      next_a="$r1"
      next_b="$r2"
    elif [[ "$a_broken" -eq 1 ]]; then
      r1="$(pick_eligible_photo_id "$pa,$pb" || true)"
      if [[ -z "${r1:-}" ]]; then
        log "WARN: cannot repair Photo A for matchup id=$mid week=$week"
        echo "unrepaired matchup_id=$mid week=$week reason=no_replacement_a" >> "$REPAIR_LOG_FILE"
        UNREPAIRED_COUNT=$((UNREPAIRED_COUNT + 1))
        continue
      fi
      next_a="$r1"
    elif [[ "$b_broken" -eq 1 ]]; then
      r1="$(pick_eligible_photo_id "$pa,$pb" || true)"
      if [[ -z "${r1:-}" ]]; then
        log "WARN: cannot repair Photo B for matchup id=$mid week=$week"
        echo "unrepaired matchup_id=$mid week=$week reason=no_replacement_b" >> "$REPAIR_LOG_FILE"
        UNREPAIRED_COUNT=$((UNREPAIRED_COUNT + 1))
        continue
      fi
      next_b="$r1"
    fi

    if [[ "$next_a" == "$pa" && "$next_b" == "$pb" ]]; then
      continue
    fi
    if [[ "$next_a" == "$next_b" ]]; then
      log "WARN: refusing identical pair for matchup id=$mid"
      echo "unrepaired matchup_id=$mid week=$week reason=identical_pair" >> "$REPAIR_LOG_FILE"
      UNREPAIRED_COUNT=$((UNREPAIRED_COUNT + 1))
      continue
    fi

    log "Repairing matchup id=$mid week=$week pair ${pa},${pb} -> ${next_a},${next_b}"
    echo "repaired matchup_id=$mid week=$week from=${pa},${pb} to=${next_a},${next_b}" >> "$REPAIR_LOG_FILE"

    if [[ "$DRY_RUN" == "1" ]]; then
      REPAIRED_COUNT=$((REPAIRED_COUNT + 1))
      continue
    fi

    UPDATE_SQL="UPDATE weekly_matchups SET photo_a_id = ${next_a}, photo_b_id = ${next_b}, status = 'active' WHERE id = ${mid};"
    CLEAR_SQL="DELETE FROM weekly_votes WHERE week_start = '$(sql_escape "$week")';"
    OUT="$(wrangler_exec command "$UPDATE_SQL")" || {
      log "ERROR: Failed updating matchup id=$mid"
      log "$OUT"
      exit 4
    }
    OUT="$(wrangler_exec command "$CLEAR_SQL")" || {
      log "ERROR: Failed clearing weekly_votes for week=$week"
      log "$OUT"
      exit 4
    }
    REPAIRED_COUNT=$((REPAIRED_COUNT + 1))
  done < <(echo "$MATCHUP_ROWS" | jq -c '.[]')
fi

emit_github_outputs "$STALE_COUNT" "$REPAIRED_COUNT" "${STALE_SAMPLE}" "$MEDIA_STALE_COUNT"

log "Deletion reconciliation completed successfully"
log "Summary: total_b2=$TOTAL_OBJECTS candidates=$EXISTING_COUNT retired_attempted=$STALE_COUNT batches=$TOTAL_BATCHES repaired_matchups=$REPAIRED_COUNT unrepaired_matchups=$UNREPAIRED_COUNT key_mode=$KEY_MODE content_items_retired=$MEDIA_STALE_COUNT"
if [[ -s "$REPAIR_LOG_FILE" ]]; then
  log "Repair evidence:"
  while IFS= read -r line; do log "  $line"; done < "$REPAIR_LOG_FILE"
fi
exit 0
