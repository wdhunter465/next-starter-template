// POST /api/admin/media-assets/sync-from-b2?maxObjects=2000
// Lists objects from B2 (S3 ListObjectsV2) and INSERT OR IGNORE into D1 media_assets.
// Requires an authenticated D1 admin member session and Pages secrets B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";
import { requireB2, listB2Objects, mediaUidFromB2 } from "../../../_lib/b2";

export const onRequestGet = async (): Promise<Response> => {
  return new Response(JSON.stringify({ ok: false, error: "Method not allowed. Use POST." }), {
    status: 405,
    headers: { "Content-Type": "application/json", Allow: "POST, OPTIONS" },
  });
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["media_assets"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  const b2 = requireB2(env as Record<string, unknown>);
  if (!b2.ok) return b2.response;

  const url = new URL(request.url);
  const maxRaw = Number(url.searchParams.get("maxObjects") || "2000");
  const maxObjects = Number.isFinite(maxRaw) ? Math.min(Math.max(maxRaw, 1), 50_000) : 2000;

  let listed: Awaited<ReturnType<typeof listB2Objects>>;
  try {
    listed = await listB2Objects(b2.cfg, { maxObjects });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "B2 list failed";
    console.error("sync-from-b2 list error:", err);
    return jsonResponse({ ok: false, error: message }, 502);
  }

  type Row = {
    media_uid: string;
    b2_key: string;
    b2_file_id: string;
    size: number;
    etag: string;
  };

  const rows: Row[] = [];
  for (const o of listed) {
    const media_uid = await mediaUidFromB2(o.fileId, o.key);
    rows.push({
      media_uid,
      b2_key: o.key,
      b2_file_id: o.fileId,
      size: o.size,
      etag: o.etag || "",
    });
  }

  // D1 allows at most ~100 bound parameters per statement; 5 columns × 15 = 75.
  const BATCH = 15;
  let changesReported = 0;
  const db = d1.db;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => "(?, ?, ?, ?, ?)").join(", ");
    const sql = `INSERT OR IGNORE INTO media_assets (media_uid, b2_key, b2_file_id, size, etag) VALUES ${placeholders}`;
    const binds: (string | number)[] = [];
    for (const r of chunk) {
      binds.push(r.media_uid, r.b2_key, r.b2_file_id, r.size, r.etag);
    }
    const run = await db.prepare(sql).bind(...binds).run();
    changesReported += Number(run.meta?.changes ?? 0);
  }

  return new Response(
    JSON.stringify(
      {
        ok: true,
        listed: listed.length,
        maxObjects,
        batches: rows.length ? Math.ceil(rows.length / BATCH) : 0,
        changes_reported: changesReported,
        note: "changes_reported sums D1 meta.changes per batch (approximate new rows when duplicates are ignored).",
      },
      null,
      2,
    ),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
};
