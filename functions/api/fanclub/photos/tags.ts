import { requireMember } from '../../../_lib/session';

function parseTagsField(raw: unknown): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];
  return text
    .split(/[,;|]/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

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
  const auth = await requireMember(context);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const statusFilter = (await photosHasStatusColumn(auth.db)) ? ` AND status = 'published'` : '';
    const rows = await auth.db
      .prepare(
        `SELECT tags
           FROM photos
          WHERE (is_memorabilia IS NULL OR is_memorabilia = 0)
            AND COALESCE(TRIM(tags), '') != ''${statusFilter}`,
      )
      .all();

    const tagSet = new Set<string>();
    for (const row of rows.results || []) {
      for (const tag of parseTagsField((row as any).tags)) {
        tagSet.add(tag);
      }
    }

    const tags = [...tagSet].sort((a, b) => a.localeCompare(b));

    return new Response(JSON.stringify({ ok: true, tags }, null, 2), {
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
