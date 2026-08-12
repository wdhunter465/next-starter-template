import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildDiagnosticSnippet,
  buildResultMarkdown,
  buildTableExclusionSql,
  buildTableListSql,
  buildTableRowCountSql,
  hasLiveDevD1Credentials,
  loadD1IdentitiesFromWrangler,
  parseSingleRowCount,
  productionD1IdFromWrangler,
  quoteSqlIdentifier,
  quoteSqlStringLiteral,
  requireEnv,
} from '../scripts/ci/production_content_preview_preflight_2859.mjs';

const WRANGLER = path.resolve(process.cwd(), 'wrangler.toml');

describe('requireEnv', () => {
  it('lists every missing required B2 credential', () => {
    expect(requireEnv({})).toEqual(['B2_ENDPOINT', 'B2_BUCKET', 'B2_KEY_ID', 'B2_APP_KEY']);
  });

  it('returns an empty list when every B2 credential is present', () => {
    expect(
      requireEnv({
        B2_ENDPOINT: 'x',
        B2_BUCKET: 'x',
        B2_KEY_ID: 'x',
        B2_APP_KEY: 'x',
      }),
    ).toEqual([]);
  });
});

describe('SQL quoting / buildTableRowCountSql (#3337, #3379)', () => {
  it('escapes single quotes in string literals', () => {
    expect(quoteSqlStringLiteral("foo'bar")).toBe("'foo''bar'");
  });

  it('escapes double quotes in identifiers', () => {
    expect(quoteSqlIdentifier('a"b')).toBe('"a""b"');
  });

  it('builds one COUNT(*) query per table with the identifier escaped -- never a combined UNION ALL (D1 compound-SELECT term limit, live finding 2026-08-12)', () => {
    expect(buildTableRowCountSql('mem"bers')).toBe('SELECT COUNT(*) AS row_count FROM "mem""bers"');
    expect(buildTableRowCountSql('events')).toBe('SELECT COUNT(*) AS row_count FROM "events"');
    expect(buildTableRowCountSql('events')).not.toContain('UNION');
  });
});

describe('buildTableExclusionSql / buildTableListSql', () => {
  it('excludes sqlite_/d1_migrations/_cf_ bookkeeping tables via GLOB (literal underscores)', () => {
    const sql = buildTableExclusionSql();
    expect(sql).toContain("NOT GLOB 'sqlite_*'");
    expect(sql).toContain("NOT GLOB 'd1_migrations*'");
    expect(sql).toContain("NOT GLOB '_cf_*'");
    expect(sql).not.toContain('NOT LIKE');
  });

  it('builds a query selecting table names from sqlite_master with the exclusion applied', () => {
    const sql = buildTableListSql();
    expect(sql).toContain("SELECT name FROM sqlite_master WHERE type='table'");
    expect(sql).toContain('ORDER BY name');
  });
});

describe('parseSingleRowCount', () => {
  it('extracts the count from a one-row, one-column result', () => {
    expect(parseSingleRowCount([{ row_count: 25 }])).toBe(25);
  });

  it('coerces a string count to a number', () => {
    expect(parseSingleRowCount([{ row_count: '20' }])).toBe(20);
  });

  it('returns 0 for an empty or missing result', () => {
    expect(parseSingleRowCount([])).toBe(0);
    expect(parseSingleRowCount(undefined)).toBe(0);
  });
});

