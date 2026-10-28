const TEAM_QUEUE_ORDER = [
  { id: 'operations', title: 'Operations', teamLabel: 'team:operations' },
  { id: 'engineering', title: 'Engineering', teamLabel: 'team:engineering' },
  { id: 'governance', title: 'Governance', teamLabel: 'team:governance' }
];

const PMO_QUEUE_ORDER = [
  { id: 'pmoTracked', title: 'PMO tracked', teamLabel: 'team:pmo', omitTask: true, parentLabel: 'pmo:parent' },
  { id: 'pmoPipeline', title: 'PMO Pipeline', teamLabel: 'team:pmo', lifecycleLabel: 'pmo:pipeline', omitTask: true, parentLabel: 'pmo:parent' },
  { id: 'pmoActive', title: 'PMO Active', teamLabel: 'team:pmo', lifecycleLabel: 'pmo:active', omitTask: true, parentLabel: 'pmo:parent' }
];

const PMO_TASK_QUEUE = {
  id: 'pmoTasks',
  title: 'PMO child / task',
  taskLabel: 'pmo:task'
};

const APPROVED_TEAMS = new Set([
  'team:operations',
  'team:pmo',
  'team:engineering',
  'team:governance'
]);

/** Post-merge / closeout exception labels that count toward Operations (no team:* required). */
const OPERATIONS_EXCEPTION_LABELS = ['ops-pr-escalation', 'post-merge-failure'];

const PARENT_REF_PATTERN = /^\s*(?:[-*]\s*)?(?:Parent(?:\s+(?:program|project|issue))?)\s*:\s*#?(\d+)\b/im;
const CHILD_PROJECT_PATTERN = /^PROJECT:\s*(\d+):(\d+)\s*\|\s*(.+)$/i;

/** A project child is a task label or a parent link. Team queues count standalone work only (#4981). */
export function isProjectChild(issue) {
  if (!issue || issue.pull_request) return false;
  const labels = normalizeLabels(issue.labels);
  if (labels.includes('pmo:task')) return true;
  if (PARENT_REF_PATTERN.test(issue.body || '')) return true;
  if (CHILD_PROJECT_PATTERN.test(issue.title || '')) return true;
  return false;
}

