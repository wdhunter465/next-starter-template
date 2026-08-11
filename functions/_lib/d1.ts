// D1 database guard helpers for Cloudflare Pages Functions
// Provides explicit error responses when D1 binding is missing or tables don't exist

export interface Env {
  DB?: any; // D1Database type is only available at runtime in Cloudflare Workers
  [key: string]: any;
}

type RequireD1Result =
  | { ok: true; db: any }
  | { ok: false; status: number; body: Record<string, any> };

/**
 * Guard: Ensure D1 binding exists
 * 
 * Returns either the D1 database instance or an error response object.
 * Use this at the start of any endpoint that requires D1.
 * 
 * @example
 * ```ts
 * const d1 = requireD1(env);
 * if (!d1.ok) {
 *   return new Response(JSON.stringify(d1.body), {
 *     status: d1.status,
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }
 * const db = d1.db;
 * ```
 */
export function requireD1(env: Env): RequireD1Result {
  if (!env.DB) {
    return {
      ok: false,
      status: 503,
      body: {
        ok: false,
        error: 'Database unavailable',
        detail: 'D1 binding "DB" not found. Ensure wrangler.toml has [[d1_databases]] with binding="DB" and Cloudflare Pages environment has the D1 binding configured.',
        docs: 'https://developers.cloudflare.com/pages/functions/bindings/#d1-databases'
      }
    };
  }
  
  return { ok: true, db: env.DB };
}

/**
 * Guard: Ensure required tables exist in D1
 * 
 * Checks that the specified tables exist by querying sqlite_master.
 * Use this to validate that migrations have been applied before attempting operations.
 * 
 * @param db - D1 database instance
 * @param tables - Array of table names that must exist
 * @returns Promise of result indicating success or error details
 * 
 * @example
 * ```ts
 * const tablesCheck = await requireTables(db, ['join_requests', 'members']);
 * if (!tablesCheck.ok) {
 *   return new Response(JSON.stringify(tablesCheck.body), {
 *     status: tablesCheck.status,
 *     headers: { 'Content-Type': 'application/json' }
 *   });
 * }
 * ```
 */
export async function requireTables(
  db: any,
  tables: string[]
): Promise<RequireD1Result> {
  try {
    const placeholders = tables.map(() => '?').join(',');
    const query = `SELECT name FROM sqlite_master WHERE type='table' AND name IN (${placeholders})`;
    const result = await db.prepare(query).bind(...tables).all();
    
    const existingTables = new Set((result.results || []).map((row: any) => row.name));
    const missingTables = tables.filter(t => !existingTables.has(t));
    
    if (missingTables.length > 0) {
      return {
        ok: false,
        status: 503,
        body: {
          ok: false,
          error: 'Database schema incomplete',
          detail: `Missing required table(s): ${missingTables.join(', ')}. Run migrations with: npx wrangler d1 migrations apply lgfc_lite --remote (Production) or npx wrangler d1 migrations apply lgfc-litedev --remote (Preview/Dev). See docs/how-to/operations/bind-pages-preview-d1-dev.md`,
          missingTables,
          docs: 'See /docs/governance/PR_GOVERNANCE.md § D1 Database Seeding'
        }
      };
    }
    
    return { ok: true, db };
  } catch (e: any) {
    return {
      ok: false,
      status: 500,
      body: {
        ok: false,
        error: 'Database query failed',
        detail: e?.message || 'Unknown error checking table existence'
      }
    };
  }
}

/**
 * Helper: Create JSON Response
 * 
 * Convenience function to create properly formatted JSON responses.
 */
export function jsonResponse(data: any, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
