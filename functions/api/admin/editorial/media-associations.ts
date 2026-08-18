// GET/POST /api/admin/editorial/media-associations
// Reads or updates story-media associations for content_inventory records.

import { requireAdmin } from "../../../_lib/auth";
import {
  insertStoryMediaAssociations,
  listStoryMediaAssociations,
  loadPhotosByIds,
  normalizeMediaAssociations,
  serializeLegacyMediaJson,
} from "../../../_lib/content-inventory-media";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["content_inventory", "content_inventory_media", "photos"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const storyId = asInt(url.searchParams.get("story_id"));
    if (!storyId) {
      return jsonResponse({ ok: false, error: "story_id is required." }, 400);
    }

    const story = await d1.db.prepare("SELECT id FROM content_inventory WHERE id = ?").bind(storyId).first();
    if (!story) {
      return jsonResponse({ ok: false, error: "Content record not found." }, 404);
    }

    const grouped = await listStoryMediaAssociations(d1.db, [storyId]);
    return jsonResponse({ ok: true, story_id: storyId, media_associations: grouped.get(storyId) || [] }, 200);
  } catch (err: any) {
    console.error("admin editorial media associations get error:", err);
    return jsonResponse({ ok: false, error: "Media association read failed." }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["content_inventory", "content_inventory_media", "photos"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const storyId = asInt(body?.story_id);
    const normalized = normalizeMediaAssociations(body?.media_associations);

    if (!storyId) {
      return jsonResponse({ ok: false, error: "story_id is required." }, 400);
    }
    if (!normalized.ok) {
      return jsonResponse({ ok: false, error: normalized.error }, 400);
    }

    const story = await d1.db.prepare("SELECT id FROM content_inventory WHERE id = ?").bind(storyId).first();
    if (!story) {
      return jsonResponse({ ok: false, error: "Content record not found." }, 404);
    }

    const photoRows = await loadPhotosByIds(
      d1.db,
      normalized.value.map((association) => association.media_id),
    );
    if (photoRows.length !== normalized.value.length) {
      return jsonResponse({ ok: false, error: "One or more media_id values do not match approved photo records." }, 400);
    }

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());

    await insertStoryMediaAssociations(d1.db, storyId, normalized.value, now);

    const mediaJson = serializeLegacyMediaJson(normalized.value, photoRows);
    await d1.db.prepare("UPDATE content_inventory SET media = ?, updated_at = ? WHERE id = ?").bind(mediaJson, now, storyId).run();

    const grouped = await listStoryMediaAssociations(d1.db, [storyId]);
    return jsonResponse(
      {
        ok: true,
        story_id: storyId,
        media_associations: grouped.get(storyId) || [],
      },
      200,
    );
  } catch (err: any) {
    console.error("admin editorial media associations post error:", err);
    return jsonResponse({ ok: false, error: "Media association update failed." }, 500);
  }
};
