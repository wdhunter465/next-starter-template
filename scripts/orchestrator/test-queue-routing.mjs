#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  classifyQueueCandidate,
  evaluateCollaborationBoundary,
  selectNextDispatch
} from './queue-routing.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const matrixPath = path.join(__dirname, 'fixtures/queue-routing-matrix.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runCase(testCase) {
  if (testCase.collaboration) {
    const result = evaluateCollaborationBoundary(testCase.issue, testCase.collaboration);
    for (const [key, expected] of Object.entries(testCase.expect || {})) {
      assert(
        result[key] === expected,
        `${testCase.id}: expected ${key}=${expected}, got ${result[key]}`
      );
    }
    return;
  }

  const classification = classifyQueueCandidate(testCase.issue, testCase.context || {});
  for (const [key, expected] of Object.entries(testCase.expect || {})) {
    assert(
      classification[key] === expected,
      `${testCase.id}: expected ${key}=${JSON.stringify(expected)}, got ${JSON.stringify(classification[key])} (${classification.reasons?.join(',') || 'no-reasons'})`
    );
  }
}

function runSelection(testCase) {
  const result = selectNextDispatch(testCase.candidates);
  assert(
    result.selectedIssueNumber === testCase.expectSelected,
    `${testCase.id}: expected selected ${testCase.expectSelected}, got ${result.selectedIssueNumber}`
  );
  if (testCase.expectIntervalOnly) {
    for (const number of testCase.expectIntervalOnly) {
      assert(
        result.intervalOnly.includes(number),
        `${testCase.id}: expected interval-only #${number}`
      );
    }
  }
}

for (const testCase of matrix.cases) {
  runCase(testCase);
}
for (const testCase of matrix.selectionCases || []) {
  runSelection(testCase);
}

// Wiring coverage: selector + routing contract
{
  const routing = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../.github/orchestrator-routing.json'), 'utf8')
  );
  assert(routing.version === 3, 'orchestrator-routing must be version 3');
  assert(routing.queueAwareDispatch?.enabled === true, 'queueAwareDispatch must be enabled');
  assert(
    routing.queueAwareDispatch.decisionModule === 'scripts/orchestrator/queue-routing.mjs',
    'decision module path'
  );
}

// Governance branch coverage (#3629 decision, #3642 implementation).
// Kept inline rather than added to fixtures/queue-routing-matrix.json, which is
// outside #3642's declared file allowlist; only the one pre-existing case whose
// expected precedenceRank changed as a direct consequence of the re-rank was
// updated there.
{
  const numbered = classifyQueueCandidate({
    number: 8001,
    state: 'open',
    labels: ['team:governance', 'gov:priority:1']
  });
  assert(numbered.lane === 'governance', 'gov-numbered: lane governance');
  assert(numbered.eligible === true, 'gov-numbered: eligible');
  assert(numbered.precedenceRank === 5, 'gov-numbered: rank 5 (last of the five #3629 lanes)');
  assert(numbered.blocksNormalWork === false, 'gov-numbered: never an automatic interrupt');

  const review = classifyQueueCandidate({
    number: 8002,
    state: 'open',
    labels: ['team:governance', 'gov:review']
  });
  assert(review.lane === 'governance', 'gov-review: lane governance');
  assert(review.action === 'interval_update', 'gov-review: interval_update');
  assert(review.eligible === false, 'gov-review: non-blocking, not dispatchable');

  const hold = classifyQueueCandidate({
    number: 8003,
    state: 'open',
    labels: ['team:governance', 'gov:hold']
  });
  assert(hold.action === 'interval_update', 'gov-hold: interval_update');
  assert(hold.eligible === false, 'gov-hold: non-blocking, not dispatchable');

  const missing = classifyQueueCandidate({
    number: 8004,
    state: 'open',
    labels: ['team:governance']
  });
  assert(missing.eligible === false, 'gov-missing-state: fails closed');
  assert(missing.failClosed === true, 'gov-missing-state: failClosed true');

  // #3629 adopted order end-to-end: PMO Pipeline before Engineering before Governance.
  const order = selectNextDispatch([
    { number: 8001, state: 'open', labels: ['team:governance', 'gov:priority:1'] },
    { number: 3001, state: 'open', labels: ['team:engineering', 'eng:priority:1'] },
    {
      number: 3003,
      state: 'open',
      labels: [
        'pmo',
        'pmo:pipeline',
        'team:pmo',
        'pmo:pipeline-priority:1',
        'pmo:stage:pending-launch-packet'
      ]
    }
  ]);
  assert(order.selectedIssueNumber === 3003, 'order: PMO Pipeline selected over Engineering and Governance');

  const engBeforeGov = selectNextDispatch([
    { number: 8001, state: 'open', labels: ['team:governance', 'gov:priority:1'] },
    { number: 3001, state: 'open', labels: ['team:engineering', 'eng:priority:1'] }
  ]);
  assert(engBeforeGov.selectedIssueNumber === 3001, 'order: Engineering selected over Governance');
}

{
  const { selectFromIssues } = await import('./select-next-queue-work.mjs');
  const issues = [
    {
      number: 3001,
      state: 'open',
      labels: [
        { name: 'pmo' },
        { name: 'pmo:pipeline' },
        { name: 'team:pmo' },
        { name: 'pmo:pipeline-priority:1' },
        { name: 'pmo:stage:pending-launch-packet' }
      ],
      body: ''
    },
    {
      number: 1001,
      state: 'open',
      labels: [{ name: 'team:operations' }, { name: 'ops:priority:1' }],
      body: ''
    }
  ];
  const selected = selectFromIssues(issues);
  assert(selected.selectedIssueNumber === 1001, 'selector must prefer numbered Operations');
}

{
  const { validateEligibility } = await import('../cursor-bridge/lib/eligibility.mjs');
  const bad = validateEligibility(
    {
      number: 9,
      state: 'OPEN',
      labels: [{ name: 'agent:cursor' }, { name: 'handoff:ready' }, { name: 'team:operations' }, { name: 'ops:priority:1' }, { name: 'pmo:priority:1' }],
      body: ''
    },
    [
      {
        id: 1,
        body: 'CHATGPT RESPONSE\nOK',
        createdAt: '2026-07-22T00:00:00.000Z',
        url: 'https://example.com/#issuecomment-1'
      },
      {
        id: 2,
        body: 'LOCAL CURSOR RESUME\nIssue: #9\nResume from: https://example.com/#issuecomment-1\nNext local action:\n- do one thing\n',
        createdAt: '2026-07-22T00:01:00.000Z'
      }
    ],
    { skipQueueRoutingCheck: false }
  );
  assert(bad.ok, 'Bridge launch remains mechanically eligible; queue conflict is informational');
  assert(
    bad.semanticFindings.some((error) => error.startsWith('queue_routing_ineligible:')),
    'queue_routing_ineligible finding required'
  );
}

console.log(
  `Queue routing tests passed (${matrix.cases.length} cases, ${(matrix.selectionCases || []).length} selection cases, wiring checks ok)`
);
