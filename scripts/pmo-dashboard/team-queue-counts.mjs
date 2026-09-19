const TEAM_QUEUE_ORDER = [
  { id: 'operations', title: 'Operations', teamLabel: 'team:operations' },
  { id: 'engineering', title: 'Engineering', teamLabel: 'team:engineering' },
  { id: 'governance', title: 'Governance', teamLabel: 'team:governance' }
];

const PMO_QUEUE_ORDER = [
  { id: 'pmoTracked', title: 'PMO tracked', teamLabel: 'team:pmo', omitTask: true },
  { id: 'pmoPipeline', title: 'PMO Pipeline', teamLabel: 'team:pmo', lifecycleLabel: 'pmo:pipeline', omitTask: true },
  { id: 'pmoActive', title: 'PMO Active', teamLabel: 'team:pmo', lifecycleLabel: 'pmo:active', omitTask: true }
];

const APPROVED_TEAMS = new Set([
  'team:operations',
  'team:pmo',
  'team:engineering',
  'team:governance'
]);

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

export function classifyTeamQueue(issue) {
  if (!issue || issue.pull_request || issue.state !== 'open') return null;
  const labels = normalizeLabels(issue.labels);
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

function issueSearchUrl(owner, repo, queue) {
  const query = ['is:open', `label:${queue.teamLabel}`];
  if (queue.lifecycleLabel) query.push(`label:${queue.lifecycleLabel}`);
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

export function buildTeamQueueCounts(issues, { owner, repo } = {}) {
  const counts = Object.fromEntries(
    [...TEAM_QUEUE_ORDER, ...PMO_QUEUE_ORDER].map((queue) => [queue.id, 0])
  );
  for (const issue of issues || []) {
    const id = classifyTeamQueue(issue);
    if (id) counts[id] += 1;
  }
  counts.pmoTracked = counts.pmoPipeline + counts.pmoActive;
  return {
    order: TEAM_QUEUE_ORDER.map((queue) => queue.id),
    queues: queuePayload(TEAM_QUEUE_ORDER, counts, owner, repo),
    pmoOrder: PMO_QUEUE_ORDER.map((queue) => queue.id),
    pmoQueues: queuePayload(PMO_QUEUE_ORDER, counts, owner, repo)
  };
}

export { TEAM_QUEUE_ORDER, PMO_QUEUE_ORDER };
