#!/usr/bin/env node
/**
 * Prepend PMO dashboard metadata blocks to tracked issues when missing.
 * Safe to re-run: skips issues that already declare Dashboard Lifecycle.
 */
import { execFileSync } from 'node:child_process';

const REPO = 'wdhunter465/next-starter-template';

const METADATA = {
  2286: `Dashboard Lifecycle: active
Priority #: 1
Owner / Agent: ChatGPT + Cursor
Anticipated Completion Date: TBD
Program Description: Runtime implementation for LGFC content pipeline candidate metadata, admin review APIs, member submission persistence, and publication-prep helpers.

`,
  1719: `Dashboard Lifecycle: active
Priority #: 2
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Complete PMO governance and workflow automation program; launch-gated until explicit task assignment.

`,
  2299: `Dashboard Lifecycle: active
Priority #: 3
Owner / Agent: ChatGPT + Cursor
Anticipated Completion Date: TBD
Project Description: Repair PMO dashboard tracking so all tracked PMO programs, projects, ideas, planning items, active work, pipeline work, and completed work appear in the correct dashboard view with explicit numeric priority.

`,
  2294: `Dashboard Lifecycle: pipeline
Priority #: 1
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Project Description: Agent issue polling and handoff routing for PMO workflow automation.

`,
  2292: `Dashboard Lifecycle: pipeline
Priority #: 2
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: AI-assisted tagging strategy for LGFC digital content assets; strategy capture and PMO sequencing only.

`,
  2291: `Dashboard Lifecycle: pipeline
Priority #: 3
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: LGFC SEO strategy capture and PMO activation control; strategy tracking only.

`,
  2040: `Dashboard Lifecycle: pipeline
Priority #: 4
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Controlled content-publication automation after manual/staged content workflow is proven.

`,
  2073: `Dashboard Lifecycle: pipeline
Priority #: 5
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Advanced Gehrig content collection and media/archive acquisition after Phase 1 and publication capability.

`,
  2085: `Dashboard Lifecycle: pipeline
Priority #: 6
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Admin page and tools design readiness program candidate.

`,
  2075: `Dashboard Lifecycle: pipeline
Priority #: 7
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: LGFC social media strategy program candidate.

`,
  2074: `Dashboard Lifecycle: pipeline
Priority #: 8
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Member communications and newsletter operations program candidate.

`,
  2084: `Dashboard Lifecycle: pipeline
Priority #: 9
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Annual Lou Gehrig Day operations package program candidate.

`,
  2093: `Dashboard Lifecycle: pipeline
Priority #: 10
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: 2027 launch calendar and go/no-go plan program candidate.

`,
  2081: `Dashboard Lifecycle: pipeline
Priority #: 11
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: LGFC monetization strategy program candidate.

`,
  2082: `Dashboard Lifecycle: pipeline
Priority #: 12
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: LGFC store strategy program candidate.

`,
  2083: `Dashboard Lifecycle: pipeline
Priority #: 13
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Store and merchandise operations program candidate.

`,
  2079: `Dashboard Lifecycle: pipeline
Priority #: 14
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Community engagement cadence program candidate.

`,
  2078: `Dashboard Lifecycle: pipeline
Priority #: 15
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Adam Wilson Award and recognition system program candidate.

`,
  2077: `Dashboard Lifecycle: pipeline
Priority #: 16
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Partner and Friends of the Fan Club operations program candidate.

`,
  2076: `Dashboard Lifecycle: pipeline
Priority #: 17
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Cost analysis and growth heat map program candidate.

`,
  2273: `Dashboard Lifecycle: pipeline
Priority #: 18
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Dashboard Status: Planning complete (successor #2286 active)
Program Description: Content pipeline reconciliation and canonical candidate model planning; planning merged, runtime successor active.

`,
  2270: `Dashboard Lifecycle: pipeline
Priority #: 19
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Dashboard Status: Strategy review
Program Description: Revised LGFC content discovery, review, approval, and publication pipeline strategy review.

`,
  1738: `Dashboard Lifecycle: pipeline
Priority #: 20
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Dashboard Status: Paused (launch-gated)
Program Description: Lou Gehrig content collection and research pipeline expansion Phase 1; paused pending Bill authorization.

`,
  1700: `Dashboard Lifecycle: pipeline
Priority #: 21
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Fundraiser and charity campaign operations buildout; queued launch-gated program.

`,
  1685: `Dashboard Lifecycle: completed
Priority #: 1
Owner / Agent: ChatGPT + Cursor
Anticipated Completion Date: TBD
Program Description: Website completion and fan club product buildout; closed complete per PMO registry.

`,
  2100: `Dashboard Lifecycle: completed
Priority #: 2
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Project Description: PMO V4 repository authority promotion.

`,
  2039: `Dashboard Lifecycle: completed
Priority #: 3
Owner / Agent: ChatGPT
Anticipated Completion Date: TBD
Program Description: Website public launch and relaunch readiness program.

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
