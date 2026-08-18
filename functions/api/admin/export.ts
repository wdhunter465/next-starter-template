// GET /api/admin/export?table=join_requests|join_email_log|library_entries|photos|page_content
// Returns CSV. Protected by ADMIN_TOKEN.

import { requireAdmin } from "../../_lib/auth";
import { toCsv } from "../../_lib/csv";

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

  const url = new URL(request.url);
  const table = (url.searchParams.get("table") || "join_requests").trim();

  const allowed = new Set(["join_requests", "join_email_log", "library_entries", "photos", "page_content"]);
  if (!allowed.has(table)) {
    return new Response(JSON.stringify({ ok: false, error: "Invalid table." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const limit = Math.min(Number(url.searchParams.get("limit") || "5000"), 5000);
    const rows = await db.prepare(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ?1`).bind(limit).all();

    const resultRows = (rows?.results || []) as Record<string, unknown>[];
    const columns =
      resultRows.length > 0 ? Object.keys(resultRows[0]) : (table === "photos"
        ? ["photo_id", "url", "is_memorabilia", "description", "created_at"]
        : table === "library_entries"
        ? ["id", "name", "email", "title", "content", "created_at"]
        : ["id", "name", "email", "created_at"]);

    const csv = toCsv(resultRows, columns);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${table}.csv"`,
      },
    });
  } catch (err: any) {
    console.error("admin export error:", err);
    return new Response(JSON.stringify({ ok: false, error: "Export failed." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