describe('Production D1 identity from wrangler.toml (#3337)', () => {
  it('loads Production/Preview identities from wrangler.toml via the parser (no hardcoded UUID copies)', () => {
    const identities = loadD1IdentitiesFromWrangler(WRANGLER);
    expect(identities.production.databaseName).toBe('lgfc_lite');
    expect(identities.preview.databaseName).toBe('lgfc-litedev');
    expect(identities.production.databaseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(identities.preview.databaseId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(identities.production.databaseId).not.toBe(identities.preview.databaseId);
    expect(productionD1IdFromWrangler(WRANGLER)).toBe(identities.production.databaseId);
    // Sanity: Production id appears in the file text (without assuming first-match order).
    const toml = fs.readFileSync(WRANGLER, 'utf8');
    expect(toml).toContain(identities.production.databaseId);
    expect(toml).toContain(identities.preview.databaseId);
  });

  it('does not treat Preview as production-shared', () => {
    const identities = loadD1IdentitiesFromWrangler(WRANGLER);
    expect(identities.preview.databaseId).not.toBe(identities.production.databaseId);
    expect(identities.preview.databaseName).not.toBe(identities.production.databaseName);
  });
});

describe('buildDiagnosticSnippet', () => {
  const identity = (text) => text;

  it('prefers stderr over stdout', () => {
    expect(buildDiagnosticSnippet({ stderr: 'from stderr', stdout: 'from stdout' }, identity)).toBe('from stderr');
  });

  it('falls back to stdout when stderr is empty', () => {
    expect(buildDiagnosticSnippet({ stderr: '', stdout: 'from stdout' }, identity)).toBe('from stdout');
  });

  it('treats whitespace-only stderr as empty and falls back to stdout', () => {
    expect(buildDiagnosticSnippet({ stderr: '\n  \n', stdout: 'from stdout' }, identity)).toBe('from stdout');
  });

  it('returns an empty string when both are empty', () => {
    expect(buildDiagnosticSnippet({ stderr: '', stdout: '' }, identity)).toBe('');
    expect(buildDiagnosticSnippet({}, identity)).toBe('');
  });

  it('truncates to 800 chars with a trailing ellipsis', () => {
    const long = 'x'.repeat(1000);
    const snippet = buildDiagnosticSnippet({ stderr: long }, identity);
    expect(snippet).toBe(`${'x'.repeat(800)}...`);
  });

  it('applies the provided redact function before truncating', () => {
    const redact = (text) => text.replaceAll('secret-value', '[REDACTED]');
    expect(buildDiagnosticSnippet({ stderr: 'error near secret-value token' }, redact)).toBe(
      'error near [REDACTED] token',
    );
  });
});

describe('hasLiveDevD1Credentials', () => {
  it('is false when only B2 credentials are present', () => {
    expect(
      hasLiveDevD1Credentials({
        B2_ENDPOINT: 'x',
        B2_BUCKET: 'x',
        B2_KEY_ID: 'x',
        B2_APP_KEY: 'x',
      }),
    ).toBe(false);
  });

  it('is true when Cloudflare + D1_DEV credentials are present', () => {
    expect(
      hasLiveDevD1Credentials({
        CLOUDFLARE_API_TOKEN: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'x',
        D1_DEV_DATABASE_NAME: 'lgfc-litedev',
        D1_DEV_DATABASE_ID: '35232809-b4c1-4df9-9f39-2f178b13c378',
      }),
    ).toBe(true);
  });
});

describe('buildResultMarkdown', () => {
  const fullyOk = {
    checkedAt: '2026-08-11T00:00:00Z',
    d1: {
      productionName: 'lgfc_lite',
      productionId: '22d0dc3e-ad34-43af-8e6a-2063df1a1e04',
      previewName: 'lgfc-litedev',
      previewId: '35232809-b4c1-4df9-9f39-2f178b13c378',
      distinct: true,
      contractOk: true,
      contractFailures: [],
      liveProbe: 'skipped_missing_credentials',
    },
    b2: { reachable: true, objectCount: 42, truncated: false, failureReason: '' },
  };

  it('states the post-split D1 contract, not production-shared', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('lgfc-litedev');
    expect(md).toContain('lgfc_lite');
    expect(md).toContain('Distinct IDs: YES');
    expect(md).not.toContain('production-shared');
  });

  it('renders a fully-reachable B2 result', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('Reachable: YES');
    expect(md).toContain('Object count (first page, max 1000): 42');
  });

  it('never includes credential values or object keys, by construction', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).not.toContain('http://');
    expect(md).not.toContain('AccessKeyId');
  });

  it('renders an unreachable B2 result with its failure reason', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      b2: { reachable: false, objectCount: null, truncated: false, failureReason: 'HTTP 403: AccessDenied' },
    });
    expect(md).toContain('Reachable: NO (HTTP 403: AccessDenied)');
    expect(md).not.toContain('Object count (first page');
  });
});
