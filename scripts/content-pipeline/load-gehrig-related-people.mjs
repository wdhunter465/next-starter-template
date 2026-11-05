#!/usr/bin/env node
/**
 * #5087: loads the players of Gehrig's era (1923 to 1939) into gehrig_related_people and
 * gehrig_related_person_seasons from Retrosheet's season roster files.
 *
 * Product Authority direction (2026-11-05): the reference list of people related to Gehrig's story
 * is derived, not hand-made. This is the players slice; non-players come from the collected stories
 * in a later slice. Writing to Production D1 needs Product Authority's Go on #5087.
 *
 * Per run: for each season, download https://www.retrosheet.org/events/<year>eve.zip (about 1 MB,
 * requests spaced), read the <TEAM><year>.ROS files, group players, and either print a summary
 * (default, nothing written), write the SQL to a file, or apply it with wrangler.
 *
 * Usage:
 *   node scripts/content-pipeline/load-gehrig-related-people.mjs [--from 1923] [--to 1939]
 *     [--print]                      summary only (default)
 *     [--sql-out people.sql]         also write the SQL statements to a file
 *     [--apply --remote|--local]     apply with wrangler d1 execute (database lgfc_lite)
 *
 * The information used here was obtained free of charge from and is copyrighted by Retrosheet.
 * Interested parties may contact Retrosheet at "www.retrosheet.org".
 */

import { mkdtempSync, rmSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  FIRST_SEASON,
  LAST_SEASON,
  RETROSHEET_NOTICE,
  buildUpsertStatements,
  groupPeople,
  parseRosterFile,
} from './gehrig-related-people-lib.mjs';

const USER_AGENT = 'LGFC-Related-People-Loader/1.0 (lougehrigfanclub.com; contact via site)';
const REQUEST_GAP_MS = 2000;
const DATABASE = 'lgfc_lite';

export function parseArgs(argv) {
  const options = { from: FIRST_SEASON, to: LAST_SEASON, apply: false, target: null, sqlOut: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--from') options.from = Number(argv[++i]);
    else if (arg === '--to') options.to = Number(argv[++i]);
    else if (arg === '--sql-out') options.sqlOut = argv[++i];
    else if (arg === '--apply') options.apply = true;
    else if (arg === '--remote') options.target = 'remote';
    else if (arg === '--local') options.target = 'local';
    else if (arg === '--print') options.apply = false;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!Number.isInteger(options.from) || !Number.isInteger(options.to) || options.from > options.to) {
    throw new Error('--from and --to must be years with from <= to.');
  }
  if (options.from < FIRST_SEASON || options.to > LAST_SEASON) {
    throw new Error(`Seasons must be between ${FIRST_SEASON} and ${LAST_SEASON}.`);
  }
  if (options.apply && !options.target) throw new Error('--apply needs --remote or --local.');
  return options;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${command} failed (exit ${result.status})`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const work = mkdtempSync(path.join(os.tmpdir(), 'lgfc-retrosheet-'));
  const rows = [];
  try {
    for (let season = options.from; season <= options.to; season += 1) {
      const zipPath = path.join(work, `${season}eve.zip`);
      const dir = path.join(work, String(season));
      run('curl', ['-sS', '-L', '--fail', '-A', USER_AGENT, '-o', zipPath, `https://www.retrosheet.org/events/${season}eve.zip`]);
      run('unzip', ['-o', '-q', zipPath, '*.ROS', '-d', dir]);
      const files = readdirSync(dir).filter((name) => name.toUpperCase().endsWith('.ROS'));
      if (files.length === 0) throw new Error(`No roster files found for ${season}; Retrosheet may have changed the zip.`);
      for (const file of files) rows.push(...parseRosterFile(readFileSync(path.join(dir, file), 'latin1'), season));
      console.log(`${season}: ${files.length} roster files`);
      await sleep(REQUEST_GAP_MS);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  const people = groupPeople(rows);
  const statements = buildUpsertStatements(people);
  const byRelation = {};
  for (const person of people) byRelation[person.relation] = (byRelation[person.relation] ?? 0) + 1;
  console.log(`\n${people.length} players, ${statements.length} statements. Strongest relation: ${JSON.stringify(byRelation)}`);
  console.log(RETROSHEET_NOTICE);

  if (options.sqlOut) writeFileSync(options.sqlOut, `${statements.join('\n')}\n`);
  if (!options.apply) {
    console.log('Summary only; nothing written. Use --apply --remote after Product Authority gives a Go on #5087.');
    return;
  }
  const sqlFile = path.join(os.tmpdir(), `lgfc-related-people-${process.pid}.sql`);
  writeFileSync(sqlFile, `${statements.join('\n')}\n`);
  try {
    const args = ['wrangler', 'd1', 'execute', DATABASE, options.target === 'local' ? '--local' : '--remote', '--file', sqlFile];
    run('npx', args);
  } finally {
    rmSync(sqlFile, { force: true });
  }
  console.log('Applied.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
