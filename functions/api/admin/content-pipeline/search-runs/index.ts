// GET/POST /api/admin/content-pipeline/search-runs
// Lists or starts a #3552 content discovery search run. Protected by an authenticated D1 admin member session (requireAdmin).
// A run always belongs to exactly one allowlisted source (#3551's workflow:
// "Operator chooses an enabled discovery/research service from the approved list").

import { parseStartSearchRunRequest } from '../../../../_lib/content-search-run-admin';
import {
  expireStaleRunningSearchRuns,
  listSearchRuns,
  requireContentSearchRunTables,
  startSearchRun,
  type ContentSearchRunListFilter,
} from '../../../../_lib/content-search-run-repository';
import { requireAdmin } from '../../../../_lib/auth';
import { jsonResponse, requireD1 } from '../../../../_lib/d1';

async function resolveSourceId(db: any, sourceDomain: string): Promise<number | null> {
  const row = await db
    .prepare('SELECT id FROM sources WHERE source_domain = ? LIMIT 1')
    .bind(sourceDomain)
    .first();
  return row ? Number((row as { id: number }).id) : null;
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentSearchRunTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    // Opportunistic lease sweep: a run can never surface as `running`
    // forever, even if nothing ever calls the sweep on a schedule.
    await expireStaleRunningSearchRuns(d1.db);

    const url = new URL(request.url);
    const filter: ContentSearchRunListFilter = {};
    const status = url.searchParams.get('status');
    if (status) filter.status = status as ContentSearchRunListFilter['status'];
    const sourceDomain = url.searchParams.get('source_domain');
    if (sourceDomain) {
      const sourceId = await resolveSourceId(d1.db, sourceDomain);
      if (sourceId === null) {
        return jsonResponse({ ok: true, count: 0, runs: [] }, 200);
      }
      filter.source_id = sourceId;
    }

    const runs = await listSearchRuns(d1.db, filter);
    return jsonResponse({ ok: true, count: runs.length, runs }, 200);
  } catch (err: any) {
    console.error('admin search-runs list error:', err);
    return jsonResponse({ ok: false, error: 'Search run query failed.' }, 500);
  }
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const d1 = requireD1(env);
  if (!d1.ok) return jsonResponse(d1.body, d1.status);

  const tables = await requireContentSearchRunTables(d1.db);
  if (!tables.ok) return jsonResponse(tables.body, tables.status);

  try {
    const body = await request.json().catch(() => null);
    const parsed = parseStartSearchRunRequest(body);
    if (!parsed.ok) {
      return jsonResponse({ ok: false, error: parsed.error }, 400);
    }

    await expireStaleRunningSearchRuns(d1.db);

    const { source_domain, ...startInput } = parsed.request;
    const sourceId = await resolveSourceId(d1.db, source_domain);
    if (sourceId === null) {
      return jsonResponse({ ok: false, error: `Unknown or unapproved source_domain: ${source_domain}` }, 400);
    }

    const run = await startSearchRun(d1.db, { ...startInput, source_id: sourceId });
    return jsonResponse({ ok: true, run }, 201);
  } catch (err: any) {
    const message = String(err?.message || err);
    if (message.includes('UNIQUE')) {
      return jsonResponse({ ok: false, error: 'run_uid already exists.' }, 409);
    }
    console.error('admin search-runs create error:', err);
    return jsonResponse({ ok: false, error: 'Search run create failed.' }, 500);
  }
};
