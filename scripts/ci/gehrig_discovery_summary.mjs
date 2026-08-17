#!/usr/bin/env node
/**
 * Writes a human-readable GitHub Actions step summary for a
 * gehrig-content-discovery.yml run: what was discovered and each source's
 * search-run outcome. Never records a rights conclusion -- that stays a
 * separate, human-only step per #3551.
 */

import fs from 'node:fs';
import path from 'node:path';

const CANDIDATES_FILE = 'data/research/lou-gehrig-content-candidates-external-discovery.json';
const SEARCH_RUNS_FILE = 'data/research/lou-gehrig-content-candidates-external-discovery.search-runs.json';

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
        `| ${escapeMarkdownTableCell(c.candidate_id)} | ${escapeMarkdownTableCell(c.source_name)} | ${escapeMarkdownTableCell(c.title)} | ${escapeMarkdownTableCell(c.source_url || '(none)')} |`,
    )
    .join('\n');
  return `| Candidate ID | Source | Title | Source URL |\n| --- | --- | --- | --- |\n${rows}\n`;
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

function main() {
  const repoRoot = process.cwd();
  const candidatesData = readJsonIfExists(path.join(repoRoot, CANDIDATES_FILE));
  const searchRunsData = readJsonIfExists(path.join(repoRoot, SEARCH_RUNS_FILE));

  const candidates = candidatesData?.candidates ?? [];
  const searchRuns = searchRunsData?.search_runs ?? [];

  const markdown = [
    '## Gehrig Content Discovery (#3551 / #3552)',
    '',
    `Discovered **${candidates.length}** candidate(s) across ${searchRuns.length} source run(s). Metadata only -- no rights conclusion recorded, nothing published.`,
    '',
    '### Search runs',
    formatSearchRunsTable(searchRuns),
    '### Candidates',
    formatCandidatesTable(candidates),
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

main();
