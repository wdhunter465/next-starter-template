import { describe, expect, it, vi } from 'vitest';

import {
  fetchIssueCommentsSince,
  ingestIssueComments,
  mapIssueCommentToChatterboxEvent,
  postChatterboxEvent,
  shouldIngestComment,
} from '../scripts/ci/chatterbox_github_ingest.mjs';

describe('shouldIngestComment', () => {
  it('ingests a comment not already known', () => {
    expect(shouldIngestComment({ id: 5 }, new Set([1, 2]))).toBe(true);
  });

  it('skips a comment already ingested', () => {
    expect(shouldIngestComment({ id: 5 }, new Set([5]))).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(shouldIngestComment(null)).toBe(false);
    expect(shouldIngestComment({ id: 'not-a-number' })).toBe(false);
  });
});

describe('mapIssueCommentToChatterboxEvent', () => {
  it('builds a SYSTEM event with an exact github_ref citation and deterministic idempotency key', () => {
    const comment = { id: 123, user: { login: 'wdhunter465' }, body: 'Product Authority decision — GO' };
    const payload = mapIssueCommentToChatterboxEvent(comment, {
      roomKey: 'lgfc-website',
      participantKey: 'github-clerk',
      repository: 'wdhunter465/next-starter-template',
      issueNumber: '3415',
    });

    expect(payload).toMatchObject({
      room_key: 'lgfc-website',
      participant_key: 'github-clerk',
      event_type: 'SYSTEM',
      task_ref: '3415',
      idempotency_key: 'github-comment-123',
      github_ref: {
        issue: '3415',
        comment_id: 123,
        repository: 'wdhunter465/next-starter-template',
      },
    });
    expect(payload.body).toContain('@wdhunter465');
    expect(payload.body).toContain('Product Authority decision — GO');
  });

  it('truncates a very long comment body rather than posting it unbounded', () => {
    const comment = { id: 1, user: { login: 'a' }, body: 'x'.repeat(2000) };
    const payload = mapIssueCommentToChatterboxEvent(comment, {
      roomKey: 'r',
      participantKey: 'p',
      repository: 'o/r',
      issueNumber: '1',
    });
    expect(payload.body.length).toBeLessThan(600);
  });

  it('handles a missing author gracefully', () => {
    const comment = { id: 1, body: 'no user field' };
    const payload = mapIssueCommentToChatterboxEvent(comment, {
      roomKey: 'r',
      participantKey: 'p',
      repository: 'o/r',
      issueNumber: '1',
    });
    expect(payload.body).toContain('@unknown');
  });
});

describe('fetchIssueCommentsSince', () => {
  it('requests the comments endpoint with a since param when provided', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: 1 }, { id: 2 }],
      text: async () => '',
    });

    const comments = await fetchIssueCommentsSince({
      token: 't',
      repository: 'o/r',
      issueNumber: '5',
      since: '2026-08-14T00:00:00Z',
      fetchFn,
    });

    expect(comments).toEqual([{ id: 1 }, { id: 2 }]);
    const [calledUrl] = fetchFn.mock.calls[0];
    expect(calledUrl).toContain('/repos/o/r/issues/5/comments');
    expect(calledUrl).toContain('since=2026-08-14T00%3A00%3A00Z');
  });

  it('returns an empty array rather than throwing when the response is not an array', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ message: 'not found' }),
      text: async () => '',
    });
    const comments = await fetchIssueCommentsSince({ token: 't', repository: 'o/r', issueNumber: '5', fetchFn });
    expect(comments).toEqual([]);
  });
});

describe('postChatterboxEvent', () => {
  it('posts with the admin token header and returns the parsed body', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, event: { id: 9 } }),
    });

    const result = await postChatterboxEvent({
      baseUrl: 'https://example.pages.dev',
      adminToken: 'secret',
      payload: { room_key: 'r' },
      fetchFn,
    });

    expect(result).toEqual({ ok: true, event: { id: 9 } });
    const [url, options] = fetchFn.mock.calls[0];
    expect(url).toBe('https://example.pages.dev/api/chatterbox/events');
    expect(options.headers['x-admin-token']).toBe('secret');
    expect(options.method).toBe('POST');
  });

  it('throws with response detail on a non-ok response', async () => {
    const fetchFn = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ ok: false, error: 'forbidden' }),
    });

    await expect(
      postChatterboxEvent({ baseUrl: 'https://x', adminToken: 't', payload: {}, fetchFn }),
    ).rejects.toThrow(/403/);
  });
});

describe('ingestIssueComments', () => {
  it('fetches then posts each fetched comment, reporting idempotent replays', async () => {
    const fetchFn = vi
      .fn()
      // fetchIssueCommentsSince call
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ id: 1, user: { login: 'a' }, body: 'first' }, { id: 2, user: { login: 'b' }, body: 'second' }],
        text: async () => '',
      })
      // postChatterboxEvent for comment 1 (new)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, event: { id: 100 } }) })
      // postChatterboxEvent for comment 2 (already ingested)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, idempotent_replay: true }) });

    const result = await ingestIssueComments({
      token: 't',
      repository: 'o/r',
      issueNumber: '5',
      baseUrl: 'https://x',
      adminToken: 'admin',
      roomKey: 'room',
      participantKey: 'clerk',
      fetchFn,
    });

    expect(result.totalFetched).toBe(2);
    expect(result.ingested).toEqual([
      { commentId: 1, idempotentReplay: false },
      { commentId: 2, idempotentReplay: true },
    ]);
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });
});
