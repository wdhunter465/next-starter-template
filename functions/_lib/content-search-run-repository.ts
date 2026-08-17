// D1 repository for #3551/#3552 content_search_runs (migration 0055).
// A run always belongs to exactly one allowlisted source (source_id NOT NULL)
// -- a multi-source discovery invocation is multiple runs, not one.

import { requireTables } from './d1';

export const CONTENT_SEARCH_RUN_TABLES = ['content_search_runs', 'sources'] as const;

export const CONTENT_SEARCH_RUN_RUNNING_STATUS = 'running';

export const CONTENT_SEARCH_RUN_TERMINAL_STATUSES = [
  'completed',
  'completed_with_limit',
  'no_results',
  'source_error',
  'rate_limited',
  'cancelled',
  'blocked_policy',
] as const;

export type ContentSearchRunTerminalStatus = (typeof CONTENT_SEARCH_RUN_TERMINAL_STATUSES)[number];
export type ContentSearchRunStatus = ContentSearchRunTerminalStatus | typeof CONTENT_SEARCH_RUN_RUNNING_STATUS;

function toSet<T extends string>(values: readonly T[]): Set<string> {
  return new Set(values);
}

export const CONTENT_SEARCH_RUN_TERMINAL_STATUS_SET = toSet(CONTENT_SEARCH_RUN_TERMINAL_STATUSES);

