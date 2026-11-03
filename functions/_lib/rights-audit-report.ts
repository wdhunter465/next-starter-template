// Rights audit report (#5059): the share-safe permission log described in
// docs/reference/website/lou-gehrig-content-record-d1-design.md ("Audit report").
//
// Read-only. One row per record as of a date, optionally for one source domain.
// The columns are an allowlist: nothing outside RIGHTS_AUDIT_COLUMNS can leave this module,
// so admin notes, reviewer names, contact details and permission message bodies cannot leak
// into a report that is meant to be handed to a rights holder.

import { toCsv } from './csv';

export const RIGHTS_AUDIT_COLUMNS = [
  'candidate_id',
  'date_collected',
  'title',
  'content_type',
  'source_name',
  'source_domain',
  'source_url',
  'credit_line',
  'origin_permission',
  'cmg_permission',
  'mlb_permission',
  'yankees_permission',
  'privacy_status',
  'outcome_basis',
  'origin_statement',
  'statement_captured_at',
  'final_status',
] as const;

export type RightsAuditColumn = (typeof RIGHTS_AUDIT_COLUMNS)[number];
export type RightsAuditRow = Record<RightsAuditColumn, string>;

export const RIGHTS_AUDIT_MAX_ROWS = 5000;

export class RightsAuditQueryError extends Error {}

export interface RightsAuditQuery {
  /** Lowercase source domain, or null for every source. */
  domain: string | null;
  /** Inclusive upper bound on created_at, as stored (UTC ISO). */
  asOf: string;
}

const DOMAIN_PATTERN = /^[a-z0-9]([a-z0-9.-]{0,251}[a-z0-9])?$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?Z$/;

/**
 * Validate request parameters. A date-only as_of covers the whole day. Defaults to now.
 * Throws RightsAuditQueryError on anything malformed, so SQL only ever sees checked values.
 */
export function parseRightsAuditQuery(
  domainParam: string | null,
  asOfParam: string | null,
  now: Date = new Date(),
): RightsAuditQuery {
  let domain: string | null = null;
  const rawDomain = (domainParam ?? '').trim().toLowerCase();
  if (rawDomain) {
    if (!DOMAIN_PATTERN.test(rawDomain)) throw new RightsAuditQueryError('domain is not a valid host name');
    domain = rawDomain;
  }

  const rawAsOf = (asOfParam ?? '').trim();
  let asOf: string;
  if (!rawAsOf) {
    asOf = now.toISOString();
  } else if (DATE_ONLY.test(rawAsOf)) {
    if (Number.isNaN(Date.parse(`${rawAsOf}T00:00:00Z`))) throw new RightsAuditQueryError('as_of is not a valid date');
    asOf = `${rawAsOf}T23:59:59.999Z`;
  } else if (DATE_TIME.test(rawAsOf)) {
    if (Number.isNaN(Date.parse(rawAsOf))) throw new RightsAuditQueryError('as_of is not a valid date');
    asOf = rawAsOf;
  } else {
    throw new RightsAuditQueryError('as_of must be YYYY-MM-DD or a UTC ISO timestamp ending in Z');
  }
  return { domain, asOf };
}

/**
 * A record counts only if no newer record for the same origin URL existed by the as-of date.
 * The permission layers are the record's current values; as-of selects which records
 * existed, it does not reconstruct earlier layer values.
 */
export function buildRightsAuditSql(query: RightsAuditQuery): { sql: string; params: unknown[] } {
  const params: unknown[] = [query.asOf];
  let domainClause = '';
  if (query.domain) {
    domainClause = ' AND ci.source_domain = ?';
    params.push(query.domain);
  }
  params.push(query.asOf, RIGHTS_AUDIT_MAX_ROWS + 1);
  const sql = `SELECT ci.candidate_id AS candidate_id,
       ci.created_at AS date_collected,
       ci.title AS title,
       ci.content_type AS content_type,
       ci.source_name AS source_name,
       ci.source_domain AS source_domain,
       ci.source_url AS source_url,
       ci.credit_line AS credit_line,
       ci.origin_permission AS origin_permission,
       ci.cmg_permission AS cmg_permission,
       ci.mlb_permission AS mlb_permission,
       ci.yankees_permission AS yankees_permission,
       ci.privacy_status AS privacy_status,
       ci.outcome_basis AS outcome_basis,
       re.evidence_text AS origin_statement,
       re.recorded_at AS statement_captured_at,
       ci.final_status AS final_status
FROM content_items ci
LEFT JOIN rights_evidence re
  ON re.content_item_id = ci.id
 AND re.id = (SELECT MAX(id) FROM rights_evidence WHERE content_item_id = ci.id)
WHERE ci.created_at <= ?${domainClause}
  AND NOT EXISTS (
    SELECT 1 FROM content_items n
    WHERE n.source_url = ci.source_url
      AND (n.created_at > ci.created_at OR (n.created_at = ci.created_at AND n.id > ci.id))
      AND n.created_at <= ?
  )
ORDER BY ci.created_at, ci.id
LIMIT ?`;
  return { sql, params };
}

export interface RightsAuditReport {
  query: RightsAuditQuery;
  rows: RightsAuditRow[];
  /** True when more rows matched than the cap allows; the report is incomplete. */
  truncated: boolean;
}

export async function buildRightsAuditReport(db: any, query: RightsAuditQuery): Promise<RightsAuditReport> {
  const { sql, params } = buildRightsAuditSql(query);
  const result = await db.prepare(sql).bind(...params).all();
  const raw = ((result?.results ?? []) as Record<string, unknown>[]).slice();
  const truncated = raw.length > RIGHTS_AUDIT_MAX_ROWS;
  if (truncated) raw.length = RIGHTS_AUDIT_MAX_ROWS;
  const rows = raw.map((record) => {
    const row = {} as RightsAuditRow;
    for (const column of RIGHTS_AUDIT_COLUMNS) {
      const value = record[column];
      row[column] = value === null || value === undefined ? '' : String(value);
    }
    return row;
  });
  return { query, rows, truncated };
}

/**
 * Spreadsheet programs run a cell that starts with = + - @ (or a tab or CR) as a formula.
 * Titles and statements come from outside sources, so neutralise those cells.
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export function rightsAuditCsv(rows: RightsAuditRow[]): string {
  const safe = rows.map((row) => {
    const out: Record<string, string> = {};
    for (const column of RIGHTS_AUDIT_COLUMNS) out[column] = neutraliseFormula(row[column]);
    return out;
  });
  return toCsv(safe, [...RIGHTS_AUDIT_COLUMNS]);
}

export function rightsAuditFilename(query: RightsAuditQuery, extension: 'csv' | 'json'): string {
  const domain = query.domain ?? 'all-sources';
  return `rights-audit-${domain}-${query.asOf.slice(0, 10)}.${extension}`;
}
