import { describe, expect, it } from 'vitest';
import {
  buildResultMarkdown,
  countCreateTableStatements,
  findLatestBackupKey,
  generateRestoreDbName,
  parseD1ExecuteFileResult,
  parseTableCountResult,
  requireRestoreEnv,
} from '../scripts/ci/d1_backup_phase2_restore_verify_3268.mjs';

// #3268 Phase 2 Package 3 restore proof — covers the pure helper functions only. `main()`
// invokes the real R2 S3 API and `wrangler` CLI against live credentials this sandbox does not
// have, and is verified by the real CI run, same precedent as every other #3268 package script.

describe('requireRestoreEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireRestoreEnv({})).toEqual([
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'CLOUDFLARE_ACCOUNT_ID',
      'CLOUDFLARE_API_TOKEN',
      'D1_DATABASE_NAME',
    ]);
  });

  it('returns an empty list when every credential is present', () => {
    expect(
      requireRestoreEnv({
        R2_ACCESS_KEY_ID: 'x',
        R2_SECRET_ACCESS_KEY: 'x',
        R2_BUCKET_NAME: 'x',
        CLOUDFLARE_ACCOUNT_ID: 'x',
        CLOUDFLARE_API_TOKEN: 'x',
        D1_DATABASE_NAME: 'x',
      }),
    ).toEqual([]);
  });
});

describe('findLatestBackupKey', () => {
  it('picks the lexicographically greatest backup.sql key under the database prefix', () => {
    const keys = [
      'd1-backups/lgfc_lite/2026-08-10T20-13-54-080Z/backup.sql',
      'd1-backups/lgfc_lite/2026-08-10T20-13-54-080Z/backup.sql.sha256',
      'd1-backups/lgfc_lite/2026-08-11T10-33-48-870Z/backup.sql',
      'd1-backups/lgfc_lite/2026-08-11T10-33-48-870Z/backup.sql.sha256',
    ];
    expect(findLatestBackupKey(keys, 'lgfc_lite')).toBe('d1-backups/lgfc_lite/2026-08-11T10-33-48-870Z/backup.sql');
  });

  it('ignores keys under a different database prefix', () => {
    const keys = ['d1-backups/other_db/2026-08-11T00-00-00-000Z/backup.sql'];
    expect(findLatestBackupKey(keys, 'lgfc_lite')).toBeNull();
  });

  it('returns null when no backup.sql key exists, instead of throwing', () => {
    expect(findLatestBackupKey([], 'lgfc_lite')).toBeNull();
    expect(findLatestBackupKey(undefined, 'lgfc_lite')).toBeNull();
    expect(findLatestBackupKey(['d1-backups/lgfc_lite/x/backup.sql.sha256'], 'lgfc_lite')).toBeNull();
  });
});

describe('countCreateTableStatements', () => {
  it('counts CREATE TABLE statements case-insensitively', () => {
    const sql = 'CREATE TABLE members (id INTEGER);\ncreate table events (id INTEGER);\nINSERT INTO members VALUES (1);';
    expect(countCreateTableStatements(sql)).toBe(2);
  });

  it('returns 0 for text with no CREATE TABLE statements, instead of throwing', () => {
    expect(countCreateTableStatements('')).toBe(0);
    expect(countCreateTableStatements(undefined)).toBe(0);
    expect(countCreateTableStatements('INSERT INTO x VALUES (1);')).toBe(0);
  });
});

describe('generateRestoreDbName', () => {
  it('produces a name under the restore-drill prefix, unique per (now, random) pair', () => {
    const a = generateRestoreDbName(1000, 'aaaa');
    const b = generateRestoreDbName(2000, 'aaaa');
    expect(a).toMatch(/^lgfc-3268-restore-drill-1000-aaaa$/);
    expect(a).not.toBe(b);
  });
});

