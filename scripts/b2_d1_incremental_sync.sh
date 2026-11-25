#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# B2 → D1 Incremental Sync (Idempotent Daily Sync)
# ============================================================================
# Fixes two real-world failure modes you've hit:
#   1) SQLITE_MISMATCH: caused by inserting strings into INTEGER columns (e.g., photos.id).
#      We NEVER use `id` as the external key.
#   2) Cloudflare SQL exec rejection of BEGIN/COMMIT/SAVEPOINT/ROLLBACK.
#      We never emit them, and we strip them defensively.
#
# Required env vars:
#   B2_ENDPOINT           - https://s3.<region>.backblazeb2.com
#   B2_BUCKET             - bucket name
#   B2_KEY_ID             - applicationKeyId (S3 access key id)
#   B2_APP_KEY            - applicationKey (S3 secret)
#   D1_DATABASE_NAME      - D1 database binding/name for wrangler (or D1_DATABASE_ID)
#   CLOUDFLARE_API_TOKEN  - token with D1 Edit + User Details Read
#   CLOUDFLARE_ACCOUNT_ID - Cloudflare account id (or CF_ACCOUNT_ID)
#
# Optional env vars:
#   CF_API_TOKEN / CF_ACCOUNT_ID - aliases for Cloudflare credentials
#   PUBLIC_B2_BASE_URL    - base URL for public access (default: https://<endpoint>/<bucket>)
#   DRY_RUN=1             - don't execute, just print SQL
#   D1_BATCH_SIZE=250     - statements per batch wrangler execute (default 250)
# ============================================================================

log() { echo "[b2_d1_incremental_sync] $*" >&2; }

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

# ----------------------------------------------------------------------------
# Validate env
# ----------------------------------------------------------------------------
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

# ----------------------------------------------------------------------------
# Derive region from B2_ENDPOINT: https://s3.<region>.backblazeb2.com
# ----------------------------------------------------------------------------
ENDPOINT_HOST="${B2_ENDPOINT#https://}"
ENDPOINT_HOST="${ENDPOINT_HOST%%/*}"

if [[ "$ENDPOINT_HOST" =~ ^s3\.([^.]+)\.backblazeb2\.com$ ]]; then
  export AWS_DEFAULT_REGION="${BASH_REMATCH[1]}"
else
  log "ERROR: B2_ENDPOINT must look like https://s3.<region>.backblazeb2.com"
  log "  Got: $B2_ENDPOINT"
  exit 2
fi

# ----------------------------------------------------------------------------
# Public URL base for objects
# - If PUBLIC_B2_BASE_URL is set, we use it verbatim.
# - Otherwise default to path-style public URL: https://<endpoint-host>/<bucket>
#   Example: https://s3.us-east-005.backblazeb2.com/LouGehrigFanClub
# ----------------------------------------------------------------------------
DEFAULT_PUBLIC_BASE_URL="https://${ENDPOINT_HOST}/${B2_BUCKET}"
PUBLIC_BASE_URL="${PUBLIC_B2_BASE_URL:-${DEFAULT_PUBLIC_BASE_URL}}"
PUBLIC_BASE_URL="${PUBLIC_BASE_URL%/}"

# AWS creds for B2 S3
export AWS_ACCESS_KEY_ID="$B2_KEY_ID"
export AWS_SECRET_ACCESS_KEY="$B2_APP_KEY"
export AWS_EC2_METADATA_DISABLED=true

# Cloudflare creds
export CLOUDFLARE_API_TOKEN
export CLOUDFLARE_ACCOUNT_ID

if [[ -x "./node_modules/.bin/wrangler" ]]; then
  WRANGLER_CMD=(./node_modules/.bin/wrangler)
elif command -v wrangler >/dev/null 2>&1; then
  WRANGLER_CMD=(wrangler)
else
  WRANGLER_CMD=(npx --no-install wrangler)
fi

