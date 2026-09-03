// POST /api/admin/editorial/club-home-edition-rollback
// Protected by ADMIN_TOKEN.
// P1-06 (#3413): reactivate a prior ready Club Home edition without rewriting history.

import { requireAdmin } from "../../../_lib/auth";
import { rollbackClubHomeEdition } from "../../../_lib/content-inventory-club-home";
import { jsonResponse, requireD1, requireTables } from "../../../_lib/d1";

function asInt(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

const EDITION_TABLES = [
  "content_inventory_club_home_editions",
  "content_inventory_club_home_edition_placements",
  "content_inventory_club_home_active_edition",
];

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, EDITION_TABLES);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const editionId = asInt(body?.edition_id);
    const activatedBy = asString(body?.activated_by) || "admin-ui";

    if (!editionId) {
      return jsonResponse({ ok: false, error: "edition_id is required." }, 400);
    }

    const result = await rollbackClubHomeEdition(d1.db, editionId, { activatedBy });
    if (!result.ok) {
      return jsonResponse(
        {
          ok: false,
          error: result.error,
          building_edition_id: result.building_edition_id ?? null,
        },
        result.status,
      );
    }

    return jsonResponse(
      {
        ok: true,
        action: "rollback",
        edition_id: result.edition_id,
        previous_edition_id: result.previous_edition_id,
        placements: result.placements,
      },
      200,
    );
  } catch (err: any) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
};
