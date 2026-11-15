// GET /api/social/edition-plan?from=YYYY-MM-DD&days=N[&surface=website|social][&platform=<key>]
// Read path for the daily job (#5218, slice of #5037): the next days of the edition plan (#5075).
// Authenticated by the scheduled-content bridge token, like the social ledger (#5156). Read only: it has no
// write method. It returns the planning fields a job needs and leaves out the posting bookkeeping
// (external_id, error, posted_at), and the table holds no member, donor or visitor data.

import { requireScheduledContentBridge } from "../../_lib/scheduled-content-auth";

type D1Like = {
  prepare(sql: string): { bind(...values: string[]): { all(): Promise<{ results?: unknown[] }> } };
};
type Context = { request: Request; env: { DB?: D1Like; SCHEDULED_CONTENT_BRIDGE_TOKEN?: string } };

const DEFAULT_DAYS = 3;
const MAX_DAYS = 14;
const SURFACES = ["website", "social"] as const;
const PLATFORMS = ["website", "facebook_page", "instagram", "pinterest", "x"] as const;

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function addDays(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export const onRequestGet = async (context: Context): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);

  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? new Date().toISOString().slice(0, 10);
  if (!isRealDate(from)) return json({ ok: false, error: "from must be a real date, YYYY-MM-DD" }, 400);

  const daysParam = params.get("days");
  const days = daysParam === null ? DEFAULT_DAYS : Number(daysParam);
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return json({ ok: false, error: `days must be a whole number from 1 to ${MAX_DAYS}` }, 400);
  }

  const surface = params.get("surface");
  if (surface !== null && !(SURFACES as readonly string[]).includes(surface)) {
    return json({ ok: false, error: "unknown surface" }, 400);
  }
  const platform = params.get("platform");
  if (platform !== null && !(PLATFORMS as readonly string[]).includes(platform)) {
    return json({ ok: false, error: "unknown platform" }, 400);
  }

  const to = addDays(from, days - 1);
  const where = ["edition_date >= ?", "edition_date <= ?"];
  const binds: string[] = [from, to];
  if (surface) {
    where.push("surface = ?");
    binds.push(surface);
  }
  if (platform) {
    where.push("platform = ?");
    binds.push(platform);
  }

  const result = await env.DB.prepare(
    `SELECT edition_date, surface, platform, channel, content_item_id, story_ref, text, link, image_url, image_alt,
            skip, skip_reason, status, plan_version
       FROM edition_plan
      WHERE ${where.join(" AND ")}
      ORDER BY edition_date ASC, surface ASC, platform ASC;`,
  )
    .bind(...binds)
    .all();

  return json({ ok: true, from, to, days, rows: result.results ?? [] }, 200);
};
