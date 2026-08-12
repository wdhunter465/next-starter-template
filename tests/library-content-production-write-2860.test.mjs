import { describe, expect, it } from 'vitest';
import {
  ROLLBACK_SQL,
  buildDiagnosticSnippet,
  buildResultMarkdown,
  buildStatementsForPlan,
  isApplyMode,
  parseCount,
  requireEnv,
} from '../scripts/ci/library_content_production_write_2860.mjs';

// #2860 Production write tooling -- covers the pure helper functions only. `main()` invokes
// the real `wrangler` CLI against real Production credentials this sandbox does not have,
// and is verified by a real dispatch, same precedent as every other #3268/#2913/#2859
// preflight/package script. Per Bill's 2026-08-12 GO decision, this PR builds and merges the
// tooling only -- it is not dispatched from this session in either mode.

describe('requireEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireEnv({})).toEqual(['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID', 'D1_DATABASE_NAME', 'D1_DATABASE_ID']);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireEnv({
        CLOUDFLARE_API_TOKEN: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'x',
        D1_DATABASE_NAME: 'x',
        D1_DATABASE_ID: 'x',
      }),
    ).toEqual([]);
  });
});

describe('isApplyMode', () => {
  it('requires both MODE=apply and CONFIRM_WRITE=confirm', () => {
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'confirm' })).toBe(true);
  });

  it('is false when MODE is dry-run, even with confirm set', () => {
    expect(isApplyMode({ MODE: 'dry-run', CONFIRM_WRITE: 'confirm' })).toBe(false);
  });

  it('is false when CONFIRM_WRITE is missing or wrong, even with MODE=apply', () => {
    expect(isApplyMode({ MODE: 'apply' })).toBe(false);
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'yes' })).toBe(false);
  });

  it('is false with no env at all', () => {
    expect(isApplyMode({})).toBe(false);
  });
});

describe('buildStatementsForPlan', () => {
  it('builds one statement per insert/update action, skipping noop/excluded/conflict', () => {
    const plan = {
      plans: [
        { action: 'insert', fields: { tag: 'legacy-library-1', status: 'draft', title: 't', text: 'x' } },
        { action: 'noop' },
        { action: 'excluded', exceptionCode: 'LE_INVALID_EMPTY' },
        { action: 'conflict', exceptionCode: 'TAG_COLLISION_NON_MIGRATION_SOURCE' },
        { action: 'update', id: 5, fields: { title: 't2', status: 'draft' }, willBecomePublished: false },
      ],
    };
    const statements = buildStatementsForPlan(plan);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('INSERT INTO content_inventory');
    expect(statements[1]).toContain('WHERE id = 5');
  });

  it('returns an empty array when nothing needs writing', () => {
    expect(buildStatementsForPlan({ plans: [{ action: 'noop' }] })).toEqual([]);
  });
});

describe('parseCount', () => {
  it('extracts the count from a one-row result', () => {
    expect(parseCount([{ n: 12 }])).toBe(12);
  });

  it('coerces a string count and defaults missing rows to 0', () => {
    expect(parseCount([{ n: '7' }])).toBe(7);
    expect(parseCount([])).toBe(0);
    expect(parseCount(undefined)).toBe(0);
  });
});

describe('buildDiagnosticSnippet', () => {
  const identity = (text) => text;

  it('prefers stderr, falls back to stdout, trims whitespace-only stderr', () => {
    expect(buildDiagnosticSnippet({ stderr: 'err', stdout: 'out' }, identity)).toBe('err');
    expect(buildDiagnosticSnippet({ stderr: '', stdout: 'out' }, identity)).toBe('out');
    expect(buildDiagnosticSnippet({ stderr: '\n\n', stdout: 'out' }, identity)).toBe('out');
    expect(buildDiagnosticSnippet({}, identity)).toBe('');
  });

  it('applies redaction and truncates to 800 chars', () => {
    const redact = (t) => t.replaceAll('secret', '[REDACTED]');
    expect(buildDiagnosticSnippet({ stderr: 'has secret in it' }, redact)).toBe('has [REDACTED] in it');
    expect(buildDiagnosticSnippet({ stderr: 'x'.repeat(1000) }, identity)).toBe(`${'x'.repeat(800)}...`);
  });
});

describe('buildResultMarkdown', () => {
  const dryRun = {
    checkedAt: '2026-08-12T00:00:00Z',
    mode: 'dry-run',
    databaseName: 'lgfc_lite',
    databaseId: '22d0dc3e-ad34-43af-8e6a-2063df1a1e04',
    approvalColumnPresent: false,
    counts: { LE_TOTAL: 10, CI_LEGACY_TAG: 2 },
    summary: { insert: 5, update: 1, noop: 2, excluded: 1, conflict: 1 },
    exceptions: [
      { legacyId: 3, code: 'LE_INVALID_EMPTY' },
      { legacyId: 9, code: 'TAG_COLLISION_NON_MIGRATION_SOURCE' },
    ],
  };

  it('renders dry-run mode with no write section', () => {
    const md = buildResultMarkdown(dryRun);
    expect(md).toContain('Mode: **dry-run**');
    expect(md).toContain('No write performed — dry-run only');
    expect(md).not.toContain('Write result');
  });

  it('renders the plan summary and exceptions by legacy id + code only', () => {
    const md = buildResultMarkdown(dryRun);
    expect(md).toContain('Insert: 5');
    expect(md).toContain('`3`: LE_INVALID_EMPTY');
    expect(md).toContain('`9`: TAG_COLLISION_NON_MIGRATION_SOURCE');
  });

  it('never includes row content, email, or credential values, by construction', () => {
    const md = buildResultMarkdown(dryRun);
    expect(md).not.toContain('@');
    expect(md).not.toContain('http://');
  });

  it('always includes the proven rollback command', () => {
    const md = buildResultMarkdown(dryRun);
    expect(md).toContain(ROLLBACK_SQL);
  });

  it('renders apply mode with the write result and pre/post counts', () => {
    const md = buildResultMarkdown({
      ...dryRun,
      mode: 'apply',
      writeOk: true,
      statementCount: 6,
      preLegacyTotal: 10,
      postLegacyTotal: 10,
      preMigratedCount: 2,
      postMigratedCount: 8,
      postPublishedCount: 0,
    });
    expect(md).toContain('Mode: **apply**');
    expect(md).toContain('Executed: YES');
    expect(md).toContain('Statements executed: 6');
    expect(md).toContain('before 10, after 10');
    expect(md).toContain('before 2, after 8');
    expect(md).toContain('Published (legacy-tagged canonical), after: 0');
  });

  it('renders a failed apply-mode write with its reason', () => {
    const md = buildResultMarkdown({
      ...dryRun,
      mode: 'apply',
      writeOk: false,
      writeFailureReason: 'wrangler d1 execute failed (exit 1)',
      preLegacyTotal: 10,
      preMigratedCount: 2,
    });
    expect(md).toContain('Executed: NO (wrangler d1 execute failed (exit 1))');
    expect(md).not.toContain('Statements executed');
  });
});
