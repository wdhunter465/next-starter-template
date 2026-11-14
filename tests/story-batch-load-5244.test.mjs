import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BATCH_DIR,
  REQUIRED_COLUMNS,
  buildInsertStatement,
  buildReviewNotes,
  buildRollbackSql,
  isApplyMode,
  parseTarget,
  planBatch,
  resolveBatchPath,
  validateBatch,
} from '../scripts/ci/story_batch_load.mjs';

const COLUMNS = new Set([...REQUIRED_COLUMNS, 'id']);

function story(overrides = {}) {
  return {
    tag: 'gehrig-1939-farewell',
    title: 'The farewell speech',
    text: 'On July 4, 1939, Lou Gehrig spoke at Yankee Stadium.',
    story_type: 'brief',
    credit_line: 'Lou Gehrig Fan Club',
    verification: { status: 'unverified' },
    ...overrides,
  };
}

const THREE = [
  { name: 'a', url: 'https://example.com/a' },
  { name: 'b', url: 'https://example.com/b' },
  { name: 'c', url: 'https://example.com/c' },
];

describe('story batch validation (#5244)', () => {
  it('accepts a good batch and normalizes it', () => {
    const { errors, stories } = validateBatch({ batch_id: 'b1', stories: [story({ verification: { status: 'three_source_verified', sources: THREE } })] });
    expect(errors).toEqual([]);
    expect(stories).toHaveLength(1);
    expect(stories[0]).toMatchObject({ tag: 'gehrig-1939-farewell', story_type: 'brief', verification_status: 'three_source_verified' });
  });

  it('never loads the example batch', () => {
    const example = JSON.parse(readFileSync('data/stories/example-batch.json', 'utf8'));
    const { errors } = validateBatch(example);
    expect(errors.join(' ')).toMatch(/example/i);
  });

  it('needs three distinct source URLs before a story may be marked three-source verified', () => {
    const two = validateBatch({ batch_id: 'b', stories: [story({ verification: { status: 'three_source_verified', sources: THREE.slice(0, 2) } })] });
    expect(two.errors.join(' ')).toMatch(/three distinct source URLs/);
    const sameUrl = validateBatch({
      batch_id: 'b',
      stories: [story({ verification: { status: 'three_source_verified', sources: [THREE[0], THREE[0], THREE[0]] } })],
    });
    expect(sameUrl.errors.join(' ')).toMatch(/three distinct source URLs/);
    const three = validateBatch({ batch_id: 'b', stories: [story({ verification: { status: 'three_source_verified', sources: THREE } })] });
    expect(three.errors).toEqual([]);
  });

  it('requires the Eig credit, the book and the page on an excerpt', () => {
    const base = { excerpt_of: { work: 'Luckiest Man', author: 'Jonathan Eig', page: 123 } };
    const ok = validateBatch({ batch_id: 'b', stories: [story({ ...base, credit_line: 'From Jonathan Eig, Luckiest Man, p. 123' })] });
    expect(ok.errors).toEqual([]);
    const noAuthor = validateBatch({ batch_id: 'b', stories: [story({ ...base, credit_line: 'Luckiest Man, p. 123' })] });
    expect(noAuthor.errors.join(' ')).toMatch(/credit Jonathan Eig/);
    const noWork = validateBatch({ batch_id: 'b', stories: [story({ ...base, credit_line: 'Jonathan Eig, p. 123' })] });
    expect(noWork.errors.join(' ')).toMatch(/name Luckiest Man/);
    const noPage = validateBatch({ batch_id: 'b', stories: [story({ ...base, credit_line: 'Jonathan Eig, Luckiest Man' })] });
    expect(noPage.errors.join(' ')).toMatch(/page 123/);
    const noPageKnown = validateBatch({
      batch_id: 'b',
      stories: [story({ excerpt_of: { work: 'Luckiest Man', author: 'Jonathan Eig' }, credit_line: 'Jonathan Eig, Luckiest Man' })],
    });
    expect(noPageKnown.errors).toEqual([]);
  });

  it('rejects bad tags, duplicates, bad types, missing fields, scripts and oversized batches', () => {
    const bad = validateBatch({
      batch_id: 'b',
      stories: [
        story({ tag: 'Bad Tag' }),
        story({ tag: 'dup-tag' }),
        story({ tag: 'dup-tag' }),
        story({ tag: 'bad-type', story_type: 'epic' }),
        story({ tag: 'no-credit', credit_line: '' }),
        story({ tag: 'has-script', text: 'hi <script>alert(1)</script>' }),
        story({ tag: 'bad-date', event_date: 'July 4' }),
        story({ tag: 'bad-url', source_url: 'ftp://x' }),
      ],
    });
    const joined = bad.errors.join(' | ');
    for (const expected of ['lowercase slug', 'duplicate tag', 'story_type must be', 'credit_line is required', 'script tags', 'event_date must be', 'source_url must be']) {
      expect(joined).toContain(expected);
    }
    expect(validateBatch({ batch_id: '', stories: [story()] }).errors.join(' ')).toMatch(/batch_id/);
    expect(validateBatch({ batch_id: 'b', stories: [] }).errors.join(' ')).toMatch(/non-empty/);
    const many = Array.from({ length: 101 }, (_, i) => story({ tag: `story-number-${i}` }));
    expect(validateBatch({ batch_id: 'b', stories: many }).errors.join(' ')).toMatch(/at most 100/);
  });
});

