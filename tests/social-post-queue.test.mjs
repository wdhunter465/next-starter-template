import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classifyPosts, validatePost, validateQueue } from '../scripts/ops/social-post-queue.mjs';

const real = JSON.parse(readFileSync('docs/reference/operations/social-post-queue.json', 'utf8'));
const footer = real.footer_required;

const queue = () => ({
  lateness_hours: 4,
  rights_cleared_photo_ids: [1, 2],
  held_photo_ids: [9],
  footer_required: footer,
  posts: [],
});
const post = (over = {}) => ({
  id: 'p1',
  publish_at: '2026-11-09T10:00:00-05:00',
  text: `A fact.\n\n${footer}`,
  photo_id: 1,
  alt_text: 'A photo',
  platforms: ['x', 'facebook'],
  sources: 'SABR',
  status: 'approved',
  ...over,
});

describe('social post queue', () => {
  it('accepts the committed queue', () => {
    expect(validateQueue(real)).toEqual([]);
  });

  it('accepts a valid post', () => {
    expect(validatePost(post(), queue())).toEqual([]);
  });

  it('rejects missing alt text', () => {
    expect(validatePost(post({ alt_text: ' ' }), queue()).join()).toMatch(/alt_text/);
  });

  it('rejects text over 280 characters', () => {
    expect(validatePost(post({ text: `${'a'.repeat(260)}\n\n${footer}` }), queue()).join()).toMatch(/over 280/);
  });

  it('rejects a missing footer', () => {
    expect(validatePost(post({ text: 'No footer' }), queue()).join()).toMatch(/footer/);
  });

  it('rejects a photo not on the cleared list and a held photo', () => {
    expect(validatePost(post({ photo_id: 5 }), queue()).join()).toMatch(/not on the rights-cleared list/);
    expect(validatePost(post({ photo_id: 9 }), queue()).join()).toMatch(/held/);
  });

  it('rejects an unknown platform and a time without an offset', () => {
    expect(validatePost(post({ platforms: ['myspace'] }), queue()).join()).toMatch(/unknown platform/);
    expect(validatePost(post({ publish_at: '2026-11-09T10:00:00' }), queue()).join()).toMatch(/offset/);
  });

  it('rejects a duplicate id and a reused photo', () => {
    const q = queue();
    q.posts = [post(), post()];
    const text = validateQueue(q).join();
    expect(text).toMatch(/duplicate id/);
    expect(text).toMatch(/used twice/);
  });

  it('classifies due, late and upcoming posts and skips posted ones', () => {
    const q = queue();
    q.posts = [
      post({ id: 'due', publish_at: '2026-11-09T10:00:00-05:00', photo_id: 1 }),
      post({ id: 'late', publish_at: '2026-11-08T10:00:00-05:00', photo_id: 2 }),
      post({ id: 'next', publish_at: '2026-11-10T10:00:00-05:00', photo_id: 2 }),
      post({ id: 'done', publish_at: '2026-11-09T10:00:00-05:00', photo_id: 1 }),
    ];
    const now = Date.parse('2026-11-09T11:00:00-05:00');
    const r = classifyPosts(q, now, ['done']);
    expect(r.due.map((p) => p.id)).toEqual(['due']);
    expect(r.late.map((p) => p.id)).toEqual(['late']);
    expect(r.upcoming.map((p) => p.id)).toEqual(['next']);
  });

  it('treats the lateness window as inclusive at 4 hours and late after', () => {
    const q = queue();
    q.posts = [post()];
    expect(classifyPosts(q, Date.parse('2026-11-09T14:00:00-05:00')).due).toHaveLength(1);
    expect(classifyPosts(q, Date.parse('2026-11-09T14:00:01-05:00')).late).toHaveLength(1);
  });
});
