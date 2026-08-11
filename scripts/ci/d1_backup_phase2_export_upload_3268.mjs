#!/usr/bin/env node
/**
 * #3268 Phase 2 Package 2 — bounded real D1 export, checksum, and private R2 upload.
 *
 * Per the Phase 2 design (docs/ops/reports/d1-backup-restore-3268-phase2.md) and Package 1's
 * confirmed capabilities (PR #3306/#3309: R2 write scope and D1 admin scope both proven), this
 * produces the first real backup artifact: a full `wrangler d1 export` (schema + data) of the
 * Production database, a SHA-256 checksum, and an upload of both to the private
 * `lgfc-d1-backups` bucket under a dated prefix. It then re-downloads the uploaded object and
 * re-hashes it, so the checksum comparison this package reports is real, independent
 * verification -- not merely "the upload call returned 200."
 *
 * `wrangler d1 export --remote` is Cloudflare's documented, non-interactive, read-only backup
 * mechanism: it POSTs to the D1 export API, polls until the server-side snapshot is ready, then
 * downloads it via a short-lived presigned URL. It never mutates `lgfc_lite` in any way. Reading
 * wrangler's own source (`node_modules/wrangler/wrangler-dist/cli.js`, `exportRemotely`) surfaced
 * an important fact this script's implementation depends on: on success, wrangler logs that
 * presigned download URL (valid for one hour) to its own stdout. This script therefore never
 * captures or surfaces `wrangler d1 export`'s stdout anywhere -- not in the result markdown, not
 * in a log line -- since that URL would grant direct, credential-free download access to a real
 * export containing member/auth/PII-bearing data (see the Phase 2 report's data-sensitivity
 * section) for as long as it stays valid.
 *
 * The local export file exists only in a dedicated OS temp directory (never inside the repo
 * working tree, so it can never be accidentally committed) for the duration of this run, and is
 * deleted unconditionally (success or failure) via a try/finally. Its contents are never logged,
 * never printed, and never included in the result posted to the public #3268 issue comment --
 * only non-sensitive metadata (file size, SHA-256 checksum, R2 object key, verification outcome)
 * is reported, matching the handling constraints the Phase 2 report already committed to.
 *
 * This script never runs a restore -- that is Package 3, gated on this package's own verified
 * upload succeeding first.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, CLOUDFLARE_ACCOUNT_ID,
 *   CLOUDFLARE_API_TOKEN, D1_DATABASE_NAME (aliases CF_ACCOUNT_ID/CF_API_TOKEN accepted).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';
import { redactSecrets, extractS3ErrorCode, findBlankAfterTrim } from './d1_backup_r2_phase1_preflight_3268.mjs';

export const RESULT_JSON_PATH = 'd1-backup-phase2-export-upload-3268-result.json';
export const RESULT_MD_PATH = 'd1-backup-phase2-export-upload-3268-result.md';

const R2_PREFIX = 'd1-backups';
const SQL_FILENAME = 'backup.sql';
const CHECKSUM_FILENAME = 'backup.sql.sha256';

function aliasEnv(primary, aliases) {
  if (process.env[primary]) return;
  for (const name of aliases) {
    if (process.env[name]) {
      process.env[primary] = process.env[name];
      return;
    }
  }
}

export function requireExportEnv(env = process.env) {
  return [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'D1_DATABASE_NAME',
  ].filter((name) => !env[name]);
}

/** Pure given `databaseName` and `timestamp` (an ISO-8601 string with colons already stripped). */
export function buildR2ObjectKeys(databaseName, timestamp) {
  const dir = `${R2_PREFIX}/${databaseName}/${timestamp}`;
  return {
    sqlKey: `${dir}/${SQL_FILENAME}`,
    checksumKey: `${dir}/${CHECKSUM_FILENAME}`,
  };
}

export function computeSha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Standard `sha256sum`-compatible format: `<hex>  <filename>\n`. */
export function buildChecksumFileContent(sha256Hex, filename) {
  return `${sha256Hex}  ${filename}\n`;
}

export function parseChecksumFileContent(text) {
  const match = String(text ?? '').match(/^([0-9a-f]{64})\s+(\S+)/);
  return match ? { sha256Hex: match[1], filename: match[2] } : null;
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', '--no-install', 'wrangler'];
}

