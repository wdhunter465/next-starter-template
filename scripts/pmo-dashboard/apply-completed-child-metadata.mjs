#!/usr/bin/env node
/**
 * Prepend PMO dashboard metadata for completed #1255 child projects.
 * Safe to re-run: skips issues that already declare Dashboard Lifecycle.
 */
import { execFileSync } from 'node:child_process';

const REPO = 'wdhunter465/next-starter-template';

const METADATA = {
  1256: `Dashboard Lifecycle: completed
Priority #: 1
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Project Description: Content strategy and editorial inventory for Lou Gehrig historical content, media associations, editorial rotation, search/discovery, and intake/review workflows under program #1255.

`,
  1258: `Dashboard Lifecycle: completed
Priority #: 2
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Project Description: Website operations and admin workflows for post-launch LGFC operations, including fan club, moderation, content/media management, events, fundraiser, and matchup admin under program #1255.

`,
  1259: `Dashboard Lifecycle: completed
Priority #: 3
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Project Description: Canonical Website QA and production validation for program #1255: route, navigation, auth, mobile, D1/B2 verification, public-core closeout, and production audit handoff.

`,
  1264: `Dashboard Lifecycle: completed
Priority #: 4
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Project Description: Superseded duplicate of #1259; closed as stale with no independent execution history. Retained for program #1255 audit continuity only.

`
};

function ghJson(args) {
  return JSON.parse(execFileSync('gh', args, { encoding: 'utf8' }));
}

for (const [number, block] of Object.entries(METADATA)) {
  const issue = ghJson(['issue', 'view', number, '--repo', REPO, '--json', 'body,title']);
  if (/^\s*Dashboard Lifecycle\s*:/im.test(issue.body || '')) {
    console.log(`skip #${number} — dashboard metadata already present`);
    continue;
  }
  const body = `${block}${issue.body || ''}`;
  execFileSync('gh', ['issue', 'edit', number, '--repo', REPO, '--body', body], { stdio: 'inherit' });
  console.log(`updated #${number} — ${issue.title}`);
}
