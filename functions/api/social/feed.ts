// GET /api/social/feed
// RSS 2.0 feed of the social posts whose publish time has arrived (#5158, design #5143).
// One Zapier Zap per platform (Facebook Page, Instagram, Pinterest) watches this feed with
// RSS by Zapier and posts each new item. A post appears here only at its publish time, so
// nothing is public earlier. The text is already public once posted; the photo is served
// by /api/social/image/<id>, which applies the same time and rights checks.

import { allPosts, isPublished, type SocialPost } from "../../_lib/social-queue";

const MAX_ITEMS = 20;

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildFeed(origin: string, posts: SocialPost[], now: number = Date.now()): string {
  const published = posts
    .filter((p) => isPublished(p, now))
    .sort((a, b) => Date.parse(b.publish_at) - Date.parse(a.publish_at))
    .slice(0, MAX_ITEMS);

  const items = published
    .map((p) => {
      const image = `${origin}/api/social/image/${p.id}`;
      return [
        "    <item>",
        `      <title>${xmlEscape(p.topic)}</title>`,
        `      <link>${xmlEscape(origin)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(p.id)}</guid>`,
        `      <pubDate>${new Date(p.publish_at).toUTCString()}</pubDate>`,
        `      <description>${xmlEscape(p.text)}</description>`,
        `      <enclosure url="${xmlEscape(image)}" type="image/jpeg" length="0" />`,
        `      <media:content url="${xmlEscape(image)}" medium="image" type="image/jpeg"><media:description>${xmlEscape(p.alt_text)}</media:description></media:content>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">',
    "  <channel>",
    "    <title>Lou Gehrig Fan Club daily post</title>",
    `    <link>${xmlEscape(origin)}</link>`,
    "    <description>The daily Lou Gehrig Fan Club social post, listed at its publish time.</description>",
    items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const origin = new URL(context.request.url).origin;
  return new Response(buildFeed(origin, allPosts()), {
    status: 200,
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
};
