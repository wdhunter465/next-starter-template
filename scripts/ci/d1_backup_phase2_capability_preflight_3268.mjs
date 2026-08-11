#!/usr/bin/env node
/**
 * #3268 Phase 2 Package 1 — bounded, reversible capability preflight.
 *
 * Proves two capabilities the Phase 2 design
 * (docs/ops/reports/d1-backup-restore-3268-phase2.md) depends on, both
 * currently unverified:
 *
 *   1. R2 write scope: the existing least-privilege R2 credential has so far
 *      only been proven to support `ListObjectsV2` (Phase 1, PR #3302/#3303).
 *      This writes, reads back, and deletes a single small disposable test
 *      object under a clearly-scoped test prefix.
 *   2. D1 admin scope: the existing `CLOUDFLARE_API_TOKEN` has so far only
 *      been proven to support read operations (`d1 info`, `d1 time-travel
 *      info`). This creates a brand-new, uniquely-named D1 database, runs a
 *      trivial query against it, and deletes it.
 *
 * Per Bill's explicit conditions for this package: the D1 test database is
 * temporary (deleted at the end of this same job, in a `finally`-style path
 * so a mid-run failure still attempts cleanup), uniquely named (timestamp +
 * random suffix, so retries can never collide with a leftover from a prior
 * failed run), and never referenced anywhere in `wrangler.toml` — no code
 * path in this script writes to that file, and `wrangler d1 create` itself
 * only auto-patches JSON/JSONC config files (confirmed by reading
 * `node_modules/wrangler/wrangler-dist/cli.js`'s `createdResourceConfig`),
 * never this repo's `wrangler.toml`. This script also performs a best-effort
 * orphan sweep: before creating its own test database, it lists existing D1
 * databases and deletes any stray one matching this script's own test-name
 * prefix, in case a previous run crashed before its own cleanup ran.
 *
 * This script never touches `lgfc_lite` (Production D1) in any way — it
 * does not read `D1_DATABASE_NAME`/`D1_DATABASE_ID` and has no code path
 * that could address the Production database. It never runs a real D1
 * export, never uploads real backup content, and never restores anything —
 * that is Packages 2-3, not this one.
 *
 * Required env (GitHub Actions repository secrets; values are never logged):
 *   R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME,
 *   CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN (aliases CF_ACCOUNT_ID/
 *   CF_API_TOKEN accepted).
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { AwsClient } from '../../functions/_lib/aws4fetch.ts';
import { redactSecrets, extractS3ErrorCode, findBlankAfterTrim } from './d1_backup_r2_phase1_preflight_3268.mjs';

export const RESULT_JSON_PATH = 'd1-backup-phase2-capability-preflight-3268-result.json';
export const RESULT_MD_PATH = 'd1-backup-phase2-capability-preflight-3268-result.md';

const TEST_KEY_PREFIX = '_3268-capability-test/';
const TEST_DB_PREFIX = 'lgfc-3268-cap-test-';

function aliasEnv(primary, aliases) {
  if (process.env[primary]) return;
  for (const name of aliases) {
    if (process.env[name]) {
      process.env[primary] = process.env[name];
      return;
    }
  }
}

export function requireCapabilityEnv(env = process.env) {
  return ['R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME', 'CLOUDFLARE_ACCOUNT_ID', 'CLOUDFLARE_API_TOKEN'].filter(
    (name) => !env[name],
  );
}

/**
 * Deterministic given its inputs (pure for testability); the real run seeds
 * `now`/`random` from the live clock and `crypto.randomBytes` so retries
 * within the same second can never collide.
 */
export function generateTestKey(now, random) {
  return `${TEST_KEY_PREFIX}${now}-${random}.txt`;
}

export function generateTestDbName(now, random) {
  return `${TEST_DB_PREFIX}${now}-${random}`;
}

export function generateTestContent(nonce) {
  return `#3268 Phase 2 Package 1 capability preflight test object -- nonce ${nonce}. Safe to delete; written and deleted by the same CI run.`;
}

/**
 * Parses `wrangler d1 create <name>`'s plain-text output (no `--json` flag
 * exists for this subcommand -- confirmed via `wrangler d1 create --help`)
 * for the `database_id`/`database_name` fields of the TOML config snippet
 * it prints on success (confirmed from wrangler's own source: for a TOML
 * config file, `formatConfigSnippet` renders `[[d1_databases]]` /
 * `database_name = "..."` / `database_id = "..."` via a real TOML
 * stringifier, not JSON). Returns null when neither field can be found,
 * distinct from a result with a missing individual field.
 */
