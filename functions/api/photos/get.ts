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
  const { env, params, request } = context;

  try {
    const url = new URL(request.url);
    const paramsId = Number((params as any)?.id);
    const queryId = Number(url.searchParams.get("id"));
    const id = !Number.isNaN(paramsId) && paramsId > 0 ? paramsId : queryId;
    if (!id || Number.isNaN(id)) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid id" }, null, 2), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const statusFilter = (await photosHasStatusColumn(env.DB)) ? " AND status = 'published'" : "";
    const row = await env.DB.prepare(
      `SELECT id, url, is_memorabilia, description, created_at FROM photos WHERE id = ?${statusFilter} LIMIT 1;`
    )
      .bind(id)
      .first();

    if (!row) {
      return new Response(JSON.stringify({ ok: false, error: "Not found" }, null, 2), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const item = {
      ...row,
      url: normalizePhotoUrl({ rawUrl: row.url, request, publicB2BaseUrl: env.PUBLIC_B2_BASE_URL }),
    };

    return new Response(JSON.stringify({ ok: true, item }, null, 2), {
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