d1_auth_hint() {
  log "HINT: Cloudflare D1 auth failed. Ensure CLOUDFLARE_API_TOKEN includes Account → D1 → Edit and User → User Details → Read."
  log "HINT: Verify CLOUDFLARE_ACCOUNT_ID matches the account that owns database \"$DB_REF\"."
}

WORKDIR="$(mktemp -d)"
trap 'rm -rf "$WORKDIR"' EXIT

OBJECTS_FILE="$WORKDIR/b2_objects.json"
EXISTING_KEYS_FILE="$WORKDIR/existing_keys.txt"
B2_KEYS_FILE="$WORKDIR/b2_keys.txt"
NEW_KEYS_FILE="$WORKDIR/new_keys.txt"
SQL_FILE="$WORKDIR/inserts.sql"
HEADER_FILE="$WORKDIR/header.sql"
BODY_FILE="$WORKDIR/body.sql"
SQL_DIR="$WORKDIR/sql_batches"
mkdir -p "$SQL_DIR"

# ----------------------------------------------------------------------------
# Wrangler exec helper
# ----------------------------------------------------------------------------
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
  log "ERROR: internal: invalid wrangler_exec mode: $mode"
  return 99
}

# ----------------------------------------------------------------------------
# Step 0: Introspect D1 `photos` columns + types
# ----------------------------------------------------------------------------
log "Reading D1 photos schema (PRAGMA table_info)..."
SCHEMA_OUT="$(wrangler_exec command "PRAGMA table_info(photos);")" || {
  log "ERROR: Failed PRAGMA table_info(photos)"
  log "$SCHEMA_OUT"
  d1_auth_hint
  exit 3
}

# Extract schema rows as JSON array of objects with at least name/type.
SCHEMA_ROWS_JSON="$(echo "$SCHEMA_OUT" | jq -c '
  [.. | arrays?] as $arrs
  | ($arrs | map(select((.[0]?|type)=="object" and (.[0]?|has("name"))))) as $cands
  | ($cands[0] // [])
' 2>/dev/null || echo "[]")"

if [[ "$SCHEMA_ROWS_JSON" == "[]" ]]; then
  # Fallback if wrangler output isn't JSON in this environment.
  log "WARNING: Could not parse schema output as JSON; assuming base schema."
  SCHEMA_ROWS_JSON='[{"name":"id","type":"INTEGER"},{"name":"url","type":"TEXT"},{"name":"is_memorabilia","type":"INTEGER"},{"name":"description","type":"TEXT"},{"name":"created_at","type":"TEXT"}]'
fi

has_col() { echo "$SCHEMA_ROWS_JSON" | jq -e --arg c "$1" 'map(.name==$c) | any' >/dev/null 2>&1; }
col_type() { echo "$SCHEMA_ROWS_JSON" | jq -r --arg c "$1" 'map(select(.name==$c))[0].type // ""' 2>/dev/null; }

# URL column
URL_COL="url"
if ! has_col "$URL_COL"; then
  if has_col "public_url"; then URL_COL="public_url"
  elif has_col "link"; then URL_COL="link"
  else
    log "ERROR: photos table missing a URL-like column (url/public_url/link)."
    exit 3
  fi
fi

# External key strategy:
# Prefer photo_id TEXT if present; else key off URL itself (TEXT).
KEY_COL=""
KEY_MODE="" # photo_id | url
if has_col "photo_id" && [[ "$(col_type "photo_id" | tr '[:lower:]' '[:upper:]')" == *"TEXT"* ]]; then
  KEY_COL="photo_id"
  KEY_MODE="photo_id"
else
  KEY_COL="$URL_COL"
  KEY_MODE="url"
fi

# Hard safety: never allow INTEGER id as key
if [[ "$KEY_COL" == "id" ]]; then
  log "ERROR: Refusing to use photos.id as external key (INTEGER)."
  exit 3
fi

HAS_IS_MEM=0; has_col "is_memorabilia" && HAS_IS_MEM=1
HAS_DESC=0; has_col "description" && HAS_DESC=1
HAS_CREATED_AT=0; has_col "created_at" && HAS_CREATED_AT=1

log "Using KEY_MODE=$KEY_MODE (KEY_COL=$KEY_COL) URL_COL=$URL_COL"

# ----------------------------------------------------------------------------
# Step 1: List B2 objects (paginated)
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
      public_url: ($base + "/" + .Key),
      uploaded_at: .LastModified
    }
  ]
}' > "$OBJECTS_FILE"

