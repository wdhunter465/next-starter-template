#!/usr/bin/env node
/**
 * #3268 Phase 2 Package 3 — isolated, non-Production restore proof.
 *
 * The final package Bill's Phase 2 authorization named directly: "isolated restore -> content/
 * schema verification -> teardown." Per the Phase 2 design
 * (docs/ops/reports/d1-backup-restore-3268-phase2.md) and Package 2's confirmed result (PR
 * #3311: a real, checksummed backup already sits in R2), this finds the most recent backup
 * under `d1-backups/<D1_DATABASE_NAME>/` in the private R2 bucket, re-verifies its checksum
 * independently (never trusting the earlier upload's own claim), creates a brand-new, uniquely
 * named D1 database that is never referenced in `wrangler.toml` (so the deployed Worker/app can
 * never read or write it), imports the verified backup into it, and checks the restored
 * database's table count against the backup file's own `CREATE TABLE` statements. It then
 * deletes the restore-drill database unconditionally, including on failure, via try/finally --
 * matching Package 1's proven, teardown-required capability-test pattern and Bill's explicit
 * conditions on any such created resource: temporary, uniquely named, unbound to Production,
 * teardown-required.
 *
 * This never writes to, mutates, or reads any content from `lgfc_lite` (Production D1) -- it
 * only reads the already-produced backup from R2. All verification queries against the restored
 * database are aggregate-only (`SELECT COUNT(*) ...`, `SELECT name FROM sqlite_master ...`) --
 * never a query that could return actual row content -- since the restored database is a full
 * copy of real member/auth/PII-bearing data and this script's result is posted to a public
 * GitHub issue. Reading wrangler's own source (`node_modules/wrangler/wrangler-dist/cli.js`,
 * `executeRemotely`) confirmed this precisely: a `--file`-based import's `--json` response
 * contains only aggregate metadata (query count, rows read/written, database size), never row
 * content, and a `--command`-based query's `--json` response is `[{ results: [...], success,
 * meta }]` where `results` holds exactly the columns the query selected -- so as long as every
 * query here only selects counts/names, its JSON output is safe to capture and report.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, CLOUDFLARE_ACCOUNT_ID,
 *   CLOUDFLARE_API_TOKEN, D1_DATABASE_NAME (aliases CF_ACCOUNT_ID/CF_API_TOKEN accepted).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';
import {
  redactSecrets,
  extractS3ErrorCode,
  findBlankAfterTrim,
  parseListObjectsV2Page,
} from './d1_backup_r2_phase1_preflight_3268.mjs';
import { computeSha256Hex, parseChecksumFileContent } from './d1_backup_phase2_export_upload_3268.mjs';

export const RESULT_JSON_PATH = 'd1-backup-phase2-restore-verify-3268-result.json';
export const RESULT_MD_PATH = 'd1-backup-phase2-restore-verify-3268-result.md';

const R2_PREFIX = 'd1-backups';
const RESTORE_DB_PREFIX = 'lgfc-3268-restore-drill-';

function aliasEnv(primary, aliases) {
  if (process.env[primary]) return;
  for (const name of aliases) {
    if (process.env[name]) {
      process.env[primary] = process.env[name];
      return;
    }
  }
}

export function requireRestoreEnv(env = process.env) {
  return [
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_NAME',
    'CLOUDFLARE_ACCOUNT_ID',
    'CLOUDFLARE_API_TOKEN',
    'D1_DATABASE_NAME',
  ].filter((name) => !env[name]);
}

/**
 * Given a flat list of object keys (as returned by ListObjectsV2), finds the most recent backup
 * under this database's prefix: filters to keys ending in `/backup.sql` (excluding `.sha256`
 * sidecars), sorts ascending, and returns the last one -- this repo's dated-prefix timestamps
 * (ISO-8601 with `:`/`.` replaced by `-`) preserve chronological order under lexicographic sort
 * because every component stays fixed-width. Returns null when no backup is found.
 */
export function findLatestBackupKey(keys, databaseName) {
  const prefix = `${R2_PREFIX}/${databaseName}/`;
  const candidates = (keys ?? [])
    .filter((key) => typeof key === 'string' && key.startsWith(prefix) && key.endsWith('/backup.sql'))
    .sort();
  return candidates.length > 0 ? candidates[candidates.length - 1] : null;
}