function runWrangler(args) {
  const cmd = resolveWranglerCmd();
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], { encoding: 'utf8', env: process.env });
}

function formatExportResult(exportResult) {
  const lines = ['### D1 export (read-only)', ''];
  lines.push(`- Export: ${exportResult.exportOk ? 'OK' : `FAILED${exportResult.exportFailureReason ? ` (${exportResult.exportFailureReason})` : ''}`}`);
  if (exportResult.exportOk) {
    lines.push(`- File size: ${exportResult.fileSizeBytes} bytes`);
    lines.push(`- SHA-256: \`${exportResult.sha256Hex}\``);
  }
  return lines.join('\n');
}

function formatUploadResult(upload) {
  const lines = ['### R2 upload + independent re-verification', ''];
  lines.push(`- Backup object uploaded: ${upload.sqlUploadOk ? 'OK' : `FAILED${upload.sqlUploadFailureReason ? ` (${upload.sqlUploadFailureReason})` : ''}`}`);
  lines.push(`- Checksum sidecar uploaded: ${upload.checksumUploadOk ? 'OK' : `FAILED${upload.checksumUploadFailureReason ? ` (${upload.checksumUploadFailureReason})` : ''}`}`);
  if (upload.sqlUploadOk) {
    lines.push(
      `- Re-downloaded and re-hashed: ${upload.verifyOk ? 'OK' : `FAILED${upload.verifyFailureReason ? ` (${upload.verifyFailureReason})` : ''}`}`,
    );
    if (upload.verifyOk) lines.push(`- Checksum matched exactly: ${upload.checksumMatched ? 'YES' : 'NO'}`);
  }
  if (upload.bucketName && upload.sqlKey) {
    lines.push(`- Bucket: \`${upload.bucketName}\``);
    lines.push(`- Object key: \`${upload.sqlKey}\``);
  }
  return lines.join('\n');
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- d1-backup-phase2-export-upload-3268 -->',
    '## #3268 Phase 2 Package 2 — real D1 export, checksum, and R2 upload',
    '',
    `- Checked at: ${result.checkedAt}`,
    '- This never writes to, restores into, or otherwise mutates `lgfc_lite` — export is read-only.',
    '- The local export file exists only in a temp directory for this run\'s duration and is deleted unconditionally at job end.',
    '- Export file content, and the one-hour presigned download URL `wrangler d1 export` prints on success, are never included in this result or logged anywhere -- only non-sensitive metadata (size, checksum, object key).',
    '',
    formatExportResult(result.exportResult),
    '',
    formatUploadResult(result.upload),
    '',
    '### Overall',
    '',
    `- Backup artifact produced and verified in R2: ${result.backupVerified ? 'YES' : 'NO'}`,
    `- Ready for Phase 2 Package 3 (isolated restore proof): ${result.backupVerified ? 'YES' : 'NO'}`,
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No Production D1 write or restore was attempted; this script has no such code path.');
  process.exitCode = 1;
}

