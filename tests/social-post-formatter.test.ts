import { describe, expect, it } from 'vitest';

import {
  SOCIAL_LIMITS,
  formatSocialPosts,
  truncateText,
} from '../functions/_lib/social-post-formatter';

// #4936: one ready-to-post version per platform, built by the sweep so each Zap
// branch only maps fields. Limits are counted in UTF-16 units (an emoji is 2),
// which is the conservative direction for every platform.

const POST_URL = 'https://www.lougehrigfanclub.com/fundraiser-details/';
const IMAGE = 'https://b2.example.com/photo.jpg';

function input(overrides: Partial<Parameters<typeof formatSocialPosts>[0]> = {}) {
  return {
    title: 'Grand prize announced!',
    caption: 'Grand prize day! See the full details on LGFC.com',
    post_url: POST_URL as string | null,
    image_url: IMAGE as string | null,
    image_alt: 'The grand prize trophy' as string | null,
    ...overrides,
  };
}

// An unpaired surrogate means a truncation split an emoji.
const UNPAIRED_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe('truncateText (#4936)', () => {
  it('returns text at or under the limit unchanged', () => {
    expect(truncateText('short', 10)).toBe('short');
    expect(truncateText('exactly10!', 10)).toBe('exactly10!');
  });

  it('cuts over-limit text to the limit and ends with an ellipsis', () => {
    const out = truncateText('a'.repeat(50), 10);
    expect(out.length).toBeLessThanOrEqual(10);
    expect(out.endsWith('…')).toBe(true);
  });

  it('never splits an emoji at the boundary', () => {
    for (let pad = 0; pad < 6; pad += 1) {
      const out = truncateText(`${'a'.repeat(pad)}${'🎉'.repeat(20)}`, 10);
      expect(out.length).toBeLessThanOrEqual(10);
      expect(UNPAIRED_SURROGATE.test(out)).toBe(false);
    }
  });
});

describe('formatSocialPosts (#4936)', () => {
  it('gives Facebook Page and Facebook Group the caption, the link and the image', () => {
    const posts = formatSocialPosts(input());
    for (const entry of [posts.facebook_page, posts.facebook_group]) {
      expect(entry.text).toBe('Grand prize day! See the full details on LGFC.com');
      expect(entry.link).toBe(POST_URL);
      expect(entry.image_url).toBe(IMAGE);
      expect(entry.image_alt).toBe('The grand prize trophy');
    }
  });

  it('still posts to Facebook when the post has no image', () => {
    const posts = formatSocialPosts(input({ image_url: null, image_alt: null }));
    expect(posts.facebook_page.text).toContain('Grand prize day!');
    expect(posts.facebook_page.image_url).toBeNull();
  });

  it('gives Instagram a caption with no link and keeps it within 2,200', () => {
    const posts = formatSocialPosts(input());
    expect(posts.instagram.skip).toBe(false);
    expect(posts.instagram.skip_reason).toBeNull();
    expect(posts.instagram.image_url).toBe(IMAGE);
    expect(posts.instagram.caption).toBe('Grand prize day! See the full details on LGFC.com');
    expect(posts.instagram.caption).not.toContain('http');

    const long = formatSocialPosts(input({ caption: 'x'.repeat(5000) }));
    expect(long.instagram.caption.length).toBeLessThanOrEqual(SOCIAL_LIMITS.instagramCaption);
    expect(long.instagram.caption.endsWith('…')).toBe(true);
  });

  it('skips Instagram and Pinterest, not Facebook or X, when the post has no image', () => {
    const posts = formatSocialPosts(input({ image_url: null, image_alt: null }));
    expect(posts.instagram.skip).toBe(true);
    expect(posts.instagram.skip_reason).toBe('no_image');
    expect(posts.pinterest.skip).toBe(true);
    expect(posts.pinterest.skip_reason).toBe('no_image');
    expect(posts.x.skip).toBe(false);
    expect(posts.x.image_url).toBeNull();
  });

  it('puts the link at the end of the X post and keeps the whole post within 280', () => {
    const posts = formatSocialPosts(input());
    expect(posts.x.text).toBe(`Grand prize day! See the full details on LGFC.com ${POST_URL}`);
    expect(posts.x.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.xText);
  });

  it('truncates the X caption before the link and never cuts the link', () => {
    const posts = formatSocialPosts(input({ caption: 'word '.repeat(200) }));
    expect(posts.x.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.xText);
    expect(posts.x.text.endsWith(POST_URL)).toBe(true);
    expect(posts.x.text).toContain('…');
  });

  it('does not split an emoji when the X caption is cut', () => {
    for (let pad = 0; pad < 6; pad += 1) {
      const posts = formatSocialPosts(input({ caption: `${'a'.repeat(pad)}${'🎉'.repeat(200)}` }));
      expect(posts.x.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.xText);
      expect(UNPAIRED_SURROGATE.test(posts.x.text)).toBe(false);
      expect(posts.x.text.endsWith(POST_URL)).toBe(true);
    }
  });

  it('posts the X caption alone, within 280, when there is no link', () => {
    const posts = formatSocialPosts(input({ post_url: null, caption: 'y'.repeat(400) }));
    expect(posts.x.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.xText);
    expect(posts.x.text).not.toContain('http');
    expect(posts.facebook_page.link).toBeNull();
  });

  it('gives Pinterest a title within 100, a description within 500 and the link', () => {
    const posts = formatSocialPosts(
      input({ title: 'T'.repeat(300), caption: 'd'.repeat(900) }),
    );
    expect(posts.pinterest.skip).toBe(false);
    expect(posts.pinterest.title.length).toBeLessThanOrEqual(SOCIAL_LIMITS.pinterestTitle);
    expect(posts.pinterest.description.length).toBeLessThanOrEqual(SOCIAL_LIMITS.pinterestDescription);
    expect(posts.pinterest.link).toBe(POST_URL);
    expect(posts.pinterest.image_url).toBe(IMAGE);
  });

  it('falls back to the title when the caption is blank', () => {
    const posts = formatSocialPosts(input({ caption: '   ' }));
    expect(posts.facebook_page.text).toBe('Grand prize announced!');
    expect(posts.x.text.startsWith('Grand prize announced!')).toBe(true);
  });

  it('adds no hashtags', () => {
    const posts = formatSocialPosts(input());
    expect(JSON.stringify(posts)).not.toContain('#');
  });
});
