// GET /api/fundraiser-details/list?limit=10
// Public, read-only. Returns published Fundraiser Daily Details posts,
// newest first. No admin token required -- intended for the homepage teaser
// section and the full /fundraiser-details history page. #4253.

function json(res: any, status = 200): Response {
  return new Response(JSON.stringify(res, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

const PAGE = 'home';
const SECTION = 'fundraiser-daily-details';
const DEFAULT_LIMIT = 30;
const MAX_LIMIT = 100;

function parseLimit(raw: string | null): number {
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed <= 0) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  try {
    const url = new URL(request.url);
    const limit = parseLimit(url.searchParams.get('limit'));

    const rows = await env.DB.prepare(
      `SELECT key, title, published_body_md, published_at
       FROM content_blocks
       WHERE page = ? AND section = ? AND status = 'published'
       ORDER BY published_at DESC
       LIMIT ?`,
    )
      .bind(PAGE, SECTION, limit)
      .all();

    const items = (rows?.results || []).map((row: any) => ({
      key: row.key,
      title: row.title,
      body_md: row.published_body_md,
      published_at: row.published_at,
    }));

    return json({ ok: true, items }, 200);
  } catch (err: any) {
    console.error('fundraiser-details list error:', err);
    return json({ ok: false, error: 'List failed.' }, 500);
  }
};
