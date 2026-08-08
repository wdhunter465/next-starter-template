import { describe, expect, it } from 'vitest';
import {
  createOfflineIssueStore,
  renderExerciseMarkdown,
  runFailureExercise,
  seededHealthyResults,
  seededUnhealthyResults,
} from '../scripts/ci/production_health_failure_exercise.mjs';
import { issueTitle } from '../scripts/ci/production_health_routing.mjs';

describe('#2917 offline failure exercise', () => {
  it('seeds unhealthy fixtures covering unavailable/degraded/stale', () => {
    const states = seededUnhealthyResults().map((row) => row.state).sort();
    expect(states).toEqual(['degraded', 'stale', 'unavailable']);
    expect(seededHealthyResults().every((row) => row.state === 'healthy')).toBe(true);
  });

  it('routes seeded failures, updates without duplicates, then closes on recovery', async () => {
    const store = createOfflineIssueStore();
    const report = await runFailureExercise({ store });

    const createPhase = report.phases.find((p) => p.name === 'seeded_failures_create');
    expect(createPhase.outcomes.every((o) => o.action === 'created')).toBe(true);
    expect(createPhase.outcomes).toHaveLength(3);

    const updatePhase = report.phases.find((p) => p.name === 'seeded_failures_update');
    expect(updatePhase.outcomes.every((o) => o.action === 'updated')).toBe(true);

    const recoverPhase = report.phases.find((p) => p.name === 'recovery_close');
    expect(recoverPhase.outcomes.every((o) => o.action === 'closed')).toBe(true);

    // While unhealthy, one open issue per check title — no spam duplicates
    const openRoutingTitles = [...store.issues.values()]
      .filter((issue) => issue.source === 'routing' && issue.state === 'open')
      .map((issue) => issue.title);
    // After recovery + hold re-seed, only the held d1_health routing issue remains open
    expect(openRoutingTitles).toEqual(['OPS — Production health: d1_health']);
  });

  it('keeps monitoring-hold from auto-closing a recovered check', async () => {
    const store = createOfflineIssueStore();
    const report = await runFailureExercise({ store });
    const holdPhase = report.phases.find((p) => p.name === 'monitoring_hold_blocks_close');
    expect(holdPhase.outcomes[0].action).toBe('held');

    const held = [...store.issues.values()].find(
      (issue) => issue.title === issueTitle('d1_health') && issue.state === 'open',
    );
    expect(held).toBeTruthy();
    expect(held.labels.some((label) => label.name === 'monitoring-hold')).toBe(true);
  });

  it('proves collector disable produces no routing upserts', async () => {
    const report = await runFailureExercise();
    const phase = report.phases.find((p) => p.name === 'collector_disable_no_results');
    expect(phase.upsertCalls).toBe(0);
    expect(phase.outcomes).toEqual([]);
  });

  it('proves routing disable still allows manual Ops Issue intake', async () => {
    const store = createOfflineIssueStore();
    const report = await runFailureExercise({ store });
    const phase = report.phases.find((p) => p.name === 'routing_disable_manual_intake');
    expect(phase.routingInvoked).toBe(false);
    expect(phase.manualIssue.html_url).toContain('/issues/');
    expect(report.summary.openManualIssues).toBe(1);
    expect(report.productionMutation).toBe(false);
    expect(report.liveGitHubCalls).toBe(false);
  });

  it('renders durable markdown evidence without Production mutation claims', () => {
    const md = renderExerciseMarkdown({
      mode: 'offline-fixture',
      productionMutation: false,
      liveGitHubCalls: false,
      summary: { openRoutingIssues: 1, openManualIssues: 1 },
      phases: [{ name: 'recovery_close', outcomes: [{ action: 'closed' }] }],
    });
    expect(md).toContain('#2917');
    expect(md).toContain('Production mutation: false');
    expect(md).toContain('`recovery_close`');
  });
});
