// POST /api/admin/editorial/club-home-edition-regenerate
// GET  /api/admin/editorial/club-home-edition-regenerate  (inspect current active edition)
// Protected by ADMIN_TOKEN.
// P1-06 (#3413): on-demand Club Home edition regeneration + inspect.

import { requireAdmin } from '../../../_lib/auth';
import {
  getActiveClubHomeEdition,
  listClubHomeEditionPlacements,
  regenerateClubHomeEdition,
} from '../../../_lib/content-inventory-club-home';
import { jsonResponse, requireD1, requireTables } from '../../../_lib/d1';

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const EDITION_TABLES = [
  'content_inventory',
  'content_inventory_club_home_editions',
  'content_inventory_club_home_edition_placements',
  'content_inventory_club_home_active_edition',
];

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, EDITION_TABLES);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const active = await getActiveClubHomeEdition(d1.db);
    if (!active) {
      return jsonResponse(
        {
          ok: true,
          active: null,
          message: 'No active Club Home edition. Run regenerate to create and activate one.',
        },
        200,
      );
    }

    const placements = await listClubHomeEditionPlacements(d1.db, active.edition.id);
    return jsonResponse(
      {
        ok: true,
        active: active.active,
        edition: active.edition,
        placements,
      },
      200,
    );
  } catch (err: any) {
    return jsonResponse({ ok: false, error: String(err?.message || err) }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const deny = requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, EDITION_TABLES);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const createdBy = asString(body?.created_by) || 'admin-ui';
    const result = await regenerateClubHomeEdition(d1.db, {
      createdBy,
      request,
      publicB2BaseUrl: env?.PUBLIC_B2_BASE_URL,
    });

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
        action: 'regenerate',
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