function normalizeLabels(input) {
  return (input || [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

function exclusiveApprovedTeam(labels) {
  const teams = labels.filter((label) => label.startsWith('team:'));
  if (teams.length !== 1) return null;
  return APPROVED_TEAMS.has(teams[0]) ? teams[0] : null;
}

function isOperationsException(labels) {
  return OPERATIONS_EXCEPTION_LABELS.some((label) => labels.includes(label));
}

function isOpenIssue(issue) {
  return Boolean(issue) && !issue.pull_request && issue.state === 'open';
}

/**
 * Parent team-queue classification for exclusive team tiles and PMO parent tiles.
 * Returns null for closed, PRs, multi-team, pmo:task, dual lifecycle, or unowned issues.
 */
export function classifyTeamQueue(issue) {
  if (!isOpenIssue(issue)) return null;
  if (isProjectChild(issue)) return null;
  const labels = normalizeLabels(issue.labels);
  // Exception / escalated closeout work counts in Operations regardless of team:* exclusivity.
  if (isOperationsException(labels)) return 'operations';
  const team = exclusiveApprovedTeam(labels);
  if (!team) return null;
  if (team === 'team:operations') return 'operations';
  if (team === 'team:engineering') return 'engineering';
  if (team === 'team:governance') return 'governance';
  if (labels.includes('pmo:task')) return null;
  const hasActive = labels.includes('pmo:active');
  const hasPipeline = labels.includes('pmo:pipeline');
  if (hasActive === hasPipeline) return null;
  return hasActive ? 'pmoActive' : 'pmoPipeline';
}

/**
 * Exhaustive partition of one open issue for the full assignment breakout.
 * Categories are mutually exclusive so counts sum to totalOpenIssues.
 */
export function classifyOpenIssuePartition(issue) {
  if (!isOpenIssue(issue)) return null;
  const labels = normalizeLabels(issue.labels);
  // Children stay out of team tiles, including when a team or exception label is still present (#4981).
  if (isProjectChild(issue)) return 'pmoTasks';
  if (isOperationsException(labels)) return 'operations';
  const team = exclusiveApprovedTeam(labels);
  if (team === 'team:operations') return 'operations';
  if (team === 'team:engineering') return 'engineering';
  if (team === 'team:governance') return 'governance';
  if (team === 'team:pmo') {
    const hasActive = labels.includes('pmo:active');
    const hasPipeline = labels.includes('pmo:pipeline');
    if (hasActive !== hasPipeline) return 'pmoParents';
  }
  return 'other';
}

function issueSearchUrl(owner, repo, queue) {
  // is:issue excludes pull requests so the link matches classifyTeamQueue (which omits PRs).
  const query = ['is:open', 'is:issue'];
  if (queue.id === 'operations') {
    const opsLabels = [queue.teamLabel, ...OPERATIONS_EXCEPTION_LABELS].join(',');
    query.push(`label:${opsLabels}`);
    query.push('-label:pmo:task');
  } else if (queue.taskLabel) {
    query.push(`label:${queue.taskLabel}`);
  } else if (queue.id === 'other') {
    // Approximate residual set for operator drill-down (not a perfect partition filter).
    query.push('-label:team:operations');
    query.push('-label:team:engineering');
    query.push('-label:team:governance');
    query.push('-label:team:pmo');
    query.push('-label:pmo:task');
    query.push('-label:ops-pr-escalation');
    query.push('-label:post-merge-failure');
  } else if (queue.teamLabel) {
    query.push(`label:${queue.teamLabel}`);
    if (!queue.omitTask) query.push('-label:pmo:task');
  }
  if (queue.lifecycleLabel) query.push(`label:${queue.lifecycleLabel}`);
  if (queue.parentLabel) query.push(`label:${queue.parentLabel}`);
  if (queue.omitTask) query.push('-label:pmo:task');
  if (queue.id === 'pmoTracked') {
    query.push('label:pmo:active,pmo:pipeline');
  }
  return `https://github.com/${owner}/${repo}/issues?q=${encodeURIComponent(query.join(' '))}`;
}

function queuePayload(order, counts, owner, repo) {
  return order.map((queue) => ({
    id: queue.id,
    title: queue.title,
    count: counts[queue.id],
    issueSearchUrl: issueSearchUrl(owner, repo, queue)
  }));
}

function totalOpenSearchUrl(owner, repo) {
  return `https://github.com/${owner}/${repo}/issues?q=${encodeURIComponent('is:open is:issue')}`;
}

export function buildTeamQueueCounts(issues, { owner, repo } = {}) {
  const counts = Object.fromEntries(
    [...TEAM_QUEUE_ORDER, ...PMO_QUEUE_ORDER].map((queue) => [queue.id, 0])
  );
  counts.pmoTasks = 0;
  counts.other = 0;

  let totalOpenIssues = 0;
  const breakout = {
    operations: 0,
    engineering: 0,
    governance: 0,
    pmoParents: 0,
    pmoTasks: 0,
    other: 0
  };

  for (const issue of issues || []) {
    if (!isOpenIssue(issue)) continue;
    totalOpenIssues += 1;

    const parentId = classifyTeamQueue(issue);
    if (parentId) counts[parentId] += 1;

    const partition = classifyOpenIssuePartition(issue);
    if (partition && Object.prototype.hasOwnProperty.call(breakout, partition)) {
      breakout[partition] += 1;
    }
  }

  counts.pmoTracked = counts.pmoPipeline + counts.pmoActive;
  counts.pmoTasks = breakout.pmoTasks;
  counts.other = breakout.other;

  const pmoTaskPayload = {
    id: PMO_TASK_QUEUE.id,
    title: PMO_TASK_QUEUE.title,
    count: counts.pmoTasks,
    issueSearchUrl: issueSearchUrl(owner, repo, PMO_TASK_QUEUE)
  };

  const otherPayload = {
    id: 'other',
    title: 'Other / unassigned',
    count: counts.other,
    issueSearchUrl: issueSearchUrl(owner, repo, { id: 'other' })
  };

  return {
    totalOpenIssues,
    totalOpenIssuesUrl: totalOpenSearchUrl(owner, repo),
    order: TEAM_QUEUE_ORDER.map((queue) => queue.id),
    queues: queuePayload(TEAM_QUEUE_ORDER, counts, owner, repo),
    pmoOrder: PMO_QUEUE_ORDER.map((queue) => queue.id),
    pmoQueues: queuePayload(PMO_QUEUE_ORDER, counts, owner, repo),
    pmoTaskQueue: pmoTaskPayload,
    otherQueue: otherPayload,
    breakout: {
      ...breakout,
      totalOpenIssues,
      // Convenience: parents from exclusive PMO parent classification.
      pmoParentsFromTiles: counts.pmoTracked
    }
  };
}

export { TEAM_QUEUE_ORDER, PMO_QUEUE_ORDER, PMO_TASK_QUEUE };
