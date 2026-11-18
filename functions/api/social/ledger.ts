// GET  /api/social/ledger?post_id=<id>   rows already recorded for a post
// POST /api/social/ledger                 record one post on one platform
// Authenticated by the scheduled-content bridge token, like publish-due (#4253). It can only
// read and write social_post_ledger rows for posts in the reviewed queue (#5156, design #5143).
// A platform that is already 'posted' or 'handed_off' is never overwritten: the answer is 409, so a rerun
// cannot post twice. 'handed_off' (#5289) is for Facebook, Instagram and Pinterest, where the job only opens
// a hand-off Issue and the platform is not read back. A 'failed' row can be retried and its attempts count
// goes up.

import { requireScheduledContentBridge } from "../../_lib/scheduled-content-auth";
import { SOCIAL_PLATFORMS, findPost } from "../../_lib/social-queue";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);

  const postId = new URL(request.url).searchParams.get("post_id") ?? "";
  if (!findPost(postId)) return json({ ok: false, error: "unknown post_id" }, 400);
  const rows = await env.DB.prepare(
    "SELECT post_id, platform, status, platform_post_id, attempts, error, recorded_at FROM social_post_ledger WHERE post_id = ?;",
  )
    .bind(postId)
    .all();
  return json({ ok: true, rows: rows.results ?? [] }, 200);
};

export const onRequestPost = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);

  let body: any;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }
  const postId = String(body?.post_id ?? "");
  const platform = String(body?.platform ?? "");
  const status = String(body?.status ?? "");
  if (!findPost(postId)) return json({ ok: false, error: "unknown post_id" }, 400);
  if (!(SOCIAL_PLATFORMS as string[]).includes(platform)) return json({ ok: false, error: "unknown platform" }, 400);
  if (status !== "posted" && status !== "failed" && status !== "handed_off") {
    return json({ ok: false, error: "status must be posted, handed_off or failed" }, 400);
  }
  const platformPostId = body?.platform_post_id ? String(body.platform_post_id).slice(0, 200) : null;
  const error = body?.error ? String(body.error).slice(0, 500) : null;

  const existing: any = await env.DB.prepare(
    "SELECT status, attempts FROM social_post_ledger WHERE post_id = ? AND platform = ?;",
  )
    .bind(postId, platform)
    .first();

  if (existing?.status === "posted" || existing?.status === "handed_off") {
    return json(
      { ok: false, error: existing.status === "posted" ? "already posted" : "already handed off", post_id: postId, platform },
      409,
    );
  }
  if (existing) {
    await env.DB.prepare(
      "UPDATE social_post_ledger SET status = ?, platform_post_id = ?, error = ?, attempts = attempts + 1, recorded_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE post_id = ? AND platform = ?;",
    )
      .bind(status, platformPostId, error, postId, platform)
      .run();
    return json({ ok: true, post_id: postId, platform, status, attempts: Number(existing.attempts) + 1 }, 200);
  }
  await env.DB.prepare(
    "INSERT INTO social_post_ledger (post_id, platform, status, platform_post_id, error) VALUES (?, ?, ?, ?, ?);",
  )
    .bind(postId, platform, status, platformPostId, error)
    .run();
  return json({ ok: true, post_id: postId, platform, status, attempts: 1 }, 201);
};