/**
 * Counts `CREATE TABLE` statements for application tables only, excluding SQLite's own
 * internal `sqlite_%` bookkeeping tables (e.g. `sqlite_sequence`, auto-managed whenever any
 * table uses `AUTOINCREMENT`) -- the same exclusion this repo already applies when enumerating
 * "real" tables elsewhere (`functions/api/admin/d1-inspect.ts`: `... AND name NOT LIKE
 * 'sqlite_%'`). Without this, a dump that includes an explicit `CREATE TABLE sqlite_sequence`
 * statement (or a live database where SQLite created it implicitly) could make this count and
 * the live `sqlite_master` count (see main()'s table-count query, which applies the identical
 * exclusion) disagree even though the restore succeeded correctly.
 */
export function countCreateTableStatements(sqlText) {
  const matches = String(sqlText ?? '').matchAll(/^\s*CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/gim);
  let count = 0;
  for (const match of matches) {
    if (!match[1].toLowerCase().startsWith('sqlite_')) count += 1;
  }
  return count;
}

export function generateRestoreDbName(now, random) {
  return `${RESTORE_DB_PREFIX}${now}-${random}`;
}

/**
 * Parses `wrangler d1 execute <db> --file=... --remote -y --json`'s response: an array with one
 * element shaped `{ results: [{ "Total queries executed", "Rows read", "Rows written", ... }],
 * success, meta }` for a file-based import (confirmed from wrangler's own source, executeRemotely
 * in node_modules/wrangler/wrangler-dist/cli.js). Returns null when the shape isn't recognized.
 */
export function parseD1ExecuteFileResult(stdout) {
  try {
    const parsed = JSON.parse(String(stdout ?? ''));
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    const row = entry?.results?.[0];
    if (!entry || typeof entry.success !== 'boolean' || !row) return null;
    return {
      success: entry.success,
      numQueries: row['Total queries executed'] ?? null,
      rowsRead: row['Rows read'] ?? null,
      rowsWritten: row['Rows written'] ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Parses `wrangler d1 execute <db> --command="SELECT COUNT(*) AS table_count FROM sqlite_master
 * WHERE type='table' AND name NOT LIKE 'sqlite_%'" --remote --json`'s response: `[{ results:
 * [{ table_count: N }], success, meta }]` (the standard Cloudflare D1 query API response shape).
 * Returns null when the shape isn't recognized.
 */
export function parseTableCountResult(stdout) {
  try {
    const parsed = JSON.parse(String(stdout ?? ''));
    const entry = Array.isArray(parsed) ? parsed[0] : parsed;
    const row = entry?.results?.[0];
    if (!entry?.success || typeof row?.table_count !== 'number') return null;
    return row.table_count;
  } catch {
    return null;
  }
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', '--no-install', 'wrangler'];
}

/**
 * `discardStdout: true` for any wrangler invocation whose stdout could carry sensitive content
 * (none in this script touch raw row data, but this keeps the same structural guarantee used in
 * Package 2 rather than relying on "we don't happen to read it"). Defaults to piping stdout,
 * since the execute/list commands here are confirmed safe to capture per the top-of-file comment.
 */
function runWrangler(args, { discardStdout = false } = {}) {
  const cmd = resolveWranglerCmd();
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], {
    encoding: 'utf8',
    env: process.env,
    stdio: discardStdout ? ['ignore', 'ignore', 'pipe'] : ['ignore', 'pipe', 'pipe'],
  });
}

function formatDiscoveryResult(discovery) {
  const lines = ['### Backup discovery + independent checksum re-verification', ''];
  lines.push(`- Backup found in R2: ${discovery.found ? 'YES' : `NO${discovery.failureReason ? ` (${discovery.failureReason})` : ''}`}`);
  if (discovery.found) {
    lines.push(`- Object key: \`${discovery.sqlKey}\``);
    lines.push(`- File size: ${discovery.fileSizeBytes} bytes`);
    lines.push(`- Checksum re-verified against sidecar: ${discovery.checksumVerified ? 'YES' : 'NO'}`);
  }
  return lines.join('\n');
}

