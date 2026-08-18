// POST /api/admin/faq/deny
// Denies a pending FAQ entry (sets status to denied, keeps record)

import { requireAdmin } from "../../../_lib/auth";
import { parsePositiveInt } from "../../../_lib/faqModeration";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json().catch(() => ({}));
    const id = parsePositiveInt(body?.id);

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid FAQ entry ID required' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB as any;
    
    const result = await db.prepare(
      "UPDATE faq_entries SET status = 'denied', updated_at = datetime('now') WHERE id = ? AND status = 'pending'"
    ).bind(id).run();

    if (!result.meta?.changes) {
      return new Response(JSON.stringify({ ok: false, error: 'FAQ entry not found or not pending.' }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id, status: 'denied' }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("admin faq/deny error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
