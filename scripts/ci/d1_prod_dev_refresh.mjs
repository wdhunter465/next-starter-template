#!/usr/bin/env node
/**
 * #3359 — Prod → Dev D1 refresh orchestration (manual Action helper).
 *
 * Identity fail-closed checks, sanitization gate, SQL dump parse → sanitize →
 * Dev load SQL generation. Wrangler export/execute wrappers discard sensitive
 * stdout and never log source values.
 *
 * Production is read-only (export). Destructive writes target lgfc-litedev only.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import {
  DEV_ID,
  DEV_NAME,
  PROD_ID,
  PROD_NAME,
  evaluateIdentities,
  parseProdAndPreviewD1,
} from './d1_prod_dev_identity_check.mjs';
import {
  assertSchemaCovered,
  evaluateRefreshGate,
  loadManifest,
  privacySafeSummary,
  sanitizeDataset,
} from './d1_prod_dev_sanitize.mjs';

export { PROD_NAME, PROD_ID, DEV_NAME, DEV_ID };

export const CONFIRM_TOKEN = 'confirm';
export const CONFIRM_DEV_RESET_TOKEN = 'RESET_LGFC_LITEDEV';

export function validateManualInputs({
  confirm,
  confirmDevReset,
  reason,
  dryRun,
  allowRemoteDestructive,
}) {
  const failures = [];
  if (confirm !== CONFIRM_TOKEN) {
    failures.push(`confirm must be exactly "${CONFIRM_TOKEN}"`);
  }
  if (!reason || !String(reason).trim()) {
    failures.push('reason/reference is required');
  }
  if (!dryRun && !allowRemoteDestructive) {
    failures.push('remote destructive Dev refresh requires allowRemoteDestructive=true');
  }
  if (!dryRun && confirmDevReset !== CONFIRM_DEV_RESET_TOKEN) {
    failures.push(`confirmDevReset must be exactly "${CONFIRM_DEV_RESET_TOKEN}" for non-dry-run`);
  }
  return { ok: failures.length === 0, failures };
}

export function validateSourceTargetIdentities(env = process.env, wranglerText = '') {
  const failures = [];
  const parsed = wranglerText ? parseProdAndPreviewD1(wranglerText) : null;
  if (parsed) {
    const idResult = evaluateIdentities(parsed, env);
    if (!idResult.ok) failures.push(...idResult.failures);
  }

  const prodName = env.D1_DATABASE_NAME || PROD_NAME;
  const prodId = env.D1_DATABASE_ID || PROD_ID;
  const devName = env.D1_DEV_DATABASE_NAME || DEV_NAME;
  const devId = env.D1_DEV_DATABASE_ID || DEV_ID;

  if (prodId === devId) {
    failures.push('source and target database IDs must not be identical');
  }
  if (prodName === devName) {
    failures.push('source and target database names must not be identical');
  }
  if (prodName !== PROD_NAME || prodId !== PROD_ID) {
    failures.push('Production identity does not match expected lgfc_lite UUID');
  }
  if (devName !== DEV_NAME || devId !== DEV_ID) {
    failures.push('Dev identity does not match expected lgfc-litedev UUID');
  }

  return {
    ok: failures.length === 0,
    failures,
    source: { name: prodName, id: prodId },
    target: { name: devName, id: devId },
  };
}

/** Parse a single SQL literal / NULL / number from VALUES list. */
export function parseSqlValueToken(token) {
  const t = token.trim();
  if (/^null$/i.test(t)) return null;
  if (/^-?\d+(\.\d+)?$/.test(t)) {
    return t.includes('.') ? Number(t) : Number.parseInt(t, 10);
  }
  if ((t.startsWith("'") && t.endsWith("'")) || (t.startsWith('"') && t.endsWith('"'))) {
    const q = t[0];
    let out = '';
    for (let i = 1; i < t.length - 1; i += 1) {
      if (t[i] === q && t[i + 1] === q) {
        out += q;
        i += 1;
      } else {
        out += t[i];
      }
    }
    return out;
  }
  throw new Error('Unparseable SQL value token');
}

