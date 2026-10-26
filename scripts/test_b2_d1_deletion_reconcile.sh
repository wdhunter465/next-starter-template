#!/usr/bin/env bash
# Smoke/structure test for b2_d1_deletion_reconcile.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RECONCILE_SCRIPT="$REPO_ROOT/scripts/b2_d1_deletion_reconcile.sh"

echo "============================================"
echo "B2 → D1 Deletion Reconciliation Script Test"
echo "============================================"

echo "Test 1: Script exists and is executable..."
if [[ ! -x "$RECONCILE_SCRIPT" ]]; then
  echo "  ✗ FAILED: Script not found or not executable: $RECONCILE_SCRIPT"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 2: Bash syntax validation..."
if ! bash -n "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Syntax errors in script"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 3: Environment variable validation..."
EXPECTED_VARS=(
  "B2_ENDPOINT"
  "B2_BUCKET"
  "B2_KEY_ID"
  "B2_APP_KEY"
  "D1_DATABASE_NAME"
  "CLOUDFLARE_API_TOKEN"
  "CLOUDFLARE_ACCOUNT_ID"
)
for var in "${EXPECTED_VARS[@]}"; do
  if ! grep -q "\"$var\"" "$RECONCILE_SCRIPT"; then
    echo "  ✗ FAILED: Script should validate $var"
    exit 1
  fi
done
echo "  ✓ PASSED"

echo "Test 4: Soft-retire policy (#2519)..."
if ! grep -q "is_matchup_eligible = -1" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should soft-retire with is_matchup_eligible = -1"
  exit 1
fi
if ! grep -q "PURGE_ELIGIBLE" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should mark PURGE_ELIGIBLE"
  exit 1
fi
if grep -qE 'DELETE[[:space:]]+FROM[[:space:]]+photos' "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script must not hard-delete photos rows"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 5: Empty B2 inventory fail-closed..."
if ! grep -q "refusing deletion reconciliation" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should refuse reconcile when B2 inventory is empty"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 6: DRY_RUN + strict mode..."
grep -q "DRY_RUN" "$RECONCILE_SCRIPT"
grep -q "set -euo pipefail" "$RECONCILE_SCRIPT"
echo "  ✓ PASSED"

echo "Test 7: Idempotent WHERE guard..."
if ! grep -q "is_matchup_eligible >= 0" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Retire UPDATE should guard with is_matchup_eligible >= 0"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 8: Active matchup repair + vote clear..."
if ! grep -q "Scanning active weekly_matchups" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should scan active matchups for excluded photos"
  exit 1
fi
if ! grep -q "DELETE FROM weekly_votes" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should clear weekly_votes when pair changes"
  exit 1
fi
if ! grep -q "UPDATE weekly_matchups SET photo_a_id" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should update weekly_matchups pair on repair"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 9: Findings outputs for Actions..."
if ! grep -q "has_findings=" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should emit has_findings to GITHUB_OUTPUT"
  exit 1
fi
if ! grep -q "repaired_matchups=" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should emit repaired_matchups"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 10: Phase 2b (media_assets/content_items) reconciliation (#3718)..."
if ! grep -q "phase 2b reconciliation" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should reconcile media_assets/content_items (phase 2b)"
  exit 1
fi
if ! grep -q "SELECT b2_key AS k, media_uid AS u FROM media_assets" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should query media_assets.b2_key"
  exit 1
fi
if grep -qE 'DELETE[[:space:]]+FROM[[:space:]]+(content_items|media_assets)' "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script must not hard-delete content_items or media_assets rows"
  exit 1
fi
if ! grep -q "UPDATE content_items SET deleted_at" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should soft-delete content_items via deleted_at, not a new status flag"
  exit 1
fi
if ! grep -q "media_assets/content_items not present in this database" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should skip gracefully when the newer pipeline tables are absent"
  exit 1
fi
if ! grep -q "jq -r '.objects\[\].external_id' \"\$OBJECTS_FILE\"" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should reuse the already-fetched B2 listing (\$OBJECTS_FILE), not make a second B2 API call"
  exit 1