TOTAL_OBJECTS="$(jq '.objects | length' "$OBJECTS_FILE")"
log "Total objects discovered: $TOTAL_OBJECTS"
[[ "$TOTAL_OBJECTS" -eq 0 ]] && { log "No objects found. Exit."; exit 0; }

# ----------------------------------------------------------------------------
# Step 2: Read existing keys from D1
# ----------------------------------------------------------------------------
log "Querying D1 for existing keys ($KEY_COL)..."
D1_OUT="$(wrangler_exec command "SELECT \"$KEY_COL\" AS k FROM photos WHERE \"$KEY_COL\" IS NOT NULL;")" || {
  log "ERROR: Failed SELECT existing keys"
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
log "Existing key count: $EXISTING_COUNT"

# ----------------------------------------------------------------------------
# Step 3: Build B2 key list and diff
# ----------------------------------------------------------------------------
if [[ "$KEY_MODE" == "photo_id" ]]; then
  jq -r '.objects[].external_id' "$OBJECTS_FILE" | LC_ALL=C sort -u > "$B2_KEYS_FILE"
else
  jq -r '.objects[].public_url' "$OBJECTS_FILE" | LC_ALL=C sort -u > "$B2_KEYS_FILE"
fi

touch "$EXISTING_KEYS_FILE"
LC_ALL=C sort -u "$EXISTING_KEYS_FILE" -o "$EXISTING_KEYS_FILE" || true
comm -13 "$EXISTING_KEYS_FILE" "$B2_KEYS_FILE" > "$NEW_KEYS_FILE" || true

NEW_COUNT="$(wc -l < "$NEW_KEYS_FILE" | tr -d ' ')"
log "New objects to insert: $NEW_COUNT"
[[ "$NEW_COUNT" -eq 0 ]] && { log "No new objects. Exit."; exit 0; }

# ----------------------------------------------------------------------------
# Step 4: Build transaction-free SQL
# ----------------------------------------------------------------------------
sql_escape() { echo "${1//\'/\'\'}"; }

cat > "$SQL_FILE" <<SQL_HEADER
-- B2 → D1 Incremental Sync
-- Generated by scripts/b2_d1_incremental_sync.sh
-- Transaction SQL intentionally omitted.
SQL_HEADER

while IFS= read -r new_key; do
  [[ -z "$new_key" ]] && continue

  if [[ "$KEY_MODE" == "photo_id" ]]; then
    ext_id="$new_key"
    obj="$(jq --arg id "$ext_id" -c '.objects[] | select(.external_id == $id)' "$OBJECTS_FILE")" || true
    [[ -z "$obj" ]] && continue

    url="$(echo "$obj" | jq -r '.public_url')"
    uploaded="$(echo "$obj" | jq -r '.uploaded_at')"

    esc_id="$(sql_escape "$ext_id")"
    esc_url="$(sql_escape "$url")"
    esc_uploaded="$(sql_escape "$uploaded")"

    col_list="\"$KEY_COL\",\"$URL_COL\""
    val_list="'$esc_id','$esc_url'"

    [[ "$HAS_IS_MEM" -eq 1 ]] && { col_list+=",is_memorabilia"; val_list+=",0"; }
    [[ "$HAS_DESC" -eq 1 ]] && { col_list+=",description"; val_list+=",''"; }
    [[ "$HAS_CREATED_AT" -eq 1 ]] && { col_list+=",created_at"; val_list+=",'$esc_uploaded'"; }

    # #5518: a row can already exist for this object under a different photo_id
    # (bulk upload stores the content SHA, not the object key). Also match on the
    # object URL so the sync never adds a second published row for the same file.
    printf 'INSERT INTO photos (%s) SELECT %s WHERE NOT EXISTS (SELECT 1 FROM photos WHERE "%s" = '\''%s'\'' OR "%s" = '\''%s'\'');\n' \
      "$col_list" "$val_list" "$KEY_COL" "$esc_id" "$URL_COL" "$esc_url" >> "$SQL_FILE"
  else
    url="$new_key"
    obj="$(jq --arg u "$url" -c '.objects[] | select(.public_url == $u)' "$OBJECTS_FILE")" || true
    [[ -z "$obj" ]] && continue

    uploaded="$(echo "$obj" | jq -r '.uploaded_at')"
    esc_url="$(sql_escape "$url")"
    esc_uploaded="$(sql_escape "$uploaded")"

    col_list="\"$URL_COL\""
    val_list="'$esc_url'"

    [[ "$HAS_IS_MEM" -eq 1 ]] && { col_list+=",is_memorabilia"; val_list+=",0"; }
    [[ "$HAS_DESC" -eq 1 ]] && { col_list+=",description"; val_list+=",''"; }
    [[ "$HAS_CREATED_AT" -eq 1 ]] && { col_list+=",created_at"; val_list+=",'$esc_uploaded'"; }

    printf 'INSERT INTO photos (%s) SELECT %s WHERE NOT EXISTS (SELECT 1 FROM photos WHERE "%s" = '\''%s'\'');\n' \
      "$col_list" "$val_list" "$URL_COL" "$esc_url" >> "$SQL_FILE"
  fi
