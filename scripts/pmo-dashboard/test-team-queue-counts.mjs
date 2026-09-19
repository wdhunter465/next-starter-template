import { buildTeamQueueCounts, classifyTeamQueue } from './team-queue-counts.mjs';

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
    issue(14, { labels: ['team:pmo', 'pmo:active', 'pmo:task'] })
  ],
  { owner: 'wdhunter465', repo: 'next-starter-template' }
);

assert(counts.order.join(',') === 'operations,engineering,governance', 'team row order');
assert(counts.queues.map((queue) => queue.title).join(',') === 'Operations,Engineering,Governance', 'team display titles');
assert(counts.queues.map((queue) => queue.count).join(',') === '2,1,1', 'team exclusive open counts');
assert(counts.pmoOrder.join(',') === 'pmoTracked,pmoPipeline,pmoActive', 'pmo row order');
assert(counts.pmoQueues.map((queue) => queue.title).join(',') === 'PMO tracked,PMO Pipeline,PMO Active', 'pmo display titles');
assert(counts.pmoQueues.map((queue) => queue.count).join(',') === '4,3,1', 'pmo parent counts: tracked = pipeline + active');
assert(
  counts.queues[0].issueSearchUrl === 'https://github.com/wdhunter465/next-starter-template/issues?q=is%3Aopen%20label%3Ateam%3Aoperations',
  'operations search URL'
);
assert(
  counts.pmoQueues[2].issueSearchUrl.includes('label%3Apmo%3Aactive') &&
    counts.pmoQueues[2].issueSearchUrl.includes('-label%3Apmo%3Atask'),
  'pmo active search includes lifecycle and omits tasks'
);
assert(counts.pmoQueues[0].issueSearchUrl.includes('-label%3Apmo%3Atask'), 'pmo tracked search omits tasks');

console.log('team-queue count contract passed');