describe('parseD1ExecuteFileResult', () => {
  it('extracts success/query/row counts from a real file-import response shape', () => {
    const stdout = JSON.stringify([
      {
        results: [
          { 'Total queries executed': 42, 'Rows read': 0, 'Rows written': 1200, 'Database size (MB)': '0.47' },
        ],
        success: true,
        finalBookmark: 'abc123',
        meta: { duration: 100 },
      },
    ]);
    expect(parseD1ExecuteFileResult(stdout)).toEqual({
      success: true,
      numQueries: 42,
      rowsRead: 0,
      rowsWritten: 1200,
    });
  });

  it('returns null for an unrecognized shape instead of throwing', () => {
    expect(parseD1ExecuteFileResult('not json')).toBeNull();
    expect(parseD1ExecuteFileResult('{}')).toBeNull();
    expect(parseD1ExecuteFileResult(JSON.stringify([{ success: true }]))).toBeNull();
    expect(parseD1ExecuteFileResult(undefined)).toBeNull();
  });
});

describe('parseTableCountResult', () => {
  it('extracts table_count from a real --command --json response shape', () => {
    const stdout = JSON.stringify([{ results: [{ table_count: 38 }], success: true, meta: {} }]);
    expect(parseTableCountResult(stdout)).toBe(38);
  });

  it('returns null for an unrecognized shape or failed query instead of throwing', () => {
    expect(parseTableCountResult('not json')).toBeNull();
    expect(parseTableCountResult(JSON.stringify([{ results: [{ table_count: 38 }], success: false }]))).toBeNull();
    expect(parseTableCountResult(JSON.stringify([{ results: [{ other: 1 }], success: true }]))).toBeNull();
    expect(parseTableCountResult(undefined)).toBeNull();
  });
});

describe('buildResultMarkdown', () => {
  const fullyOk = {
    checkedAt: '2026-08-11T00:00:00Z',
    discovery: {
      found: true,
      sqlKey: 'd1-backups/lgfc_lite/2026-08-11T10-33-48-870Z/backup.sql',
      fileSizeBytes: 469630,
      checksumVerified: true,
    },
    restore: {
      orphansFound: 0,
      orphansDeleted: 0,
      createOk: true,
      importOk: true,
      numQueries: 42,
      rowsRead: 0,
      rowsWritten: 1200,
      tableCountVerified: true,
      expectedTableCount: 38,
      actualTableCount: 38,
      tableCountMatched: true,
      deleteOk: true,
    },
    restoreProofComplete: true,
  };

  it('renders a fully-successful restore proof', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('Backup found in R2: YES');
    expect(md).toContain('Checksum re-verified against sidecar: YES');
    expect(md).toContain('Restore-drill database created: OK');
    expect(md).toContain('Import: OK');
    expect(md).toContain('Queries executed: 42, rows read: 0, rows written: 1200');
    expect(md).toContain('Table count verification: OK');
    expect(md).toContain('Expected (from backup file\'s own `CREATE TABLE` statements): 38');
    expect(md).toContain('Actual (restored database, `sqlite_master`): 38');
    expect(md).toContain('Matched exactly: YES');
    expect(md).toContain('Restore-drill database deleted (teardown): OK');
    expect(md).toContain('Isolated restore proof complete: YES');
  });

  it('never includes raw row content, by construction of the sections it renders', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).not.toContain('SELECT *');
  });

  it('renders a backup-not-found failure, short-circuiting the restore section', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-11T00:00:00Z',
      discovery: { found: false, failureReason: "no backup object found under this database's R2 prefix." },
      restore: { orphansFound: 0, orphansDeleted: 0, createOk: false },
      restoreProofComplete: false,
    });
    expect(md).toContain("Backup found in R2: NO (no backup object found under this database's R2 prefix.)");
    expect(md).not.toContain('Object key:');
    expect(md).toContain('Restore-drill database created: FAILED');
    expect(md).toContain('Isolated restore proof complete: NO');
  });

  it('renders a table count mismatch distinctly from a verification failure', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      restore: { ...fullyOk.restore, actualTableCount: 37, tableCountMatched: false },
      restoreProofComplete: false,
    });
    expect(md).toContain('Table count verification: OK');
    expect(md).toContain('Matched exactly: NO');
  });

  it('renders a checksum-mismatch failure', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-11T00:00:00Z',
      discovery: {
        found: true,
        sqlKey: 'd1-backups/lgfc_lite/2026-08-11T10-33-48-870Z/backup.sql',
        fileSizeBytes: 469630,
        checksumVerified: false,
      },
      restore: { orphansFound: 0, orphansDeleted: 0, createOk: false },
      restoreProofComplete: false,
    });
    expect(md).toContain('Checksum re-verified against sidecar: NO');
  });
});
