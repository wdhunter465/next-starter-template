import { requireD1, requireTables, jsonResponse } from "../../_lib/d1";
import { normalizePhotoUrl } from "../../_lib/photo-url";

const LOUGEHRIG_COM_HOST = "lougehrig.com";

const HOMEPAGE_ORDER = [
  "https://www.alscure.org",
  "https://www.iamals.org",
  "https://www.livelikelou.org",
  "https://www.thelougehrigsociety.org",
  "https://www.jonathaneig.com/luckiest-man-the-life-and-death-of-lou-gehrig",
  "https://museum.phideltatheta.org/lou-gehrig-award",
  "https://www.theyplayedincolor.com",
];

const CLUB_HOME_ORDER = [
  "https://www.alscure.org",
  "https://www.thelougehrigsociety.org",
  "https://www.iamals.org",
  "https://www.livelikelou.org",
  "https://lougehrig.com",
  "https://www.jonathaneig.com/luckiest-man-the-life-and-death-of-lou-gehrig",
  "https://museum.phideltatheta.org/lou-gehrig-award",
  "https://www.theyplayedincolor.com",
];

function normalizeFriendUrl(url: unknown): string {
  return String(url || "")
    .trim()
    .toLowerCase()
    .replace(/\/+$/, "");
}

function isLouGehrigDotCom(url: unknown): boolean {
  const normalized = normalizeFriendUrl(url);
  return normalized === `https://${LOUGEHRIG_COM_HOST}` || normalized === `http://${LOUGEHRIG_COM_HOST}`;
}

function rankIndex(order: string[], url: unknown): number {
  const normalized = normalizeFriendUrl(url);
  const found = order.findIndex((entry) => normalizeFriendUrl(entry) === normalized);
  return found === -1 ? order.length : found;
}

function applyFriendSurface(
  items: Array<Record<string, unknown>>,
  surface: string,
): Array<Record<string, unknown>> {
  if (surface === "homepage") {
    const filtered = items.filter((item) => !isLouGehrigDotCom(item.url));
    return [...filtered].sort((a, b) => {
      const rankDiff = rankIndex(HOMEPAGE_ORDER, a.url) - rankIndex(HOMEPAGE_ORDER, b.url);
      if (rankDiff !== 0) return rankDiff;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  if (surface === "club-home") {
    return [...items].sort((a, b) => {
      const rankDiff = rankIndex(CLUB_HOME_ORDER, a.url) - rankIndex(CLUB_HOME_ORDER, b.url);
      if (rankDiff !== 0) return rankDiff;
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
  }

  return items;
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, request } = context;
  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  try {
    const tables = await requireTables(d1.db, ["friends"]);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

    const url = new URL(request.url);
    const kind = (url.searchParams.get("kind") || "").trim();
    const surface = (url.searchParams.get("surface") || "").trim();
    const parsedLimit = Number(url.searchParams.get("limit") || "40");
    const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, Math.trunc(parsedLimit))) : 40;
    const usesEditorialSurface = surface === "homepage" || surface === "club-home";
    const fetchLimit = usesEditorialSurface ? 100 : limit;

    let sql = "SELECT id, name, kind, blurb, url, photo_url FROM friends WHERE status='posted'";
    const args: any[] = [];
    if (kind) {
      sql += " AND kind = ?";
      args.push(kind);
    }
    sql += " ORDER BY name ASC LIMIT ?";
    args.push(fetchLimit);

    const rows = await d1.db.prepare(sql).bind(...args).all();
    const mapped = ((rows.results ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      photo_url: normalizePhotoUrl({
        rawUrl: row.photo_url,
        request,
        publicB2BaseUrl: env.PUBLIC_B2_BASE_URL,
      }) || null,
    }));
    const items = applyFriendSurface(mapped, surface).slice(0, limit);

    return new Response(JSON.stringify({ ok: true, items }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
