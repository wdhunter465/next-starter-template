import { buildTeamQueueCounts, classifyTeamQueue, classifyOpenIssuePartition } from './team-queue-counts.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function issue(number, { state = 'open', labels = [], pull_request } = {}) {
  return {
    number,
    state,
    labels: labels.map((name) => ({ name })),
    pull_request
  };
}

assert(classifyTeamQueue(issue(1, { labels: ['team:operations', 'ops:priority:1'] })) === 'operations', 'operations');
assert(
  classifyTeamQueue(issue(15, { labels: ['ops-pr-escalation'] })) === 'operations',
  'ops-pr-escalation alone counts as operations'
);
assert(
  classifyTeamQueue(issue(16, { labels: ['ops-pr-escalation', 'team:pmo', 'pmo:active'] })) === 'operations',
  'ops-pr-escalation takes precedence for Operations count'
);
assert(
  classifyTeamQueue(issue(18, { labels: ['post-merge-failure', 'status:active', 'agent:claude'] })) ===
    'operations',
  'post-merge-failure exception (e.g. #4381) counts as operations'
);
assert(
  classifyTeamQueue(issue(19, { labels: ['post-merge-failure', 'ops-pr-escalation'] })) === 'operations',
  'both exception labels still count once as operations'
);
assert(classifyTeamQueue(issue(2, { labels: ['team:pmo', 'pmo:active', 'pmo:priority:1'] })) === 'pmoActive', 'pmo active');
assert(
  classifyTeamQueue(issue(12, { labels: ['team:pmo', 'pmo:active', 'pmo:task'] })) === null,
  'pmo task with team:pmo is not a parent queue row'
);
assert(
  classifyTeamQueue(issue(13, { labels: ['team:pmo', 'pmo:pipeline', 'pmo:task'] })) === null,
  'pmo task with pipeline labels is not a parent queue row'
);
assert(classifyTeamQueue(issue(3, { labels: ['team:engineering', 'eng:priority:1'] })) === 'engineering', 'engineering');
assert(classifyTeamQueue(issue(4, { labels: ['team:governance', 'gov:priority:1'] })) === 'governance', 'governance');
assert(
  classifyTeamQueue(issue(5, { labels: ['team:pmo', 'pmo:pipeline', 'pmo:pipeline-priority:3'] })) === 'pmoPipeline',
  'pmo pipeline'
);

assert(classifyTeamQueue(issue(6, { state: 'closed', labels: ['team:operations'] })) === null, 'closed omitted');
assert(classifyTeamQueue(issue(7, { labels: ['team:operations', 'team:pmo'] })) === null, 'multi-team omitted');
assert(
  classifyTeamQueue(issue(8, { labels: ['team:pmo', 'pmo:active', 'pmo:pipeline'] })) === null,
  'dual lifecycle omitted'
);
assert(classifyTeamQueue(issue(9, { labels: ['team:pmo', 'pmo:priority:3'] })) === null, 'team:pmo without lifecycle omitted');
assert(classifyTeamQueue(issue(10, { labels: ['pmo:active'] })) === null, 'no team omitted');
assert(classifyTeamQueue(issue(11, { labels: ['team:operations'], pull_request: {} })) === null, 'pull requests omitted');
assert(
  classifyTeamQueue(issue(17, { state: 'closed', labels: ['ops-pr-escalation'] })) === null,
  'closed ops-pr-escalation omitted'
);
assert(
  classifyTeamQueue(issue(20, { state: 'closed', labels: ['post-merge-failure'] })) === null,
  'closed post-merge-failure omitted'
);

assert(classifyOpenIssuePartition(issue(100, { labels: ['pmo:task'] })) === 'pmoTasks', 'partition task');
assert(
  classifyOpenIssuePartition(issue(101, { labels: ['pmo:task', 'team:engineering'] })) === 'pmoTasks',
  'partition task wins over team label'
);
assert(
  classifyOpenIssuePartition(issue(102, { labels: ['status:active'] })) === 'other',
  'partition unassigned'
);
assert(
  classifyOpenIssuePartition(issue(103, { labels: ['team:pmo', 'pmo:active'] })) === 'pmoParents',
  'partition pmo parent'
);
assert(
  classifyOpenIssuePartition(issue(104, { labels: ['ops-pr-escalation', 'pmo:task'] })) === 'operations',
  'ops exception wins over task in partition'
);