/** Split VALUES (...),(...) lists respecting quotes. */
export function splitSqlTupleList(valuesBlob) {
  const tuples = [];
  let depth = 0;
  let inQuote = null;
  let start = -1;
  for (let i = 0; i < valuesBlob.length; i += 1) {
    const ch = valuesBlob[i];
    if (inQuote) {
      if (ch === inQuote) {
        if (valuesBlob[i + 1] === inQuote) {
          i += 1;
        } else {
          inQuote = null;
        }
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      inQuote = ch;
      continue;
    }
    if (ch === '(') {
      if (depth === 0) start = i + 1;
      depth += 1;
      continue;
    }
    if (ch === ')') {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        tuples.push(valuesBlob.slice(start, i));
        start = -1;
      }
    }
  }
  return tuples;
}

export function splitSqlArgs(argBlob) {
  const args = [];
  let inQuote = null;
  let start = 0;
  for (let i = 0; i < argBlob.length; i += 1) {
    const ch = argBlob[i];
    if (inQuote) {
      if (ch === inQuote) {
        if (argBlob[i + 1] === inQuote) i += 1;
        else inQuote = null;
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      inQuote = ch;
      continue;
    }
    if (ch === ',') {
      args.push(argBlob.slice(start, i).trim());
      start = i + 1;
    }
  }
  args.push(argBlob.slice(start).trim());
  return args.filter((a) => a.length > 0);
}

/**
 * Parse INSERT statements from a Wrangler-style SQLite dump into { table: row[] }.
 * Fail-closed on INSERT shapes we cannot safely parse.
 */
export function parseInsertDump(sqlText, schemaFingerprint) {
  const dataset = {};
  const failures = [];
  const insertRe =
    /INSERT\s+INTO\s+(?:"([^"]+)"|([A-Za-z_][\w]*))(?:\s*\(([^)]*)\))?\s*VALUES\s*/gi;

  let match;
  while ((match = insertRe.exec(sqlText)) !== null) {
    const table = match[1] || match[2];
    const colBlob = match[3];
    const after = sqlText.slice(match.index + match[0].length);
    const endMatch = after.match(/^([\s\S]*?)(?:;|\n(?=INSERT\s+INTO|\nCREATE|\nCOMMIT|\nBEGIN)|$)/i);
    if (!endMatch) {
      failures.push(`Failed to locate VALUES payload for table ${table}`);
      continue;
    }
    const valuesBlob = endMatch[1].trim().replace(/;+\s*$/, '');
    const columns = colBlob
      ? splitSqlArgs(colBlob).map((c) => c.replace(/^["']|["']$/g, ''))
      : schemaFingerprint[table] || null;

    if (!columns) {
      failures.push(`INSERT into unclassified/unknown table or missing column list: ${table}`);
      continue;
    }
    if (!schemaFingerprint[table]) {
      failures.push(`Unclassified table in dump (fail-closed): ${table}`);
      continue;
    }

    try {
      const tuples = splitSqlTupleList(valuesBlob.startsWith('(') ? valuesBlob : `(${valuesBlob})`);
      for (const tuple of tuples) {
        const vals = splitSqlArgs(tuple).map(parseSqlValueToken);
        if (vals.length !== columns.length) {
          failures.push(`Column/value arity mismatch for ${table}`);
          continue;
        }
        const row = {};
        columns.forEach((c, idx) => {
          row[c] = vals[idx];
        });
        if (!dataset[table]) dataset[table] = [];
        dataset[table].push(row);
      }
    } catch (err) {
      failures.push(`Parse failure for ${table}: ${err.message}`);
    }
  }

  return { ok: failures.length === 0, failures, dataset };
}

/** Total parsed data rows across tables (excludes empty table keys). */
export function countParsedRows(dataset = {}) {
  return Object.values(dataset).reduce((n, rows) => n + (Array.isArray(rows) ? rows.length : 0), 0);
}

export function sqlLiteral(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function buildDevLoadSql(sanitizedTables, schemaFingerprint) {
  const parts = ['PRAGMA foreign_keys=OFF;', 'BEGIN TRANSACTION;'];
  const tableOrder = Object.keys(schemaFingerprint);
  for (const table of tableOrder) {
    parts.push(`DELETE FROM "${table}";`);
  }
  for (const table of tableOrder) {
    const rows = sanitizedTables[table] || [];
    const cols = schemaFingerprint[table];
    for (const row of rows) {
      const values = cols.map((c) => sqlLiteral(row[c] ?? null));
      parts.push(
        `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${values.join(', ')});`,
      );
    }
  }
  parts.push('COMMIT;', 'PRAGMA foreign_keys=ON;');
  return parts.join('\n');
}

export function buildEvidenceArtifact({
  actor,
  commitSha,
  reason,
  dryRun,
  source,
  target,
  gate,
  schemaCoverage,
  summary,
  status,
  startedAt,
  finishedAt,
}) {
  return {
    issue: 3359,
    actor: actor || null,
    commitSha: commitSha || null,
    reason: reason || null,
    dryRun: Boolean(dryRun),
    status,
    startedAt,
    finishedAt,
    source: { name: source?.name, id: source?.id },
    target: { name: target?.name, id: target?.id },
    refreshGate: gate?.recommendation,
    schemaCoverageOk: schemaCoverage?.ok,
    tableSummaries: privacySafeSummary(summary || []),
  };
}

function resolveWranglerCmd() {
  const local = path.resolve(process.cwd(), 'node_modules', '.bin', 'wrangler');
  if (fs.existsSync(local)) return [local];
  return ['npx', '--no-install', 'wrangler'];
}

function runWrangler(args, env = process.env) {
  const cmd = resolveWranglerCmd();
  // Discard stdout at OS level — wrangler d1 export may print a presigned URL.
  return spawnSync(cmd[0], [...cmd.slice(1), ...args], {
    encoding: 'utf8',
    env,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
}

export function exportProductionSql({ databaseName = PROD_NAME, outputPath, env = process.env }) {
  const result = runWrangler(
    ['d1', 'export', databaseName, '--remote', '--output', outputPath],
    env,
  );
  if (result.status !== 0) {
    const err = (result.stderr || '').split('\n').slice(0, 5).join('\n');
    throw new Error(`Production export failed (exit ${result.status}): ${err}`);
  }
  if (!fs.existsSync(outputPath)) {
    throw new Error('Production export did not create output file');
  }
  return { bytes: fs.statSync(outputPath).size };
}

export function applyDevSqlFile({
  databaseName = DEV_NAME,
  sqlPath,
  env = process.env,
  usePreviewEnv = true,
}) {
  const args = ['d1', 'execute', databaseName, '--remote', '--yes', '--file', sqlPath];
  if (usePreviewEnv) args.push('--env', 'preview');
  const result = runWrangler(args, env);
  if (result.status !== 0) {
    const err = (result.stderr || '').split('\n').slice(0, 5).join('\n');
    throw new Error(`Dev SQL apply failed (exit ${result.status}): ${err}`);
  }
  return { ok: true };
}

/**
 * Core refresh pipeline. dryRun=true stops after writing sanitized SQL locally
 * and never touches Dev. Never logs row values.
 */
export function runRefreshPipeline({
  repoRoot = process.cwd(),
  env = process.env,
  dryRun = true,
  confirm,
  confirmDevReset,
  reason,
  allowRemoteDestructive = false,
  actor,
  commitSha,
  exportSqlPath,
  loadSqlPath,
  skipRemoteExport = false,
  fixtureSqlText = null,
}) {
  const startedAt = new Date().toISOString();
  const inputGate = validateManualInputs({
    confirm,
    confirmDevReset,
    reason,
    dryRun,
    allowRemoteDestructive,
  });
  if (!inputGate.ok) {
    return { ok: false, failures: inputGate.failures, evidence: null };
  }

  const wranglerText = fs.readFileSync(path.join(repoRoot, 'wrangler.toml'), 'utf8');
  const identities = validateSourceTargetIdentities(env, wranglerText);
  if (!identities.ok) {
    return { ok: false, failures: identities.failures, evidence: null };
  }

  const manifest = loadManifest(repoRoot);
  const schemaCoverage = assertSchemaCovered(manifest, manifest.schema_fingerprint);
  if (!schemaCoverage.ok) {
    return { ok: false, failures: schemaCoverage.failures, evidence: null };
  }

  const gate = evaluateRefreshGate(manifest);
  if (!gate.ok) {
    return { ok: false, failures: gate.failures, evidence: null };
  }

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'd1-3359-'));
  const ownsTmp = !exportSqlPath && !loadSqlPath;
  const exportPath = exportSqlPath || path.join(tmpRoot, 'prod-export.sql');
  const sanitizedPath = loadSqlPath || path.join(tmpRoot, 'dev-load-sanitized.sql');
  let cleanupTmp = ownsTmp;

  try {
    let sqlText = fixtureSqlText;
    if (!sqlText) {
      if (skipRemoteExport) {
        return { ok: false, failures: ['skipRemoteExport requires fixtureSqlText'], evidence: null };
      }
      exportProductionSql({ databaseName: identities.source.name, outputPath: exportPath, env });
      sqlText = fs.readFileSync(exportPath, 'utf8');
    }

    const parsed = parseInsertDump(sqlText, manifest.schema_fingerprint);
    if (!parsed.ok) {
      return { ok: false, failures: parsed.failures, evidence: null };
    }
    if (countParsedRows(parsed.dataset) === 0) {
      return {
        ok: false,
        failures: ['Fail-closed: export produced zero parsable INSERT rows; refusing Dev DELETE/load'],
        evidence: null,
      };
    }

    // Ensure every fingerprint table key exists for DELETE generation even if empty.
    for (const table of Object.keys(manifest.schema_fingerprint)) {
      if (!parsed.dataset[table]) parsed.dataset[table] = [];
    }

    const sanitized = sanitizeDataset(manifest, parsed.dataset);
    if (!sanitized.ok) {
      return { ok: false, failures: sanitized.failures, evidence: null };
    }

    const loadSql = buildDevLoadSql(sanitized.tables, manifest.schema_fingerprint);
    fs.writeFileSync(sanitizedPath, loadSql, 'utf8');

    if (!dryRun) {
      applyDevSqlFile({
        databaseName: identities.target.name,
        sqlPath: sanitizedPath,
        env,
        usePreviewEnv: true,
      });
    }

    const finishedAt = new Date().toISOString();
    const evidence = buildEvidenceArtifact({
      actor,
      commitSha,
      reason,
      dryRun,
      source: identities.source,
      target: identities.target,
      gate,
      schemaCoverage,
      summary: sanitized.summary,
      status: dryRun ? 'dry_run_ok' : 'remote_dev_refresh_ok',
      startedAt,
      finishedAt,
    });

    cleanupTmp = ownsTmp;
    return {
      ok: true,
      failures: [],
      evidence,
      sanitizedPath: ownsTmp ? null : sanitizedPath,
      exportPath: fixtureSqlText || ownsTmp ? null : exportPath,
      tmpRoot: ownsTmp ? null : tmpRoot,
    };
  } finally {
    if (cleanupTmp) {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        // ignore cleanup errors
      }
    }
  }
}

function main() {
  const dryRun = process.env.D1_REFRESH_DRY_RUN !== 'false';
  const result = runRefreshPipeline({
    dryRun,
    confirm: process.env.D1_REFRESH_CONFIRM || '',
    confirmDevReset: process.env.D1_REFRESH_CONFIRM_DEV_RESET || '',
    reason: process.env.D1_REFRESH_REASON || '',
    allowRemoteDestructive: process.env.D1_REFRESH_ALLOW_REMOTE === 'true',
    actor: process.env.GITHUB_ACTOR || '',
    commitSha: process.env.GITHUB_SHA || '',
  });

  const evidencePath = path.resolve('d1-prod-dev-refresh-3359-result.json');
  if (result.evidence) {
    fs.writeFileSync(evidencePath, JSON.stringify(result.evidence, null, 2) + '\n');
  }
  // Privacy-safe console output only
  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        failures: result.failures,
        evidencePath: result.evidence ? evidencePath : null,
        status: result.evidence?.status || 'failed',
      },
      null,
      2,
    ),
  );
  process.exit(result.ok ? 0 : 1);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
