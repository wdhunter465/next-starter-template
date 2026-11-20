import { buildQueueWorklist } from './queue-worklist.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function issue(number, labels = [], { state = 'open', body = '', title = `Issue ${number}`, pull_request } = {}) {
  return { number, state, body, title, pull_request, labels: labels.map((name) => ({ name })) };
}

const issues = [
  issue(1, ['team:operations', 'ops:priority:2']),
  issue(2, ['team:operations']),
  issue(3, ['post-merge-failure']),
  issue(4, ['team:operations', 'ops:hold']),
  issue(10, ['team:engineering', 'eng:priority:3']),
  issue(11, ['team:engineering', 'eng:priority:1', 'go-live-2027']),
  issue(12, ['team:engineering', 'eng:priority:2']),
  issue(13, ['team:engineering', 'eng:priority:1', 'status:hold', 'go-live-2027']),
  issue(14, ['team:engineering']),
  issue(20, ['team:governance', 'gov:priority:2', 'wait:product']),
  issue(21, ['team:governance', 'gov:priority:1']),
  issue(30, ['team:pmo', 'pmo:active', 'pmo:priority:2']),
  issue(31, ['team:pmo', 'pmo:active', 'pmo:priority:1']),
  issue(32, ['team:pmo', 'pmo:pipeline', 'pmo:pipeline-priority:5']),
  issue(40, ['pmo:task'], { body: 'Parent: #30' }),
  issue(41, ['team:engineering', 'pmo:task']),
  issue(50, []),
  issue(51, ['team:engineering', 'team:governance']),
  issue(60, ['team:engineering'], { state: 'closed' }),
  issue(61, ['team:engineering'], { pull_request: {} })
];

const w = buildQueueWorklist(issues, { owner: 'o', repo: 'r' });
const rows = (id) => w.queues.find((q) => q.id === id).rows.map((r) => r.number);

assert(JSON.stringify(w.order) === '["operations","engineering","governance","pmo"]', 'queue order');
// Operations: interrupt tier (1, 3), then other (2), held last (4). 51 is multi-team and unplaced.
assert(JSON.stringify(rows('operations')) === '[1,3,2,4]', `operations order ${rows('operations')}`);
assert(JSON.stringify(w.interrupt.map((r) => r.number)) === '[1,3]', 'interrupt banner rows');
// Engineering: go-live first, then priority (1,2,3), unprioritised last, held last.
assert(JSON.stringify(rows('engineering')) === '[11,12,10,14,13]', `engineering order ${rows('engineering')}`);
assert(JSON.stringify(rows('governance')) === '[21,20]', `governance order ${rows('governance')}`);
assert(JSON.stringify(rows('pmo')) === '[31,30,32]', `pmo order ${rows('pmo')}`);

const a = w.accounting;
assert(a.totalOpenIssues === 18, `total ${a.totalOpenIssues}`);
assert(a.projectChildren === 2 && JSON.stringify(a.projectChildrenWithTeamLabel) === '[41]', 'children accounting');
assert(JSON.stringify(a.noTeamLabel) === '[3,40,50]'.replace('3,40,', '') || JSON.stringify(a.noTeamLabel) === '[50]', `no team ${a.noTeamLabel}`);
assert(JSON.stringify(a.multipleTeamLabels) === '[51]', 'multi team');
assert(a.unplaced === 2 && a.listed === 14, `unplaced ${a.unplaced} listed ${a.listed}`);
assert(a.balanced, 'accounting balances');
assert(w.issueUrlBase === 'https://github.com/o/r/issues/', 'issue url base');

const empty = buildQueueWorklist([], {});
assert(empty.accounting.balanced && empty.queues.every((q) => q.rows.length === 0), 'empty input');

console.log('Queue worklist test passed');
