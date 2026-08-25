#!/usr/bin/env node
/**
 * Import seed/fixture candidate registry JSON into D1 content pipeline tables.
 *
 * Usage:
 *   node --experimental-strip-types scripts/content-pipeline/import-seed-candidates.mjs \
 *     --file data/research/lou-gehrig-content-candidates.json \
 *     [--database lgfc_lite] [--local|--remote] [--dry-run]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

// Node strip-types cannot resolve extensionless relative imports inside .ts
// files. Register a resolver so this CLI can load candidate-import.ts without
// adding .ts specifiers that tsc (moduleResolution=bundler) rejects.
register(
  `data:text/javascript,${encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('.') && !/\\.(?:js|mjs|cjs|json|ts|tsx)$/i.test(specifier)) {
    try {
      return await nextResolve(specifier + '.ts', context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}
`)}`,
  import.meta.url,
);

const {
  buildCandidateImportPlan,
  buildImportSqlBatch,
  validateCandidateRegistry,
} = await import('../../functions/_lib/content-pipeline-candidate-import.ts');

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');
const MIN_NODE_MAJOR = 22;
const MIN_NODE_MINOR_FOR_STRIP_TYPES = 6;

function printUsage() {
  console.log(`Usage: node --experimental-strip-types ${path.relative(process.cwd(), fileURLToPath(import.meta.url))} \\
  --file <registry.json> [--database lgfc_lite] [--local|--remote] [--dry-run]`);
}

function assertNodeRuntime() {
  const [majorRaw, minorRaw] = process.versions.node.split('.');
  const major = Number(majorRaw);
  const minor = Number(minorRaw ?? 0);

  if (!Number.isFinite(major) || major !== MIN_NODE_MAJOR || minor < MIN_NODE_MINOR_FOR_STRIP_TYPES) {
    console.error(
      `Node ${process.versions.node} is unsupported for this script. ` +
        `Use Node ${MIN_NODE_MAJOR}.${MIN_NODE_MINOR_FOR_STRIP_TYPES}+ with --experimental-strip-types ` +
        `(see package.json engines).`,
    );
    process.exit(1);
  }
}

function readFlagValue(argv, index, flagName) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`Missing value for ${flagName}`);
  }
  return value;
}

function parseArgs(argv) {
  const options = {
    file: 'data/research/lou-gehrig-content-candidates.json',
    database: 'lgfc_lite',
    target: 'local',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--file') {
      options.file = readFlagValue(argv, index, '--file');
      index += 1;
      continue;
    }
    if (arg === '--database') {
      options.database = readFlagValue(argv, index, '--database');
      index += 1;
      continue;
    }
    if (arg === '--local') {
      options.target = 'local';
      continue;
    }
    if (arg === '--remote') {
      options.target = 'remote';
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return options;
}

function loadRegistry(filePath) {
  if (!filePath) {
    throw new Error('Registry file path is required');
  }

  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw);
}

function executeSqlFile(database, target, sqlFile) {
  const args = ['wrangler', 'd1', 'execute', database];
  if (database === 'lgfc-litedev') {
    args.push('--env', 'preview');
  }
  if (target === 'local') {
    args.push('--local');
  } else {
    args.push('--remote');
  }
  args.push('--file', sqlFile);

  execFileSync('npx', args, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

/**
 * Post-import verification (#3712 phase 1): the content_items INSERT is
 * guarded to skip a candidate whose source_url already belongs to a
 * different row, so a rediscovered photo never creates a duplicate. That
 * means a skipped candidate_id simply never appears in content_items --
 * report which of this batch's candidate_ids that happened to, so a
 * skip is visible rather than silent.
 */
function reportDuplicateSkips(database, target, candidateIds) {
  if (candidateIds.length === 0) return;

  const args = ['wrangler', 'd1', 'execute', database, '--json'];
  if (database === 'lgfc-litedev') {
    args.push('--env', 'preview');
  }
  args.push(target === 'local' ? '--local' : '--remote');
  const idList = candidateIds.map((id) => `'${id.replace(/'/g, "''")}'`).join(', ');
  args.push('--command', `SELECT candidate_id FROM content_items WHERE candidate_id IN (${idList});`);

  let stdout;
  try {
    stdout = execFileSync('npx', args, { cwd: repoRoot, encoding: 'utf8', env: process.env });
  } catch (err) {
    console.warn(`Duplicate-skip verification query failed (non-fatal): ${err.message}`);
    return;
  }

  let present;
  try {
    const parsed = JSON.parse(stdout);
    const results = parsed?.[0]?.results ?? [];
    present = new Set(results.map((row) => row.candidate_id));
  } catch (err) {
    console.warn(`Could not parse duplicate-skip verification output (non-fatal): ${err.message}`);
    return;
  }

  const skipped = candidateIds.filter((id) => !present.has(id));
  if (skipped.length > 0) {
    console.log(
      `\n${skipped.length} candidate(s) skipped as source_url duplicates of an existing row (no new content_items row created):`,
    );
    for (const id of skipped) {
      console.log(`  - ${id}`);
    }
  } else {
    console.log(`\nNo candidates skipped as duplicates -- all ${candidateIds.length} are present in content_items.`);
  }
}

function main() {
  assertNodeRuntime();
  const options = parseArgs(process.argv.slice(2));
  const registry = loadRegistry(options.file);
  const validation = validateCandidateRegistry(registry);

  if (!validation.ok) {
    console.error('Registry validation failed:');
    for (const error of validation.errors) {
      console.error(`  - ${error}`);
    }
    process.exit(1);
  }

  const plan = buildCandidateImportPlan(registry);
  let sqlBatch = buildImportSqlBatch(plan);
  if (options.target === 'remote') {
    // Cloudflare D1 remote execute rejects SQL BEGIN/COMMIT; wrangler already
    // applies the uploaded file atomically and rolls back on failure.
    sqlBatch = sqlBatch.replace(/^\s*BEGIN;\s*/i, '').replace(/\s*COMMIT;\s*$/i, '');
  }
  console.log(
    `Validated ${plan.candidateCount} candidate(s); prepared ${plan.statements.length} SQL statement(s) in one transaction batch.`,
  );

  if (options.dryRun) {
    console.log('Dry run — no SQL executed.');
    for (const statement of plan.statements.slice(0, 5)) {
      console.log(`-- ${statement.description}`);
      console.log(`${statement.sql}\n`);
    }
    if (plan.statements.length > 5) {
      console.log(`... ${plan.statements.length - 5} additional statement(s) omitted in dry-run preview.`);
    }
    return;
  }

  const tempFile = path.join(
    os.tmpdir(),
    `lgfc-content-pipeline-import-${process.pid}-${Date.now()}.sql`,
  );

  try {
    fs.writeFileSync(tempFile, sqlBatch, 'utf8');
    executeSqlFile(options.database, options.target, tempFile);
  } finally {
    try {
      fs.unlinkSync(tempFile);
    } catch {
      // ignore cleanup errors
    }
  }

  console.log('Import complete.');
  reportDuplicateSkips(
    options.database,
    options.target,
    registry.candidates.map((candidate) => candidate.candidate_id),
  );
}

main();