fi
if ! grep -q "media_assets_retired_count=" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should emit media_assets_retired_count to GITHUB_OUTPUT"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 11: Phase 2b fails closed on unparseable wrangler JSON (#3718 Copilot finding)..."
if ! grep -q "require_json_response" "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Script should guard phase 2b D1 reads against wrangler's non-JSON fallback"
  exit 1
fi
if ! grep -q 'require_json_response "\$MEDIA_TABLE_CHECK"' "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: Table-presence check must not silently treat unparseable output as 'tables absent'"
  exit 1
fi
if ! grep -q 'require_json_response "\$MEDIA_D1_OUT"' "$RECONCILE_SCRIPT"; then
  echo "  ✗ FAILED: media_assets.b2_key query must not silently treat unparseable output as 'zero rows'"
  exit 1
fi
echo "  ✓ PASSED"

echo "Test 12: Phase 2b reports what it retired, not the stale-key count (#4885)..."
# Runs the real script against fake aws and wrangler binaries. One media_assets key
# (gone.jpg) is missing from B2. The fake D1 says how many live content_items rows
# reference it, so the three cases below exercise the reporting path end to end.
run_phase2b() {
  local ref_count="$1" tmp
  tmp="$(mktemp -d)"
  mkdir -p "$tmp/bin" "$tmp/work"
  cat > "$tmp/bin/aws" <<'AWS'
#!/usr/bin/env bash
echo '{"Contents":[{"Key":"p1.jpg"},{"Key":"p2.jpg"}],"IsTruncated":false}'
AWS
  cat > "$tmp/bin/wrangler" <<'WR'
#!/usr/bin/env bash
mode=""; payload=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --command) mode="command"; payload="$2"; shift 2 ;;
    --file) mode="file"; payload="$2"; shift 2 ;;
    *) shift ;;
  esac
done
emit() { echo "[{\"results\":$1,\"success\":true,\"meta\":{}}]"; }
if [[ "$mode" == "file" ]]; then
  cat "$payload" >> "$FAKE_WRITES"
  emit '[]'
  exit 0
fi
case "$payload" in
  "PRAGMA table_info(photos);")
    emit '[{"name":"id","type":"INTEGER"},{"name":"url","type":"TEXT"},{"name":"photo_id","type":"TEXT"},{"name":"is_matchup_eligible","type":"INTEGER"},{"name":"rights_notes","type":"TEXT"}]' ;;
  "SELECT \"photo_id\" AS k FROM photos"*)
    emit '[{"k":"p1.jpg"},{"k":"p2.jpg"}]' ;;
  "SELECT name FROM sqlite_master"*)
    emit '[{"name":"media_assets"},{"name":"content_items"}]' ;;
  "SELECT b2_key AS k, media_uid AS u FROM media_assets"*)
    emit '[{"k":"p1.jpg","u":"u1"},{"k":"gone.jpg","u":"ugone"}]' ;;
  "SELECT COUNT(*) AS n FROM content_items"*)
    echo "$payload" >> "$FAKE_COUNT_QUERIES"
    emit "[{\"n\":$FAKE_REF_COUNT}]" ;;
  *weekly_matchups*)
    emit '[]' ;;
  *)
    echo "unexpected fake wrangler payload: $payload" >&2; exit 97 ;;
esac
WR
  chmod +x "$tmp/bin/aws" "$tmp/bin/wrangler"
  : > "$tmp/writes.sql"; : > "$tmp/count_queries.sql"; : > "$tmp/out"
  set +e
  (cd "$tmp/work" && PATH="$tmp/bin:$PATH" FAKE_WRITES="$tmp/writes.sql" FAKE_COUNT_QUERIES="$tmp/count_queries.sql" \
    FAKE_REF_COUNT="$ref_count" GITHUB_OUTPUT="$tmp/out" \
    B2_ENDPOINT="https://s3.us-west-004.backblazeb2.com" B2_BUCKET="bucket" B2_KEY_ID="k" B2_APP_KEY="s" \
    D1_DATABASE_NAME="db" CLOUDFLARE_API_TOKEN="t" CLOUDFLARE_ACCOUNT_ID="a" \
    bash "$RECONCILE_SCRIPT" > "$tmp/stdout" 2> "$tmp/stderr")
  RUN_EXIT=$?
  set -e
  RUN_DIR="$tmp"
}