done < "$NEW_KEYS_FILE"

# Strip any accidental transaction statements (belt + suspenders)
grep -viE '^[[:space:]]*(BEGIN[[:space:]]+TRANSACTION|SAVEPOINT|COMMIT|ROLLBACK)\b' "$SQL_FILE" > "$SQL_FILE.stripped"
mv "$SQL_FILE.stripped" "$SQL_FILE"

# ----------------------------------------------------------------------------
# Step 5: Execute in batches
# ----------------------------------------------------------------------------
if [[ "$DRY_RUN" == "1" ]]; then
  log "DRY_RUN=1 — printing SQL and exiting."
  cat "$SQL_FILE"
  exit 0
fi

FIRST_INS_LINE="$(grep -n -m1 -E '^INSERT[[:space:]]+INTO[[:space:]]+photos' "$SQL_FILE" | cut -d: -f1 || true)"
[[ -z "$FIRST_INS_LINE" ]] && { log "ERROR: No INSERT statements generated."; exit 4; }

head -n $((FIRST_INS_LINE - 1)) "$SQL_FILE" > "$HEADER_FILE"
tail -n +"$FIRST_INS_LINE" "$SQL_FILE" > "$BODY_FILE"

# One INSERT per line so split(1) never cuts mid-statement.
LINES_PER_STMT=1
LINES_PER_BATCH=$((D1_BATCH_SIZE * LINES_PER_STMT))
split -d -a 4 -l "$LINES_PER_BATCH" "$BODY_FILE" "$SQL_DIR/batch_"

TOTAL_BATCHES="$(ls -1 "$SQL_DIR"/batch_* 2>/dev/null | wc -l | tr -d ' ')"
[[ "$TOTAL_BATCHES" -eq 0 ]] && { log "ERROR: Failed to create SQL batches."; exit 4; }

for part in "$SQL_DIR"/batch_*; do
  BATCH_FILE="$WORKDIR/exec_$(basename "$part").sql"
  cat "$HEADER_FILE" "$part" > "$BATCH_FILE"
  log "Executing $(basename "$part") ..."
  OUT="$(wrangler_exec file "$BATCH_FILE")" || {
    log "ERROR: Batch execution failed: $(basename "$part")"
    log "$OUT"
    exit 4
  }
done

log "Sync completed successfully"
log "Summary: total_b2=$TOTAL_OBJECTS existing=$EXISTING_COUNT new_attempted=$NEW_COUNT batches=$TOTAL_BATCHES key_mode=$KEY_MODE key_col=$KEY_COL url_col=$URL_COL"
exit 0