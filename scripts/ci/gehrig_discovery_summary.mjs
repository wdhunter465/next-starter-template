#!/usr/bin/env node
/**
 * Writes a human-readable GitHub Actions step summary for a
 * gehrig-content-discovery.yml run: what was discovered and each source's
 * search-run outcome. Never records a rights conclusion -- that stays a
 * separate, human-only step per #3551.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CANDIDATES_FILE = 'data/research/lou-gehrig-content-candidates-external-discovery.json';
const SEARCH_RUNS_FILE = 'data/research/lou-gehrig-content-candidates-external-discovery.search-runs.json';
const LICENSE_NOTES_FILE = 'data/research/lou-gehrig-content-candidates-external-discovery.license-notes.json';

function readJsonIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Failed to parse ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

function escapeMarkdownTableCell(value) {
  return String(value ?? '')
    .replace(/\|/g, '\\|')
    .replace(/\r\n|\r|\n/g, ' ');
}

function formatCandidatesTable(candidates) {
  if (!candidates || candidates.length === 0) {
    return '_No candidates discovered._\n';
  }
  const rows = candidates
    .map(
      (c) =>
        `| ${escapeMarkdownTableCell(c.candidate_id)} | ${escapeMarkdownTableCell(c.source_name)} | ${escapeMarkdownTableCell(c.title)} | ${escapeMarkdownTableCell(c.date_or_period || '')} | ${escapeMarkdownTableCell((c.people_tags || []).join(', '))} | ${escapeMarkdownTableCell(c.credit_line || '')} | ${escapeMarkdownTableCell(c.source_url || '(none)')} |`,
    )
    .join('\n');
  return `| Candidate ID | Source | Title | Date/Period | People Tags | Credit Line | Source URL |\n| --- | --- | --- | --- | --- | --- | --- |\n${rows}\n`;
}

function formatCaptionsTable(candidates) {
  const withCaption = (candidates || []).filter((c) => c.summary);
  if (withCaption.length === 0) {
    return '_No candidate captions/summaries for this run._\n';
  }
  const rows = withCaption
    .map((c) => `| ${escapeMarkdownTableCell(c.candidate_id)} | ${escapeMarkdownTableCell(c.summary)} |`)
    .join('\n');
  return `| Candidate ID | Caption / Summary |\n| --- | --- |\n${rows}\n`;
}

function formatSearchRunsTable(searchRuns) {
  if (!searchRuns || searchRuns.length === 0) {
    return '_No search-run records._\n';
  }
  const rows = searchRuns
    .map(
      (r) =>
        `| ${escapeMarkdownTableCell(r.run_uid)} | ${escapeMarkdownTableCell(r.source_domain)} | ${escapeMarkdownTableCell(r.status)} | ${escapeMarkdownTableCell(r.discovered_count)} | ${escapeMarkdownTableCell(r.error_summary || '')} |`,
    )
    .join('\n');
  return `| Run UID | Source | Status | Discovered | Error |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
}

function formatLicenseNotesTable(licenseNotes) {
  if (!licenseNotes || licenseNotes.length === 0) {
    return '_No Wikimedia Commons license notes for this run._\n';
  }
  const rows = licenseNotes
    .map(
      (n) =>
        `| ${escapeMarkdownTableCell(n.candidate_id)} | ${escapeMarkdownTableCell(n.title)} | ${escapeMarkdownTableCell(n.license_short_name || '(none)')} | ${escapeMarkdownTableCell(n.license_url || '')} | ${escapeMarkdownTableCell(n.artist || '')} | ${escapeMarkdownTableCell(n.attribution || '')} |`,
    )
    .join('\n');
  return `| Candidate ID | Title | License | License URL | Artist | Attribution |\n| --- | --- | --- | --- | --- | --- |\n${rows}\n`;
}

const SOURCE_OUTAGE_STATUSES = new Set(['source_error', 'rate_limited']);

export function countConsecutiveFailures(conclusions) {
  let count = 0;
  for (const conclusion of conclusions) {
    if (conclusion === 'failure') count += 1;
    else break;
  }
  return count;
}

export function decideGuard({ haltAt, reenableAt, reenableRequested }) {
  if (reenableRequested) return 'run';
  if (haltAt && (!reenableAt || haltAt > reenableAt)) return 'halted';
  return 'run';
}

// pass: no source stayed down.
// fail: the job fails after import so the outage is visible. Import already ran.
// halt: this is the third consecutive failure. Open one Issue and do not fail.
export function decideOutage({ sourceErrorCount, consecutivePriorFailures }) {
  if (!sourceErrorCount) return 'pass';
  if (consecutivePriorFailures >= 2) return 'halt';
  return 'fail';
}

export function countSourceOutages(searchRuns) {
  return (searchRuns ?? []).filter((run) => SOURCE_OUTAGE_STATUSES.has(run.status)).length;
}

function setOutput(name, value) {
  const line = `${name}=${value}`;
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${line}\n`);
  console.log(line);
}

function githubHeaders() {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${process.env.GH_TOKEN || process.env.GITHUB_TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function githubGet(pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, { headers: githubHeaders() });
  if (!response.ok) {
    throw new Error(`${pathname} -> HTTP ${response.status}`);
  }
  return response.json();
}

function newestArtifactTime(artifacts, name) {
  const matches = (artifacts ?? []).filter((artifact) => artifact.name === name && !artifact.expired);
  if (matches.length === 0) return null;
  return matches.map((artifact) => artifact.created_at).sort().at(-1);
}

export async function evaluateGuard({ repository, currentRunId, reenableRequested, fetchImpl = githubGet }) {
  if (!repository || !(process.env.GH_TOKEN || process.env.GITHUB_TOKEN)) {
    return { mode: 'run', consecutiveFailures: 0 };
  }
  const artifacts = await fetchImpl(`/repos/${repository}/actions/artifacts?per_page=100`);
  const haltAt = newestArtifactTime(artifacts.artifacts, 'gehrig-discovery-halted');
  const reenableAt = newestArtifactTime(artifacts.artifacts, 'gehrig-discovery-reenabled');
  const mode = decideGuard({ haltAt, reenableAt, reenableRequested });
  if (mode === 'halted') return { mode, consecutiveFailures: 0 };
  const runs = await fetchImpl(
    `/repos/${repository}/actions/workflows/gehrig-content-discovery.yml/runs?per_page=20`,
  );
  const conclusions = (runs.workflow_runs ?? [])
    .filter((run) => String(run.id) !== String(currentRunId) && run.status === 'completed')
    .map((run) => run.conclusion);
  return { mode: 'run', consecutiveFailures: countConsecutiveFailures(conclusions) };
}

async function guardMain() {
  const reenableRequested = process.env.REENABLE === 'REENABLE_GEHRIG_DISCOVERY';
  try {
    const result = await evaluateGuard({
      repository: process.env.GITHUB_REPOSITORY,
      currentRunId: process.env.GITHUB_RUN_ID,
      reenableRequested,
    });
    setOutput('mode', result.mode);
    setOutput('consecutive_failures', String(result.consecutiveFailures));
    setOutput('reenable', reenableRequested ? 'true' : 'false');
    if (result.mode === 'halted') {
      console.log('Gehrig Content Discovery is halted after 3 consecutive failures. Re-enable with workflow_dispatch input reenable=REENABLE_GEHRIG_DISCOVERY.');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    setOutput('mode', 'run');
    setOutput('consecutive_failures', '0');
    setOutput('reenable', 'false');
  }
}

async function openHaltIssue() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repository}/issues`, {
    method: 'POST',
    headers: { ...githubHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: 'OPS EXCEPTION: Gehrig Content Discovery halted after 3 consecutive failures',
      labels: ['team:operations', 'ops-exception'],
      body: [
        'Gehrig Content Discovery failed 3 consecutive runs. This job is halted.',
        '',
        'Further scheduled runs pass without collecting or importing until a person re-enables it.',
        'Re-enable: Actions → Gehrig Content Discovery → Run workflow, and set reenable to REENABLE_GEHRIG_DISCOVERY.',
        '',
        `Run: ${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${repository}/actions/runs/${process.env.GITHUB_RUN_ID || ''}`,
        '',
        'There is no shared halt for every GitHub Action. This halt covers only Gehrig Content Discovery (#4588).',
      ].join('\n'),
    }),
  });
  if (!response.ok) {
    throw new Error(`issue create -> HTTP ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function outageMain() {
  const searchRunsData = readJsonIfExists(path.join(process.cwd(), SEARCH_RUNS_FILE));
  const sourceErrorCount = countSourceOutages(searchRunsData?.search_runs);
  const discoveryFailed = process.env.DISCOVERY_OUTCOME === 'failure';
  const effectiveErrors = sourceErrorCount > 0 ? sourceErrorCount : discoveryFailed ? 1 : 0;
  const consecutivePriorFailures = Number(process.env.CONSECUTIVE_PRIOR_FAILURES ?? 0);
  const action = decideOutage({
    sourceErrorCount: effectiveErrors,
    consecutivePriorFailures: Number.isFinite(consecutivePriorFailures) ? consecutivePriorFailures : 0,
  });
  setOutput('action', action);
  if (action === 'pass') return;
  if (action === 'fail') {
    console.error(
      `${effectiveErrors} discovery source(s) stayed down after retries. Other sources were imported. This failed step is the outage signal.`,
    );
    process.exitCode = 1;
    return;
  }
  try {
    const issue = await openHaltIssue();
    fs.mkdirSync('gehrig-discovery-halted', { recursive: true });
    fs.writeFileSync('gehrig-discovery-halted/halted-at.txt', `${new Date().toISOString()}\n`);
    setOutput('halt_check', 'true');
    console.log(`Opened ${issue.html_url}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

function main() {
  const repoRoot = process.cwd();
  const candidatesData = readJsonIfExists(path.join(repoRoot, CANDIDATES_FILE));
  const searchRunsData = readJsonIfExists(path.join(repoRoot, SEARCH_RUNS_FILE));
  const licenseNotesData = readJsonIfExists(path.join(repoRoot, LICENSE_NOTES_FILE));

  const candidates = candidatesData?.candidates ?? [];
  const searchRuns = searchRunsData?.search_runs ?? [];
  const licenseNotes = licenseNotesData?.license_notes ?? [];

  const markdown = [
    '## Gehrig Content Discovery (#3551 / #3552)',
    '',
    `Discovered **${candidates.length}** candidate(s) across ${searchRuns.length} source run(s). Metadata only -- no rights conclusion recorded, nothing published.`,
    countSourceOutages(searchRuns) > 0
      ? `**Source outage:** ${countSourceOutages(searchRuns)} source(s) stayed down after retries. Their search-runs are source_error or rate_limited. Candidates from the other sources are kept and imported. This job fails after import so the outage stays visible.`
      : '',
    '',
    '### Search runs',
    formatSearchRunsTable(searchRuns),
    '### Candidates',
    formatCandidatesTable(candidates),
    '### Captions',
    '_Uploader/source-provided caption text (e.g. Wikimedia\'s ImageDescription), not independently verified -- a description, not a rights statement._',
    '',
    formatCaptionsTable(candidates),
    '### Wikimedia Commons license notes',
    '_Uploader-asserted at time of discovery -- not a verified fact. Mislabeled licenses are a known, recurring problem on Commons. Confirm on the file page itself before recording any rights_evidence conclusion._',
    '',
    formatLicenseNotesTable(licenseNotes),
    '### Next step',
    'Review the candidates above. To record rights evidence and ingest one, use:',
    '- `POST /api/admin/content-pipeline/rights-evidence` (requires reviewer + conclusion_rationale)',
    '- `POST /api/admin/content-pipeline/ingest` (requires a recorded conclusion first)',
    '',
    'Neither step is automated -- both require a human rights determination per #3551.',
    '',
  ].join('\n');

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
  }
  console.log(markdown);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const mode = process.argv[2];
  const pending = mode === '--guard' ? guardMain() : mode === '--outage' ? outageMain() : Promise.resolve(main());
  pending.catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
