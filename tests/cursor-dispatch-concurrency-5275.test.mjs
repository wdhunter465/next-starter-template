import { describe, it, expect } from 'vitest';
import fs from 'node:fs';

// #5275: wakes for different Issues must not cancel each other.
const workflow = fs.readFileSync('.github/workflows/lgfc-cursor-dispatch.yml', 'utf8');
const concurrency = workflow.match(/^concurrency:\n((?:[ \t]+.*\n|\n)+?)(?=\S)/m)?.[1] ?? '';

describe('cursor dispatch concurrency (#5275)', () => {
  it('has a concurrency block', () => {
    expect(concurrency).not.toBe('');
  });

  it('keys the group on the Issue number, with a run-id fallback for manual dispatch', () => {
    const group = concurrency.match(/^\s*group:\s*(.+)$/m)?.[1]?.trim();
    expect(group).toBe('lgfc-cursor-dispatch-${{ github.event.issue.number || github.run_id }}');
  });

  it('never uses one fixed group name for every Issue', () => {
    const group = concurrency.match(/^\s*group:\s*(.+)$/m)?.[1]?.trim() ?? '';
    expect(group).toContain('${{');
    expect(group).not.toBe('lgfc-cursor-dispatch');
  });

  it('does not cancel a wake that is already running', () => {
    expect(concurrency).toMatch(/^\s*cancel-in-progress:\s*false\s*$/m);
  });
});