const counts = buildTeamQueueCounts(
  [
    issue(1, { labels: ['team:operations'] }),
    issue(2, { labels: ['team:operations'] }),
    issue(3, { labels: ['team:pmo', 'pmo:active'] }),
    issue(4, { labels: ['team:engineering'] }),
    issue(5, { labels: ['team:governance'] }),
    issue(6, { labels: ['team:pmo', 'pmo:pipeline'] }),
    issue(7, { labels: ['team:pmo', 'pmo:pipeline'] }),
    issue(8, { labels: ['team:pmo', 'pmo:pipeline'] }),
    issue(9, { state: 'closed', labels: ['team:operations'] }),
    issue(10, { labels: ['team:operations', 'team:engineering'] }),
    issue(14, { labels: ['team:pmo', 'pmo:active', 'pmo:task'] }),
    issue(15, { labels: ['ops-pr-escalation'] }),
    issue(16, { labels: ['ops-pr-escalation', 'post-merge-failure'] }),
    issue(18, { labels: ['post-merge-failure', 'status:active', 'agent:claude'] }),
    issue(21, { labels: ['pmo:task'] }),
    issue(22, { labels: ['random-label'] })
  ],
  { owner: 'wdhunter465', repo: 'next-starter-template' }
);

assert(counts.order.join(',') === 'operations,engineering,governance', 'team row order');
assert(counts.queues.map((queue) => queue.title).join(',') === 'Operations,Engineering,Governance', 'team display titles');
assert(
  counts.queues.map((queue) => queue.count).join(',') === '5,1,1',
  'team open counts including exception labels'
);
assert(counts.pmoOrder.join(',') === 'pmoTracked,pmoPipeline,pmoActive', 'pmo row order');
assert(counts.pmoQueues.map((queue) => queue.title).join(',') === 'PMO tracked,PMO Pipeline,PMO Active', 'pmo display titles');
assert(counts.pmoQueues.map((queue) => queue.count).join(',') === '4,3,1', 'pmo parent counts: tracked = pipeline + active');

// Open issues in the fixture (exclude closed #9): 15
assert(counts.totalOpenIssues === 15, `totalOpenIssues expected 15 got ${counts.totalOpenIssues}`);
assert(counts.pmoTaskQueue.id === 'pmoTasks', 'pmo task queue id');
assert(counts.pmoTaskQueue.count === 2, 'pmo task count: #14 and #21');
assert(counts.otherQueue.count === 2, 'other count: multi-team #10 and random #22');

const b = counts.breakout;
assert(b.operations === 5, 'breakout operations');
assert(b.engineering === 1, 'breakout engineering');
assert(b.governance === 1, 'breakout governance');
assert(b.pmoParents === 4, 'breakout pmo parents');
assert(b.pmoTasks === 2, 'breakout pmo tasks');
assert(b.other === 2, 'breakout other');
assert(
  b.operations + b.engineering + b.governance + b.pmoParents + b.pmoTasks + b.other === b.totalOpenIssues,
  'breakout partition sums to totalOpenIssues'
);
assert(b.totalOpenIssues === counts.totalOpenIssues, 'breakout total matches top-level');

const expectedOpsQuery = encodeURIComponent(
  'is:open is:issue label:team:operations,ops-pr-escalation,post-merge-failure'
);
assert(
  counts.queues[0].issueSearchUrl ===
    `https://github.com/wdhunter465/next-starter-template/issues?q=${expectedOpsQuery}`,
  'operations search URL includes exception labels and is:issue'
);

// Every queue search must exclude PRs (is:issue) so links match classifyTeamQueue.
for (const queue of [...counts.queues, ...counts.pmoQueues, counts.pmoTaskQueue, counts.otherQueue]) {
  assert(
    queue.issueSearchUrl.includes('is%3Aissue'),
    `${queue.id} search URL must include is:issue`
  );
}

assert(
  counts.queues[1].issueSearchUrl.includes('label%3Ateam%3Aengineering'),
  'engineering search includes team:engineering'
);
assert(
  counts.queues[2].issueSearchUrl.includes('label%3Ateam%3Agovernance'),
  'governance search includes team:governance'
);
assert(
  counts.pmoQueues[1].issueSearchUrl.includes('label%3Apmo%3Apipeline'),
  'pmo pipeline search includes lifecycle'
);
assert(
  counts.pmoQueues[2].issueSearchUrl.includes('label%3Apmo%3Aactive') &&
    counts.pmoQueues[2].issueSearchUrl.includes('label%3Apmo%3Aparent') &&
    counts.pmoQueues[2].issueSearchUrl.includes('-label%3Apmo%3Atask'),
  'pmo active search includes parent, lifecycle, and omits tasks'
);
assert(
  counts.pmoQueues[0].issueSearchUrl.includes('label%3Apmo%3Aparent') &&
    counts.pmoQueues[0].issueSearchUrl.includes('-label%3Apmo%3Atask'),
  'pmo tracked search includes parent and omits tasks'
);
assert(
  counts.pmoTaskQueue.issueSearchUrl.includes('label%3Apmo%3Atask'),
  'pmo task search includes pmo:task'
);
assert(
  counts.totalOpenIssuesUrl.includes('is%3Aopen') && counts.totalOpenIssuesUrl.includes('is%3Aissue'),
  'total open issues search URL'
);

console.log('team-queue count contract passed');
