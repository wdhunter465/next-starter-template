import { normalizePhotoUrl } from "../../_lib/photo-url";

async function photosHasStatusColumn(db: any): Promise<boolean> {
  try {
    const result = await db.prepare(`PRAGMA table_info(photos)`).all();
    const names = new Set((result?.results || []).map((row: any) => row.name));
    return names.has("status");
  } catch {
    return false;
  }
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, request } = context;

  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(100, Number(url.searchParams.get("limit") || "20")));
    const offset = Math.max(0, Number(url.searchParams.get("offset") || "0"));
    const memorabilia = url.searchParams.get("memorabilia");

    let sql = "SELECT id, url, is_memorabilia, description, created_at FROM photos";
    const where: string[] = [];
    const args: any[] = [];

    if (await photosHasStatusColumn(env.DB)) {
      where.push("status = 'published'");
    }
    if (memorabilia === "1") {
      where.push("is_memorabilia = 1");
    }
    if (where.length) {
      sql += ` WHERE ${where.join(" AND ")}`;
    }

    sql += " ORDER BY id DESC LIMIT ? OFFSET ?;";
    args.push(limit, offset);

    const rows = await env.DB.prepare(sql).bind(...args).all();
    const normalizedItems = (rows.results ?? []).map((row: any) => ({
      ...row,
      url: normalizePhotoUrl({ rawUrl: row?.url, request, publicB2BaseUrl: env.PUBLIC_B2_BASE_URL }),
    }));

    return new Response(
      JSON.stringify({ ok: true, items: normalizedItems, limit, offset }, null, 2),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err?.message ?? err) }, null, 2),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
