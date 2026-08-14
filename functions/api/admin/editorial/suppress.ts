// POST /api/admin/editorial/suppress
// Records an auditable takedown/suppression classification against a
// content_inventory record (#2919, F5). Requests arrive by email through the
// existing /contact intake; an admin reviewer records the disposition here.
// This never deletes the row — it archives it and records why, so the
// evidence remains auditable. There is no public takedown route.

import { requireAdmin } from "../../../_lib/auth";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

type SuppressBody = {
  content_inventory_id?: unknown;
  suppression_reason?: unknown;
  takedown_request_source?: unknown;
  takedown_resolution_note?: unknown;
};

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["content_inventory"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = (await request.json().catch(() => null)) as SuppressBody | null;
    const contentInventoryId = asInt(body?.content_inventory_id);
    const suppressionReason = asString(body?.suppression_reason);
    const takedownRequestSource = asString(body?.takedown_request_source);
    const takedownResolutionNote = asString(body?.takedown_resolution_note) || null;

    if (!contentInventoryId || !suppressionReason || !takedownRequestSource) {
      return jsonResponse(
        {
          ok: false,
          error:
            "content_inventory_id, suppression_reason, and takedown_request_source are all required.",
        },
        400,
      );
    }

    const existing = await d1.db
      .prepare("SELECT id, status FROM content_inventory WHERE id = ?")
      .bind(contentInventoryId)
      .first();

    if (!existing) {
      return jsonResponse({ ok: false, error: "content_inventory record not found." }, 404);
    }

    const nowRow = await d1.db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());

    // Suppression archives the record (removing it from published/draft
    // display) without deleting it — the row and its history remain, which
    // is the auditable evidence this control exists to produce.
    await d1.db
      .prepare(
        `UPDATE content_inventory
            SET status = 'archived',
                suppression_reason = ?,
                takedown_request_source = ?,
                takedown_resolution_note = ?,
                takedown_requested_at = ?,
                updated_at = ?
          WHERE id = ?`,
      )
      .bind(suppressionReason, takedownRequestSource, takedownResolutionNote, now, now, contentInventoryId)
      .run();

    return jsonResponse(
      { ok: true, content_inventory_id: contentInventoryId, status: "archived" },
      200,
    );
  } catch (err: any) {
    console.error("admin editorial suppress error:", err);
    return jsonResponse({ ok: false, error: "Takedown suppression failed." }, 500);
  }
};
