#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRENT_REPOSITORY = 'wdhunter465/next-starter-template';
const [currentOwner] = CURRENT_REPOSITORY.split('/');
const outDir = process.env.PMO_DASHBOARD_OUT_DIR || 'site/pmo-dashboard';

const AGENT_DISPLAY = {
  claude: 'Claude',
  cursor: 'Cursor',
  grok: 'Grok',
  jules: 'Jules',
  chatgpt: 'ChatGPT',
  chat: 'ChatGPT',
  work: 'Work',
  codex: 'Codex',
  copilot: 'Copilot',
  cloudflareai: 'Cloudflare AI'
};

function resolveRepositoryIdentity() {
  const repository = process.env.GITHUB_REPOSITORY || CURRENT_REPOSITORY;
  const [repositoryOwner] = repository.split('/');
  const owner = process.env.GITHUB_REPOSITORY_OWNER || repositoryOwner || currentOwner;
  return { repository, owner };
}

function runCoreBuilder(repositoryIdentity) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(__dirname, 'build-dashboard.mjs')], {
      env: {
        ...process.env,
        GITHUB_REPOSITORY_OWNER: repositoryIdentity.owner,
        GITHUB_REPOSITORY: repositoryIdentity.repository
      },
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`PMO dashboard core builder failed (${signal || `exit ${code}`})`));
    });
  });
}

function labelName(label) {
  return typeof label === 'string' ? label : label?.name;
}

function normalizeAgentDisplay(agentKey) {
  const key = String(agentKey || '').trim().toLowerCase();
  if (!key) return null;
  if (AGENT_DISPLAY[key]) return AGENT_DISPLAY[key];
  return key.replace(/(^|[-_])([a-z])/g, (_, sep, ch) => (sep ? ` ${ch.toUpperCase()}` : ch.toUpperCase()));
}

/**
 * Post-build authority pass: enforce agent:* as sole current owner source.
 * Matches build-dashboard.mjs owner() contract so fixture and live paths agree.
 */
function reconcileOwner(row) {
  const names = (row.labels || []).map(labelName).filter((label) => typeof label === 'string');
  const agentLabels = names.filter((label) => /^agent:/i.test(label));
  if (agentLabels.length === 1) {
    const key = agentLabels[0].replace(/^agent:/i, '');
    row.ownerAgent = normalizeAgentDisplay(key) || key;
  } else if (agentLabels.length > 1) {
    row.ownerAgent = `Conflicting agent ownership: ${agentLabels.join(', ')}`;
  } else {
    row.ownerAgent = 'Unassigned';
  }
  for (const child of row.children || []) reconcileOwner(child);
}

async function main() {
  const repositoryIdentity = resolveRepositoryIdentity();
  await runCoreBuilder(repositoryIdentity);

  const dataPath = path.join(outDir, 'dashboard-data.json');
  const data = JSON.parse(await readFile(dataPath, 'utf8'));
  data.repository = repositoryIdentity.repository;

  for (const rows of Object.values(data.views || {})) {
    for (const row of rows || []) reconcileOwner(row);
  }

  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`);
  console.log(`Reconciled PMO dashboard repository and agent:* owner authority for ${data.repository}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