describe('story batch SQL (#5244)', () => {
  const { stories } = validateBatch({ batch_id: 'b', stories: [story({ title: "It's Lou's day" })] });

  it('inserts a draft, canonical, unpublished row, and only inserts', () => {
    const sql = buildInsertStatement(stories[0], COLUMNS);
    expect(sql.startsWith('INSERT OR IGNORE INTO content_inventory')).toBe(true);
    expect(sql).toContain("'draft'");
    expect(sql).not.toMatch(/\b(UPDATE|DELETE|DROP|ALTER)\b/i);
    expect(sql).not.toContain("'published'");
    expect(sql).toContain("'It''s Lou''s day'");
  });

  it('records the verification state in the review notes', () => {
    const unverified = buildReviewNotes(stories[0]);
    expect(unverified).toMatch(/UNVERIFIED/);
    const verified = validateBatch({ batch_id: 'b', stories: [story({ verification: { status: 'three_source_verified', sources: THREE } })] }).stories[0];
    expect(buildReviewNotes(verified)).toContain('https://example.com/a ; https://example.com/b ; https://example.com/c');
    expect(buildReviewNotes(verified)).not.toMatch(/UNVERIFIED/);
  });

  it('fails when the table is missing a column the loader needs', () => {
    const missing = new Set(COLUMNS);
    missing.delete('review_notes');
    expect(() => buildInsertStatement(stories[0], missing)).toThrow(/review_notes/);
  });

  it('skips tags that already exist', () => {
    const two = validateBatch({ batch_id: 'b', stories: [story({ tag: 'one-story' }), story({ tag: 'two-story' })] }).stories;
    const plan = planBatch(two, ['one-story']);
    expect(plan.toInsert.map((s) => s.tag)).toEqual(['two-story']);
    expect(plan.skipped.map((s) => s.tag)).toEqual(['one-story']);
  });

  it('rolls back only draft rows of the batch', () => {
    const sql = buildRollbackSql(stories);
    expect(sql).toMatch(/^DELETE FROM content_inventory WHERE canonical = 1 AND status = 'draft' AND tag IN \('gehrig-1939-farewell'\);$/);
  });
});

describe('story batch gates (#5244)', () => {
  it('writes only with MODE=apply and CONFIRM_WRITE=confirm', () => {
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: 'confirm' })).toBe(true);
    expect(isApplyMode({ MODE: 'apply', CONFIRM_WRITE: '' })).toBe(false);
    expect(isApplyMode({ MODE: 'dry-run', CONFIRM_WRITE: 'confirm' })).toBe(false);
    expect(isApplyMode({})).toBe(false);
  });

  it('accepts only dev or prod', () => {
    expect(parseTarget({ TARGET: 'DEV' })).toBe('dev');
    expect(parseTarget({ TARGET: 'prod' })).toBe('prod');
    expect(parseTarget({ TARGET: 'staging' })).toBeNull();
    expect(parseTarget({})).toBeNull();
  });

  it('takes a batch file only from directly under data/stories', () => {
    expect(resolveBatchPath(`${BATCH_DIR}/batch-1.json`, '/repo').abs).toBe('/repo/data/stories/batch-1.json');
    for (const bad of ['', 'data/stories/sub/batch.json', '../data/stories/batch.json', 'data/other/batch.json', 'data/stories/batch.txt', '/etc/passwd']) {
      expect(resolveBatchPath(bad, '/repo').error).toBeTruthy();
    }
  });

  it('keeps the workflow to a dry run by default behind two gates', () => {
    const workflow = readFileSync('.github/workflows/ops-story-batch-load.yml', 'utf8');
    expect(workflow).toContain("if [ \"${{ inputs.confirm_write }}\" != \"confirm\" ]");
    expect(workflow).toMatch(/mode:[\s\S]*default: dry-run/);
    expect(workflow).toContain('contents: read');
    expect(workflow).not.toMatch(/pull_request|schedule:/);
    expect(workflow).toContain('scripts/ci/story_batch_load.mjs');
  });
});
