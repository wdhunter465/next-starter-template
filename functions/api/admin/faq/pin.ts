// POST /api/admin/faq/pin
// Toggles the pinned status of an approved FAQ entry

import { requireAdmin } from "../../../_lib/auth";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json();
    const id = Number(body?.id);
    const pinned = Number(body?.pinned);

    if (!Number.isInteger(id) || id <= 0) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid FAQ entry ID required' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pinned !== 0 && pinned !== 1) {
      return new Response(JSON.stringify({ ok: false, error: 'Pinned must be 0 or 1' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB as any;
    
    // Update pinned status for approved entries only
    await db.prepare(
      "UPDATE faq_entries SET pinned = ?, updated_at = datetime('now') WHERE id = ? AND status = 'approved'"
    ).bind(pinned, id).run();

    return new Response(JSON.stringify({ ok: true }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error("admin faq/pin error:", err);
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
