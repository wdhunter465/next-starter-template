import { requireAdmin } from '../../../_lib/auth';
import {
  isPublishedFaqStatus,
  normalizeFaqStatus,
} from '../../../_lib/faqModeration';

export const onRequestGet = async (context: { request: Request; env: { DB?: unknown } }): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const url = new URL(request.url);
    const statusFilter = normalizeFaqStatus(url.searchParams.get('status') || '');

    const db = env.DB as any;

    let sql =
      'SELECT id, question, answer, status, submitter_email, view_count, pinned, created_at, updated_at FROM faq_entries';
    const args: string[] = [];

    if (statusFilter) {
      sql += ' WHERE status = ?';
      args.push(statusFilter);
    }

    sql += ' ORDER BY pinned DESC, updated_at DESC, id DESC';

    const result = args.length
      ? await db.prepare(sql).bind(...args).all()
      : await db.prepare(sql).all();
    const items = (result.results || []).map((row: Record<string, unknown>) => {
      const record = row;
      const status = String(record.status ?? '');
      return {
        ...record,
        published: isPublishedFaqStatus(status),
      };
    });

    return new Response(JSON.stringify({ ok: true, items }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('admin faq/list error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to load FAQ entries.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