function formatRestoreResult(restore) {
  const lines = ['### Isolated restore + verification', ''];
  lines.push(`- Orphan sweep before this run: ${restore.orphansFound} stray restore-drill database(s) found, ${restore.orphansDeleted} deleted`);
  lines.push(`- Restore-drill database created: ${restore.createOk ? 'OK' : `FAILED${restore.createFailureReason ? ` (${restore.createFailureReason})` : ''}`}`);
  if (restore.createOk) {
    lines.push(`- Import: ${restore.importOk ? 'OK' : `FAILED${restore.importFailureReason ? ` (${restore.importFailureReason})` : ''}`}`);
    if (restore.importOk) {
      lines.push(`  - Queries executed: ${restore.numQueries}, rows read: ${restore.rowsRead}, rows written: ${restore.rowsWritten}`);
    }
    lines.push(
      `- Table count verification: ${restore.tableCountVerified ? 'OK' : `FAILED${restore.tableCountFailureReason ? ` (${restore.tableCountFailureReason})` : ''}`}`,
    );
    if (restore.tableCountVerified) {
      lines.push(`  - Expected (from backup file's own \`CREATE TABLE\` statements): ${restore.expectedTableCount}`);
      lines.push(`  - Actual (restored database, \`sqlite_master\`): ${restore.actualTableCount}`);
      lines.push(`  - Matched exactly: ${restore.tableCountMatched ? 'YES' : 'NO'}`);
    }
    lines.push(`- Restore-drill database deleted (teardown): ${restore.deleteOk ? 'OK' : `FAILED${restore.deleteFailureReason ? ` (${restore.deleteFailureReason})` : ''}`}`);
  }
  return lines.join('\n');
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- d1-backup-phase2-restore-verify-3268 -->',
    '## #3268 Phase 2 Package 3 — isolated restore proof',
    '',
    `- Checked at: ${result.checkedAt}`,
    '- This never reads, writes, or otherwise touches `lgfc_lite` (Production D1) directly — only the already-produced R2 backup is read.',
    '- The restore-drill database is never referenced in `wrangler.toml` and is deleted before this run ends, including on failure.',
    '- Every query against the restored database is aggregate-only (counts/names) — never a query that could return actual row content — since the restored database is a full copy of real member/auth/PII-bearing data.',
    '',
    formatDiscoveryResult(result.discovery),
    '',
    formatRestoreResult(result.restore),
    '',
    '### Overall',
    '',
    `- Isolated restore proof complete: ${result.restoreProofComplete ? 'YES' : 'NO'}`,
    `- This is the backup/restore evidence Gate 1 needs to feed through #2859 → #2780 → #2926: ${result.restoreProofComplete ? 'YES' : 'NO'}`,
  ];
  return lines.join('\n');
}

function writeOutput(name, value) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) fs.appendFileSync(outputPath, `${name}=${value}\n`);
}

function failClosed(message) {
  console.error(`FAIL-CLOSED: ${message}`);
  console.error('No Production D1 read/write was attempted; this script has no such code path.');
  process.exitCode = 1;
}

