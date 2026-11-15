#!/usr/bin/env node
/**
 * #5218: runs the edition planner over a date window and writes the rows into `edition_plan`.
 * DRY RUN BY DEFAULT: it reads the story pool, prints counts and a sample, and writes nothing.
 * The write needs --apply, a link to the Go comment on issue 5218, and, for Production, extra guards
 * (see applyGuardFailures). The statement is idempotent: it inserts a row or refreshes one that is still
 * 'planned'; a queued, posted, failed or skipped row is left alone and the migration refuses changes to a posted row.
 *
 * Usage (Node 22):
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node --experimental-strip-types scripts/ops/edition-plan-write.mjs \
 *     [--database lgfc_lite|lgfc-litedev] [--local|--remote] [--start 2027-01-01] [--end 2027-12-31] \
 *     [--plan-version <name>] [--out edition-plan-dry-run.md] \
 *     [--apply --confirm-go https://github.com/wdhunter465/next-starter-template/issues/5218#issuecomment-<id>] [--allow-shortfall]
 */
import fs from 'node:fs';
import path from 'node:path';
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

import { makeWranglerD1 } from '../ci/wrangler-d1-adapter.mjs';
import { assertSelectOnly } from './archive-report-lib.mjs';
import {
  POOL_SQL,
  applyGuardFailures,
  daysInWindow,
  dryRunReport,
  parseArgs,
  rowsToPool,
} from './edition-plan-write-lib.mjs';

async function loadPlanner() {
  register(pathToFileURL(path.resolve(path.dirname(new URL(import.meta.url).pathname), 'ts-extensionless-hook.mjs')).href);
  const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../../functions/_lib');
  const planner = await import(pathToFileURL(path.join(root, 'social-edition-planner.ts')).href);
  const rowsLib = await import(pathToFileURL(path.join(root, 'edition-plan-rows.ts')).href);
  return { planEditions: planner.planEditions, planToRows: rowsLib.planToRows, bindValues: rowsLib.bindValues, sql: rowsLib.EDITION_PLAN_UPSERT_SQL };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { planEditions, planToRows, bindValues, sql } = await loadPlanner();
  const db = makeWranglerD1({ database: options.database, target: options.target, cwd: process.cwd() });

  const poolRows = (await db.prepare(assertSelectOnly(POOL_SQL)).all()).results ?? [];
  const pool = rowsToPool(poolRows);
  const plan = planEditions({ pool, startDate: options.start, endDate: options.end });
  const rows = planToRows(plan, options.planVersion);

  const report = dryRunReport({
    plan,
    rows,
    poolSize: pool.length,
    start: options.start,
    end: options.end,
    planVersion: options.planVersion,
    database: options.database,
  });
  fs.writeFileSync(options.out, `${report}\n`);
  console.log(report);

  if (!options.apply) return;

  const failures = applyGuardFailures({
    apply: true,
    goUrl: options.goUrl,
    database: options.database,
    env: process.env,
    poolSize: pool.length,
    days: daysInWindow(options.start, options.end),
    allowShortfall: options.allowShortfall,
  });
  if (failures.length) {
    console.error(`Refusing to write:\n- ${failures.join('\n- ')}`);
    process.exit(2);
  }
  for (const row of rows) await db.prepare(sql).bind(...bindValues(row)).run();
  console.log(`Wrote ${rows.length} rows to ${options.database} (plan version ${options.planVersion}).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
