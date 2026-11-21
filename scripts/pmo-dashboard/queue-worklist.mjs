// Queue worklist (#4451): ordered rows per team queue plus accounting checks.
// Go-live view (#4441): every listed Issue is go-live, deferred (held, waiting or pipeline), or reported as unbucketed.
// Contract: docs/reference/pmo/queue-worklist-views-and-tiers.md. Read-only; GitHub labels are the only input.
import { isProjectChild, classifyTeamQueue } from './team-queue-counts.mjs';

export const WORKLIST_QUEUES = [
  { id: 'operations', title: 'Operations' },
  { id: 'engineering', title: 'Engineering' },
  { id: 'governance', title: 'Governance' },
  { id: 'pmo', title: 'PMO' }
];

const TEAM_PRIORITY_PREFIX = { operations: 'ops:priority:', engineering: 'eng:priority:', governance: 'gov:priority:' };
const OPERATIONS_INTERRUPT_RE = /^ops:priority:[1-4]$/;
const OPERATIONS_EXCEPTION_LABELS = ['ops-pr-escalation', 'post-merge-failure'];
const HOLD_LABELS = new Set(['status:hold', 'ops:hold', 'gov:hold']);
const GO_LIVE_LABEL = 'go-live-2027';
const PIPELINE_LABEL = 'pmo:pipeline';
const PARENT_REF_PATTERN = /^\s*(?:[-*]\s*)?(?:Parent(?:\s+(?:program|project|issue))?)\s*:\s*#?(\d+)\b/im;

function names(issue) {
  return (issue.labels || []).map((label) => (typeof label === 'string' ? label : label?.name)).filter(Boolean);
}

function isOpenIssue(issue) {
  return Boolean(issue) && !issue.pull_request && issue.state === 'open';
}

function isHeld(labels) {
  return labels.some((label) => HOLD_LABELS.has(label) || label.startsWith('wait:'));
}

// 1-4 interrupt, 5 other Operations, 6 go-live then queue priority, 7 remaining, 9 held. Lower sorts first.
function tierFor(queueId, labels) {
  if (isHeld(labels)) return 9;
  if (queueId === 'operations') {
    if (labels.some((label) => OPERATIONS_INTERRUPT_RE.test(label)) || OPERATIONS_EXCEPTION_LABELS.some((l) => labels.includes(l))) return 1;
    return 2;
  }
  return labels.includes(GO_LIVE_LABEL) ? 3 : 4;
}

function priorityNumber(queueId, labels) {
  if (queueId === 'pmo') {
    const label = labels.find((l) => /^pmo:priority:\d+$/.test(l)) || labels.find((l) => /^pmo:pipeline-priority:\d+$/.test(l));
    return label ? Number(label.split(':').pop()) : Infinity;
  }
  const label = labels.find((l) => l.startsWith(TEAM_PRIORITY_PREFIX[queueId]));
  const value = label ? label.slice(TEAM_PRIORITY_PREFIX[queueId].length) : '';
  return /^\d+$/.test(value) ? Number(value) : Infinity;
}

function rowFor(queueId, issue, labels) {
  const parent = PARENT_REF_PATTERN.exec(issue.body || '');
  return {
    number: issue.number,
    title: issue.title || '',
    queue: queueId,
    tier: tierFor(queueId, labels),
    held: isHeld(labels),
    pipeline: labels.includes(PIPELINE_LABEL),
    goLive: labels.includes(GO_LIVE_LABEL),
    state: labels.filter((l) => l.startsWith('status:') || l.startsWith('wait:')),
    claim: labels.filter((l) => l.startsWith('agent:')),
    priority: labels.find((l) => /:priority:/.test(l) || l.startsWith('pmo:pipeline-priority:')) || null,
    parent: queueId === 'pmo' && parent ? Number(parent[1]) : null,
    _p: priorityNumber(queueId, labels)
  };
}

export function buildQueueWorklist(issues, { owner, repo } = {}) {
  const sections = Object.fromEntries(WORKLIST_QUEUES.map((q) => [q.id, []]));
  const noTeam = [];
  const multiTeam = [];
  const childrenWithTeam = [];
  let totalOpenIssues = 0;
  let projectChildren = 0;
  let listed = 0;
  let unplaced = 0;
  const unplacedNumbers = [];

  for (const issue of issues || []) {
    if (!isOpenIssue(issue)) continue;
    totalOpenIssues += 1;
    const labels = names(issue);
    const teams = labels.filter((l) => l.startsWith('team:'));
    if (isProjectChild(issue)) {
      projectChildren += 1;
      if (teams.length) childrenWithTeam.push(issue.number);
      continue;
    }
    // Operations exception labels place an Issue in Operations without a team:* label (team-queue-counts.mjs).
    const isException = OPERATIONS_EXCEPTION_LABELS.some((l) => labels.includes(l));
    if (teams.length === 0 && !isException) noTeam.push(issue.number);
    if (teams.length > 1) multiTeam.push(issue.number);
    const queue = classifyTeamQueue(issue);
    let queueId = queue === 'pmoActive' || queue === 'pmoPipeline' ? 'pmo' : queue;
    // A standalone Issue owned by team:pmo belongs in the PMO section even without a pmo:active or pmo:pipeline label,
    // so it is never hidden from the page (go-live and hygiene tasks are often owned this way).
    if (!queueId && teams.length === 1 && teams[0] === 'team:pmo') queueId = 'pmo';
    if (!queueId) {
      unplaced += 1;
      unplacedNumbers.push(issue.number);
      continue;
    }
    sections[queueId].push(rowFor(queueId, issue, labels));
    listed += 1;
  }

  for (const q of WORKLIST_QUEUES) {
    sections[q.id].sort((a, b) => a.tier - b.tier || a._p - b._p || a.number - b.number);
    for (const row of sections[q.id]) delete row._p;
  }

  // #4441: each listed Issue is on the go-live view, in the deferred bucket (held, waiting, or a pipeline
  // project that is not go-live: pipeline work is deferred by nature), or unbucketed.
  const goLiveView = { goLive: 0, deferred: 0, unbucketed: [] };
  for (const q of WORKLIST_QUEUES) {
    for (const row of sections[q.id]) {
      if (row.goLive) goLiveView.goLive += 1;
      else if (row.held || row.pipeline) goLiveView.deferred += 1;
      else goLiveView.unbucketed.push(row.number);
    }
  }
  goLiveView.unbucketed.sort((a, b) => a - b);

  const base = owner && repo ? `https://github.com/${owner}/${repo}/issues/` : null;
  return {
    order: WORKLIST_QUEUES.map((q) => q.id),
    queues: WORKLIST_QUEUES.map((q) => ({ id: q.id, title: q.title, rows: sections[q.id] })),
    interrupt: sections.operations.filter((row) => row.tier === 1),
    issueUrlBase: base,
    accounting: {
      totalOpenIssues,
      listed,
      projectChildren,
      unplaced,
      unplacedIssues: unplacedNumbers.sort((a, b) => a - b),
      balanced: listed + projectChildren + unplaced === totalOpenIssues,
      noTeamLabel: noTeam,
      multipleTeamLabels: multiTeam,
      projectChildrenWithTeamLabel: childrenWithTeam
    },
    goLiveView
  };
}
