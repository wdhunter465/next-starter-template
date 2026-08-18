import { requireAdmin } from '../../../_lib/auth';
import { askStatusesForFilter } from '../../../_lib/faqModeration';

export const onRequestGet = async (context: { request: Request; env: { DB?: unknown } }): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const url = new URL(request.url);
    const statuses = askStatusesForFilter(url.searchParams.get('status') || 'pending');
    const placeholders = statuses.map(() => '?').join(', ');

    const db = env.DB as {
      prepare: (sql: string) => { bind: (...args: unknown[]) => { all: () => Promise<{ results?: unknown[] }> } };
    };

    const result = await db
      .prepare(
        `SELECT id, first_name, last_name, screen_name, email, question, status,
                moderation_note, faq_entry_id, created_at
         FROM ask_inbox
         WHERE status IN (${placeholders})
         ORDER BY created_at DESC`,
      )
      .bind(...statuses)
      .all();

    return new Response(JSON.stringify({ ok: true, items: result.results || [] }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('admin ask/list error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to load ask inbox.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