export type ContentSearchRunRow = {
  id: number;
  run_uid: string;
  source_id: number;
  query: string | null;
  filters: string;
  result_limit: number | null;
  page_limit: number | null;
  adapter_version: string | null;
  initiated_by: string | null;
  status: ContentSearchRunStatus;
  discovered_count: number;
  duplicate_count: number;
  new_count: number;
  deferred_count: number;
  rights_cleared_count: number;
  rejected_count: number;
  error_count: number;
  error_summary: string | null;
  lease_expires_at: string | null;
  heartbeat_at: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredContentSearchRun = Omit<ContentSearchRunRow, 'filters'> & {
  filters: Record<string, unknown>;
};

export type StartSearchRunInput = {
  run_uid: string;
  source_id: number;
  query?: string | null;
  filters?: Record<string, unknown>;
  result_limit?: number | null;
  page_limit?: number | null;
  adapter_version?: string | null;
  initiated_by?: string | null;
  lease_seconds?: number;
};

export type CompleteSearchRunCounts = {
  discovered_count?: number;
  duplicate_count?: number;
  new_count?: number;
  deferred_count?: number;
  rights_cleared_count?: number;
  rejected_count?: number;
  error_count?: number;
  error_summary?: string | null;
};

export type CompleteSearchRunInput = CompleteSearchRunCounts & {
  status: ContentSearchRunTerminalStatus;
};

export async function requireContentSearchRunTables(db: unknown) {
  return requireTables(db, [...CONTENT_SEARCH_RUN_TABLES]);
}

// SQLite datetime modifiers must carry their own sign (e.g. "+900 seconds"
// or "-1 seconds") -- concatenating a hardcoded '+' with a negative number
// in SQL produces the invalid modifier "+-1 seconds", which strftime
// silently resolves to NULL rather than erroring.
function leaseModifier(seconds: number): string {
  const sign = seconds >= 0 ? '+' : '';
  return `${sign}${seconds} seconds`;
}

function parseFilters(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === '') return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function mapContentSearchRunRow(row: ContentSearchRunRow): StoredContentSearchRun {
  return { ...row, filters: parseFilters(row.filters) };
}

export async function startSearchRun(
  db: any,
  input: StartSearchRunInput,
): Promise<StoredContentSearchRun> {
  const leaseSeconds = input.lease_seconds ?? 900; // 15 minutes default lease
  const result = await db
    .prepare(
      `INSERT INTO content_search_runs (
        run_uid, source_id, query, filters, result_limit, page_limit,
        adapter_version, initiated_by, status, lease_expires_at, heartbeat_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'running',
        strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?),
        strftime('%Y-%m-%dT%H:%M:%fZ','now'))`,
    )
    .bind(
      input.run_uid,
      input.source_id,
      input.query ?? null,
      JSON.stringify(input.filters ?? {}),
      input.result_limit ?? null,
      input.page_limit ?? null,
      input.adapter_version ?? null,
      input.initiated_by ?? null,
      leaseModifier(leaseSeconds),
    )
    .run();

  const insertedId = Number(result?.meta?.last_row_id ?? 0);
  const row = await db.prepare('SELECT * FROM content_search_runs WHERE id = ? LIMIT 1').bind(insertedId).first();
  if (!row) {
    throw new Error(`Failed to load content_search_runs after insert for run_uid=${input.run_uid}`);
  }
  return mapContentSearchRunRow(row as ContentSearchRunRow);
}

export async function getSearchRunByUid(db: any, runUid: string): Promise<StoredContentSearchRun | null> {
  const row = await db
    .prepare('SELECT * FROM content_search_runs WHERE run_uid = ? LIMIT 1')
    .bind(runUid)
    .first();
  return row ? mapContentSearchRunRow(row as ContentSearchRunRow) : null;
}

export async function completeSearchRun(
  db: any,
  runUid: string,
  input: CompleteSearchRunInput,
): Promise<StoredContentSearchRun | null> {
  if (!CONTENT_SEARCH_RUN_TERMINAL_STATUS_SET.has(input.status)) {
    throw new Error(`Invalid terminal status: ${input.status}`);
  }

  await db
    .prepare(
      `UPDATE content_search_runs
       SET status = ?,
           discovered_count = ?,
           duplicate_count = ?,
           new_count = ?,
           deferred_count = ?,
           rights_cleared_count = ?,
           rejected_count = ?,
           error_count = ?,
           error_summary = ?,
           completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE run_uid = ?
         AND status = 'running'`,
    )
    .bind(
      input.status,
      input.discovered_count ?? 0,
      input.duplicate_count ?? 0,
      input.new_count ?? 0,
      input.deferred_count ?? 0,
      input.rights_cleared_count ?? 0,
      input.rejected_count ?? 0,
      input.error_count ?? 0,
      input.error_summary ?? null,
      runUid,
    )
    .run();

  return getSearchRunByUid(db, runUid);
}

export async function heartbeatSearchRun(
  db: any,
  runUid: string,
  leaseSeconds = 900,
): Promise<StoredContentSearchRun | null> {
  await db
    .prepare(
      `UPDATE content_search_runs
       SET heartbeat_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           lease_expires_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE run_uid = ?
         AND status = 'running'`,
    )
    .bind(leaseModifier(leaseSeconds), runUid)
    .run();

  return getSearchRunByUid(db, runUid);
}

export type ContentSearchRunListFilter = {
  status?: ContentSearchRunStatus;
  source_id?: number;
  limit?: number;
  offset?: number;
};

export async function listSearchRuns(
  db: any,
  filter: ContentSearchRunListFilter = {},
): Promise<StoredContentSearchRun[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (filter.status) {
    clauses.push('status = ?');
    binds.push(filter.status);
  }
  if (filter.source_id) {
    clauses.push('source_id = ?');
    binds.push(filter.source_id);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const result = await db
    .prepare(
      `SELECT * FROM content_search_runs
       ${whereSql}
       ORDER BY started_at DESC, id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all();

  return ((result.results ?? []) as ContentSearchRunRow[]).map(mapContentSearchRunRow);
}

// #3551: "A run must never remain indefinitely `running`; a lease/heartbeat
// expiration converts it to `source_error` for operator review." Callable on
// an interval (or opportunistically before creating a new run) rather than
// requiring a dedicated scheduler.
export async function expireStaleRunningSearchRuns(db: any): Promise<number> {
  const result = await db
    .prepare(
      `UPDATE content_search_runs
       SET status = 'source_error',
           error_summary = COALESCE(error_summary, 'lease expired without heartbeat'),
           completed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
           updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE status = 'running'
         AND lease_expires_at IS NOT NULL
         AND lease_expires_at < strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    )
    .run();

  return Number((result as { meta?: { changes?: number } })?.meta?.changes ?? 0);
}
