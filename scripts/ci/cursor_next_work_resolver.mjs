/**
 * Repository-owned Cursor next-work resolver (#3607).
 *
 * Live GitHub records in, one Issue or NO_ELIGIBLE_WORK out.
 * GitHub assignee alone is not implementation authority.
 * Queue order is the #3629 default:
 * Operations → PMO Active → PMO Pipeline → Engineering → Governance.
 * Set disabled: true (poller env CURSOR_NEXT_WORK_RESOLVER=0) to skip.
 */

export const NO_ELIGIBLE_WORK = 'NO_ELIGIBLE_WORK';
export const RESOLVER_STATUS = {
  SELECTED: 'SELECTED',
  NO_ELIGIBLE_WORK: 'NO_ELIGIBLE_WORK',
  DISABLED: 'DISABLED',
};

const QUEUE_RANK = {
  operations: 1,
  'pmo-active': 2,
  'pmo-pipeline': 3,
  engineering: 4,
  governance: 5,
};

const BLOCKING_STATUSES = new Set([
  'status:queued',
  'status:blocked',
  'status:complete',
  'status:failed',
  'status:hold',
  'status:review',
  'status:needs-review',
  'status:post-merge-verify',
]);

const FORBID_BODY = [
  /no Cursor claim authorized/i,
  /forbids Cursor implementation/i,
  /Cursor implementation is not authorized/i,
  /do not (?:authorize|start) Cursor/i,
];

function labelNames(issue) {
  return (issue.labels || []).map((label) =>
    typeof label === 'string' ? label : label.name,
  );
}

function opsPriority(labels) {
  const match = labels
    .map((name) => name.match(/^ops:priority:([1-4])$/))
    .find(Boolean);
  return match ? Number(match[1]) : 99;
}

export function classifyQueue(issue) {
  const labels = labelNames(issue);
  const teams = labels.filter((name) => name.startsWith('team:'));
  if (teams.length > 1) {
    return { queue: null, reason: 'multiple team labels' };
  }
  if (teams.includes('team:operations') || labels.some((name) => /^ops:priority:[1-4]$/.test(name))) {
    return { queue: 'operations', reason: 'operations queue' };
  }
  if (teams.includes('team:pmo')) {
    const active = labels.includes('pmo:active') || labels.includes('lifecycle:active');
    return {
      queue: active ? 'pmo-active' : 'pmo-pipeline',
      reason: active ? 'pmo active' : 'pmo pipeline',
    };
  }
  if (teams.includes('team:governance')) {
    return { queue: 'governance', reason: 'governance queue' };
  }
  if (teams.includes('team:engineering')) {
    return { queue: 'engineering', reason: 'engineering queue' };
  }
  if (labels.includes('agent:cursor')) {
    return { queue: 'engineering', reason: 'agent:cursor claim without another team label' };
  }
  return { queue: null, reason: 'no cursor queue' };
}

function lifecycleOf(labels) {
  return labels.find((name) => name.startsWith('status:')) || 'open';
}

function dependencyNumbers(issue) {
  if (Array.isArray(issue.blockedBy)) return issue.blockedBy.map(Number);
  const text = String(issue.body || '');
  const found = new Set();
  for (const match of text.matchAll(/\b(?:blocked by|depends on)\s+#(\d+)/gi)) {
    found.add(Number(match[1]));
  }
  return [...found];
}

export function rejectionReason(issue, { openNumbers = null } = {}) {
  if (!issue || issue.state === 'closed' || issue.closed) return 'closed';
  const labels = labelNames(issue);
  if (!labels.includes('agent:cursor')) return 'assignee is not implementation authority';
  if (labels.includes('superseded') || /^SUPERSEDED\b/i.test(issue.title || '')) return 'superseded';
  const blocking = labels.find((name) => BLOCKING_STATUSES.has(name));
  if (blocking) return `blocking ${blocking}`;
  if (labels.includes('hold') || labels.includes('planning')) return 'hold or planning label';
  if (/^(HOLD|PLANNING|BACKLOG)\b/i.test(issue.title || '')) return 'hold or planning title';
  if (/^HOLD\b/m.test(String(issue.body || ''))) return 'hold marker in body';
  const text = `${issue.title || ''}\n${issue.body || ''}`;
  if (FORBID_BODY.some((pattern) => pattern.test(text))) return 'body forbids Cursor implementation';
  const queue = classifyQueue(issue);
  if (!queue.queue) return queue.reason;
  const open = openNumbers instanceof Set ? openNumbers : new Set(openNumbers || []);
  const blocked = dependencyNumbers(issue).filter((number) => open.has(number));
  if (blocked.length) return `dependency blocked by #${blocked.join(', #')}`;
  return null;
}

function result({ status, issue, queue, lifecycle, priorityReason, eligibilityReason, rejected }) {
  return {
    status,
    issue: issue ?? null,
    queue: queue ?? null,
    lifecycle: lifecycle ?? null,
    priorityReason,
    eligibilityReason,
    rejected,
  };
}

export function resolveCursorNextWork(issues, options = {}) {
  const rejected = [];
  if (options.disabled) {
    return result({
      status: RESOLVER_STATUS.DISABLED,
      priorityReason: 'resolver disabled',
      eligibilityReason: 'CURSOR_NEXT_WORK_RESOLVER=0',
      rejected,
    });
  }

  const openNumbers = new Set(
    (issues || [])
      .filter((issue) => issue && issue.state !== 'closed' && !issue.closed)
      .map((issue) => Number(issue.number)),
  );
  if (options.openNumbers) {
    for (const number of options.openNumbers) openNumbers.add(Number(number));
  }

  const eligible = [];
  for (const issue of issues || []) {
    const reason = rejectionReason(issue, { openNumbers });
    if (reason) {
      rejected.push({ number: issue?.number ?? null, reason });
      continue;
    }
    eligible.push(issue);
  }

  if (options.activeIssue != null) {
    const active = eligible.find((issue) => Number(issue.number) === Number(options.activeIssue));
    if (active) {
      const labels = labelNames(active);
      const queue = classifyQueue(active);
      return result({
        status: RESOLVER_STATUS.SELECTED,
        issue: Number(active.number),
        queue: queue.queue,
        lifecycle: lifecycleOf(labels),
        priorityReason: 'active claim already held; duplicate dispatch suppressed',
        eligibilityReason: 'existing agent:cursor claim remains eligible',
        rejected,
      });
    }
  }

  eligible.sort((a, b) => {
    const qa = QUEUE_RANK[classifyQueue(a).queue];
    const qb = QUEUE_RANK[classifyQueue(b).queue];
    if (qa !== qb) return qa - qb;
    const pa = opsPriority(labelNames(a));
    const pb = opsPriority(labelNames(b));
    if (pa !== pb) return pa - pb;
    return Number(a.number) - Number(b.number);
  });

  if (eligible.length === 0) {
    return result({
      status: RESOLVER_STATUS.NO_ELIGIBLE_WORK,
      priorityReason: 'no eligible agent:cursor issue',
      eligibilityReason: NO_ELIGIBLE_WORK,
      rejected,
    });
  }

  const selected = eligible[0];
  const labels = labelNames(selected);
  const queue = classifyQueue(selected);
  const ahead = eligible.length - 1;
  return result({
    status: RESOLVER_STATUS.SELECTED,
    issue: Number(selected.number),
    queue: queue.queue,
    lifecycle: lifecycleOf(labels),
    priorityReason: `${queue.reason}; #3629 order; ${ahead} later eligible issue(s) not dispatched`,
    eligibilityReason: 'agent:cursor claim is open and not queued, held, blocked, or forbidden',
    rejected,
  });
}
