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

const INTERNAL_TABLE_PREFIXES = ['sqlite_', 'd1_migrations', '_cf_'];

function isInternalTableName(name) {
  const lower = name.toLowerCase();
  return INTERNAL_TABLE_PREFIXES.some((prefix) => lower.startsWith(prefix));
}

/**
 * Extracts the names of application tables a SQL dump's `CREATE TABLE` statements create,
 * excluding internal bookkeeping tables neither the export nor a fresh restore actually
 * originates from an explicit `CREATE TABLE` in application code: SQLite's own `sqlite_%`
 * (e.g. `sqlite_sequence`, auto-managed whenever any table uses `AUTOINCREMENT`), D1's own
 * migration-tracking `d1_migrations%`, and D1's own internal `_cf_%` tables (e.g. `_cf_KV`,
 * confirmed present in a real restored database by a live run on 2026-08-11 despite never
 * appearing in the exported SQL text -- D1 creates it automatically, outside the export).
 * This is the exact exclusion list this repo already uses elsewhere for the same purpose
 * (`scripts/d1-seed-all.mjs`'s `getTables()`: `... AND name NOT LIKE 'sqlite_%' AND name NOT
 * LIKE 'd1_migrations%' AND name NOT LIKE '_cf_%'`). Table *names* are schema-only, not row
 * content, so they are safe to report directly (unlike this script's other queries, which are
 * aggregate-only by necessity because they touch the restored data itself). Only matches literal
 * `CREATE TABLE` (not `CREATE VIRTUAL TABLE`) -- see the live query in main(), which applies the
 * identical exclusion list and is what this list is actually compared against.
 */
