// GET /api/admin/d1-inspect
// Lists all D1 tables and row counts, and can return sample rows for a specific table.
// Protected by ADMIN_TOKEN (x-admin-token / Authorization: Bearer).
//
// Query params:
//   ?table=<name>&limit=<n>  -> returns schema + up to n rows
//
// NOTE: We only allow table names discovered from sqlite_master and matching [A-Za-z0-9_]+.

import { requireAdmin } from "../../_lib/auth";

type TableInfo = { name: string; count: number };

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isSafeIdent(name: string): boolean {
  return /^[A-Za-z0-9_]+$/.test(name);
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const url = new URL(request.url);
  const tableParam = (url.searchParams.get("table") || "").trim();
  const limitParam = Math.max(0, Math.min(100, Number(url.searchParams.get("limit") || "5") || 5));

  const db = env.DB as any;
  if (!db) return json({ ok: false, error: "D1 binding DB is missing." }, 500);

  try {
    // Discover tables
    const tablesRes = await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name ASC"
      )
      .all();

    const tableNames: string[] = (tablesRes?.results || [])
      .map((r: any) => String(r?.name || "").trim())
      .filter((n: string) => n && isSafeIdent(n));

    // Counts
    const tables: TableInfo[] = [];
    for (const name of tableNames) {
      const cRes = await db.prepare(`SELECT COUNT(1) as c FROM ${name}`).first();
      tables.push({ name, count: Number((cRes as any)?.c || 0) });
    }

    // If no table requested, return summary
    if (!tableParam) {
      return json({ ok: true, tables });
    }

    // Validate requested table is real
    if (!isSafeIdent(tableParam) || !tableNames.includes(tableParam)) {
      return json({ ok: false, error: "Invalid table name.", allowedTables: tableNames }, 400);
    }

    const schema = await db.prepare(`PRAGMA table_info(${tableParam})`).all();
    const rows = await db.prepare(`SELECT * FROM ${tableParam} LIMIT ${limitParam}`).all();

    return json({
      ok: true,
      table: tableParam,
      limit: limitParam,
      schema: schema?.results || [],
      rows: rows?.results || [],
      tables,
    });
  } catch (err: any) {
    return json({ ok: false, error: err?.message || String(err) }, 500);
  }
};
