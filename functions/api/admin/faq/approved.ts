// GET /api/admin/faq/approved
// Returns all approved FAQ entries for admin management

import { requireAdmin } from "../../../_lib/auth";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const db = env.DB as any;
    
    const result = await db.prepare(
      "SELECT id, question, answer, status, submitter_email, view_count, pinned, created_at, updated_at FROM faq_entries WHERE status = 'approved' ORDER BY pinned DESC, view_count DESC, updated_at DESC"
    ).all();

    return new Response(JSON.stringify({ ok: true, items: result.results || [] }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin faq/approved error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Failed to load approved FAQs." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