# Case A: the stale key has no live content_items reference.
run_phase2b 0
if [[ "$RUN_EXIT" -ne 0 ]]; then echo "  ✗ FAILED (unreferenced): script exited $RUN_EXIT"; cat "$RUN_DIR/stderr"; exit 1; fi
if ! grep -qx "media_assets_retired_count=0" "$RUN_DIR/out"; then echo "  ✗ FAILED: an unreferenced stale key must report 0 retired content_items rows"; cat "$RUN_DIR/out"; exit 1; fi
if ! grep -qx "media_assets_stale_count=1" "$RUN_DIR/out"; then echo "  ✗ FAILED: the stale register key should still be reported separately"; cat "$RUN_DIR/out"; exit 1; fi
if ! grep -qx "has_findings=false" "$RUN_DIR/out"; then echo "  ✗ FAILED: an unreferenced stale key must not raise a finding"; cat "$RUN_DIR/out"; exit 1; fi
if [[ -s "$RUN_DIR/writes.sql" ]]; then echo "  ✗ FAILED: nothing should be written when no live row references the key"; cat "$RUN_DIR/writes.sql"; exit 1; fi
if ! grep -q "'b2://gone.jpg'" "$RUN_DIR/count_queries.sql" || ! grep -q "'media_uid:ugone'" "$RUN_DIR/count_queries.sql"; then echo "  ✗ FAILED: the count must cover both the b2:// and media_uid: reference forms"; cat "$RUN_DIR/count_queries.sql"; exit 1; fi
if ! grep -q "content_items_retired=0 media_assets_stale=1" "$RUN_DIR/stderr"; then echo "  ✗ FAILED: summary should say 0 retired and 1 stale"; cat "$RUN_DIR/stderr"; exit 1; fi
rm -rf "$RUN_DIR"
echo "  ✓ PASSED (unreferenced stale key: 0 retired, no finding, no write)"

# Case B: two live content_items rows reference the stale key.
run_phase2b 2
if [[ "$RUN_EXIT" -ne 0 ]]; then echo "  ✗ FAILED (referenced): script exited $RUN_EXIT"; cat "$RUN_DIR/stderr"; exit 1; fi
if ! grep -qx "media_assets_retired_count=2" "$RUN_DIR/out"; then echo "  ✗ FAILED: retired count must equal the live rows referencing the key"; cat "$RUN_DIR/out"; exit 1; fi
if ! grep -qx "has_findings=true" "$RUN_DIR/out"; then echo "  ✗ FAILED: a referenced stale key must raise a finding"; cat "$RUN_DIR/out"; exit 1; fi
if ! grep -q "UPDATE content_items SET deleted_at" "$RUN_DIR/writes.sql" || ! grep -q "b2://gone.jpg" "$RUN_DIR/writes.sql"; then echo "  ✗ FAILED: a referenced stale key must still be soft-deleted"; cat "$RUN_DIR/writes.sql"; exit 1; fi
if grep -qE 'DELETE[[:space:]]+FROM' "$RUN_DIR/writes.sql"; then echo "  ✗ FAILED: no hard delete may be issued"; exit 1; fi
rm -rf "$RUN_DIR"
echo "  ✓ PASSED (referenced stale key: retired count equals rows, finding raised, soft-delete issued)"

# Case C: an unparseable count must fail closed.
run_phase2b '"oops"'
if [[ "$RUN_EXIT" -eq 0 ]]; then echo "  ✗ FAILED: a non-numeric reference count must make the script fail, not guess"; exit 1; fi
if [[ -s "$RUN_DIR/writes.sql" ]]; then echo "  ✗ FAILED: nothing should be written after a failed count"; exit 1; fi
rm -rf "$RUN_DIR"
echo "  ✓ PASSED (non-numeric count fails closed, nothing written)"

echo ""
echo "============================================"
echo "All tests PASSED ✓"
echo "============================================"
