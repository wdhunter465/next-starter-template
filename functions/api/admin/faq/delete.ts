import { requireAdmin } from '../../../_lib/auth';
import { parsePositiveInt } from '../../../_lib/faqModeration';

export const onRequestPost = async (context: { request: Request; env: { DB?: unknown } }): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json().catch(() => ({}));
    const id = parsePositiveInt(body?.id);
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid FAQ entry ID required.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB as any;

    const result = await db
      .prepare("UPDATE faq_entries SET status = 'denied', updated_at = datetime('now') WHERE id = ?")
      .bind(id)
      .run();

    if (!result.meta?.changes) {
      return new Response(JSON.stringify({ ok: false, error: 'FAQ entry not found.' }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('admin faq/delete error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to delete FAQ entry.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
