#!/usr/bin/env node
/**
 * #5124: soft delete (or restore) members by id, dry run first.
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=... CLOUDFLARE_ACCOUNT_ID=... \
 *   node scripts/ops/soft-delete-members.mjs --issue 5124 --reason "Test accounts (Product Authority 2026-11-07)" \
 *     --ids 4,5,6 --expect 3 [--restore|--promote] [--allow-admin] [--database lgfc_lite] [--local|--remote] [--apply]
 *
 * Writes only with --apply. The writes match the admin endpoint (#2919); nothing is hard-deleted.
 * Output is by id with a masked address, because the repository and its Actions logs are public.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeWranglerD1 } from '../ci/wrangler-d1-adapter.mjs';
import { buildStatements, describeMember, parseArgs, planRun } from './soft-delete-members-lib.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export async function run(options, db, log = console.log) {
  const placeholders = options.ids.map(() => '?').join(',');
  const rows =
    (await db.prepare(`SELECT id, email, role, created_at, deleted_at FROM members WHERE id IN (${placeholders}) ORDER BY id`).bind(...options.ids).all()).results ?? [];

  const adminRow = await db.prepare("SELECT COUNT(*) AS n FROM members WHERE role = 'admin' AND deleted_at IS NULL").first();
  const { targets, skipped } = planRun(rows, options.ids, { ...options, activeAdminCount: Number(adminRow?.n ?? 0) });
  const verb = options.promote ? 'make admin' : options.restore ? 'restore' : 'soft-delete';
  log(`${targets.length} member(s) selected to ${verb}${options.apply ? '' : ' (dry run, nothing will be written)'}:`);
  for (const row of targets) log(`  ${describeMember(row)}`);
  for (const item of skipped) log(`  skipped #${item.id}: ${item.why}`);

  if (!options.apply) {
    log(`\nDry run. Re-run with apply to ${verb} these, citing #${options.issue}.`);
    return { changed: 0, targets, skipped };
  }

  const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
  const now = String(nowRow?.now ?? new Date().toISOString().slice(0, 19).replace('T', ' '));
  const deletedBy = `ops-workflow #${options.issue}`;
  for (const row of targets) {
    for (const statement of buildStatements(row.email, { now, reason: options.reason, deletedBy, restore: options.restore, promote: options.promote })) {
      await db.prepare(statement.sql).bind(...statement.params).run();
    }
    log(`  done #${row.id}`);
  }

  const after =
    (await db.prepare(`SELECT id, role, deleted_at FROM members WHERE id IN (${placeholders}) ORDER BY id`).bind(...options.ids).all()).results ?? [];
  const stillWrong = (row) => (options.promote ? row.role !== 'admin' : options.restore ? row.deleted_at != null : row.deleted_at == null);
  const wrong = after.filter((row) => stillWrong(row) && targets.some((t) => Number(t.id) === Number(row.id)));
  if (wrong.length) throw new Error(`verification failed for id ${wrong.map((row) => row.id).join(', ')}`);
  log(`\n${targets.length} member(s) ${options.promote ? 'made admin' : options.restore ? 'restored' : 'soft-deleted'}, citing #${options.issue}. Verified.`);
  return { changed: targets.length, targets, skipped };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const db = makeWranglerD1({ database: options.database, target: options.target, cwd: repoRoot });
    await run(options, db);
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
