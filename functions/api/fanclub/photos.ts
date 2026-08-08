import { requireMember } from '../../_lib/session';
import { normalizePhotoUrl } from '../../_lib/photo-url';

const PAGE_SIZE = 24;

function parsePage(raw: string | null): number {
  const n = Number(raw || '1');
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

function parseTags(raw: string | null): string[] {
  return String(raw || '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

/** Column inventory for schema-gated published-only + attribution selects. */
async function photosColumnNames(db: any): Promise<Set<string>> {
  try {
    const result = await db.prepare(`PRAGMA table_info(photos)`).all();
    return new Set((result?.results || []).map((row: any) => row.name));
  } catch {
    return new Set();
  }
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const url = new URL(context.request.url);
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase();
    const tags = parseTags(url.searchParams.get('tags'));
    const page = parsePage(url.searchParams.get('page'));
    const offset = (page - 1) * PAGE_SIZE;

    const where: string[] = ['(is_memorabilia IS NULL OR is_memorabilia = 0)'];
    const args: any[] = [];

    const columns = await photosColumnNames(auth.db);
    if (columns.has('status')) {
      where.push(`status = 'published'`);
    }

    if (q) {
      where.push('(lower(COALESCE(title,\'\')) LIKE ? OR lower(COALESCE(description,\'\')) LIKE ? OR lower(COALESCE(tags,\'\')) LIKE ?)');
      const like = `%${q}%`;
      args.push(like, like, like);
    }

    for (const t of tags) {
      where.push('lower(COALESCE(tags,\'\')) LIKE ?');
      args.push(`%${t}%`);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const attributionSelect = [
      columns.has('credit_line') ? 'credit_line' : null,
      columns.has('rights_owner') ? 'rights_owner' : null,
    ]
      .filter(Boolean)
      .join(', ');
    const selectCols = `id, photo_id, url, title, description, tags, source${attributionSelect ? `, ${attributionSelect}` : ''}`;

    const countRow = await auth.db
      .prepare(`SELECT COUNT(1) AS n FROM photos ${whereSql}`)
      .bind(...args)
      .first();
    const total = Number((countRow as any)?.n ?? 0) || 0;

    const rows = await auth.db
      .prepare(
        `SELECT ${selectCols}
         FROM photos
         ${whereSql}
         ORDER BY id DESC
         LIMIT ? OFFSET ?`
      )
      .bind(...args, PAGE_SIZE, offset)
      .all();

    const items = (rows.results || []).map((row: any) => ({
      id: row.id,
      b2_key: row.photo_id || row.url || null,
      thumbnail_url: normalizePhotoUrl({ rawUrl: row?.url, request: context.request, publicB2BaseUrl: context.env.PUBLIC_B2_BASE_URL }),
      title: row.title || null,
      description: row.description || null,
      tags: row.tags || null,
      // Design field required; nearest available schema field is `source`.
      uploaded_by: row.source || null,
      credit_line: row.credit_line || null,
      rights_owner: row.rights_owner || null,
    }));

    return new Response(
      JSON.stringify({ ok: true, items, page, page_size: PAGE_SIZE, total }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
