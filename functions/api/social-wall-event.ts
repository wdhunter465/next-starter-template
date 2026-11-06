// Cloudflare Pages Function for POST /api/social-wall-event  (#5116)
// - Called by the homepage when the social wall shows its fallback panel.
// - Takes no data from the browser. The server asks Elfsight for the reason and records one row:
//   time, reason and widget id. Nothing about the visitor is stored.
// - At most MAX_PER_MINUTE rows a minute across all visitors, so a script cannot flood the table.

import { requireD1, requireTables, jsonResponse, type Env } from '../_lib/d1';
import { currentWidgetReason, SOCIAL_WALL_ELFSIGHT_WIDGET_UUID } from '../_lib/social-wall-status';

export const MAX_PER_MINUTE = 60;

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const d1Check = requireD1(context.env);
  if (!d1Check.ok) return jsonResponse(d1Check.body, d1Check.status);
  const db = d1Check.db;

  const tablesCheck = await requireTables(db, ['social_wall_events']);
  if (!tablesCheck.ok) return jsonResponse({ ok: false }, 202);

  try {
    const recent = await db
      .prepare(`SELECT COUNT(*) AS n FROM social_wall_events WHERE occurred_at > strftime('%Y-%m-%dT%H:%M:%fZ','now','-1 minutes')`)
      .first();
    if (Number((recent as any)?.n ?? 0) >= MAX_PER_MINUTE) return jsonResponse({ ok: true, logged: false }, 202);

    const reason = await currentWidgetReason();
    await db
      .prepare(`INSERT INTO social_wall_events (reason, widget_id) VALUES (?1, ?2)`)
      .bind(reason, SOCIAL_WALL_ELFSIGHT_WIDGET_UUID)
      .run();
    return jsonResponse({ ok: true, logged: true }, 202);
  } catch {
    // Logging must never matter to the visitor.
    return jsonResponse({ ok: false }, 202);
  }
}
