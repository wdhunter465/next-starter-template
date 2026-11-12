#!/usr/bin/env node
/**
 * social-monthly-check-reminder.mjs (#5143, Phase 5 follow-up)
 *
 * Opens (or updates) one Operations Issue for the month, reminding the team to check the two things
 * GitHub cannot read: Zapier's task count against the 100 free tasks, and the Meta token that the
 * Facebook Page and Instagram connections use. One Issue per month: the title carries the month, and
 * an open Issue with that title is updated, not duplicated.
 *
 * Env: GH_TOKEN, GITHUB_REPOSITORY, NOW (ISO, tests only)
 */

import { pathToFileURL } from 'node:url';
import { upsertOpsRuntimeIssue } from '../ci/ops_runtime_escalation.mjs';

export function reminderTitle(now = new Date()) {
  const month = new Date(now).toISOString().slice(0, 7);
  return `Social posting monthly check (${month})`;
}

export function reminderBody(now = new Date()) {
  const month = new Date(now).toISOString().slice(0, 7);
  return [
    '<!-- ops-social-monthly-check -->',
    '',
    `Monthly check for ${month}. GitHub cannot read these two, so they are checked by hand.`,
    '',
    '## Checklist',
    '- [ ] **Zapier tasks:** open Zapier, Settings, Usage. The Free plan allows 100 tasks a month and the daily post uses about 3 a day (about 90 a month). Record the number used on #4416. If it is above 80 before the month ends, tell Product Authority; do not upgrade (no paid plan is approved).',
    '- [ ] **Meta token:** open Zapier, My apps, Facebook Pages and Instagram for Business; both must show as connected. Reconnect an expired one, and confirm a test post still works.',
    '- [ ] **Zaps on:** the three GitHub-triggered Zaps (Facebook Page, Instagram, Pinterest) are on and show last-run times this week (`docs/how-to/ops/social-feed-zaps-setup.md`).',
    '- [ ] **Buffer:** the BUFFER_API_KEY works (run the `OPS — Buffer API Check` workflow) and the X channel `GehrigFanClub` shows as connected.',
    '',
    'Close this Issue when the checklist is done.',
  ].join('\n');
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!repository || !token) throw new Error('GITHUB_REPOSITORY and GH_TOKEN are required');
  const [owner, repo] = repository.split('/');
  const now = process.env.NOW ? new Date(process.env.NOW) : new Date();
  const outcome = await upsertOpsRuntimeIssue({
    token,
    owner,
    repo,
    title: reminderTitle(now),
    body: reminderBody(now),
    labels: ['ops-reminder'],
  });
  console.log(JSON.stringify(outcome, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`ERROR: ${String(error?.message ?? error)}`);
    process.exit(1);
  });
}
