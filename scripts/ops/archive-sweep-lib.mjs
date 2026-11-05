// #5098 -- the archive sweep. Pure planning and applying over a D1-style database
// (`db.prepare(sql).bind(...).all() / .first() / .run()`), with the B2 deletion injected so tests
// need no network. The CLI in archive-sweep.mjs supplies the real database and B2.
//
// The sweep removes what Product Authority's tools have approved for deletion: records in the
// lifecycle state `ok_to_delete` whose waiting period (`delete_after`) has passed. It refuses any
// item whose picture is still in use, writes a permanent tombstone, deletes the B2 objects, removes
// the picture rows, and marks the record `purged`. Every statement is safe to repeat.

export const SWEEP_ACTOR = 'archive-sweep';

export function parseArgs(argv) {
  const options = { database: 'lgfc_lite', target: 'remote', limit: 5, apply: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--database') options.database = argv[++i];
    else if (arg === '--local') options.target = 'local';
    else if (arg === '--remote') options.target = 'remote';
    else if (arg === '--limit') options.limit = Number(argv[++i]);
    else if (arg === '--apply') options.apply = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.limit) || options.limit < 1 || options.limit > 100) {
    throw new Error('--limit must be a whole number from 1 to 100.');
  }
  return options;
}


/** Records approved for deletion whose waiting period has passed. Bind: now (ISO), limit. */
export const DUE_SQL = `
SELECT id AS content_item_id, candidate_id, title, source_url, source_domain, media_asset_id,
       lifecycle_reason, lifecycle_set_by, lifecycle_set_at, lifecycle_issue, delete_after
  FROM content_items
 WHERE lifecycle_state = 'ok_to_delete' AND delete_after IS NOT NULL AND delete_after <= ?
 ORDER BY id
 LIMIT ?`;

const MEDIA_BY_REF_SQL = `SELECT id, b2_key, media_uid, b2_file_id FROM media_assets WHERE b2_key = ? OR media_uid = ?`;

/** Website photo rows for a B2 file: the url ends with "/<b2_key>". Bind: key, key. */
const PHOTOS_FOR_KEY_SQL = `
SELECT id, url, publication_eligible, is_featured, is_matchup_eligible
  FROM photos WHERE substr(url, -(length(?) + 1)) = '/' || ?`;

const PHOTO_IN_USE_SQL = `
SELECT
  (SELECT COUNT(*) FROM content_inventory_media WHERE media_id = ?) AS story_media,
  (SELECT COUNT(*) FROM matchup_entries WHERE photo_id = ?) AS matchup_entries,
  (SELECT COUNT(*) FROM weekly_matchups WHERE photo_a_id = ? OR photo_b_id = ?) AS weekly_matchups`;

const RENDITIONS_SQL = `SELECT id, b2_key FROM content_inventory_media_renditions WHERE media_id = ?`;

const OTHER_LIVE_USERS_SQL = `
SELECT id FROM content_items
 WHERE id <> ? AND media_asset_id IN (?, ?)
   AND lifecycle_state IN ('active', 'not_to_be_used') AND superseded_at IS NULL AND deleted_at IS NULL
 LIMIT 1`;

/** Splits "b2://<key>" or "media_uid:<uid>" into the lookup values. */
export function parseMediaRef(ref) {
  const text = String(ref ?? '');
  if (text.startsWith('b2://')) return { key: text.slice(5), uid: null };
  if (text.startsWith('media_uid:')) return { key: null, uid: text.slice(10) };
  return { key: null, uid: null };
}

const all = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).all()).results ?? [];
const first = async (db, sql, ...params) => (await db.prepare(sql).bind(...params).first()) ?? null;

/**
 * Looks at one due item and says what the sweep would do. `blocked` is a reason code when the
 * item must not be purged yet, otherwise null.
 */