export function parseD1CreateOutput(stdout) {
  const raw = String(stdout ?? '');
  const idMatch = raw.match(/database_id\s*=\s*"([^"]+)"/);
  const nameMatch = raw.match(/database_name\s*=\s*"([^"]+)"/);
  if (!idMatch && !nameMatch) return null;
  return {
    databaseId: idMatch ? idMatch[1] : null,
    databaseName: nameMatch ? nameMatch[1] : null,
  };
}

/**
 * Parses `wrangler d1 list --json`'s output into the subset of existing D1
 * databases whose name starts with this script's own test-name prefix --
 * used only for the best-effort orphan sweep before this run creates its
 * own test database. Returns an empty array (never throws) for
 * unparseable/empty input, since a failed sweep should not block the rest
 * of the preflight.
 */
export function findOrphanTestDatabases(stdout, prefix) {
  try {
    const parsed = JSON.parse(String(stdout ?? ''));
    const records = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.result) ? parsed.result : [];
    return records.filter((db) => typeof db?.name === 'string' && db.name.startsWith(prefix));
  } catch {
    return [];
  }
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

function formatR2Result(r2) {
  const lines = ['### R2 write-capability test (PUT / GET / DELETE round-trip)', ''];
  lines.push(`- PutObject: ${r2.putOk ? 'OK' : `FAILED${r2.putFailureReason ? ` (${r2.putFailureReason})` : ''}`}`);
  if (r2.putOk) {
    lines.push(`- GetObject read-back: ${r2.getOk ? 'OK' : `FAILED${r2.getFailureReason ? ` (${r2.getFailureReason})` : ''}`}`);
    if (r2.getOk) lines.push(`- Content matched exactly: ${r2.contentMatched ? 'YES' : 'NO'}`);
    lines.push(`- DeleteObject: ${r2.deleteOk ? 'OK' : `FAILED${r2.deleteFailureReason ? ` (${r2.deleteFailureReason})` : ''}`}`);
    if (r2.deleteOk) {
      lines.push(
        `- Deletion verified (follow-up GET returned not-found): ${r2.deleteVerified ? 'YES' : `NO${r2.deleteVerifyReason ? ` (${r2.deleteVerifyReason})` : ''}`}`,
      );
    }
  }
  return lines.join('\n');
}

function formatD1Result(d1) {
  const lines = ['### D1 admin-capability test (create / execute / delete)', ''];
  lines.push(`- Orphan sweep before this run: ${d1.orphansFound} stray test database(s) found, ${d1.orphansDeleted} deleted`);
  lines.push(`- Create: ${d1.createOk ? 'OK' : `FAILED${d1.createFailureReason ? ` (${d1.createFailureReason})` : ''}`}`);
  if (d1.createOk) {
    lines.push(`- Database name confirmed matches requested name: ${d1.nameMatched ? 'YES' : 'NO'}`);
    lines.push(`- UUID returned: ${d1.databaseId ? 'YES' : 'NO'}`);
    lines.push(`- Trivial query execution: ${d1.executeOk ? 'OK' : `FAILED${d1.executeFailureReason ? ` (${d1.executeFailureReason})` : ''}`}`);
    lines.push(`- Delete (cleanup): ${d1.deleteOk ? 'OK' : `FAILED${d1.deleteFailureReason ? ` (${d1.deleteFailureReason})` : ''}`}`);
  }
  return lines.join('\n');
}

