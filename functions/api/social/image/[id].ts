// GET /api/social/image/<post id>
// Serves the photo of a social post, and only once that post's publish time has arrived (#5156,
// design #5143). Facebook, Instagram and Pinterest fetch the image from a public address, and the
// main B2 bucket is private (#5131), so the site streams the one photo of the one published post.
// Nothing else in the bucket is reachable through this route: the post id must be in the reviewed
// queue, its time must have arrived, and the photo must still be rights-cleared.

import { findPost, isPublished } from "../../../_lib/social-queue";
import { normalizePhotoUrl } from "../../../_lib/photo-url";
import { signB2Url } from "../../../_lib/b2-presign";
import { rightsClearedClause } from "../../../_lib/rights-hold";

function notFound(): Response {
  return new Response("Not found", { status: 404, headers: { "Cache-Control": "no-store" } });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { env, params, request } = context;
  const id = String(params?.id ?? "").replace(/\.(jpg|jpeg|png)$/i, "");

  const post = findPost(id);
  if (!post || !isPublished(post)) return notFound();

  try {
    const row = await env.DB.prepare(
      `SELECT url FROM photos WHERE id = ? AND ${rightsClearedClause()} LIMIT 1;`,
    )
      .bind(post.photo_id)
      .first();
    if (!row?.url) return notFound();

    const stored = normalizePhotoUrl({ rawUrl: row.url, request, publicB2BaseUrl: env.PUBLIC_B2_BASE_URL });
    // ?for=instagram and ?for=facebook serve the shared padded variant the posting job stored beside the
    // photo (#5196/#5291). They never fall back to the original because the platforms may crop it in feeds.
    const forPlatform = new URL(request.url).searchParams.get("for");
    let target = stored;
    if (forPlatform !== null) {
      if (forPlatform !== "instagram" && forPlatform !== "facebook") return notFound();
      const bucketBase = stored.match(/^(https:\/\/[^/]+\/[^/]+\/)/)?.[1];
      if (!bucketBase) return notFound();
      target = `${bucketBase}social-variants/instagram/${Number(post.photo_id)}.jpg`;
    }
    const signed = await signB2Url(env, target);
    if (signed === target && !/^https:\/\/[^/]*backblazeb2\.com\//.test(stored)) return notFound();

    const upstream = await fetch(signed);
    const type = upstream.headers.get("Content-Type") ?? "";
    if (!upstream.ok || !type.startsWith("image/")) {
      return new Response("Image unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
    }
    return new Response(upstream.body, {
      status: 200,
      headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" },
    });
  } catch {
    return new Response("Image unavailable", { status: 502, headers: { "Cache-Control": "no-store" } });
  }
};
