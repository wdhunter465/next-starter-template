// @vitest-environment node
// #5158: the social feed lists a post only once its publish time has arrived, and escapes its text.

import { describe, expect, it } from 'vitest';

import { buildFeed, onRequestGet, xmlEscape } from '../../functions/api/social/feed';

const post = (over: Record<string, unknown> = {}) =>
  ({
    id: 'p1',
    publish_at: '2026-11-09T10:00:00-05:00',
    topic: 'A & B',
    text: 'Gehrig "4" <home> runs',
    photo_id: 1,
    alt_text: 'alt <text>',
    platforms: ['facebook'],
    sources: 's',
    status: 'approved',
    ...over,
  }) as any;

describe('social feed', () => {
  it('lists nothing before the publish time', () => {
    const xml = buildFeed('https://example.test', [post()], Date.parse('2026-11-09T14:59:59Z'));
    expect(xml).not.toContain('<item>');
  });

  it('lists the post at its publish time with its image address and escaped text', () => {
    const xml = buildFeed('https://example.test', [post()], Date.parse('2026-11-09T15:00:00Z'));
    expect(xml).toContain('<guid isPermaLink="false">p1</guid>');
    expect(xml).toContain('<enclosure url="https://example.test/api/social/image/p1"');
    expect(xml).toContain('A &amp; B');
    expect(xml).toContain('Gehrig &quot;4&quot; &lt;home&gt; runs');
    expect(xml).toContain('Mon, 09 Nov 2026 15:00:00 GMT');
  });

  it('leaves out drafts and puts the newest first', () => {
    const xml = buildFeed(
      'https://example.test',
      [
        post({ id: 'old', publish_at: '2026-11-08T10:00:00-05:00' }),
        post({ id: 'new', publish_at: '2026-11-09T10:00:00-05:00' }),
        post({ id: 'draft', status: 'draft' }),
      ],
      Date.parse('2026-11-10T00:00:00Z'),
    );
    expect(xml.indexOf('>new<')).toBeLessThan(xml.indexOf('>old<'));
    expect(xml).not.toContain('>draft<');
  });

  it('lists a post only in the feeds of its platforms', () => {
    const posts = [post({ id: 'a', platforms: ['facebook', 'instagram'] }), post({ id: 'b', platforms: ['facebook'] })];
    const now = Date.parse('2026-11-10T00:00:00Z');
    const ig = buildFeed('https://example.test', posts, now, 'instagram');
    expect(ig).toContain('>a<');
    expect(ig).not.toContain('>b<');
    expect(buildFeed('https://example.test', posts, now, 'facebook')).toContain('>b<');
    expect(buildFeed('https://example.test', posts, now)).toContain('>b<');
  });

  it('filters by the platform query and rejects an unknown platform', async () => {
    const ok = await onRequestGet({ request: new Request('https://example.test/api/social/feed?platform=instagram') });
    expect(ok.status).toBe(200);
    const bad = await onRequestGet({ request: new Request('https://example.test/api/social/feed?platform=myspace') });
    expect(bad.status).toBe(400);
  });

  it('serves RSS from the handler', async () => {
    const res = await onRequestGet({ request: new Request('https://example.test/api/social/feed') });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('application/rss+xml');
    expect(await res.text()).toContain('<rss version="2.0"');
  });

  it('escapes the five XML characters', () => {
    expect(xmlEscape(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&apos;');
  });
});
