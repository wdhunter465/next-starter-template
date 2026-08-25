#!/usr/bin/env node
/**
 * #3552 phase 3: one-time backfill of rights_holder / repository_or_collection
 * / evidence_text on rights_evidence rows already written by the pre-fix
 * batch-approval writer (functions/_lib/content-pipeline-batch-rights-approval.ts).
 *
 * All derivation logic lives in
 * functions/_lib/content-pipeline-rights-evidence-backfill.ts (tested) -- this
 * file is just the CLI: parse args, load JSON, build SQL, execute via
 * wrangler, matching record-batch-rights-approval.mjs's own pattern.
 *
 * The generated UPDATE statements are guarded by `WHERE rights_holder IS
 * NULL`, so this is safe to re-run and never overwrites a row a human has
 * since edited.
 *
 * Usage:
 *   node --experimental-strip-types scripts/content-pipeline/backfill-rights-evidence-provenance.mjs \
 *     --candidates <registry.json> --license-notes <license-notes.json> \
 *     [--database lgfc_lite] [--local|--remote] [--dry-run]
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
import { fileURLToPath } from 'node:url';

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

const { buildRightsEvidenceProvenanceBackfillSql } = await import(
  '../../functions/_lib/content-pipeline-rights-evidence-backfill.ts'
);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

function printUsage() {
  console.log(
    'Usage: node --experimental-strip-types scripts/content-pipeline/backfill-rights-evidence-provenance.mjs --candidates <registry.json> --license-notes <license-notes.json> [--database lgfc_lite] [--local|--remote] [--dry-run]',
  );
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
    candidates: null,
    licenseNotes: null,
    database: 'lgfc_lite',
    target: 'local',
    dryRun: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--candidates') {
      options.candidates = readFlagValue(argv, index, '--candidates');
      index += 1;
    } else if (arg === '--license-notes') {
      options.licenseNotes = readFlagValue(argv, index, '--license-notes');
      index += 1;
    } else if (arg === '--database') {
      options.database = readFlagValue(argv, index, '--database');
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.candidates) throw new Error('--candidates is required');
  if (!options.licenseNotes) throw new Error('--license-notes is required');

  return options;
}

function readJson(filePath) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(repoRoot, filePath);
  return JSON.parse(fs.readFileSync(absolutePath, 'utf8'));
}

function executeSqlFile(database, target, sqlFile) {
  const args = ['wrangler', 'd1', 'execute', database];
  if (database === 'lgfc-litedev') {
    args.push('--env', 'preview');
  }
  args.push(target === 'local' ? '--local' : '--remote');
  args.push('--file', sqlFile);

  execFileSync('npx', args, { cwd: repoRoot, stdio: 'inherit', env: process.env });
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const registry = readJson(options.candidates);
  const licenseNotesData = readJson(options.licenseNotes);
  const licenseNotesByCandidateId = new Map(
    (licenseNotesData.license_notes ?? []).map((note) => [note.candidate_id, note]),
  );

  const { rows, sqlBatch } = buildRightsEvidenceProvenanceBackfillSql(
    registry.candidates,
    licenseNotesByCandidateId,
  );

  console.log(`Prepared ${rows.length} rights_evidence provenance backfill UPDATE(s):`);
  for (const row of rows) {
    console.log(`  - ${row.candidateId}: rights_holder=${row.rightsHolder ?? 'NULL'}`);
  }

  if (options.dryRun) {
    console.log('\nDry run -- no SQL executed.\n');
    console.log(sqlBatch);
    return;
  }

  const tempFile = path.join(os.tmpdir(), `lgfc-rights-evidence-backfill-${process.pid}-${Date.now()}.sql`);

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

  console.log('Rights evidence provenance backfill recorded.');
}

main();
