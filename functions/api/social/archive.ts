// POST /api/social/archive  { "post_id": "2026-11-09-daily" }
// Saves the text of a daily social post into the archive (D1 content_items), because text plus photo together
// make up the LGFC archive (#5097, Product Authority direction 2026-11-05).
//
// Authenticated by the scheduled-content bridge token, like the social ledger (#5156). The row is built here from
// the reviewed queue (data/social-post-queue.json) and the send ledger, never from the request body, so a caller
// can only ask for a post that already exists in the reviewed queue. It never approves or publishes anything:
//   - review_status 'pending_review', publication_status 'not_ready', rights_status 'unknown' (a person decides
//     the rights and the approval; automation may not, per the content pipeline as-built record #3551)
//   - only a post whose publish time has arrived and that the ledger shows as posted on at least one platform
// Idempotent: the row key is candidate_id = 'social-post-<post_id>' (UNIQUE), so a rerun refreshes the sent-post
// details in source_metadata and changes nothing a person has decided.

import { requireScheduledContentBridge } from "../../_lib/scheduled-content-auth";
import { findPost, isPublished } from "../../_lib/social-queue";

type D1Like = {
  prepare(sql: string): {
    bind(...values: unknown[]): {
      all(): Promise<{ results?: unknown[] }>;
      first(): Promise<unknown>;
      run(): Promise<unknown>;
    };
  };
};
type Context = { request: Request; env: { DB?: D1Like; SCHEDULED_CONTENT_BRIDGE_TOKEN?: string } };

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

export const archiveCandidateId = (postId: string) => `social-post-${postId}`;

export const onRequestPost = async (context: Context): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);

  let body: { post_id?: unknown };
  try {
    body = (await request.json()) as { post_id?: unknown };
  } catch {
    return json({ ok: false, error: "invalid JSON" }, 400);
  }
  const postId = String(body?.post_id ?? "");
  const post = findPost(postId);
  if (!post) return json({ ok: false, error: "unknown post_id" }, 400);
  if (!isPublished(post)) return json({ ok: false, error: "post is not published yet", post_id: postId }, 409);

  const ledger = await env.DB.prepare(
    "SELECT platform, status, platform_post_id, recorded_at FROM social_post_ledger WHERE post_id = ? ORDER BY platform;",
  )
    .bind(postId)
    .all();
  const rows = (ledger.results ?? []) as Array<{ platform: string; status: string; platform_post_id: string | null; recorded_at: string }>;
  const posted = rows.filter((r) => r.status === "posted");
  if (posted.length === 0) return json({ ok: false, error: "post has not been recorded as posted", post_id: postId }, 409);

  const metadata = JSON.stringify({
    kind: "daily_social_post",
    post_id: post.id,
    publish_at: post.publish_at,
    photo_id: post.photo_id,
    alt_text: post.alt_text,
    citation: post.sources,
    platforms_planned: post.platforms,
    sent: posted.map((r) => ({ platform: r.platform, platform_post_id: r.platform_post_id, recorded_at: r.recorded_at })),
    note: "Original LGFC text. Rights and approval are for a person to set; automation sets neither.",
  });

  const candidateId = archiveCandidateId(post.id);
  await env.DB.prepare(
    `INSERT INTO content_items (
       candidate_id, input_stream, title, source_name, source_type, content_type, summary,
       date_or_period, provenance_notes, rights_status, source_trust_status, relevance_status,
       review_status, publication_status, publication_target, privacy_flag, privacy_review_status,
       credit_line, review_priority, source_metadata
     ) VALUES (?, 'admin_seed', ?, 'LGFC daily post', 'operator', 'timeline_fact', ?,
       ?, ?, 'unknown', 'pending', 'pending', 'pending_review', 'not_ready', 'social', 'none', 'not_applicable',
       'Lou Gehrig Fan Club', 'normal', ?)
     ON CONFLICT(candidate_id) DO UPDATE SET
       source_metadata = excluded.source_metadata,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`,
  )
    .bind(
      candidateId,
      post.topic,
      post.text,
      post.publish_at.slice(0, 10),
      "Daily social post written by LGFC from public statistics and a verified source; sent through the reviewed queue.",
      metadata,
    )
    .run();

  const row = (await env.DB.prepare("SELECT id, review_status, publication_status FROM content_items WHERE candidate_id = ?;")
    .bind(candidateId)
    .first()) as { id: number; review_status: string; publication_status: string } | null;

  return json(
    {
      ok: true,
      post_id: post.id,
      content_item_id: row?.id ?? null,
      review_status: row?.review_status ?? null,
      publication_status: row?.publication_status ?? null,
      sent_platforms: posted.map((r) => r.platform),
    },
    200,
  );
};
