// GET/POST /api/admin/editorial/media-associations
// Reads or updates story-media associations for content_inventory records.
// POST action=persist_renditions accepts browser-generated rendition bytes (P1-07 / #3419).

import { requireAdmin } from "../../../_lib/auth";
import {
  CLUB_HOME_MEDIA_RENDITION_SIZE,
  RENDITION_OUTPUT_CONTENT_TYPE,
  RENDITION_SIZES,
  decodeBase64Bytes,
  insertStoryMediaAssociations,
  isRenditionSize,
  listStoryMediaAssociations,
  loadPhotosByIds,
  normalizeMediaAssociations,
  putRenditionObject,
  publicUrlForRenditionKey,
  renditionObjectKey,
  requireB2,
  serializeLegacyMediaJson,
  upsertMediaRendition,
  validatePersistedRenditionDimensions,
  type RenditionSize,
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
    return jsonResponse(
      {
        ok: true,
        story_id: storyId,
        media_associations: grouped.get(storyId) || [],
        rendition_sizes: RENDITION_SIZES,
        club_home_rendition_size: CLUB_HOME_MEDIA_RENDITION_SIZE,
      },
      200,
    );
  } catch (err: any) {
    console.error("admin editorial media associations get error:", err);
    return jsonResponse({ ok: false, error: "Media association read failed." }, 500);
  }
};

async function persistRenditions(context: { request: Request; env: Record<string, unknown>; db: any; body: any }): Promise<Response> {
  const { env, db, body } = context;

  const tables = await requireTables(db, ["content_inventory", "content_inventory_media", "photos", "content_inventory_media_renditions"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  const b2 = requireB2(env);
  if (!b2.ok) return b2.response;

  const storyId = asInt(body?.story_id);
  if (!storyId) {
    return jsonResponse({ ok: false, error: "story_id is required." }, 400);
  }

  const story = await db.prepare("SELECT id FROM content_inventory WHERE id = ?").bind(storyId).first();
  if (!story) {
    return jsonResponse({ ok: false, error: "Content record not found." }, 404);
  }

  const associated = await listStoryMediaAssociations(db, [storyId]);
  const associatedIds = new Set((associated.get(storyId) || []).map((row) => asInt((row as any).media_id)));

  const items = Array.isArray(body?.renditions) ? body.renditions : null;
  if (!items || !items.length) {
    return jsonResponse({ ok: false, error: "renditions array is required." }, 400);
  }

  const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
  const now = String((nowRow as any)?.now || new Date().toISOString());
  const generatedBy = typeof body?.generated_by === "string" ? body.generated_by.trim() || null : "admin-ui";

  const results: Array<Record<string, unknown>> = [];

  for (const item of items) {
    const mediaId = asInt(item?.media_id);
    const sizeRaw = item?.size;
    if (!mediaId || !isRenditionSize(sizeRaw)) {
      return jsonResponse({ ok: false, error: "Each rendition requires media_id and a valid size." }, 400);
    }
    const size = sizeRaw as RenditionSize;
    if (!associatedIds.has(mediaId)) {
      return jsonResponse({ ok: false, error: `media_id ${mediaId} is not associated with story ${storyId}.` }, 400);
    }

    const sourceWidth = asInt(item?.source_width);
    const sourceHeight = asInt(item?.source_height);
    const widthPx = asInt(item?.width_px);
    const heightPx = asInt(item?.height_px);
    const contentType =
      typeof item?.content_type === "string" && item.content_type.trim() ? item.content_type.trim() : RENDITION_OUTPUT_CONTENT_TYPE;

    if (contentType !== RENDITION_OUTPUT_CONTENT_TYPE) {
      return jsonResponse({ ok: false, error: `content_type must be ${RENDITION_OUTPUT_CONTENT_TYPE}.` }, 400);
    }

    const dimCheck = validatePersistedRenditionDimensions({
      size,
      source_width: sourceWidth,
      source_height: sourceHeight,
      width_px: widthPx,
      height_px: heightPx,
    });
    if (!dimCheck.ok) {
      return jsonResponse({ ok: false, error: dimCheck.error }, 400);
    }

    const bytes = decodeBase64Bytes(item?.bytes_base64);
    if (!bytes || !bytes.byteLength) {
      return jsonResponse({ ok: false, error: `Rendition bytes missing for media_id ${mediaId} size ${size}.` }, 400);
    }

    const key = renditionObjectKey(mediaId, size);
    const url = publicUrlForRenditionKey(env, b2.cfg, key);

    try {
      await putRenditionObject(b2.cfg, key, bytes, contentType);
      await upsertMediaRendition(db, {
        media_id: mediaId,
        size,
        b2_key: key,
        url,
        width_px: widthPx,
        height_px: heightPx,
        bytes: bytes.byteLength,
        content_type: contentType,
        status: "ready",
        error: null,
        generated_at: now,
        generated_by: generatedBy,
      });
      results.push({ media_id: mediaId, size, status: "ready", url, b2_key: key, width_px: widthPx, height_px: heightPx });
    } catch (err: any) {
      const message = String(err?.message || err || "Rendition persistence failed.");
      await upsertMediaRendition(db, {
        media_id: mediaId,
        size,
        b2_key: key,
        url,
        width_px: widthPx,
        height_px: heightPx,
        bytes: bytes.byteLength,
        content_type: contentType,
        status: "failed",
        error: message.slice(0, 500),
        generated_at: now,
        generated_by: generatedBy,
      });
      results.push({ media_id: mediaId, size, status: "failed", error: message.slice(0, 500) });
    }
  }

  return jsonResponse({ ok: true, story_id: storyId, renditions: results }, 200);
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  try {
    const body = await request.json().catch(() => null);
    const action = typeof body?.action === "string" ? body.action.trim() : "";

    if (action === "persist_renditions") {
      return persistRenditions({ request, env, db: d1.db, body });
    }

    const tables = await requireTables(d1.db, ["content_inventory", "content_inventory_media", "photos"]);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

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
