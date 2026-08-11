import { describe, expect, it } from 'vitest';
import {
  buildResultMarkdown,
  computeD1Capable,
  computeR2Capable,
  findOrphanTestDatabases,
  generateTestContent,
  generateTestDbName,
  generateTestKey,
  parseD1CreateOutput,
  requireCapabilityEnv,
} from '../scripts/ci/d1_backup_phase2_capability_preflight_3268.mjs';

// #3268 Phase 2 Package 1 capability preflight — covers the pure helper functions only.
// `main()` invokes the real R2 S3 API and `wrangler` CLI against live credentials this
// sandbox does not have, and is verified by the real CI run, same precedent as every
// other #3268 preflight script.

describe('requireCapabilityEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireCapabilityEnv({})).toEqual([
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
    ]);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireCapabilityEnv({
        R2_ACCESS_KEY_ID: 'x',
        R2_SECRET_ACCESS_KEY: 'x',
        R2_BUCKET_NAME: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'x',
        CLOUDFLARE_API_TOKEN: 'x',
      }),
    ).toEqual([]);
  });
});

describe('generateTestKey / generateTestDbName / generateTestContent', () => {
  it('produces a key under the test prefix, unique per (now, random) pair', () => {
    const a = generateTestKey(1000, 'aaaa');
    const b = generateTestKey(1000, 'bbbb');
    expect(a).toMatch(/^_3268-capability-test\/1000-aaaa\.txt$/);
    expect(a).not.toBe(b);
  });

  it('produces a db name under the test prefix, unique per (now, random) pair', () => {
    const a = generateTestDbName(1000, 'aaaa');
    const b = generateTestDbName(2000, 'aaaa');
    expect(a).toMatch(/^lgfc-3268-cap-test-1000-aaaa$/);
    expect(a).not.toBe(b);
  });

  it('embeds the given nonce in test content, so read-back comparisons are meaningful', () => {
    const content = generateTestContent('deadbeef');
    expect(content).toContain('deadbeef');
    expect(content).toContain('#3268 Phase 2 Package 1');
  });
});

// Regression coverage for the two post-merge findings on PR #3306 (#3308): (1) r2Capable
// must require deleteVerified, not just a 2xx DELETE response, since a DELETE that
// "succeeded" but left the object readable is not proof of reversibility; (2) the
// whitespace-only-secret-after-trim gap this preflight shares with the Phase 1 R2
// preflight (findBlankAfterTrim, reused here) must fail closed rather than silently
// producing a malformed hostname/credential.
describe('computeR2Capable', () => {
  it('requires deleteVerified, not just deleteOk, to report capable', () => {
    expect(
      computeR2Capable({ putOk: true, getOk: true, contentMatched: true, deleteOk: true, deleteVerified: true }),
    ).toBe(true);
    expect(
      computeR2Capable({ putOk: true, getOk: true, contentMatched: true, deleteOk: true, deleteVerified: false }),
    ).toBe(false);
  });

  it('requires every prior step to have succeeded', () => {
    expect(computeR2Capable({ putOk: false })).toBe(false);
    expect(computeR2Capable({ putOk: true, getOk: false })).toBe(false);
    expect(computeR2Capable({ putOk: true, getOk: true, contentMatched: false })).toBe(false);
  });

  it('does not throw on a missing/undefined r2 result', () => {
    expect(computeR2Capable(undefined)).toBe(false);
    expect(computeR2Capable({})).toBe(false);
  });
});

describe('computeD1Capable', () => {
  it('requires create, execute, and delete to all have succeeded', () => {
    expect(computeD1Capable({ createOk: true, executeOk: true, deleteOk: true })).toBe(true);
    expect(computeD1Capable({ createOk: true, executeOk: true, deleteOk: false })).toBe(false);
    expect(computeD1Capable({ createOk: true, executeOk: false, deleteOk: true })).toBe(false);
  });

  it('does not throw on a missing/undefined d1 result', () => {
    expect(computeD1Capable(undefined)).toBe(false);
    expect(computeD1Capable({})).toBe(false);
  });
});

describe('parseD1CreateOutput', () => {
  it('extracts database_id and database_name from a real TOML config snippet', () => {
    const stdout = [
      "✅ Successfully created DB 'lgfc-3268-cap-test-1000-aaaa' in region ENAM",
      'Created your new D1 database.',
      '',
      'To access your new D1 Database in your Worker, add the following snippet to your configuration file:',
      '[[d1_databases]]',
      'binding = "DB"',
      'database_name = "lgfc-3268-cap-test-1000-aaaa"',
      'database_id = "11111111-2222-3333-4444-555555555555"',
      '',
    ].join('\n');
    expect(parseD1CreateOutput(stdout)).toEqual({
      databaseId: '11111111-2222-3333-4444-555555555555',
      databaseName: 'lgfc-3268-cap-test-1000-aaaa',
    });
  });

  it('returns null when neither field can be found, instead of throwing', () => {
    expect(parseD1CreateOutput('')).toBeNull();
    expect(parseD1CreateOutput('some unrelated error text')).toBeNull();
    expect(parseD1CreateOutput(undefined)).toBeNull();
  });

  it('returns a partial result when only one field is present', () => {
    expect(parseD1CreateOutput('database_name = "only-name"')).toEqual({
      databaseId: null,
      databaseName: 'only-name',
    });
  });
});