/** For small objects only (the checksum sidecar, a few dozen bytes) -- buffers fully in memory. */
async function downloadR2Object(aws, endpoint, bucketName, key) {
  const pathBucket = bucketName.split('/').map(encodeURIComponent).join('/');
  const url = `${endpoint}/${pathBucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const res = await aws.fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    const code = extractS3ErrorCode(text);
    return { ok: false, reason: code ? `HTTP ${res.status}: ${code}` : `HTTP ${res.status}` };
  }
  return { ok: true, buffer: Buffer.from(await res.arrayBuffer()) };
}

/**
 * For the backup itself, which can be arbitrarily large: streams the R2 response body directly
 * to `destPath` on disk while hashing it incrementally in the same pass, rather than buffering
 * the whole download into memory first. Peak memory during download stays bounded by chunk size
 * regardless of backup size, and the destination file is exactly what gets passed to
 * `wrangler d1 execute --file=` afterward -- no separate buffer-then-write step.
 */
async function streamDownloadToFile(aws, endpoint, bucketName, key, destPath) {
  const pathBucket = bucketName.split('/').map(encodeURIComponent).join('/');
  const url = `${endpoint}/${pathBucket}/${key.split('/').map(encodeURIComponent).join('/')}`;
  const res = await aws.fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    const code = extractS3ErrorCode(text);
    return { ok: false, reason: code ? `HTTP ${res.status}: ${code}` : `HTTP ${res.status}` };
  }
  const hash = crypto.createHash('sha256');
  let fileSizeBytes = 0;
  const hashingPassThrough = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      fileSizeBytes += chunk.length;
      callback(null, chunk);
    },
  });
  await pipeline(Readable.fromWeb(res.body), hashingPassThrough, fs.createWriteStream(destPath));
  return { ok: true, sha256Hex: hash.digest('hex'), fileSizeBytes };
}

export async function main() {
  aliasEnv('CLOUDFLARE_API_TOKEN', ['CF_API_TOKEN']);
  aliasEnv('CLOUDFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID']);

  const missing = requireRestoreEnv(process.env);
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

  process.env.CLOUDFLARE_ACCOUNT_ID = accountId;
  process.env.CLOUDFLARE_API_TOKEN = apiToken;

  const redact = (text) => redactSecrets(text, [accountId, bucketName, accessKeyId, secretAccessKey, apiToken, databaseName]);

  const hostname = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${hostname}`;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });

  const discovery = { found: false, failureReason: '', sqlKey: null, fileSizeBytes: null, checksumVerified: false };
  const restore = {
    orphansFound: 0,
    orphansDeleted: 0,
    createOk: false,
    createFailureReason: '',
    importOk: false,
    importFailureReason: '',
    numQueries: null,
    rowsRead: null,
    rowsWritten: null,
    tableCountVerified: false,
    tableCountFailureReason: '',
    expectedTableCount: null,
    actualTableCount: null,
    tableCountMatched: false,
    deleteOk: false,
    deleteFailureReason: '',
  };

  let tmpDir = null;
  let tmpFile = null;

  try {
    const pathBucket = bucketName.split('/').map(encodeURIComponent).join('/');
    const qs = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000', prefix: `${R2_PREFIX}/${databaseName}/` });
    const listUrl = `${endpoint}/${pathBucket}?${qs.toString()}`;
    const listRes = await aws.fetch(listUrl, { method: 'GET' });
    if (!listRes.ok) {
      const text = await listRes.text();
      const code = extractS3ErrorCode(text);
      discovery.failureReason = code ? `HTTP ${listRes.status}: ${code}` : `HTTP ${listRes.status}`;
    } else {
      const xml = await listRes.text();
      const page = parseListObjectsV2Page(xml);
      if (page.isTruncated) {
        // Silently proceeding here could pick the latest key among only the first 1000 (in
        // lexicographic/chronological order, i.e. the *oldest* 1000), missing the true latest
        // backup entirely. Fail closed rather than risk misleading restore evidence; this
        // script does not implement ListObjectsV2 continuation-token pagination.
        discovery.failureReason =
          'backup listing was truncated (more than 1000 objects under this prefix) -- cannot safely determine the true latest backup without pagination this script does not implement.';
      } else {
        const sqlKey = findLatestBackupKey(page.keys, databaseName);
        if (!sqlKey) {
          discovery.failureReason = 'no backup object found under this database\'s R2 prefix.';
        } else {
          const checksumKey = `${sqlKey}.sha256`;
          const checksumDownload = await downloadR2Object(aws, endpoint, bucketName, checksumKey);
          if (!checksumDownload.ok) {
            discovery.failureReason = redact(`checksum sidecar download failed: ${checksumDownload.reason}`);
          } else {
            const parsedChecksum = parseChecksumFileContent(checksumDownload.buffer.toString('utf8'));
            if (!parsedChecksum) {
              discovery.failureReason = 'checksum sidecar could not be parsed.';
            } else {
              tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-restore-3268-'));
              tmpFile = path.join(tmpDir, 'backup.sql');
              const streamed = await streamDownloadToFile(aws, endpoint, bucketName, sqlKey, tmpFile);
              if (!streamed.ok) {
                discovery.failureReason = redact(`backup download failed: ${streamed.reason}`);
              } else {
                discovery.found = true;
                discovery.sqlKey = sqlKey;
                discovery.fileSizeBytes = streamed.fileSizeBytes;
                discovery.checksumVerified = streamed.sha256Hex === parsedChecksum.sha256Hex;
                if (!discovery.checksumVerified) {
                  discovery.failureReason = 'downloaded backup does not match its stored checksum sidecar.';
                }
              }
            }
          }
        }
      }
    }

    if (discovery.checksumVerified && tmpFile) {
      restore.expectedTableCount = countCreateTableStatements(fs.readFileSync(tmpFile, 'utf8'));

      const listing = runWrangler(['d1', 'list', '--json']);
      if (!listing.error && listing.status === 0) {
        try {
          const parsed = JSON.parse(listing.stdout);
          const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.result) ? parsed.result : [];
          const orphans = records.filter((db) => typeof db?.name === 'string' && db.name.startsWith(RESTORE_DB_PREFIX));
          restore.orphansFound = orphans.length;
          for (const orphan of orphans) {
            const del = runWrangler(['d1', 'delete', orphan.name, '-y']);
            if (!del.error && del.status === 0) restore.orphansDeleted += 1;
          }
        } catch {
          // Best-effort sweep only; an unparseable listing should not block the restore proof.
        }
      }

      const dbName = generateRestoreDbName(Date.now(), crypto.randomBytes(4).toString('hex'));
      const create = runWrangler(['d1', 'create', dbName], { discardStdout: true });
      if (create.error || create.status !== 0) {
        restore.createFailureReason = redact((create.stderr || '').trim()).slice(0, 500) || `exit ${create.status ?? 'spawn error'}`;
      } else {
        restore.createOk = true;

        try {
          const exec = runWrangler(['d1', 'execute', dbName, '--file', tmpFile, '--remote', '-y', '--json']);
          if (exec.error || exec.status !== 0) {
            restore.importFailureReason = redact((exec.stderr || '').trim()).slice(0, 500) || `exit ${exec.status ?? 'spawn error'}`;
          } else {
            const parsedExec = parseD1ExecuteFileResult(exec.stdout);
            if (!parsedExec) {
              // A file-based import's --json response is confirmed, from wrangler's own
              // source, to contain only aggregate metadata (query/row counts, database size)
              // -- never row content -- so a truncated, redacted snippet is safe to surface
              // here as real diagnostic evidence rather than leaving the next run to guess
              // blindly at what changed about the response shape.
              const snippet = redact((exec.stdout || '').trim()).slice(0, 800);
              restore.importFailureReason = `import succeeded but its response could not be interpreted.${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no stdout captured)'}`;
            } else {
              restore.importOk = parsedExec.success;
              restore.numQueries = parsedExec.numQueries;
              restore.rowsRead = parsedExec.rowsRead;
              restore.rowsWritten = parsedExec.rowsWritten;
              if (!restore.importOk) restore.importFailureReason = 'import reported success: false.';
            }
          }

          if (restore.importOk) {
            const countCmd = "SELECT COUNT(*) AS table_count FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
            const countExec = runWrangler(['d1', 'execute', dbName, '--command', countCmd, '--remote', '--json', '-y']);
            if (countExec.error || countExec.status !== 0) {
              restore.tableCountFailureReason = redact((countExec.stderr || '').trim()).slice(0, 500) || `exit ${countExec.status ?? 'spawn error'}`;
            } else {
              const actual = parseTableCountResult(countExec.stdout);
              if (actual == null) {
                // Same reasoning as the import-parse-failure path above: this response shape
                // (`[{ results: [{ table_count: N }], success, meta }]`) is confirmed to carry
                // only the single count this query selected, so a redacted, truncated snippet
                // is safe real evidence rather than another guess.
                const snippet = redact((countExec.stdout || '').trim()).slice(0, 800);
                restore.tableCountFailureReason = `table count query succeeded but its response could not be interpreted.${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no stdout captured)'}`;
              } else {
                restore.tableCountVerified = true;
                restore.actualTableCount = actual;
                restore.tableCountMatched = actual === restore.expectedTableCount;
              }
            }
          }
        } finally {
          const del = runWrangler(['d1', 'delete', dbName, '-y']);
          if (del.error || del.status !== 0) {
            restore.deleteFailureReason = redact((del.stderr || '').trim()).slice(0, 500) || `exit ${del.status ?? 'spawn error'}`;
          } else {
            restore.deleteOk = true;
          }
        }
      }
    }
  } finally {
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  }

  const restoreProofComplete =
    discovery.found &&
    discovery.checksumVerified &&
    restore.createOk &&
    restore.importOk &&
    restore.tableCountVerified &&
    restore.tableCountMatched &&
    restore.deleteOk;

  const result = { checkedAt: new Date().toISOString(), discovery, restore, restoreProofComplete };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('restore_proof_complete', String(restoreProofComplete));

  if (!restoreProofComplete) {
    failClosed('isolated restore proof did not fully succeed. See the posted result for the exact reason.');
    return;
  }

  console.log(`OK: isolated restore proof complete (${restore.actualTableCount} tables, ${restore.rowsWritten} rows written).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
