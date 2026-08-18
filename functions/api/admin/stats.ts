// GET /api/admin/stats
// Returns row counts for core tables. Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../_lib/auth";

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const db = env.DB as any;
  if (!db?.prepare) {
    return new Response(JSON.stringify({ ok: false, error: "D1 binding is not configured." }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }

  const tables = [
    "join_requests",
    "members",
    "join_email_log",
    "login_attempts",
    "library_entries",
    "photos",
    "media_assets",
    "page_content",
    "content_blocks",
    "content_revisions",
    "content_inventory",
    "submission_queue",
    "faq_entries",
    "events",
    "milestones",
    "friends",
    "discussions",
    "weekly_matchups",
    "weekly_votes",
    "footer_quotes",
    "membership_card_content",
    "welcome_email_content",
    "admin_team_worklist",
    "reports",
  ];
  const counts: Record<string, number> = {};
  const unavailable: Record<string, string> = {};

  for (const t of tables) {
    try {
      const r = await db.prepare(`SELECT COUNT(*) as n FROM ${t}`).all();
      counts[t] = Number((r?.results?.[0] as any)?.n || 0);
    } catch (err: any) {
      unavailable[t] = err?.message ? String(err.message) : "Unavailable";
    }
  }

  try {
    return new Response(JSON.stringify({ ok: true, counts, unavailable }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("admin stats error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Stats failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
