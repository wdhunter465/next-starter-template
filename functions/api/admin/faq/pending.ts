// GET /api/admin/faq/pending
// Returns all pending FAQ entries for admin review

import { requireAdmin } from "../../../_lib/auth";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const db = env.DB as any;
    
    const result = await db.prepare(
      "SELECT id, question, answer, status, submitter_email, view_count, pinned, created_at, updated_at FROM faq_entries WHERE status = 'pending' ORDER BY created_at DESC"
    ).all();

    return new Response(JSON.stringify({ ok: true, items: result.results || [] }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin faq/pending error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Failed to load pending FAQs." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