export function extractCreateTableNames(sqlText) {
  const matches = String(sqlText ?? '').matchAll(/^\s*CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["'`]?(\w+)["'`]?/gim);
  const names = new Set();
  for (const match of matches) {
    if (!isInternalTableName(match[1])) names.add(match[1]);
  }
  return [...names].sort();
}

export function countCreateTableStatements(sqlText) {
  return extractCreateTableNames(sqlText).length;
}

/** Names present in one list but not the other, both sorted -- for a real, honest diff. */
export function diffTableNames(expectedNames, actualNames) {
  const expectedSet = new Set(expectedNames ?? []);
  const actualSet = new Set(actualNames ?? []);
  return {
    onlyInBackupFile: [...expectedSet].filter((n) => !actualSet.has(n)).sort(),
    onlyInRestoredDb: [...actualSet].filter((n) => !expectedSet.has(n)).sort(),
  };
}

export function generateRestoreDbName(now, random) {
  return `${RESTORE_DB_PREFIX}${now}-${random}`;
}

/**
 * `wrangler d1 execute --file=...` prints file-upload progress lines (e.g. "Checking if file
 * needs uploading", "Uploading <name>", "Uploading complete.") directly to stdout *before* the
 * JSON payload, even with `--json` set -- confirmed from a real live run (2026-08-11) whose
 * stdout began with several `├`/`│`/`🌀`-prefixed progress lines ahead of the actual `[ ... ]`
 * array. `JSON.parse()` on the raw string fails outright in that case. Since none of those
 * progress-line characters can appear before the real payload, this finds the first `[` in the
 * text and parses from there -- the response shape this script consumes is always a top-level
 * JSON array (confirmed from wrangler's own source, both the file-import and query-API response
 * paths). Returns null (never throws) when no `[` is found or the remainder isn't valid JSON.
 */
function extractJsonArray(stdout) {
  const text = String(stdout ?? '');
  const start = text.indexOf('[');
  if (start === -1) return null;
  try {
    return JSON.parse(text.slice(start).trim());
  } catch {
    return null;
  }
}

/**
 * Parses `wrangler d1 execute <db> --file=... --remote -y --json`'s response: an array with one
 * element shaped `{ results: [{ "Total queries executed", "Rows read", "Rows written", ... }],
 * success, meta }` for a file-based import (confirmed from wrangler's own source, executeRemotely
 * in node_modules/wrangler/wrangler-dist/cli.js). Returns null when the shape isn't recognized.
 */
export function parseD1ExecuteFileResult(stdout) {
  const parsed = extractJsonArray(stdout);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  const row = entry?.results?.[0];
  if (!entry || typeof entry.success !== 'boolean' || !row) return null;
  return {
    success: entry.success,
    numQueries: row['Total queries executed'] ?? null,
    rowsRead: row['Rows read'] ?? null,
    rowsWritten: row['Rows written'] ?? null,
  };
}

/**
 * Parses `wrangler d1 execute <db> --command="SELECT name FROM sqlite_master WHERE type='table'
 * AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_migrations%' AND name NOT LIKE '_cf_%' ORDER
 * BY name" --remote --json`'s response: `[{ results: [{ name: "..." }, ...], success, meta }]`
 * (the standard Cloudflare D1 query API response shape, one row per table). Returns a sorted
 * array of names, or null when the shape isn't recognized. Table names are schema-only, safe to
 * report directly -- unlike this restored database's actual row content, which this script never
 * queries.
 */
export function parseTableNamesResult(stdout) {
  const parsed = extractJsonArray(stdout);
  const entry = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!entry?.success || !Array.isArray(entry.results)) return null;
  const names = entry.results.map((row) => row?.name).filter((name) => typeof name === 'string');
  if (names.length !== entry.results.length) return null;
  return names.sort();
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
      lines.push(`  - Expected (from backup file's own \`CREATE TABLE\` statements): ${restore.expectedTableNames.length}`);
      lines.push(`  - Actual (restored database, \`sqlite_master\`): ${restore.actualTableNames.length}`);
      lines.push(`  - Matched exactly: ${restore.tableCountMatched ? 'YES' : 'NO'}`);
      if (!restore.tableCountMatched) {
        // Table names are schema-only, never row content, so listing the exact diff here is
        // safe and is real diagnostic evidence rather than a bare count mismatch to guess at.
        if (restore.onlyInBackupFile.length > 0) {
          lines.push(`  - In backup file but not restored database: ${restore.onlyInBackupFile.map((n) => `\`${n}\``).join(', ')}`);
        }
        if (restore.onlyInRestoredDb.length > 0) {
          lines.push(`  - In restored database but not backup file: ${restore.onlyInRestoredDb.map((n) => `\`${n}\``).join(', ')}`);
        }
      }
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
    expectedTableNames: [],
    actualTableNames: [],
    onlyInBackupFile: [],
    onlyInRestoredDb: [],
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
      restore.expectedTableNames = extractCreateTableNames(fs.readFileSync(tmpFile, 'utf8'));

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
              restore.importFailureReason = `wrangler exited 0 but its response could not be interpreted (this does not necessarily mean the import itself succeeded).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no stdout captured)'}`;
            } else {
              restore.importOk = parsedExec.success;
              restore.numQueries = parsedExec.numQueries;
              restore.rowsRead = parsedExec.rowsRead;
              restore.rowsWritten = parsedExec.rowsWritten;
              if (!restore.importOk) restore.importFailureReason = 'import reported success: false.';
            }
          }

          if (restore.importOk) {
            const namesCmd =
              "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'd1_migrations%' AND name NOT LIKE '_cf_%' ORDER BY name";
            const namesExec = runWrangler(['d1', 'execute', dbName, '--command', namesCmd, '--remote', '--json', '-y']);
            if (namesExec.error || namesExec.status !== 0) {
              restore.tableCountFailureReason = redact((namesExec.stderr || '').trim()).slice(0, 500) || `exit ${namesExec.status ?? 'spawn error'}`;
            } else {
              const actualNames = parseTableNamesResult(namesExec.stdout);
              if (actualNames == null) {
                // Same reasoning as the import-parse-failure path above: table names are
                // schema-only, never row content, so a redacted, truncated snippet is safe real
                // evidence rather than another guess.
                const snippet = redact((namesExec.stdout || '').trim()).slice(0, 800);
                restore.tableCountFailureReason = `wrangler exited 0 but its response could not be interpreted (this does not necessarily mean the query itself succeeded).${snippet ? ` Raw (redacted) response snippet: ${snippet}` : ' (no stdout captured)'}`;
              } else {
                restore.tableCountVerified = true;
                restore.actualTableNames = actualNames;
                restore.tableCountMatched =
                  restore.expectedTableNames.length === actualNames.length &&
                  restore.expectedTableNames.every((name, i) => name === actualNames[i]);
                const diff = diffTableNames(restore.expectedTableNames, actualNames);
                restore.onlyInBackupFile = diff.onlyInBackupFile;
                restore.onlyInRestoredDb = diff.onlyInRestoredDb;
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

  console.log(`OK: isolated restore proof complete (${restore.actualTableNames.length} tables, ${restore.rowsWritten} rows written).`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
