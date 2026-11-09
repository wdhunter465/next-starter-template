// The reviewed social post queue (data/social-post-queue.json, #5155) as the site sees it.
// A post is public only once its publish time has arrived (#5156): the image proxy and, later,
// the feed (#5158) call isPublished() before returning anything about a post.

import queue from "../../data/social-post-queue.json";

export type SocialPlatform = "x" | "facebook" | "instagram" | "pinterest";
export const SOCIAL_PLATFORMS: SocialPlatform[] = ["x", "facebook", "instagram", "pinterest"];

export type SocialPost = {
  id: string;
  publish_at: string;
  topic: string;
  text: string;
  photo_id: number;
  alt_text: string;
  platforms: SocialPlatform[];
  sources: string;
  status: string;
};

export function allPosts(): SocialPost[] {
  return (queue as { posts: SocialPost[] }).posts;
}

export function findPost(id: string): SocialPost | null {
  return allPosts().find((p) => p.id === id) ?? null;
}

/** Approved and its publish time has arrived. Nothing is public before that. */
export function isPublished(post: SocialPost, now: number = Date.now()): boolean {
  const at = Date.parse(post.publish_at);
  return post.status === "approved" && !Number.isNaN(at) && now >= at;
}
