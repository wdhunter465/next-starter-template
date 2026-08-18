import { requireAdmin } from '../../../_lib/auth';
import { parsePositiveInt } from '../../../_lib/faqModeration';

export const onRequestPost = async (context: { request: Request; env: { DB?: unknown } }): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json().catch(() => ({}));
    const id = parsePositiveInt(body?.id);
    const moderationNote = String(body?.moderation_note ?? '').trim() || null;

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid ask inbox ID required.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB as {
      prepare: (sql: string) => { bind: (...args: unknown[]) => { run: () => Promise<unknown> } };
    };

    const result = await db
      .prepare(
        `UPDATE ask_inbox
         SET status = 'archived', moderation_note = COALESCE(?, moderation_note)
         WHERE id = ?`,
      )
      .bind(moderationNote, id)
      .run();

    const changes = (result as { meta?: { changes?: number } })?.meta?.changes ?? 0;
    if (!changes) {
      return new Response(JSON.stringify({ ok: false, error: 'Ask entry not found.' }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('admin ask/archive error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to archive ask entry.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
