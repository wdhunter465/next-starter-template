#!/usr/bin/env node
// Reconciles docs/reference/platform/lgfc-asset-register.md against assets the
// repository itself declares (#4539). Reads names only; never reads secret values.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { appendOpsStepSummary, escalateOpsRuntimeFailure } from '../ci/ops_runtime_escalation.mjs';

export const REGISTER_PATH = 'docs/reference/platform/lgfc-asset-register.md';
export const DEFAULT_STALE_DAYS = 90;
export const ESCALATION_TITLE = 'OPS — Asset register reconciliation — drift detected';

const TABLE_MARKERS = ['<!-- asset-register:table:start -->', '<!-- asset-register:table:end -->'];
const SECRETS_MARKERS = ['<!-- asset-register:secrets:start -->', '<!-- asset-register:secrets:end -->'];

function splitRow(line) {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

export function parseMarkedTable(markdown, [start, end]) {
  const from = markdown.indexOf(start);
  const to = markdown.indexOf(end);
  if (from === -1 || to === -1 || to < from) return null;
  const lines = markdown.slice(from + start.length, to).split(/\r?\n/).filter((line) => line.trim().startsWith('|'));
  if (lines.length < 2) return [];
  const headers = splitRow(lines[0]);
  return lines.slice(2).map((line) => {
    const cells = splitRow(line);
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
  });
}

export function parseRegister(markdown) {
  return {
    assets: parseMarkedTable(markdown, TABLE_MARKERS),
    secrets: parseMarkedTable(markdown, SECRETS_MARKERS),
  };
}

export function discoverWorkflowSecretNames(workflowTexts = []) {
  const names = new Set();
  for (const text of workflowTexts) {
    for (const match of String(text).matchAll(/secrets\.([A-Z][A-Z0-9_]*)/g)) names.add(match[1]);
  }
  return names;
}

export function discoverEnvExampleNames(text = '') {
  const names = new Set();
  for (const match of String(text).matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) names.add(match[1]);
  return names;
}

export function discoverWranglerD1Names(text = '') {
  const names = new Set();
  for (const match of String(text).matchAll(/^\s*database_name\s*=\s*"([^"]+)"/gm)) names.add(match[1]);
  return names;
}

function isBlank(value) {
  return !value || value === '—' || value === '-';
}

function daysBetween(isoDate, today) {
  const then = Date.parse(`${isoDate}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  return Math.floor((today.getTime() - then) / 86_400_000);
}

export function reconcile({
  assets,
  secrets,
  workflowSecretNames = new Set(),
  envExampleNames = new Set(),
  wranglerD1Names = new Set(),
  today = new Date(),
  staleDays = DEFAULT_STALE_DAYS,
} = {}) {
  const drift = [];
  const info = [];

  if (!assets) {
    drift.push({ code: 'register_table_missing', message: 'Asset table markers not found in the register.' });
    return { drift, info };
  }
  if (!secrets) {
    drift.push({ code: 'secret_catalog_missing', message: 'Secret-name catalog markers not found in the register.' });
  }

  const assetIds = new Set(assets.map((row) => row.asset_id));

  for (const row of assets) {
    const provisional = isBlank(row.business_owner) || isBlank(row.technical_owner) || isBlank(row.last_reconciled);
    if (provisional) {
      info.push({ code: 'provisional_row', asset: row.asset_id, message: `${row.asset_id} is provisional.` });
      continue;
    }
    const age = daysBetween(row.last_reconciled, today);
    if (age === null) {
      drift.push({ code: 'invalid_date', asset: row.asset_id, message: `${row.asset_id} has an unreadable last_reconciled value "${row.last_reconciled}".` });
    } else if (age > staleDays) {
      drift.push({ code: 'stale_row', asset: row.asset_id, message: `${row.asset_id} was last reconciled ${age} days ago (limit ${staleDays}).` });
    }
  }

  const catalogNames = new Set((secrets || []).map((row) => row.name));
  const usedNames = new Set([...workflowSecretNames, ...envExampleNames]);

  for (const name of [...usedNames].sort()) {
    if (!catalogNames.has(name)) {
      drift.push({ code: 'uncatalogued_secret_name', name, message: `${name} is referenced by the repository but is not in the secret-name catalog.` });
    }
  }
  for (const row of secrets || []) {
    if (!usedNames.has(row.name)) {
      drift.push({ code: 'unused_catalog_entry', name: row.name, message: `${row.name} is in the catalog but no workflow or .env.example references it.` });
    }
    if (row.asset_id && !assetIds.has(row.asset_id)) {
      drift.push({ code: 'unknown_asset_ref', name: row.name, message: `${row.name} points to unknown asset_id ${row.asset_id}.` });
    }
  }

  for (const dbName of [...wranglerD1Names].sort()) {
    const covered = assets.some((row) => row.asset_id === `cf:d1:${dbName}`);
    if (!covered) {
      drift.push({ code: 'missing_d1_asset', name: dbName, message: `D1 database ${dbName} is declared in wrangler.toml but has no cf:d1:${dbName} row.` });
    }
  }

  return { drift, info };
}

export function renderReport({ drift, info }) {
  const lines = ['## Asset register reconciliation', '', `- Drift findings: ${drift.length}`, `- Provisional rows: ${info.length}`];
  if (drift.length) {
    lines.push('', '### Drift');
    for (const item of drift) lines.push(`- \`${item.code}\`: ${item.message}`);
  }
  if (info.length) {
    lines.push('', '### Provisional (not drift)');
    for (const item of info) lines.push(`- ${item.message}`);
  }
  return lines.join('\n');
}

export function collectFromRepo(root = process.cwd()) {
  const read = (relative) => {
    const full = path.join(root, relative);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  };
  const workflowDir = path.join(root, '.github/workflows');
  const workflowTexts = fs.existsSync(workflowDir)
    ? fs.readdirSync(workflowDir).filter((file) => /\.ya?ml$/.test(file)).map((file) => fs.readFileSync(path.join(workflowDir, file), 'utf8'))
    : [];
  const registerText = read(REGISTER_PATH);
  const { assets, secrets } = registerText ? parseRegister(registerText) : { assets: null, secrets: null };
  return {
    assets,
    secrets,
    workflowSecretNames: discoverWorkflowSecretNames(workflowTexts),
    envExampleNames: discoverEnvExampleNames(read('.env.example')),
    wranglerD1Names: discoverWranglerD1Names(read('wrangler.toml')),
  };
}

async function main() {
  const staleDays = Number(process.env.ASSET_REGISTER_STALE_DAYS || DEFAULT_STALE_DAYS);
  const result = reconcile({ ...collectFromRepo(), staleDays });
  const report = renderReport(result);
  console.log(report);
  appendOpsStepSummary(report);

  if (result.drift.length && process.argv.includes('--escalate')) {
    const outcome = await escalateOpsRuntimeFailure({
      workflowName: 'OPS — Asset register reconciliation',
      title: ESCALATION_TITLE,
      runUrl: process.env.OPS_ESCALATION_RUN_URL || '',
      details: report,
      nextSteps: [
        `Update ${REGISTER_PATH} with live evidence, or remove the stale reference from the repository.`,
        'Re-run the workflow and close this Issue once it reports zero drift.',
      ],
      labels: ['ops-runtime-finding', 'team:operations'],
    });
    console.log(JSON.stringify(outcome));
  }
  return result.drift.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    console.error(error);
    process.exit(2);
  });
}
