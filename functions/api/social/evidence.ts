// GET  /api/social/evidence?post_id=<id>  stored evidence versions for a post
// POST /api/social/evidence                 append one validated evidence record version
// Authenticated by the scheduled-content bridge token, like the social ledger. Records are
// append-only: a correction is the next version for the same post/platform, never an update.

import { requireScheduledContentBridge } from "../../_lib/scheduled-content-auth";
import { findPost, SOCIAL_PLATFORMS } from "../../_lib/social-queue";
import { AD_HOC_ID_RE, contactLikeUnknownFieldProblems, validateEvidenceRecord } from "../../_lib/social-evidence";

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { "Content-Type": "application/json" } });
}

function normalizeRecord(record: any): any {
  return { ...record, origin: record?.origin ?? "queue" };
}

function knownPostId(postId: string): boolean {
  return Boolean(findPost(postId)) || AD_HOC_ID_RE.test(postId);
}

function parseRecordJson(row: any): any {
  try {
    return { ...row, record_json: JSON.parse(row.record_json) };
  } catch {
    return row;
  }
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;
  const auth = requireScheduledContentBridge(request, env);
  if (!auth.ok) return auth.response;
  if (!env?.DB) return json({ ok: false, error: "DB binding unavailable" }, 503);

  const postId = new URL(request.url).searchParams.get("post_id") ?? "";
  if (!postId) return json({ ok: false, error: "post_id is required" }, 400);
  if (!knownPostId(postId)) return json({ ok: false, error: "unknown post_id" }, 400);

  const rows = await env.DB.prepare(
    "SELECT post_id, platform, version, origin, status, record_json, recorded_at FROM social_post_evidence WHERE post_id = ? ORDER BY platform, version;",
  )
    .bind(postId)
    .all();
  return json({ ok: true, rows: (rows.results ?? []).map(parseRecordJson) }, 200);
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

  const record = normalizeRecord(body);
  const problems = [...(await validateEvidenceRecord(record)), ...contactLikeUnknownFieldProblems(record)];
  if (problems.length) return json({ ok: false, error: "invalid evidence record", problems }, 400);

  const postId = String(record.post_id);
  const platform = String(record.platform);
  const origin = String(record.origin);
  if (!(SOCIAL_PLATFORMS as string[]).includes(platform)) return json({ ok: false, error: "unknown platform" }, 400);
  if (origin === "queue" && !findPost(postId)) return json({ ok: false, error: "unknown post_id" }, 400);
  if (origin === "ad_hoc" && !AD_HOC_ID_RE.test(postId)) return json({ ok: false, error: "invalid ad hoc post_id" }, 400);

  const duplicate = await env.DB.prepare("SELECT version FROM social_post_evidence WHERE post_id = ? AND platform = ? AND version = ?;")
    .bind(postId, platform, record.version)
    .first();
  if (duplicate) return json({ ok: false, error: "evidence version already exists", post_id: postId, platform, version: record.version }, 409);

  const maxRow: any = await env.DB.prepare("SELECT MAX(version) AS max_version FROM social_post_evidence WHERE post_id = ? AND platform = ?;")
    .bind(postId, platform)
    .first();
  const expectedVersion = Number(maxRow?.max_version ?? 0) + 1;
  if (record.version !== expectedVersion) {
    return json(
      { ok: false, error: "evidence version must be the next append-only version", expected_version: expectedVersion, version: record.version },
      400,
    );
  }

  try {
    await env.DB.prepare(
      "INSERT INTO social_post_evidence (post_id, platform, version, origin, status, record_json) VALUES (?, ?, ?, ?, ?, ?);",
    )
      .bind(postId, platform, record.version, origin, record.status, JSON.stringify(record))
      .run();
  } catch (error) {
    return json(
      {
        ok: false,
        error: "evidence version already exists",
        detail: error instanceof Error ? error.message : String(error),
        post_id: postId,
        platform,
        version: record.version,
      },
      409,
    );
  }

  return json({ ok: true, post_id: postId, platform, version: record.version, origin, status: record.status }, 201);
};
