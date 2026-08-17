import { normalizePhotoUrl } from '../_lib/photo-url';
import { rightsClearedClause } from '../_lib/rights-hold';

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

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));
    const offset = parseOffset(url.searchParams.get('offset'));
    const memorabilia = url.searchParams.get('memorabilia');

    let sql = 'SELECT id, photo_id, url, is_memorabilia, title, description, tags, created_at FROM photos';
    const where: string[] = [rightsClearedClause()];
    const args: any[] = [];

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
