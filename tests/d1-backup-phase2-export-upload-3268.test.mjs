import { describe, expect, it } from 'vitest';
import {
  buildChecksumFileContent,
  buildR2ObjectKeys,
  buildResultMarkdown,
  computeSha256Hex,
  parseChecksumFileContent,
  requireExportEnv,
} from '../scripts/ci/d1_backup_phase2_export_upload_3268.mjs';

// #3268 Phase 2 Package 2 export/upload — covers the pure helper functions only. `main()`
// invokes the real `wrangler d1 export` CLI and the real R2 S3 API against live credentials
// this sandbox does not have, and is verified by the real CI run, same precedent as every
// other #3268 preflight/package script.

describe('requireExportEnv', () => {
  it('lists every missing required credential', () => {
    expect(requireExportEnv({})).toEqual([
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
      requireExportEnv({
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

describe('buildR2ObjectKeys', () => {
  it('builds the sql and checksum keys under a dated prefix for the given database', () => {
    expect(buildR2ObjectKeys('lgfc_lite', '2026-08-11T00-00-00-000Z')).toEqual({
      sqlKey: 'd1-backups/lgfc_lite/2026-08-11T00-00-00-000Z/backup.sql',
      checksumKey: 'd1-backups/lgfc_lite/2026-08-11T00-00-00-000Z/backup.sql.sha256',
    });
  });

  it('produces distinct keys for distinct timestamps, so retries never collide', () => {
    const a = buildR2ObjectKeys('lgfc_lite', 't1');
    const b = buildR2ObjectKeys('lgfc_lite', 't2');
    expect(a.sqlKey).not.toBe(b.sqlKey);
  });
});

describe('computeSha256Hex', () => {
  it('computes a stable, well-known SHA-256 hash', () => {
    // echo -n "hello" | sha256sum
    expect(computeSha256Hex(Buffer.from('hello'))).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    );
  });

  it('produces different hashes for different content', () => {
    expect(computeSha256Hex(Buffer.from('a'))).not.toBe(computeSha256Hex(Buffer.from('b')));
  });
});

describe('buildChecksumFileContent / parseChecksumFileContent', () => {
  it('round-trips a checksum and filename through the standard sha256sum format', () => {
    const content = buildChecksumFileContent('a'.repeat(64), 'backup.sql');
    expect(content).toBe(`${'a'.repeat(64)}  backup.sql\n`);
    expect(parseChecksumFileContent(content)).toEqual({ sha256Hex: 'a'.repeat(64), filename: 'backup.sql' });
  });

  it('returns null for malformed content instead of throwing', () => {
    expect(parseChecksumFileContent('not a checksum line')).toBeNull();
    expect(parseChecksumFileContent('')).toBeNull();
    expect(parseChecksumFileContent(undefined)).toBeNull();
  });
});

describe('buildResultMarkdown', () => {
  const fullyOk = {
    checkedAt: '2026-08-11T00:00:00Z',
    exportResult: { exportOk: true, fileSizeBytes: 794624, sha256Hex: 'a'.repeat(64) },
    upload: {
      sqlUploadOk: true,
      checksumUploadOk: true,
      verifyOk: true,
      checksumMatched: true,
      bucketName: 'lgfc-d1-backups',
      sqlKey: 'd1-backups/lgfc_lite/2026-08-11T00-00-00-000Z/backup.sql',
    },
    backupVerified: true,
  };

  it('renders a fully-successful, fully-verified result', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).toContain('Export: OK');
    expect(md).toContain('File size: 794624 bytes');
    expect(md).toContain(`SHA-256: \`${'a'.repeat(64)}\``);
    expect(md).toContain('Backup object uploaded: OK');
    expect(md).toContain('Checksum sidecar uploaded: OK');
    expect(md).toContain('Re-downloaded and re-hashed: OK');
    expect(md).toContain('Checksum matched exactly: YES');
    expect(md).toContain('Bucket: `lgfc-d1-backups`');
    expect(md).toContain('Object key: `d1-backups/lgfc_lite/2026-08-11T00-00-00-000Z/backup.sql`');
    expect(md).toContain('Backup artifact produced and verified in R2: YES');
    expect(md).toContain('Ready for Phase 2 Package 3 (isolated restore proof): YES');
  });

  it('never includes wrangler stdout or a presigned URL field, by construction', () => {
    const md = buildResultMarkdown(fullyOk);
    expect(md).not.toContain('signed_url');
    expect(md).not.toContain('http://');
  });

  it('renders an export failure with its reason, short-circuiting the rest', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-11T00:00:00Z',
      exportResult: { exportOk: false, exportFailureReason: 'exit 1: some redacted reason' },
      upload: { sqlUploadOk: false, checksumUploadOk: false, bucketName: 'lgfc-d1-backups' },
      backupVerified: false,
    });
    expect(md).toContain('Export: FAILED (exit 1: some redacted reason)');
    expect(md).not.toContain('File size:');
    expect(md).toContain('Backup artifact produced and verified in R2: NO');
    expect(md).toContain('Ready for Phase 2 Package 3 (isolated restore proof): NO');
  });

  it('renders a checksum mismatch distinctly from a verify failure', () => {
    const md = buildResultMarkdown({
      ...fullyOk,
      upload: { ...fullyOk.upload, checksumMatched: false },
      backupVerified: false,
    });
    expect(md).toContain('Re-downloaded and re-hashed: OK');
    expect(md).toContain('Checksum matched exactly: NO');
  });

  it('renders an upload failure with its reason', () => {
    const md = buildResultMarkdown({
      checkedAt: '2026-08-11T00:00:00Z',
      exportResult: { exportOk: true, fileSizeBytes: 100, sha256Hex: 'b'.repeat(64) },
      upload: { sqlUploadOk: false, sqlUploadFailureReason: 'HTTP 403: AccessDenied', checksumUploadOk: false, bucketName: 'lgfc-d1-backups' },
      backupVerified: false,
    });
    expect(md).toContain('Backup object uploaded: FAILED (HTTP 403: AccessDenied)');
  });
});