export async function planItem(db, item) {
  const ref = parseMediaRef(item.media_asset_id);
  const media = ref.key || ref.uid ? await first(db, MEDIA_BY_REF_SQL, ref.key ?? '', ref.uid ?? '') : null;
  const plan = { item, media, photos: [], renditions: [], blocked: null };
  if (!media) return plan; // no picture left: only the record is purged

  const sharing = await first(
    db,
    OTHER_LIVE_USERS_SQL,
    item.content_item_id,
    `b2://${media.b2_key}`,
    `media_uid:${media.media_uid}`,
  );
  if (sharing) {
    plan.blocked = 'shared_with_live_record';
    return plan;
  }

  plan.photos = await all(db, PHOTOS_FOR_KEY_SQL, media.b2_key, media.b2_key);
  for (const photo of plan.photos) {
    if (Number(photo.publication_eligible) === 1) plan.blocked = 'photo_publication_eligible';
    else if (Number(photo.is_featured) === 1) plan.blocked = 'photo_featured';
    else if (Number(photo.is_matchup_eligible) === 1) plan.blocked = 'photo_matchup_eligible';
    else {
      const use = (await first(db, PHOTO_IN_USE_SQL, photo.id, photo.id, photo.id, photo.id)) ?? {};
      if (Number(use.story_media) > 0) plan.blocked = 'photo_used_by_story';
      else if (Number(use.matchup_entries) > 0 || Number(use.weekly_matchups) > 0) plan.blocked = 'photo_used_by_matchup';
    }
    if (plan.blocked) return plan;
    plan.renditions.push(...(await all(db, RENDITIONS_SQL, photo.id)));
  }
  return plan;
}

/**
 * Purges one planned item. Order: tombstone, B2 objects, then the database rows, so a failure part
 * way leaves a state a re-run finishes. `deleteObject(key)` removes a B2 file permanently and treats
 * a missing file as done.
 */
export async function applyItem(db, deleteObject, plan, { sweepRun, nowIso }) {
  const { item, media } = plan;
  await db
    .prepare(
      `INSERT OR IGNORE INTO archive_tombstones
         (content_item_id, candidate_id, source_url, source_domain, title, b2_key, media_uid, reason,
          flagged_by, flagged_issue, flagged_at, purged_at, sweep_run)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      item.content_item_id, item.candidate_id ?? null, item.source_url ?? null, item.source_domain ?? null, item.title ?? null,
      media?.b2_key ?? null, media?.media_uid ?? null, item.lifecycle_reason ?? null, item.lifecycle_set_by ?? null,
      item.lifecycle_issue ?? null, item.lifecycle_set_at ?? null, nowIso, sweepRun,
    )
    .run();

  const keys = [...(media ? [media.b2_key] : []), ...plan.renditions.map((r) => r.b2_key)];
  for (const key of keys) await deleteObject(key);

  for (const rendition of plan.renditions) {
    await db.prepare('DELETE FROM content_inventory_media_renditions WHERE id = ?').bind(rendition.id).run();
  }
  for (const photo of plan.photos) await db.prepare('DELETE FROM photos WHERE id = ?').bind(photo.id).run();
  await db
    .prepare(
      `UPDATE content_items
          SET lifecycle_state = 'purged', lifecycle_reason = ?, lifecycle_set_at = ?, lifecycle_set_by = ?, media_asset_id = NULL
        WHERE id = ? AND lifecycle_state = 'ok_to_delete'`,
    )
    .bind(`sweep ${sweepRun}: ${item.lifecycle_reason ?? 'approved for deletion'}`, nowIso, SWEEP_ACTOR, item.content_item_id)
    .run();
  if (media) await db.prepare('DELETE FROM media_assets WHERE id = ?').bind(media.id).run();
}

/**
 * One sweep. Without `apply` it only plans. Returns what is due, what is blocked and why, and what
 * was purged.
 */
export async function runSweep(db, { deleteObject, apply = false, limit = 5, nowIso, sweepRun }) {
  const due = await all(db, DUE_SQL, nowIso, limit);
  const report = { due: due.length, blocked: [], planned: [], purged: [], failed: [] };
  for (const item of due) {
    const plan = await planItem(db, item);
    if (plan.blocked) {
      report.blocked.push({ content_item_id: item.content_item_id, candidate_id: item.candidate_id, reason: plan.blocked });
      continue;
    }
    report.planned.push({
      content_item_id: item.content_item_id,
      candidate_id: item.candidate_id,
      b2_objects: (plan.media ? 1 : 0) + plan.renditions.length,
      photo_rows: plan.photos.length,
    });
    if (!apply) continue;
    try {
      await applyItem(db, deleteObject, plan, { sweepRun, nowIso });
      report.purged.push(item.content_item_id);
    } catch (error) {
      report.failed.push({ content_item_id: item.content_item_id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}
