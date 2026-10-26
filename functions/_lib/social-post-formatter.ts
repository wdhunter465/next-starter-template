// #4936 -- one ready-to-post version of a published post per LGFC social
// platform, built here (tested) so each Zap branch only maps fields instead of
// trimming text itself. Used by functions/api/scheduled-content/publish-due.ts.
//
// Contract: docs/reference/operations/social-crosspost-zapier-payload-contract.md
//
// Limits are counted in UTF-16 units (an emoji is 2). That over-counts against
// every platform's own rule, which is the safe direction: a post is never
// longer than the platform allows. No hashtags are added; the hashtag rule is
// an open Product Authority decision on #4785.

export const SOCIAL_LIMITS = {
  instagramCaption: 2200,
  xText: 280,
  pinterestTitle: 100,
  pinterestDescription: 500,
} as const;

const ELLIPSIS = '…';

export type SocialPostInput = {
  title: string;
  caption: string;
  post_url: string | null;
  image_url: string | null;
  image_alt: string | null;
};

export type SkipReason = 'no_image' | null;

export type SocialPosts = {
  facebook_page: { text: string; link: string | null; image_url: string | null; image_alt: string | null };
  // Zapier cannot post to a Facebook Group; this feeds the Group-admin reminder step.
  facebook_group: { text: string; link: string | null; image_url: string | null; image_alt: string | null };
  instagram: { caption: string; image_url: string | null; image_alt: string | null; skip: boolean; skip_reason: SkipReason };
  x: { text: string; image_url: string | null; skip: boolean; skip_reason: SkipReason };
  pinterest: {
    title: string;
    description: string;
    link: string | null;
    image_url: string | null;
    skip: boolean;
    skip_reason: SkipReason;
  };
};

/**
 * Cuts text to at most `max` UTF-16 units, ending with an ellipsis, only when it
 * is over the limit. Never splits an emoji (a surrogate pair), and backs up to a
 * word boundary when one is close to the end.
 */
export function truncateText(text: string, max: number): string {
  if (text.length <= max) return text;
  if (max <= 0) return '';
  if (max === 1) return ELLIPSIS;

  let out = '';
  for (const ch of Array.from(text)) {
    if (out.length + ch.length > max - ELLIPSIS.length) break;
    out += ch;
  }

  const lastSpace = out.lastIndexOf(' ');
  if (lastSpace > out.length * 0.6) out = out.slice(0, lastSpace);

  return `${out.trimEnd()}${ELLIPSIS}`;
}

function xText(caption: string, link: string | null): string {
  if (link) {
    const budget = SOCIAL_LIMITS.xText - link.length - 1;
    if (budget >= 1) return `${truncateText(caption, budget)} ${link}`;
  }
  return truncateText(caption, SOCIAL_LIMITS.xText);
}

export function formatSocialPosts(input: SocialPostInput): SocialPosts {
  const title = (input.title || '').trim();
  const caption = (input.caption || '').trim() || title;
  const link = input.post_url || null;
  const imageUrl = input.image_url || null;
  const imageAlt = imageUrl ? input.image_alt || null : null;
  const noImage: SkipReason = imageUrl ? null : 'no_image';

  return {
    facebook_page: { text: caption, link, image_url: imageUrl, image_alt: imageAlt },
    facebook_group: { text: caption, link, image_url: imageUrl, image_alt: imageAlt },
    // Instagram captions cannot carry a clickable link, so none is added.
    instagram: {
      caption: truncateText(caption, SOCIAL_LIMITS.instagramCaption),
      image_url: imageUrl,
      image_alt: imageAlt,
      skip: !imageUrl,
      skip_reason: noImage,
    },
    x: {
      text: xText(caption, link),
      image_url: imageUrl,
      skip: false,
      skip_reason: null,
    },
    pinterest: {
      title: truncateText(title || caption, SOCIAL_LIMITS.pinterestTitle),
      description: truncateText(caption, SOCIAL_LIMITS.pinterestDescription),
      link,
      image_url: imageUrl,
      skip: !imageUrl,
      skip_reason: noImage,
    },
  };
}
