#!/usr/bin/env node
import { planTaskChildLabelReconciliation } from './reconcile-task-child-labels.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

{
  const plan = planTaskChildLabelReconciliation({
    number: 1,
    state: 'open',
    title: 'TASK: missing lifecycle',
    labels: ['pmo', 'pmo:task']
  });
  assert(same(plan.add, ['pmo:active']), 'open missing lifecycle adds pmo:active');
  assert(same(plan.remove, []), 'open missing lifecycle removes nothing');
}

{
  const plan = planTaskChildLabelReconciliation({
    number: 2,
    state: 'closed',
    title: 'TASK: closed with priority and stage',
    labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:priority:1', 'pmo:stage:execution']
  });
  assert(same(plan.add, ['pmo:closed']), 'closed task adds pmo:closed');
  assert(same(plan.remove, ['pmo:active', 'pmo:priority:1', 'pmo:stage:execution']), 'closed task strips defects');
}

{
  const plan = planTaskChildLabelReconciliation({
    number: 3,
    state: 'open',
    title: 'TASK: prioritized open child',
    labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:priority:1', 'team:pmo']
  });
  assert(same(plan.add, []), 'prioritized open child needs no adds');
  assert(same(plan.remove, ['pmo:priority:1', 'team:pmo']), 'prioritized open child strips queue labels');
}

{
  const plan = planTaskChildLabelReconciliation({
    number: 31,
    state: 'open',
    title: 'TASK: pipeline-priority open child',
    labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:pipeline-priority:12']
  });
  assert(same(plan.add, []), 'pipeline-priority open child needs no adds');
  assert(same(plan.remove, ['pmo:pipeline-priority:12']), 'open child strips Pipeline priority');
}

{
  const plan = planTaskChildLabelReconciliation({
    number: 4,
    state: 'open',
    title: 'TASK: already valid',
    labels: ['pmo', 'pmo:task', 'pmo:active']
  });
  assert(plan.changed === false, 'valid open task is unchanged');
}

{
  const plan = planTaskChildLabelReconciliation({
    number: 5,
    state: 'open',
    title: 'TASK: conflicting open lifecycle',
    labels: ['pmo', 'pmo:task', 'pmo:active', 'pmo:pipeline', 'pmo:closed']
  });
  assert(same(plan.add, []), 'conflicting open lifecycle needs no add when active remains');
  assert(same(plan.remove, ['pmo:closed', 'pmo:pipeline']), 'keep pmo:active and drop others');
}

console.log('reconcile-task-child-labels unit tests passed');
