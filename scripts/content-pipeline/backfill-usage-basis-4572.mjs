#!/usr/bin/env node
/**
 * #4572 (child of #4523): derive rights_evidence.usage_basis for rows written before migration
 * 0084, from each row's existing evidence_type, conclusion and usage_decision.
 *
 * --propose  read-only: lists every row with its proposed usage_basis and the reason.
 * --apply    updates only usage_basis (and fee_required for fee rows) on rows still at the
 *            0084 defaults. Never touches usage_decision or final_status. Stops, writing
 *            nothing, if any fee row is not already usage_decision 'deny'.
 *
 * Both modes use the one classification below, so the applied values are the proposed ones.
 * Rows that cannot be classified stay 'unknown'. Safe to re-run; no deletes.
 *
 * Usage:
 *   node scripts/content-pipeline/backfill-usage-basis-4572.mjs --propose|--apply \
 *     --database <lgfc-litedev|lgfc_lite> [--local|--remote] [--dry-run] [--confirm-production]
 *
 * --apply on lgfc_lite also needs --confirm-production: the Production write needs Product's
 * Go on #4572.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../..');

const PRODUCTION_DATABASE = 'lgfc_lite';

// Same wording as FEE_TERMS_PATTERN in functions/_lib/content-pipeline-usage-basis.ts (#4568).
const FEE_PHRASES = [
  'license fee', 'licence fee', 'licensing fee', 'licencing fee', 'usage fee', 'reproduction fee',
  'permission fee', 'fee required', 'fee is required', 'fees required', 'fees are required',
  'for a fee', 'purchase a license', 'purchase a licence', 'purchase license', 'purchase licence',
  'buy a license', 'buy a licence', 'payment required', 'payment is required', 'rights-managed',
  'rights managed', 'royalty due', 'royalty is due', 'royalty required', 'royalty is required',
  'royalties due', 'royalties are due', 'royalties required', 'royalties are required',
];

const IS_FEE = `(${FEE_PHRASES.map((phrase) => `lower(coalesce(re.evidence_text, '')) LIKE '%${phrase}%'`).join(
  '\n    OR ',
)})`;

const ORIGIN_STATEMENT_TYPES = "('openverse_license', 'commons_license', 'loc_statement', 'dpla_rights_statement')";
const DIRECT_GRANT_TYPES = "('cmg_grant', 'donor_agreement')";

const PROPOSED_BASIS = `CASE
    WHEN ${IS_FEE} THEN 'fee_required'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'public_domain_confirmed' THEN 'free_use'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'permission_granted'
      AND re.evidence_type IN ${ORIGIN_STATEMENT_TYPES} THEN 'free_use_credit'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'permission_granted'
      AND re.evidence_type IN ${DIRECT_GRANT_TYPES} THEN 'free_use_permission'
    ELSE 'unknown'
  END`;

const REASON = `CASE
    WHEN ${IS_FEE} THEN 'evidence text states a fee'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'public_domain_confirmed'
      THEN 'permitted, public domain confirmed'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'permission_granted'
      AND re.evidence_type IN ${ORIGIN_STATEMENT_TYPES}
      THEN 'permitted under the origin''s licence or rights statement (credit required)'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'permission_granted'
      AND re.evidence_type IN ${DIRECT_GRANT_TYPES} THEN 'permitted by a direct grant'
    WHEN re.usage_decision = 'permit' AND re.conclusion = 'lgfc_member_owned_item_photo'
      THEN 'member-owned item photo: not an origin basis, left for Product'
    WHEN re.usage_decision = 'permit' THEN 'permitted, but the evidence type does not show the basis'
    WHEN re.usage_decision = 'deny' THEN 'denied without a stated fee'
    ELSE 'not decided (hold)'
  END`;

const PENDING_ROW = "re.usage_basis = 'unknown' AND re.fee_required = 0";

export const PROPOSAL_SQL = `SELECT re.id, re.content_item_id, re.evidence_type, re.conclusion, re.usage_decision,
  re.usage_basis AS current_usage_basis,
  ${PROPOSED_BASIS} AS proposed_usage_basis,
  CASE WHEN ${IS_FEE} THEN 1 ELSE 0 END AS proposed_fee_required,
  ${REASON} AS reason,
  CASE WHEN ${IS_FEE} AND re.usage_decision <> 'deny' THEN 1 ELSE 0 END AS stop_fee_not_deny
FROM rights_evidence re
ORDER BY re.id;`;

export const FEE_NOT_DENY_SQL = `SELECT re.id, re.content_item_id, re.evidence_type, re.usage_decision
FROM rights_evidence re
WHERE ${PENDING_ROW} AND ${IS_FEE} AND re.usage_decision <> 'deny'
ORDER BY re.id;`;

export const BACKFILL_SQL = `UPDATE rights_evidence AS re
SET usage_basis = ${PROPOSED_BASIS},
    fee_required = CASE WHEN ${IS_FEE} THEN 1 ELSE 0 END
WHERE ${PENDING_ROW}
  AND ${PROPOSED_BASIS} <> 'unknown';`;

function parseArgs(argv) {
  const options = { mode: null, database: null, target: 'remote', dryRun: false, confirmProduction: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--propose' || arg === '--apply') {
      options.mode = arg.slice(2);
    } else if (arg === '--database') {
      options.database = argv[index + 1];
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--confirm-production') {
      options.confirmProduction = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.mode) throw new Error('--propose or --apply is required');
  if (!options.database || options.database.startsWith('--')) throw new Error('--database is required');
  if (options.mode === 'apply' && options.database === PRODUCTION_DATABASE && !options.confirmProduction) {
    throw new Error('--apply on lgfc_lite needs --confirm-production (Product Go on #4572)');
  }
  return options;
}

function wranglerArgs(options) {
  const args = ['wrangler', 'd1', 'execute', options.database];
  if (options.database === 'lgfc-litedev') args.push('--env', 'preview');
  args.push(options.target === 'local' ? '--local' : '--remote');
  return args;
}

function query(options, sql) {
  const output = execFileSync('npx', [...wranglerArgs(options), '--json', '--command', sql], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: process.env,
  });
  return JSON.parse(output)[0]?.results ?? [];
}

function executeFile(options, sql) {
  const tempFile = path.join(os.tmpdir(), `lgfc-usage-basis-backfill-${process.pid}-${Date.now()}.sql`);
  try {
    fs.writeFileSync(tempFile, sql, 'utf8');
    execFileSync('npx', [...wranglerArgs(options), '--file', tempFile], { cwd: repoRoot, stdio: 'inherit', env: process.env });
  } finally {
    fs.rmSync(tempFile, { force: true });
  }
}

export function proposalTable(rows) {
  const header = [
    '| id | content item | evidence type | conclusion | decision | current | proposed | fee | reason |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];
  const lines = rows.map(
    (row) =>
      `| ${row.id} | ${row.content_item_id} | ${row.evidence_type} | ${row.conclusion ?? '(none)'} | ${row.usage_decision} | ${row.current_usage_basis} | ${row.proposed_usage_basis} | ${row.proposed_fee_required} | ${row.reason}${row.stop_fee_not_deny ? ' **STOP: not deny**' : ''} |`,
  );
  return [...header, ...lines].join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.dryRun) {
    console.log(options.mode === 'propose' ? PROPOSAL_SQL : `${FEE_NOT_DENY_SQL}\n\n${BACKFILL_SQL}`);
    return;
  }

  if (options.mode === 'propose') {
    const rows = query(options, PROPOSAL_SQL);
    console.log(proposalTable(rows));
    console.log(`\n${rows.length} row(s).`);
    return;
  }

  const blocked = query(options, FEE_NOT_DENY_SQL);
  if (blocked.length > 0) {
    console.error('Stopped: fee rows that are not usage_decision deny. Nothing was written.');
    for (const row of blocked) console.error(`  - rights_evidence ${row.id} (content item ${row.content_item_id}): ${row.usage_decision}`);
    process.exit(1);
  }
  executeFile(options, BACKFILL_SQL);
  console.log('usage_basis backfill applied.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