describe('findOrphanTestDatabases', () => {
  it('filters a wrangler d1 list --json array to only test-prefixed names', () => {
    const stdout = JSON.stringify([
      { name: 'lgfc_lite', uuid: 'a' },
      { name: 'lgfc-3268-cap-test-1000-aaaa', uuid: 'b' },
      { name: 'lgfc-3268-cap-test-2000-bbbb', uuid: 'c' },
    ]);
    const orphans = findOrphanTestDatabases(stdout, 'lgfc-3268-cap-test-');
    expect(orphans.map((d) => d.name)).toEqual(['lgfc-3268-cap-test-1000-aaaa', 'lgfc-3268-cap-test-2000-bbbb']);
  });

  it('handles a { result: [...] } wrapper shape', () => {
    const stdout = JSON.stringify({ result: [{ name: 'lgfc-3268-cap-test-1000-aaaa' }] });
    expect(findOrphanTestDatabases(stdout, 'lgfc-3268-cap-test-')).toHaveLength(1);
  });

  it('returns an empty array for unparseable or empty input instead of throwing', () => {
    expect(findOrphanTestDatabases('', 'lgfc-3268-cap-test-')).toEqual([]);
    expect(findOrphanTestDatabases('not json', 'lgfc-3268-cap-test-')).toEqual([]);
    expect(findOrphanTestDatabases(undefined, 'lgfc-3268-cap-test-')).toEqual([]);
  });

  it('returns an empty array when nothing matches the prefix', () => {
    const stdout = JSON.stringify([{ name: 'lgfc_lite' }]);
    expect(findOrphanTestDatabases(stdout, 'lgfc-3268-cap-test-')).toEqual([]);
  });
});

describe('buildResultMarkdown', () => {
  const fullyOk = {
    checkedAt: '2026-08-10T00:00:00Z',
    r2: {
      putOk: true,
      getOk: true,
      contentMatched: true,
      deleteOk: true,
      deleteVerified: true,
    },
    d1: {
      orphansFound: 0,
      orphansDeleted: 0,
      createOk: true,
      nameMatched: true,
      databaseId: '11111111-2222-3333-4444-555555555555',
      executeOk: true,
      deleteOk: true,
    },
    r2Capable: true,
    d1Capable: true,
  };

  it('renders a fully-successful result', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('R2 write capability: CONFIRMED');
    expect(md).toContain('D1 admin capability: CONFIRMED');
    expect(md).toContain('Ready for Phase 2 Package 2 (real export/upload): YES');
    expect(md).toContain('never reads or writes `lgfc_lite`');
    expect(md).toContain('never added to `wrangler.toml`');
  });

  it('renders a PutObject failure with its reason, short-circuiting the rest of the R2 section', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      r2: { putOk: false, putFailureReason: 'HTTP 403: AccessDenied' },
      r2Capable: false,
    });
    expect(md).toContain('PutObject: FAILED (HTTP 403: AccessDenied)');
    expect(md).not.toContain('GetObject read-back');
    expect(md).toContain('R2 write capability: NOT CONFIRMED');
    expect(md).toContain('Ready for Phase 2 Package 2 (real export/upload): NO');
  });

  it('renders a content mismatch distinctly from a read failure', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      r2: { putOk: true, getOk: true, contentMatched: false, deleteOk: true, deleteVerified: true },
      r2Capable: false,
    });
    expect(md).toContain('Content matched exactly: NO');
  });

  it('renders a D1 create failure with its reason', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      d1: { orphansFound: 0, orphansDeleted: 0, createOk: false, createFailureReason: 'exit 1: Authentication error' },
      d1Capable: false,
    });
    expect(md).toContain('Create: FAILED (exit 1: Authentication error)');
    expect(md).toContain('D1 admin capability: NOT CONFIRMED');
  });

  it('reports orphan sweep counts even when nothing was found', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('Orphan sweep before this run: 0 stray test database(s) found, 0 deleted');
  });

  it('reports orphan sweep counts when stray databases were found and cleaned up', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      d1: { ...fullyOk.d1, orphansFound: 2, orphansDeleted: 2 },
    });
    expect(md).toContain('Orphan sweep before this run: 2 stray test database(s) found, 2 deleted');
  });
});