export function buildResultMarkdown(result) {
  const lines = [
    '<!-- d1-backup-phase2-capability-preflight-3268 -->',
    '## #3268 Phase 2 Package 1 — capability preflight (R2 write scope + D1 admin scope)',
    '',
    `- Checked at: ${result.checkedAt}`,
    `- This test never reads or writes \`lgfc_lite\` (Production D1) or any of its data.`,
    `- The D1 test database created here (if any) is never added to \`wrangler.toml\` and is deleted before this run ends.`,
    '',
    formatR2Result(result.r2),
    '',
    formatD1Result(result.d1),
    '',
    '### Overall',
    '',
    `- R2 write capability: ${result.r2Capable ? 'CONFIRMED' : 'NOT CONFIRMED'}`,
    `- D1 admin capability: ${result.d1Capable ? 'CONFIRMED' : 'NOT CONFIRMED'}`,
    `- Ready for Phase 2 Package 2 (real export/upload): ${result.r2Capable && result.d1Capable ? 'YES' : 'NO'}`,
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

/**
 * Requires `deleteVerified`, not just a 2xx DELETE response: R2/S3-compatible DELETE can
 * report success even when the underlying object wasn't actually removed, and this
 * preflight's entire purpose is to prove full, genuine reversibility -- a DELETE that
 * "succeeded" but left the object readable is not that proof.
 */
export function computeR2Capable(r2) {
  return Boolean(r2?.putOk && r2?.getOk && r2?.contentMatched && r2?.deleteOk && r2?.deleteVerified);
}

export function computeD1Capable(d1) {
  return Boolean(d1?.createOk && d1?.executeOk && d1?.deleteOk);
}

async function runR2CapabilityTest({ accountId, bucketName, accessKeyId, secretAccessKey, redact }) {
  const hostname = `${accountId}.r2.cloudflarestorage.com`;
  const endpoint = `https://${hostname}`;
  const aws = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const testKey = generateTestKey(Date.now(), crypto.randomBytes(4).toString('hex'));
  const content = generateTestContent(crypto.randomBytes(8).toString('hex'));
  const pathBucket = bucketName.split('/').map(encodeURIComponent).join('/');
  const objectUrl = `${endpoint}/${pathBucket}/${testKey.split('/').map(encodeURIComponent).join('/')}`;

  const result = {
    putOk: false,
    putFailureReason: '',
    getOk: false,
    getFailureReason: '',
    contentMatched: false,
    deleteOk: false,
    deleteFailureReason: '',
    deleteVerified: false,
    deleteVerifyReason: '',
  };

  try {
    const putRes = await aws.fetch(objectUrl, { method: 'PUT', body: content });
    if (!putRes.ok) {
      const text = await putRes.text();
      const code = extractS3ErrorCode(text);
      result.putFailureReason = code ? `HTTP ${putRes.status}: ${code}` : `HTTP ${putRes.status}`;
      return result;
    }
    result.putOk = true;
  } catch (error) {
    result.putFailureReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
    return result;
  }

  try {
    const getRes = await aws.fetch(objectUrl, { method: 'GET' });
    if (!getRes.ok) {
      const text = await getRes.text();
      const code = extractS3ErrorCode(text);
      result.getFailureReason = code ? `HTTP ${getRes.status}: ${code}` : `HTTP ${getRes.status}`;
    } else {
      const readBack = await getRes.text();
      result.getOk = true;
      result.contentMatched = readBack === content;
    }
  } catch (error) {
    result.getFailureReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
  }

  try {
    const delRes = await aws.fetch(objectUrl, { method: 'DELETE' });
    if (!delRes.ok && delRes.status !== 204) {
      const text = await delRes.text();
      const code = extractS3ErrorCode(text);
      result.deleteFailureReason = code ? `HTTP ${delRes.status}: ${code}` : `HTTP ${delRes.status}`;
    } else {
      result.deleteOk = true;
    }
  } catch (error) {
    result.deleteFailureReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
  }

  if (result.deleteOk) {
    try {
      const verifyRes = await aws.fetch(objectUrl, { method: 'GET' });
      if (verifyRes.ok) {
        result.deleteVerifyReason = 'object still readable after delete';
      } else {
        const text = await verifyRes.text();
        const code = extractS3ErrorCode(text);
        result.deleteVerified = code === 'NoSuchKey' || verifyRes.status === 404;
        if (!result.deleteVerified) result.deleteVerifyReason = code ? `HTTP ${verifyRes.status}: ${code}` : `HTTP ${verifyRes.status}`;
      }
    } catch (error) {
      result.deleteVerifyReason = redact([error.message, error.cause?.code].filter(Boolean).join(' — '));
    }
  }

  return result;
}

async function runD1CapabilityTest({ redact }) {
  const result = {
    orphansFound: 0,
    orphansDeleted: 0,
    createOk: false,
    createFailureReason: '',
    nameMatched: false,
    databaseId: null,
    executeOk: false,
    executeFailureReason: '',
    deleteOk: false,
    deleteFailureReason: '',
  };

  const listing = runWrangler(['d1', 'list', '--json']);
  if (!listing.error && listing.status === 0) {
    const orphans = findOrphanTestDatabases(listing.stdout, TEST_DB_PREFIX);
    result.orphansFound = orphans.length;
    for (const orphan of orphans) {
      const del = runWrangler(['d1', 'delete', orphan.name, '-y']);
      if (!del.error && del.status === 0) result.orphansDeleted += 1;
    }
  }

  const dbName = generateTestDbName(Date.now(), crypto.randomBytes(4).toString('hex'));
  const create = runWrangler(['d1', 'create', dbName]);
  if (create.error || create.status !== 0) {
    result.createFailureReason = redact((create.stderr || '').trim()).slice(0, 500) || `exit ${create.status ?? 'spawn error'}`;
    return result;
  }
  result.createOk = true;
  const parsed = parseD1CreateOutput(create.stdout);
  result.nameMatched = parsed?.databaseName === dbName;
  result.databaseId = parsed?.databaseId ?? null;

  try {
    const exec = runWrangler(['d1', 'execute', dbName, '--command', 'SELECT 1 AS ok', '--remote', '-y', '--json']);
    if (exec.error || exec.status !== 0) {
      result.executeFailureReason = redact((exec.stderr || '').trim()).slice(0, 500) || `exit ${exec.status ?? 'spawn error'}`;
    } else {
      result.executeOk = true;
    }
  } finally {
    const del = runWrangler(['d1', 'delete', dbName, '-y']);
    if (del.error || del.status !== 0) {
      result.deleteFailureReason = redact((del.stderr || '').trim()).slice(0, 500) || `exit ${del.status ?? 'spawn error'}`;
    } else {
      result.deleteOk = true;
    }
  }

  return result;
}

export async function main() {
  aliasEnv('CLOUDFLARE_API_TOKEN', ['CF_API_TOKEN']);
  aliasEnv('CLOUDFLARE_ACCOUNT_ID', ['CF_ACCOUNT_ID']);

  const missing = requireCapabilityEnv(process.env);
  if (missing.length > 0) {
    failClosed(`missing required credential(s): ${missing.join(', ')} (values are never logged).`);
    return;
  }

  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID.trim();
  const bucketName = process.env.R2_BUCKET_NAME.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY.trim();

  // requireCapabilityEnv() above only checks presence, so a whitespace-only secret value
  // passes it (a non-empty string is truthy) and would trim to an empty string here --
  // silently producing a malformed R2 hostname or an empty CLOUDFLARE_ACCOUNT_ID/token
  // downstream instead of a clear error. Fail closed now, by name only, never by value.
  // (Same class of gap the Phase 1 R2 preflight already fixed once -- see
  // findBlankAfterTrim in d1_backup_r2_phase1_preflight_3268.mjs.)
  const blankAfterTrim = findBlankAfterTrim({
    CLOUDFLARE_ACCOUNT_ID: accountId,
    R2_BUCKET_NAME: bucketName,
    R2_ACCESS_KEY_ID: accessKeyId,
    R2_SECRET_ACCESS_KEY: secretAccessKey,
  });
  if (blankAfterTrim.length > 0) {
    failClosed(`required credential(s) present but blank/whitespace-only after trimming: ${blankAfterTrim.join(', ')} (values are never logged).`);
    return;
  }

  const redact = (text) => redactSecrets(text, [accountId, bucketName, accessKeyId, secretAccessKey]);

  const r2 = await runR2CapabilityTest({ accountId, bucketName, accessKeyId, secretAccessKey, redact });
  const d1 = await runD1CapabilityTest({ redact });

  const r2Capable = computeR2Capable(r2);
  const d1Capable = computeD1Capable(d1);

  const result = {
    checkedAt: new Date().toISOString(),
    r2,
    d1,
    r2Capable,
    d1Capable,
  };

  fs.writeFileSync(RESULT_JSON_PATH, `${JSON.stringify(result, null, 2)}\n`);
  fs.writeFileSync(RESULT_MD_PATH, `${buildResultMarkdown(result)}\n`);

  writeOutput('r2_capable', String(r2Capable));
  writeOutput('d1_capable', String(d1Capable));

  if (!r2Capable || !d1Capable) {
    failClosed(
      `capability check(s) failed: ${[!r2Capable && 'R2 write', !d1Capable && 'D1 admin'].filter(Boolean).join(', ')}. See the posted result for the exact reason.`,
    );
    return;
  }

  console.log('OK: both R2 write capability and D1 admin capability confirmed.');
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  main().then(() => {
    if (process.exitCode) process.exit(process.exitCode);
  });
}
