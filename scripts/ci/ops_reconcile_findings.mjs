import { pathToFileURL } from 'node:url';

import {
  appendOpsStepSummary,
  upsertOpsRuntimeIssue,
} from './ops_runtime_escalation.mjs';

export const OPS_RECONCILE_FINDINGS_MARKER = '<!-- ops-b2-d1-reconcile-findings -->';
export const DEFAULT_FINDINGS_TITLE = 'OPS — B2 D1 deletion reconcile findings';
export const DEFAULT_FINDINGS_LABELS = ['ops-runtime-finding', 'b2-runtime', 'd1-runtime'];

export function buildReconcileFindingsBody({
  workflowName = 'OPS — B2 D1 Daily Sync',
  runUrl = '',
  commitSha = '',
  retiredCount = '0',
  repairedMatchups = '0',
  mediaRetiredCount = '0',
  staleKeySample = '',
  details = '',
} = {}) {
  const sample =
    String(staleKeySample || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);
  const lines = [
    OPS_RECONCILE_FINDINGS_MARKER,
    '',
    '## B2 → D1 deletion reconcile findings',
    '',
    'Actionable findings from the daily soft-retire / active-matchup repair run.',
    'No hard deletes were performed. Historical matchup photo IDs remain intact.',
    '',
    `- Workflow: ${workflowName}`,
    `- Run: ${runUrl || 'unknown'}`,
    `- Commit: ${commitSha || 'unknown'}`,
    `- Soft-retired photo rows: ${retiredCount}`,
    `- Active matchups repaired (votes cleared on pair change): ${repairedMatchups}`,
    `- Soft-retired content_items rows (media_assets missing from B2): ${mediaRetiredCount}`,
  ];

  if (sample.length) {
    lines.push('', '## Stale key sample (up to 20)', ...sample.map((key) => `- \`${key}\``));
  }

  if (details) {
    lines.push('', '## Additional details', details);
  }

  lines.push(
    '',
    '## Required action',
    '- Confirm homepage Weekly Matchup shows two working images (or wait for next public GET probe / repair).',
    '- Optional: purge soft-retired rows later via governed admin cleanup (`PURGE_ELIGIBLE`).',
    '- Close this issue when the finding is acknowledged and no further ops work remains.',
  );

  return lines.join('\n');
}

export async function reportReconcileFindings(options = {}) {
  const token = options.token || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const repository = options.repository || process.env.GITHUB_REPOSITORY;
  if (!token || !repository) {
    throw new Error('GITHUB_TOKEN/GH_TOKEN and GITHUB_REPOSITORY are required.');
  }

  const [owner, repo] = repository.split('/');
  const retiredCount = String(options.retiredCount ?? process.env.OPS_FINDINGS_RETIRED_COUNT ?? '0');
  const repairedMatchups = String(
    options.repairedMatchups ?? process.env.OPS_FINDINGS_REPAIRED_MATCHUPS ?? '0',
  );
  const mediaRetiredCount = String(
    options.mediaRetiredCount ?? process.env.OPS_FINDINGS_MEDIA_RETIRED_COUNT ?? '0',
  );
  const hasFindings =
    options.hasFindings === true ||
    process.env.OPS_FINDINGS_HAS_FINDINGS === 'true' ||
    Number(retiredCount) > 0 ||
    Number(repairedMatchups) > 0 ||
    Number(mediaRetiredCount) > 0;

  if (!hasFindings) {
    return { action: 'skipped', issue: null, reason: 'no_actionable_findings' };
  }

  const title = options.title || process.env.OPS_FINDINGS_TITLE || DEFAULT_FINDINGS_TITLE;
  const body = buildReconcileFindingsBody({
    workflowName: options.workflowName || process.env.OPS_FINDINGS_WORKFLOW || 'OPS — B2 D1 Daily Sync',
    runUrl: options.runUrl || process.env.OPS_FINDINGS_RUN_URL || '',
    commitSha: options.commitSha || process.env.GITHUB_SHA || '',
    retiredCount,
    repairedMatchups,
    mediaRetiredCount,
    staleKeySample: options.staleKeySample || process.env.OPS_FINDINGS_STALE_KEY_SAMPLE || '',
    details: options.details || process.env.OPS_FINDINGS_DETAILS || '',
  });
  const labels =
    options.labels ||
    (process.env.OPS_FINDINGS_LABELS || DEFAULT_FINDINGS_LABELS.join(',')).split(',').filter(Boolean);

  const outcome = await upsertOpsRuntimeIssue({ token, owner, repo, title, body, labels });
  return outcome;
}

async function main() {
  const outcome = await reportReconcileFindings();
  appendOpsStepSummary(
    `### OPS B2/D1 reconcile findings\n- Action: ${outcome.action}\n- Issue: ${outcome.issue || 'n/a'}${
      outcome.reason ? `\n- Reason: ${outcome.reason}` : ''
    }`,
  );
  console.log(JSON.stringify(outcome, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
