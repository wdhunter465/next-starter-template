import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planTerminalLabelReconciliation } from '../scripts/ci/post_merge_source_issue_closeout.mjs';
import { hasMarker, planPmoRepair } from '../scripts/ci/pmo_label_repair.mjs';

const REPO = ['status:complete', 'status:post-merge-verify', 'status:active', 'pmo:closed', 'pmo:active', 'pmo:pipeline', 'pmo'];

describe('closeout sets the PMO labels in the same step that closes the issue (#5242)', () => {
  it('adds pmo:closed and clears pmo:active for a PMO task', () => {
    const plan = planTerminalLabelReconciliation({
      issueLabels: ['pmo', 'pmo:task', 'pmo:active', 'status:post-merge-verify', 'status:active'],
      repoLabels: REPO,
    });
    expect(plan.ok).toBe(true);
    expect(plan.removeLabels).toEqual(expect.arrayContaining(['pmo:active', 'status:post-merge-verify', 'status:active']));
    expect(plan.addLabel).toBe('status:complete');
    expect(plan.extraAddLabels).toEqual(['pmo:closed']);
    expect(plan.terminalLabels).toEqual(expect.arrayContaining(['pmo', 'pmo:task', 'status:complete', 'pmo:closed']));
    expect(plan.terminalLabels).not.toContain('pmo:active');
  });

  it('clears pmo:pipeline too, and does not add pmo:closed twice', () => {
    const plan = planTerminalLabelReconciliation({
      issueLabels: ['pmo', 'pmo:pipeline', 'pmo:closed', 'status:post-merge-verify'],
      repoLabels: REPO,
    });
    expect(plan.removeLabels).toContain('pmo:pipeline');
    expect(plan.extraAddLabels).toBeUndefined();
    expect(plan.terminalLabels.filter((l) => l === 'pmo:closed')).toHaveLength(1);
  });

  it('reconciles a non-PMO issue exactly as before', () => {
    const plan = planTerminalLabelReconciliation({
      issueLabels: ['team:engineering', 'status:post-merge-verify', 'status:active'],
      repoLabels: REPO,
    });
    expect(plan.removeLabels.sort()).toEqual(['status:active', 'status:post-merge-verify']);
    expect(plan.extraAddLabels).toBeUndefined();
    expect(plan.terminalLabels).not.toContain('pmo:closed');
  });

  it('leaves PMO labels alone when the repository has no pmo:closed label', () => {
    const plan = planTerminalLabelReconciliation({
      issueLabels: ['pmo', 'pmo:active', 'status:post-merge-verify'],
      repoLabels: ['status:complete', 'pmo'],
    });
    expect(plan.removeLabels).not.toContain('pmo:active');
    expect(plan.extraAddLabels).toBeUndefined();
  });
});

describe('issue-event PMO label repair (#5242)', () => {
  it('repairs a closed PMO issue that is missing pmo:closed', () => {
    const plan = planPmoRepair({ state: 'closed', labels: ['pmo', 'pmo:task', 'pmo:active', 'status:active', 'status:complete'] });
    expect(plan).toEqual({ action: 'repair', addLabels: ['pmo:closed'], removeLabels: ['pmo:active', 'status:active'] });
  });

  it('removes stale lifecycle labels from a closed issue that already has pmo:closed', () => {
    const plan = planPmoRepair({ state: 'closed', labels: ['pmo', 'pmo:closed', 'pmo:pipeline'] });
    expect(plan).toEqual({ action: 'repair', addLabels: [], removeLabels: ['pmo:pipeline'] });
  });

  it('does nothing for a clean closed issue, an open PMO issue, or a non-PMO issue', () => {
    expect(planPmoRepair({ state: 'closed', labels: ['pmo', 'pmo:closed', 'status:complete'] }).action).toBe('none');
    expect(planPmoRepair({ state: 'open', labels: ['pmo', 'pmo:active'] }).action).toBe('none');
    expect(planPmoRepair({ state: 'closed', labels: ['team:engineering'] }).action).toBe('none');
    expect(planPmoRepair({ state: 'closed', labels: [] }).action).toBe('none');
  });

  it('comments, and never changes labels, on the non-deterministic cases', () => {
    const open = planPmoRepair({ state: 'open', labels: ['pmo', 'pmo:closed'] });
    expect(open).toMatchObject({ action: 'comment', kind: 'open_with_pmo_closed', addLabels: [], removeLabels: [] });
    const both = planPmoRepair({ state: 'open', labels: ['pmo', 'pmo:active', 'pmo:pipeline'] });
    expect(both).toMatchObject({ action: 'comment', kind: 'conflicting_lifecycle', addLabels: [], removeLabels: [] });
  });

  it('comments once per kind', () => {
    const comments = [{ body: 'x <!-- pmo-label-repair:open_with_pmo_closed --> y' }];
    expect(hasMarker(comments, 'open_with_pmo_closed')).toBe(true);
    expect(hasMarker(comments, 'conflicting_lifecycle')).toBe(false);
    expect(hasMarker([], 'open_with_pmo_closed')).toBe(false);
  });

  it('runs on issue events with minimal permissions and never closes or reopens an issue', () => {
    const workflow = readFileSync('.github/workflows/pmo-label-repair.yml', 'utf8');
    expect(workflow).toMatch(/issues:\s*\n\s*types: \[closed, reopened, labeled, unlabeled\]/);
    expect(workflow).toContain('issues: write');
    expect(workflow).toContain('contents: read');
    const script = readFileSync('scripts/ci/pmo_label_repair.mjs', 'utf8');
    // It only adds and removes labels and posts comments: no PATCH, so it cannot close or reopen an issue.
    expect(script).not.toContain("method: 'PATCH'");
  });
});