export async function main() {
  aliasEnv('CLOUDFLARE_API_TOKEN', ['CF_API_TOKEN']);
  aliasEnv('CLOUDFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID']);

  const missing = requireExportEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID.trim();
  const bucketName = process.env.R2_BUCKET_NAME.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY.trim();
  const apiToken = process.env.CLOUDFLARE_API_TOKEN.trim();
  const databaseName = process.env.D1_DATABASE_NAME.trim();

  const blankAfterTrim = findBlankAfterTrim({
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
    R2_BUCKET_NAME: bucketName,
    CLOUDFLARE_ACCOUNT_ID: accountId,
    CLOUDFLARE_API_TOKEN: apiToken,
    D1_DATABASE_NAME: databaseName,
  });
  if (blankAfterTrim.length > 0) {
    failClosed(`required credential(s) present but blank/whitespace-only after trimming: ${blankAfterTrim.join(', ')} (values are never logged).`);
    return;
  }

  // wrangler subprocesses inherit process.env directly, not these local trimmed variables.
  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
  process.env.CLOUDFLARE_API_TOKEN = apiToken;

  const redact = (text) => redactSecrets(text, [accountId, bucketName, accessKeyId, secretAccessKey, apiToken, databaseName]);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const { sqlKey, checksumKey } = buildR2ObjectKeys(databaseName, timestamp);

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-export-3268-'));
  const tmpFile = path.join(tmpDir, SQL_FILENAME);

  const exportResult = { exportOk: false, exportFailureReason: '', fileSizeBytes: null, sha256Hex: null };
  const upload = {
    sqlUploadOk: false,
    sqlUploadFailureReason: '',
    checksumUploadOk: false,
    checksumUploadFailureReason: '',
    verifyOk: false,
    verifyFailureReason: '',
    checksumMatched: false,
    bucketName,
    sqlKey,
  };

  try {
    // Deliberately not capturing/using `.stdout` here -- see the top-of-file comment on why
    // wrangler's own stdout must never be surfaced from this step.
    const exp = runWrangler(['d1', 'export', databaseName, '--remote', '--output', tmpFile]);
    if (exp.error || exp.status !== 0 || !fs.existsSync(tmpFile)) {
      exportResult.exportFailureReason = redact((exp.stderr || '').trim()).slice(0, 500) || `exit ${exp.status ?? 'spawn error'}`;
    } else {
      const fileBuffer = fs.readFileSync(tmpFile);
      exportResult.fileSizeBytes = fileBuffer.length;
      exportResult.sha256Hex = computeSha256Hex(fileBuffer);
      exportResult.exportOk = true;

      const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
      const hostname = `${accountId}.r2.cloudflarestorage.com`;
      const endpoint = `https://${hostname}`;
      const pathBucket = bucketName.split('/').map(encodeURIComponent).join('/');
      const sqlUrl = `${endpoint}/${pathBucket}/${sqlKey.split('/').map(encodeURIComponent).join('/')}`;
      const checksumUrl = `${endpoint}/${pathBucket}/${checksumKey.split('/').map(encodeURIComponent).join('/')}`;

      try {
        const putRes = await aws.fetch(sqlUrl, { method: 'PUT', body: fileBuffer });
        if (!putRes.ok) {
          const text = await putRes.text();
          const code = extractS3ErrorCode(text);
          upload.sqlUploadFailureReason = code ? `HTTP ${putRes.status}: ${code}` : `HTTP ${putRes.status}`;
        } else {
          upload.sqlUploadOk = true;
        }
      } catch (error) {
        upload.sqlUploadFailureReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
      }

      if (upload.sqlUploadOk) {
        try {
          const checksumContent = buildChecksumFileContent(exportResult.sha256Hex, SQL_FILENAME);
          const putRes = await aws.fetch(checksumUrl, { method: 'PUT', body: checksumContent });
          if (!putRes.ok) {
            const text = await putRes.text();
            const code = extractS3ErrorCode(text);
            upload.checksumUploadFailureReason = code ? `HTTP ${putRes.status}: ${code}` : `HTTP ${putRes.status}`;
          } else {
            upload.checksumUploadOk = true;
          }
        } catch (error) {
          upload.checksumUploadFailureReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
        }

        try {
          const getRes = await aws.fetch(sqlUrl, { method: 'GET' });
          if (!getRes.ok) {
            const text = await getRes.text();
            const code = extractS3ErrorCode(text);
            upload.verifyFailureReason = code ? `HTTP ${getRes.status}: ${code}` : `HTTP ${getRes.status}`;
          } else {
            const downloaded = Buffer.from(await getRes.arrayBuffer());
            upload.verifyOk = true;
            upload.checksumMatched = computeSha256Hex(downloaded) === exportResult.sha256Hex;
          }
        } catch (error) {
          upload.verifyFailureReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
        }
      }
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const backupVerified = exportResult.exportOk && upload.sqlUploadOk && upload.checksumUploadOk && upload.verifyOk && upload.checksumMatched;

  const result = {
    checkedAt: new Date().toISOString(),
    exportResult,
    upload,
    backupVerified,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('backup_verified', String(backupVerified));

  if (!backupVerified) {
    failClosed('backup export/upload/verification did not fully succeed. See the posted result for the exact reason.');
    return;
  }

  console.log(`OK: backup exported, uploaded, and independently verified (${exportResult.fileSizeBytes} bytes, sha256 ${exportResult.sha256Hex}).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
