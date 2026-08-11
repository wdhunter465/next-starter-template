import { describe, expect, it } from 'vitest';
import {
  PRODUCTION_D1_DATABASE_ID,
  buildResultMarkdown,
  buildRowCountSql,
  buildTableExclusionSql,
  buildTableListSql,
  parseRowCountRows,
  requireEnv,
} from '../scripts/ci/production_content_preview_preflight_2859.mjs';

// #2859 Preview D1/B2 preflight -- covers the pure helper functions only. `main()` invokes
// the real `wrangler` CLI and the real R2 S3 API against live Preview credentials this
// sandbox does not have, and is verified by the real CI run, same precedent as every other
// #3268/#2913 preflight/package script.

describe('requireEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireEnv({})).toEqual([
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ACCOUNT_ID',
      'PREVIEW_D1_DATABASE_NAME',
      'PREVIEW_D1_DATABASE_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'PREVIEW_R2_BUCKET_NAME',
    ]);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireEnv({
        CLOUDFLARE_API_TOKEN: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'x',
        PREVIEW_D1_DATABASE_NAME: 'x',
        PREVIEW_D1_DATABASE_ID: 'x',
        R2_ACCESS_KEY_ID: 'x',
        R2_SECRET_ACCESS_KEY: 'x',
        PREVIEW_R2_BUCKET_NAME: 'x',
      }),
    ).toEqual([]);
  });
});

describe('PRODUCTION_D1_DATABASE_ID', () => {
  it('matches the database_id declared in wrangler.toml', () => {
    expect(PRODUCTION_D1_DATABASE_ID).toBe('22d0dc3e-ad34-43af-8e6a-2063df1a1e04');
  });
});

describe('buildTableExclusionSql / buildTableListSql', () => {
  it('excludes sqlite_/d1_migrations/_cf_ bookkeeping tables', () => {
    const sql = buildTableExclusionSql();
    expect(sql).toContain("NOT LIKE 'sqlite_%'");
    expect(sql).toContain("NOT LIKE 'd1_migrations%'");
    expect(sql).toContain("NOT LIKE '_cf_%'");
  });

  it('builds a query selecting table names from sqlite_master with the exclusion applied', () => {
    const sql = buildTableListSql();
    expect(sql).toContain("SELECT name FROM sqlite_master WHERE type='table'");
    expect(sql).toContain("NOT LIKE '_cf_%'");
    expect(sql).toContain('ORDER BY name');
  });
});

describe('buildRowCountSql', () => {
  it('builds one UNION ALL query covering every table', () => {
    const sql = buildRowCountSql(['members', 'events']);
    expect(sql).toBe(
      "SELECT 'members' AS table_name, COUNT(*) AS row_count FROM \"members\" UNION ALL SELECT 'events' AS table_name, COUNT(*) AS row_count FROM \"events\"",
    );
  });

  it('returns an empty string for an empty table list', () => {
    expect(buildRowCountSql([])).toBe('');
  });
});

describe('parseRowCountRows', () => {
  it('normalizes and sorts rows by table name', () => {
    expect(
      parseRowCountRows([
        { table_name: 'events', row_count: 25 },
        { table_name: 'members', row_count: '20' },
      ]),
    ).toEqual([
      { table: 'events', rowCount: 25 },
      { table: 'members', rowCount: 20 },
    ]);
  });

  it('drops rows with a missing/blank table name', () => {
    expect(parseRowCountRows([{ table_name: '', row_count: 5 }])).toEqual([]);
  });

  it('returns an empty array for null/undefined input', () => {
    expect(parseRowCountRows(undefined)).toEqual([]);
  });
});

describe('buildResultMarkdown', () => {
  const fullyOk = {
    checkedAt: '2026-08-11T00:00:00Z',
    d1: {
      tableCount: 2,
      tables: [
        { table: 'events', rowCount: 25 },
        { table: 'members', rowCount: 20 },
      ],
    },
    r2: { reachable: true, objectCount: 3, truncated: false, failureReason: '' },
  };

  it('renders a fully-reachable result', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('Table count: 2');
    expect(md).toContain('| `events` | 25 |');
    expect(md).toContain('| `members` | 20 |');
    expect(md).toContain('Reachable: YES');
    expect(md).toContain('Object count (first page, max 1000): 3');
  });

  it('never includes credential values or object keys, by construction', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).not.toContain('http://');
    expect(md).not.toContain('AccessKeyId');
  });

  it('states plainly what this evidence does not establish', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('does **not** by itself satisfy');
    expect(md).toContain('Gate 1 remains HOLD');
    expect(md).toContain('Gate 2 remains NO-GO');
  });

  it('renders an unreachable R2 result with its failure reason, and omits the object-count line', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      r2: { reachable: false, objectCount: null, truncated: false, failureReason: 'HTTP 403: AccessDenied' },
    });
    expect(md).toContain('Reachable: NO (HTTP 403: AccessDenied)');
    expect(md).not.toContain('Object count (first page');
  });

  it('renders a truncated object count with a trailing +', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      r2: { reachable: true, objectCount: 1000, truncated: true, failureReason: '' },
    });
    expect(md).toContain('Object count (first page, max 1000): 1000+');
  });

  it('renders zero tables without a stray table row', () => {
    const md = buildResultMarkdown({ ...fullyOk, d1: { tableCount: 0, tables: [] } });
    expect(md).toContain('Table count: 0');
  });
});
