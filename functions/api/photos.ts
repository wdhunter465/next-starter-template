import { normalizePhotoUrl } from '../_lib/photo-url';

function parseLimit(raw: string | null): number {
  const n = Number(raw || '20');
  if (!Number.isFinite(n)) return 20;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

function parseOffset(raw: string | null): number {
  const n = Number(raw || '0');
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

/**
 * True when photos.status exists (migration #0045 / #3119).
 * Pending rows can only exist after this column is present; once present,
 * gallery reads must return only status = 'published'.
 */
async function photosHasStatusColumn(db: any): Promise<boolean> {
  try {
    const result = await db.prepare(`PRAGMA table_info(photos)`).all();
    const names = new Set((result?.results || []).map((row: any) => row.name));
    return names.has('status');
  } catch {
    return false;
  }
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = parseOffset(url.searchParams.get('offset'));
    const memorabilia = url.searchParams.get('memorabilia');

    let sql = 'SELECT id, photo_id, url, is_memorabilia, title, description, tags, created_at FROM photos';
    const where: string[] = [];
    const args: any[] = [];

    if (await photosHasStatusColumn(env.DB)) {
      where.push(`status = 'published'`);
    }

    if (memorabilia === '1') {
      where.push('is_memorabilia = 1');
    }

    if (where.length) {
      sql += ` WHERE ${where.join(' AND ')}`;
    }

    sql += ' ORDER BY id DESC LIMIT ? OFFSET ?';
    args.push(limit, offset);

    const rows = await env.DB.prepare(sql).bind(...args).all();
    const items = (rows.results || []).map((row: any) => ({
      ...row,
      url: normalizePhotoUrl({ rawUrl: row?.url, request, publicB2BaseUrl: env.PUBLIC_B2_BASE_URL }),
    }));

    return new Response(JSON.stringify({ ok: true, items, limit, offset }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
