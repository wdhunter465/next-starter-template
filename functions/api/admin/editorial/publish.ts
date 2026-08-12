// POST /api/admin/editorial/publish
// Updates content_inventory publication state, or pin/unpin Club Home zones.
// Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../../_lib/auth";
import {
  CLUB_HOME_PINNABLE_ZONES,
  CLUB_HOME_SECTION,
  isClubHomePinnableZone,
} from "../../../_lib/content-inventory-club-home";
import { publishedInventoryWhere } from "../../../_lib/content-inventory-public";
import { CLUB_HOME_PLACEMENT_ZONES } from "../../../_lib/content-inventory-rotation";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

const VALID_STATUSES = new Set(["draft", "published", "archived"]);
const RAIL_STORY_TYPES = new Set(["secondary", "brief"]);

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hasRequiredFields(row: Record<string, unknown>, fields: string[]): boolean {
  return fields.every((field) => String(row[field] || "").trim().length > 0);
}

function sectionAllowsClubHome(allowedSections: unknown): boolean {
  const raw = String(allowedSections || "");
  if (!raw) return false;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((entry) => String(entry)).includes(CLUB_HOME_SECTION);
    }
  } catch {
    // comma-separated fallback
  }
  return raw.includes(CLUB_HOME_SECTION);
}

function pinZoneAllowsStoryType(zoneId: string, storyType: unknown): boolean {
  const normalized = String(storyType || "").trim().toLowerCase();
  if (zoneId === CLUB_HOME_PLACEMENT_ZONES.storyRail) {
    return RAIL_STORY_TYPES.has(normalized);
  }
  return true;
}

