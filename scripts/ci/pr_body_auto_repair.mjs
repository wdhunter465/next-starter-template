import { evaluateReviewerCommentDisposition, parseReviewerDispositions } from './reviewer_comment_disposition.mjs';

export const AUTO_REPAIR_START = '<!-- pr-body-auto-repair:start -->';
export const AUTO_REPAIR_END = '<!-- pr-body-auto-repair:end -->';
export const CURSOR_AGENT_PR_BODY_BEGIN = '<!-- CURSOR_AGENT_PR_BODY_BEGIN -->';

const REQUIRED_HEADINGS = [
  '## PRE-OPEN GATE PREFLIGHT (MANDATORY)',
  '## MANDATORY FIRST STEP (ZIP SAFETY)',
  '## QUEUE / DEPENDENCY MAP STATUS',
  '## PROGRESS + READINESS (MANDATORY)',
  '## DOCUMENTATION SOURCE (MANDATORY)',
  '## LABEL',
  '## DESIGN SOURCE OF TRUTH (NON-NEGOTIABLE)',
  '## FILE-TOUCH ALLOWLIST (MANDATORY)',
  '## VISUAL / UX INVARIANTS (MANDATORY)',
  '## DRIFT GATE ALIGNMENT (MANDATORY)',
  '## CHANGE SUMMARY',
  '## BUILD / TEST / VERIFICATION',
  '## DOCUMENTATION UPDATES',
  '## REVIEWER RESPONSE ACCOUNTING',
  '## PR GATE READINESS CHECKLIST',
  '## POST-MERGE CLOSEOUT CHECKLIST',
  '## ACCEPTANCE CRITERIA',
  '## REQUIRED PRE-REVIEW SELF-CHECK',
];

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function hasHeading(body = '', heading) {
  const normalized = String(heading || '').trim();
  const pattern = new RegExp(`^${escapeRegExp(normalized)}\\s*$`, 'mi');
  return pattern.test(String(body || ''));
}

