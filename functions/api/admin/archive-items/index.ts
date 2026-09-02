// GET/POST /api/admin/archive-items
// #2073 Work Package item 4 (#4061): physical archive-acquisition intake.
// Protected by an authenticated D1 admin member session (requireAdmin).

import {
  createArchiveItem,
  listArchiveItems,
  requireArchiveItemsTables,
  serializeArchiveItemForAdmin,
  type ArchiveCustodyState,
  type ArchiveCustodyType,
} from '../../../_lib/archive-items-repository';
import { parseCreateArchiveItemRequest } from '../../../_lib/archive-items-admin';
import { requireAdmin } from '../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../_lib/d1';

function parsePositiveInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseNonNegativeInt(value: string | null, fallback: number): number {
  if (!value) return fallback;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireArchiveItemsTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const url = new URL(request.url);
    const custodyState = (url.searchParams.get('custody_state') || undefined) as ArchiveCustodyState | undefined;
    const custodyType = (url.searchParams.get('custody_type') || undefined) as ArchiveCustodyType | undefined;
    const limit = parsePositiveInt(url.searchParams.get('limit'), 50);
    const offset = parseNonNegativeInt(url.searchParams.get('offset'), 0);

    const items = await listArchiveItems(d1.db, {
      custody_state: custodyState,
      custody_type: custodyType,
      limit,
      offset,
    });

    return jsonResponse({ ok: true, count: items.length, items: items.map(serializeArchiveItemForAdmin) }, 200);
  } catch (err: any) {
    console.error('admin archive-items list error:', err);
    return jsonResponse({ ok: false, error: 'Archive item query failed.' }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireArchiveItemsTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseCreateArchiveItemRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    const item = await createArchiveItem(d1.db, parsed.request);
    return jsonResponse({ ok: true, item: serializeArchiveItemForAdmin(item) }, 201);
  } catch (err: any) {
    console.error('admin archive-items create error:', err);
    return jsonResponse({ ok: false, error: 'Archive item creation failed.' }, 500);
  }
};