async function handlePin(db: any, body: any): Promise<Response> {
  const tables = await requireTables(db, ["content_inventory", "content_inventory_club_home_pins"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  const id = asInt(body?.id);
  const zoneId = asString(body?.zone_id);
  const expiresAt = asString(body?.expires_at) || null;
  const pinnedBy = asString(body?.pinned_by) || "admin-ui";

  if (!id || !isClubHomePinnableZone(zoneId)) {
    return jsonResponse(
      {
        ok: false,
        error: `id and a valid zone_id (${CLUB_HOME_PINNABLE_ZONES.join(", ")}) are required.`,
      },
      400,
    );
  }

  if (expiresAt) {
    const expiresMs = Date.parse(expiresAt);
    if (!Number.isFinite(expiresMs)) {
      return jsonResponse({ ok: false, error: "expires_at must be a valid timestamp." }, 400);
    }
  }

  const existing = await db
    .prepare(
      `SELECT id, status, allowed_sections, story_type, source_name, credit_line
         FROM content_inventory
        WHERE id = ?`,
    )
    .bind(id)
    .first();

  if (!existing) {
    return jsonResponse({ ok: false, error: "Content record not found." }, 404);
  }

  if (String((existing as any).status || "") !== "published") {
    return jsonResponse({ ok: false, error: "Only published content can be pinned." }, 400);
  }

  if (!sectionAllowsClubHome((existing as any).allowed_sections)) {
    return jsonResponse({ ok: false, error: "Pinned content must allow the club_home section." }, 400);
  }

  if (!hasRequiredFields(existing as Record<string, unknown>, ["source_name", "credit_line"])) {
    return jsonResponse(
      { ok: false, error: "Pinned content requires source_name and credit_line." },
      400,
    );
  }

  if (!pinZoneAllowsStoryType(zoneId, (existing as any).story_type)) {
    return jsonResponse(
      {
        ok: false,
        error: `story_type is not eligible for zone ${zoneId}.`,
      },
      400,
    );
  }

  // Re-check live publication/eligibility gate used by Club Home reads.
  const eligible = await db
    .prepare(`SELECT id FROM content_inventory WHERE id = ? AND ${publishedInventoryWhere(CLUB_HOME_SECTION)}`)
    .bind(id)
    .first();
  if (!eligible) {
    return jsonResponse(
      { ok: false, error: "Content is not eligible for Club Home publication gates." },
      400,
    );
  }

  const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
  const now = String((nowRow as any)?.now || new Date().toISOString());

  await db
    .prepare(
      `INSERT INTO content_inventory_club_home_pins
         (zone_id, story_id, pinned_at, pinned_by, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(zone_id) DO UPDATE SET
         story_id = excluded.story_id,
         pinned_at = excluded.pinned_at,
         pinned_by = excluded.pinned_by,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
    )
    .bind(zoneId, id, now, pinnedBy, expiresAt, now, now)
    .run();

  return jsonResponse(
    {
      ok: true,
      action: "pin",
      zone_id: zoneId,
      story_id: id,
      pinned_at: now,
      pinned_by: pinnedBy,
      expires_at: expiresAt,
    },
    200,
  );
}

async function handleUnpin(db: any, body: any): Promise<Response> {
  const tables = await requireTables(db, ["content_inventory_club_home_pins"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  const zoneId = asString(body?.zone_id);
  if (!isClubHomePinnableZone(zoneId)) {
    return jsonResponse(
      {
        ok: false,
        error: `A valid zone_id (${CLUB_HOME_PINNABLE_ZONES.join(", ")}) is required.`,
      },
      400,
    );
  }

  const existing = await db
    .prepare(`SELECT zone_id, story_id FROM content_inventory_club_home_pins WHERE zone_id = ?`)
    .bind(zoneId)
    .first();

  if (!existing) {
    return jsonResponse({ ok: false, error: "No active pin for that zone." }, 404);
  }

  await db
    .prepare(`DELETE FROM content_inventory_club_home_pins WHERE zone_id = ?`)
    .bind(zoneId)
    .run();

  return jsonResponse(
    {
      ok: true,
      action: "unpin",
      zone_id: zoneId,
      story_id: Number((existing as any).story_id),
    },
    200,
  );
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  try {
    const body = await request.json().catch(() => null);
    const action = asString(body?.action).toLowerCase();

    if (action === "pin") {
      return handlePin(d1.db, body);
    }
    if (action === "unpin") {
      return handleUnpin(d1.db, body);
    }

    const tables = await requireTables(d1.db, ["content_inventory"]);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

    const id = asInt(body?.id);
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    if (!id || !VALID_STATUSES.has(status)) {
      return jsonResponse({ ok: false, error: "id and valid status are required." }, 400);
    }

    const existing = await d1.db
      .prepare("SELECT id, status, source_name, credit_line FROM content_inventory WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) {
      return jsonResponse({ ok: false, error: "Content record not found." }, 404);
    }

    if (
      status === "published" &&
      !hasRequiredFields(existing as Record<string, unknown>, ["source_name", "credit_line"])
    ) {
      return jsonResponse(
        { ok: false, error: "Published content_inventory records require source_name and credit_line." },
        400,
      );
    }

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());
    const publishedAt = status === "published" ? now : null;

    await d1.db
      .prepare(
        `UPDATE content_inventory
            SET status = ?, updated_at = ?, published_at = ?
          WHERE id = ?`,
      )
      .bind(status, now, publishedAt, id)
      .run();

    // Leaving draft/archived clears any Club Home pins for this story so unpublished
    // rows cannot remain as sticky overrides after operator state change.
    if (status !== "published") {
      try {
        await d1.db
          .prepare(`DELETE FROM content_inventory_club_home_pins WHERE story_id = ?`)
          .bind(id)
          .run();
      } catch {
        // Pin table may be absent before migration; publication update still succeeds.
      }
    }

    return jsonResponse({ ok: true, id, status, published_at: publishedAt }, 200);
  } catch (err: any) {
    console.error("admin editorial publish error:", err);
    return jsonResponse({ ok: false, error: "Publication update failed." }, 500);
  }
};
