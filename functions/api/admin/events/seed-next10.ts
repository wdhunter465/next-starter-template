// POST /api/admin/events/seed-next10
// Admin-only. Inserts placeholder events for the next 10 days when D1 is configured.

import { requireAdmin } from "../../../_lib/auth";
import { requireD1, requireTables, jsonResponse } from "../../../_lib/d1";

export const onRequestPost = async (context: any): Promise<Response> => {
  const { env, request } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireTables(d1.db, ["events"]);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const existing = await d1.db
      .prepare("SELECT COUNT(*) AS n FROM events WHERE status='posted' AND start_date >= date('now');")
      .first();
    const upcomingPosted = Number((existing as { n?: number })?.n || 0);

    if (upcomingPosted > 0) {
      return jsonResponse(
        {
          ok: true,
          inserted: 0,
          upcoming_posted: upcomingPosted,
          note: "Upcoming posted events already exist; seed skipped to avoid duplicate placeholders.",
        },
        200,
      );
    }

    const sql = `
      INSERT INTO events (title, start_date, end_date, location, host, fees, description, external_url, status)
      VALUES
        ('LGFC Placeholder Event 01', date('now','+1 day'), date('now','+1 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 02', date('now','+2 day'), date('now','+2 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 03', date('now','+3 day'), date('now','+3 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 04', date('now','+4 day'), date('now','+4 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 05', date('now','+5 day'), date('now','+5 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 06', date('now','+6 day'), date('now','+6 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 07', date('now','+7 day'), date('now','+7 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 08', date('now','+8 day'), date('now','+8 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 09', date('now','+9 day'), date('now','+9 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted'),
        ('LGFC Placeholder Event 10', date('now','+10 day'), date('now','+10 day'), 'LGFC', 'Fan Club', 'Free', 'Placeholder event for calendar display (replace with real content later).', 'https://www.lougehrigfanclub.com', 'posted');
    `;

    await d1.db.prepare(sql).run();

    const countRow = await d1.db
      .prepare("SELECT COUNT(*) AS n FROM events WHERE status='posted' AND start_date >= date('now');")
      .first();

    return jsonResponse(
      {
        ok: true,
        inserted: 10,
        upcoming_posted: Number((countRow as any)?.n || 0),
        note: "Placeholder events inserted. Replace with real calendar content when ready.",
      },
      200,
    );
  } catch (err: any) {
    console.error("admin events seed error:", err);
    return jsonResponse({ ok: false, error: "seed_failed", detail: String(err?.message ?? err) }, 500);
  }
};
