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
import { fileURLToPath } from 'node:url';
import {
  buildCandidateImportPlan,
  buildImportSqlBatch,
  validateCandidateRegistry,
} from '../../functions/_lib/content-pipeline-candidate-import.ts';

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
}

main();