export function extractSourceIssue(body = '') {
  const match = String(body || '').match(/^\s*-\s*\*\*Issue:\*\*\s*#(\d+)\s*$/im);
  return match?.[1] || '';
}

export function isSameRepositoryPullRequest(pull = {}) {
  const baseRepo = pull.base?.repo?.full_name || '';
  const headRepo = pull.head?.repo?.full_name || '';
  return Boolean(baseRepo && headRepo && baseRepo === headRepo && pull.head?.repo?.fork !== true);
}

export function canAutoRepairPullRequest({ pull = {}, eventName = '', body = '' } = {}) {
  if (!isSameRepositoryPullRequest(pull)) return false;
  if (pull.state && pull.state !== 'open') return false;
  if (String(body || pull.body || '').includes(CURSOR_AGENT_PR_BODY_BEGIN)) return false;
  if (eventName === 'pull_request_target' || eventName === 'issue_comment' || eventName === 'pull_request_review' || eventName === 'pull_request_review_comment') {
    return true;
  }
  return eventName === '';
}

function changedFileList(files = []) {
  return files
    .map((file) => (typeof file === 'string' ? file : file.filename))
    .filter(Boolean)
    .sort();
}

function classifyIntent(files = []) {
  const names = changedFileList(files);
  if (names.length === 0) return 'change-ops';
  if (names.every((name) => name.endsWith('.md') || name.startsWith('docs/') || name === 'active_tasklist.md')) return 'docs-only';
  if (names.some((name) => name.startsWith('.github/workflows/') || name.startsWith('scripts/ci/'))) return 'infra';
  return 'change-ops';
}

function inferDocsOnly(files = []) {
  const names = changedFileList(files);
  return names.length > 0 && names.every((name) => name.endsWith('.md') || name.startsWith('docs/') || name === 'active_tasklist.md');
}

function bodyOutsideManagedBlock(body = '') {
  return String(body || '').replace(
    new RegExp(`${escapeRegExp(AUTO_REPAIR_START)}[\\s\\S]*?${escapeRegExp(AUTO_REPAIR_END)}`, 'm'),
    '',
  );
}

function isCanonicalIntentValue(value) {
  return /^(intent:[^\s]+|docs-only)$/i.test(String(value || ''));
}

export function extractCanonicalIntent({ body = '', labels = [] } = {}) {
  const text = bodyOutsideManagedBlock(body);
  const fromBody = text.match(/^\s*-\s*Intent label(?: for this PR)?:\s*(\S+)/im);
  const candidate = String(fromBody?.[1] || '').replace(/[.,;]+$/, '');
  if (isCanonicalIntentValue(candidate)) return candidate;
  const names = (labels || []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean);
  return names.find((name) => isCanonicalIntentValue(name)) || '';
}

export function isLiveRequiredChecksClean(liveState = {}) {
  return String(liveState.mergeableState || '').toLowerCase() === 'clean';
}

export function hasGenuineGovernanceFailure({
  sourceIssue = '',
  disposition = null,
  liveState = {},
} = {}) {
  if (!sourceIssue) return true;
  const pendingReviewer = (disposition?.undispositioned || []).length
    + (disposition?.outdatedWithoutDisposition || []).length;
  if (pendingReviewer > 0) return true;
  const mergeableState = String(liveState.mergeableState || '').toLowerCase();
  if (mergeableState === 'dirty' || mergeableState === 'blocked') return true;
  const combined = String(liveState.combinedState || '').toLowerCase();
  return combined === 'failure' || combined === 'error';
}

function formatFileBullets(files = []) {
  const names = changedFileList(files);
  if (!names.length) return '- pending — no changed-file list available to automation';
  return names.map((name) => `- \`${name}\``).join('\n');
}

function reviewerSkeletonLines({ body = '', disposition = null } = {}) {
  const existing = parseReviewerDispositions(body);
  const items = [
    ...(disposition?.undispositioned || []),
    ...(disposition?.outdatedWithoutDisposition || []),
    ...(disposition?.lateFindings || []),
  ];
  const seen = new Set();
  const lines = [];

  for (const item of items) {
    const commentId = String(item.commentId || '').trim();
    if (!commentId || seen.has(commentId) || existing.has(commentId)) continue;
    seen.add(commentId);
    const threadState = item.outdated ? 'outdated' : 'unresolved-with-rationale';
    lines.push(`- review-comment:${commentId} — acknowledged — auto-generated disposition pending agent completion; agent must replace with final fix/rationale before READY FOR REVIEW — thread state: ${threadState}`);
  }

  if (!lines.length) return '- none detected by auto-repair at generation time';
  return lines.join('\n');
}

export function buildAutoRepairBlock({
  body = '',
  pull = {},
  files = [],
  issueComments = [],
  reviewComments = [],
  reviews = [],
  headSha = '',
  readyForReviewAt = '',
  liveState = {},
} = {}) {
  const sourceIssue = extractSourceIssue(body);
  const fileBullets = formatFileBullets(files);
  const inferredIntent = classifyIntent(files);
  const canonicalIntent = extractCanonicalIntent({ body, labels: pull.labels || liveState.labels || [] });
  const intentConflict = Boolean(
    canonicalIntent && inferredIntent && canonicalIntent !== inferredIntent,
  );
  const docsOnly = inferDocsOnly(files);
  const missingHeadings = REQUIRED_HEADINGS.filter((heading) => !hasHeading(body, heading));
  const disposition = evaluateReviewerCommentDisposition({
    body,
    issueComments,
    reviewComments,
    reviews,
    headSha,
    readyForReviewAt,
    auditPhase: 'pre_merge',
  });
  const reviewerLines = reviewerSkeletonLines({ body, disposition });
  const liveClean = isLiveRequiredChecksClean(liveState);
  const genuineFailure = hasGenuineGovernanceFailure({ sourceIssue, disposition, liveState });
  const readinessStatus = genuineFailure
    ? 'BLOCKED'
    : liveClean
      ? 'SCAFFOLD — GitHub-native required checks currently clean; this block is advisory evidence only'
      : 'IN PROGRESS — evidence scaffold; GitHub-native merge state is authoritative';
  const haltDecision = genuineFailure
    ? 'halt — current required checks or governance evidence incomplete'
    : 'not-applicable — GitHub-native merge state is authoritative; auto-repair never authorizes queue continuation';
  const verificationSummary = genuineFailure
    ? 'PENDING — current required checks or governance evidence incomplete'
    : liveClean
      ? 'GitHub-native required checks currently clean (advisory; not merge approval)'
      : 'PENDING — live GitHub merge state not yet clean or not yet computed';
  const intentLabelForPr = canonicalIntent || inferredIntent;

  const lines = [
    AUTO_REPAIR_START,
    '',
    '## PR BODY AUTO-REPAIR EVIDENCE',
    '',
    'This block is generated by CI for trusted same-repository PRs. It is an evidence scaffold, not merge approval. GitHub-native required checks, reviews, and branch protection remain the authoritative merge blockers.',
    '',
    `- Source issue detected: ${sourceIssue ? `#${sourceIssue}` : 'missing — agent must add exactly one `- **Issue:** #<number>` line'}`,
    `- Current head SHA: ${headSha || pull.head?.sha || 'unknown'}`,
    `- Canonical intent (body/label): ${canonicalIntent || 'missing'}`,
    `- Intent inferred by automation: ${inferredIntent}`,
    ...(intentConflict
      ? [`- Intent conflict: canonical \`${canonicalIntent}\` does not match inferred \`${inferredIntent}\`. Agent must resolve; auto-repair will not overwrite the canonical intent.`]
      : []),
    `- Docs-only inferred by automation: ${docsOnly ? 'yes' : 'no'}`,
    `- Live mergeable_state: ${liveState.mergeableState || 'unknown'}`,
    `- Live combined status: ${liveState.combinedState || 'unknown'}`,
    `- Missing canonical headings detected: ${missingHeadings.length ? missingHeadings.join('; ') : 'none'}`,
    '',
    '## PRE-OPEN GATE PREFLIGHT (MANDATORY)',
    `- [${sourceIssue ? 'x' : ' '}] Confirm exactly one same-repository, open, non-PR source issue exists.`,
    `- [${sourceIssue ? 'x' : ' '}] Confirm one accepted issue-accounting line is present before opening or updating the PR. Preferred format: \`- **Issue:** #123\`.`,
    '- [ ] Read the workflow files that will run for this PR\'s touched paths before opening the PR.',
    '- [ ] Read `docs/reference/governance/troubleshooting-data-surface-requirements.md` before making any merge-readiness claim.',
    '- [ ] Confirm PR body file allowlist exactly matches the final changed-file list before opening.',
    '',
    '## MANDATORY FIRST STEP (ZIP SAFETY)',
    '- [ ] No ZIP file exists in the repo root',
    '- [ ] Final diff confirms no ZIP file is committed',
    '',
    '## QUEUE / DEPENDENCY MAP STATUS',
    '- Dependency-map result: not-applicable — auto-repair cannot infer launched-program queue state.',
    '- Next queue item: not-applicable — agent must update when this PR is a launched-program task.',
    '- Continue/halt decision: ' + haltDecision,
    '',
    '## PROGRESS + READINESS (MANDATORY)',
    '- Phase: auto-repair generated; agent must replace with source issue phase',
    '- Task: auto-repair generated; agent must replace with source issue task',
    `- Status: ${readinessStatus}`,
    `- Scope Confirmed: ${changedFileList(files).length ? 'YES' : 'NO'}`,
    '- Out-of-Scope Changes Present: NO / agent must verify',
    '- Blocking Issues: auto-repair evidence requires agent verification before READY FOR REVIEW',
    '- Notes: CI generated this scaffold; do not treat it as final human-review readiness.',
    '',
    '## DOCUMENTATION SOURCE (MANDATORY)',
    '- [ ] DIATAXIS_FULL',
    '- [ ] DIATAXIS_ROUTED',
    '- [ ] LEGACY_FALLBACK',
    '',
    'Source Files Used:',
    '- auto-repair could not infer source documents; agent must list exact paths',
    '',
    '## LABEL',
    `- Intent label for this PR: ${intentLabelForPr}`,
    '',
    '## DESIGN SOURCE OF TRUTH (NON-NEGOTIABLE)',
    '- Canonical process reference: `/docs/governance/PR_PROCESS.md`',
    '- Canonical governance reference: `/docs/governance/PR_GOVERNANCE.md`',
    '- Canonical troubleshooting reference: `/docs/reference/governance/troubleshooting-data-surface-requirements.md`',
    '- Canonical design reference: `/docs/reference/design/LGFC-Production-Design-and-Standards.md`',
    '- Additional design/reference docs used for this PR:',
    '  - auto-repair pending agent completion — agent must list exact applicable paths',
    '',
    '## FILE-TOUCH ALLOWLIST (MANDATORY)',
    'Allowed files:',
    fileBullets,
    '',
    'All other files are out of scope',
    '',
    '## VISUAL / UX INVARIANTS (MANDATORY)',
    '- [ ] Header, footer, navigation, auth, and route invariants preserved unless explicitly in scope',
    '- [ ] No unauthorized visual drift introduced',
    '- [ ] No out-of-scope UX changes introduced',
    '- [ ] Store behavior, Join/Login behavior, and Fan Club/Admin gating remain compliant unless explicitly in scope',
    '',
    '## DRIFT GATE ALIGNMENT (MANDATORY)',
    '- [ ] Exactly ONE intent label applied',
    '- [ ] File changes match allowlist exactly',
    '- [ ] No mixed-intent changes present',
    '',
    ...(docsOnly
      ? [
          '## DOCS-ONLY ASSERTION (REQUIRED FOR change-ops)',
          '- [x] This PR contains documentation-only changes',
          '- [x] No application code, config, or runtime behavior modified',
          '',
        ]
      : []),
    '## CHANGE SUMMARY',
    '- auto-repair pending agent completion — agent must replace with exact change summary',
    '',
    '## BUILD / TEST / VERIFICATION',
    '- Commands run:',
    '  - pending — agent or CI must record exact commands and outcomes',
    '- Gate verification:',
    '  - Commit-level workflow runs inspected: NO',
    '  - PR-level governance/accounting workflows inspected: NO',
    '  - Failed job logs inspected for every failing gate: N/A',
    '  - Required gates rerun or re-evaluated after fixes: N/A',
    '- Result summary:',
    `  - ${verificationSummary}`,
    '',
    '## DOCUMENTATION UPDATES',
    `- [${docsOnly ? 'x' : ' '}] Documentation updated in this PR`,
    `- [${docsOnly ? ' ' : 'x'}] No documentation updates required`,
    '- Files:',
    fileBullets,
    '',
    '## REVIEWER RESPONSE ACCOUNTING',
    '- [ ] Reviewed all reviewer comments.',
    '- [ ] Reviewed all bot comments.',
    '- [ ] Reviewed all GitHub review threads.',
    '- [ ] Every actionable reviewer comment has a PR-body disposition with `review-comment:<id>`.',
    '- [ ] Every GitHub review thread has an explicit thread-state disposition: resolved, outdated, or intentionally left unresolved with rationale.',
    '',
    'Reviewer items:',
    reviewerLines,
    '',
    '## PR GATE READINESS CHECKLIST',
    '- [ ] Live PR check panel inspected',
    '- [ ] Commit-level workflow runs inspected',
    '- [ ] PR-level pull_request_target workflows inspected',
    '- [ ] Latest head workflow runs inspected',
    '- [ ] Required gates rerun or re-evaluated after fixes',
    '- [ ] Final PR panel confirms merge-readiness',
    '',
    '## POST-MERGE CLOSEOUT CHECKLIST',
    '- [ ] PR merged state verified',
    '- [ ] Merge commit recorded',
    '- [ ] Source issue state inspected after merge',
    '- [ ] Source issue closed manually when automation did not close it',
    '',
    '## ACCEPTANCE CRITERIA',
    '- [ ] Required source issue exists, is open, is same-repository, and is not a PR.',
    '- [ ] PR issue-accounting gate passes.',
    '- [ ] Drift gate passes.',
    '- [ ] Intent gate passes.',
    '- [ ] ZIP safety gate passes.',
    '- [ ] Quality checks pass.',
    '- [ ] Repository-specific governance gates pass.',
    '- [ ] All actionable reviewer and bot feedback is resolved or explicitly dispositioned.',
    '- [ ] PR is ready for human review.',
    '',
    '## REQUIRED PRE-REVIEW SELF-CHECK',
    '- [ ] PR body contains all required sections with exact headings',
    '- [ ] PR body contains one accepted source-issue accounting line',
    '- [ ] Allowed files section matches final diff exactly',
    '- [ ] No files outside allowlist',
    '- [ ] ZIP safety confirmed',
    '- [ ] Local checks executed and passed or CI-only validation documented',
    '- [ ] Status is set to READY FOR REVIEW only after all required gates and reviewer-response obligations are complete',
    '',
    AUTO_REPAIR_END,
  ];

  return {
    block: lines.join('\n'),
    missingHeadings,
    reviewerPlaceholderCount: reviewerLines.startsWith('- review-comment:') ? reviewerLines.split('\n').length : 0,
  };
}

export function repairPullRequestBody(options = {}) {
  const body = String(options.body || '');
  const { block, missingHeadings, reviewerPlaceholderCount } = buildAutoRepairBlock(options);
  const blockPattern = new RegExp(`${escapeRegExp(AUTO_REPAIR_START)}[\\s\\S]*?${escapeRegExp(AUTO_REPAIR_END)}`, 'm');
  const existingBlock = body.match(blockPattern)?.[0] || '';
  const nextBody = existingBlock
    ? body.replace(blockPattern, block)
    : `${body.trim()}\n\n${block}`.trim();

  return {
    body: nextBody,
    changed: nextBody !== body,
    report: [
      'PR body auto-repair evaluated.',
      `Managed block updated: ${nextBody !== body ? 'yes' : 'no'}`,
      `Missing canonical headings before repair: ${missingHeadings.length}`,
      `Reviewer disposition pending entries generated: ${reviewerPlaceholderCount}`,
    ].join('\n'),
  };
}
