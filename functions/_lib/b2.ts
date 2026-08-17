/**
 * Backblaze B2 (S3-compatible) list + stable media UID for MEDIA-01 / D1 ingestion.
 * Uses Cloudflare Pages environment secrets for B2 (B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY).
 * Platform B2 connectivity is already established; missing secrets here usually means this deployment/env (e.g. preview) is not wired the same as production.
 */

import { AwsClient } from "./aws4fetch";

export type B2Bindings = {
  B2_ENDPOINT: string;
  B2_BUCKET: string;
  B2_KEY_ID: string;
  B2_APP_KEY: string;
};

export function requireB2(env: Record<string, unknown>): { ok: true; cfg: B2Bindings } | { ok: false; response: Response } {
  const B2_ENDPOINT = String(env.B2_ENDPOINT ?? "")
    .trim()
    .replace(/\/$/, "");
  const B2_BUCKET = String(env.B2_BUCKET ?? "").trim();
  const B2_KEY_ID = String(env.B2_KEY_ID ?? "").trim();
  const B2_APP_KEY = String(env.B2_APP_KEY ?? "").trim();
  if (!B2_ENDPOINT || !B2_BUCKET || !B2_KEY_ID || !B2_APP_KEY) {
    return {
      ok: false,
      response: new Response(
        JSON.stringify({
          ok: false,
          error: "B2 secrets missing for this Pages environment",
          detail:
            "B2 connectivity is established for the platform; this worker needs B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, and B2_APP_KEY as environment secrets on this deployment (e.g. mirror production secrets for preview).",
        }),
        { status: 503, headers: { "Content-Type": "application/json" } },
      ),
    };
  }
  return { ok: true, cfg: { B2_ENDPOINT, B2_BUCKET, B2_KEY_ID, B2_APP_KEY } };
}

export type ListedB2Object = {
  key: string;
  size: number;
  etag: string;
  fileId: string;
  lastModified?: string;
};

function decodeXmlInner(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractXmlTag(block: string, tag: string): string {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`);
  const m = block.match(re);
  return m ? decodeXmlInner(m[1].trim()) : "";
}

/** Parse ListObjectsV2 XML (S3-compatible). */
export function parseListObjectsV2Xml(xml: string): ListedB2Object[] {
  const out: ListedB2Object[] = [];
  const parts = xml.split("<Contents>");
  for (let i = 1; i < parts.length; i++) {
    const block = parts[i].split("</Contents>")[0];
    const key = extractXmlTag(block, "Key");
    if (!key) continue;
    const size = parseInt(extractXmlTag(block, "Size") || "0", 10) || 0;
    let etag = extractXmlTag(block, "ETag").replace(/^"\s*|\s*"$/g, "");
    const versionId = extractXmlTag(block, "VersionId");
    const lastModified = extractXmlTag(block, "LastModified");
    const fileId = versionId || etag || key;
    out.push({ key, size, etag, fileId, lastModified });
  }
  return out;
}

function extractContinuationToken(xml: string): string | undefined {
  const trunc = xml.match(/<IsTruncated>\s*(true|false)\s*<\/IsTruncated>/i);
  if (!trunc || trunc[1].toLowerCase() !== "true") return undefined;
  const t = xml.match(/<NextContinuationToken>\s*([\s\S]*?)\s*<\/NextContinuationToken>/i);
  return t ? t[1].trim() : undefined;
}

/**
 * Stable media_uid — must match scripts/d1_media_ingest.js (sha256 prefix).
 */
export async function mediaUidFromB2(fileId: string, key: string): Promise<string> {
  const combined = `${fileId}:${key}`;
  const enc = new TextEncoder().encode(combined);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  const hex = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `b2_${hex.substring(0, 40)}`;
}

function b2AwsClient(cfg: B2Bindings): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.B2_KEY_ID,
    secretAccessKey: cfg.B2_APP_KEY,
    sessionToken: undefined,
    service: "s3",
    region: undefined,
    cache: undefined,
    retries: 2,
    initRetryMs: undefined,
  });
}

function b2ObjectUrl(cfg: B2Bindings, key: string): string {
  const pathBucket = cfg.B2_BUCKET.split("/").map(encodeURIComponent).join("/");
  const pathKey = key.split("/").map(encodeURIComponent).join("/");
  return `${cfg.B2_ENDPOINT}/${pathBucket}/${pathKey}`;
}

export type PutB2ObjectInput = {
  key: string;
  body: ArrayBuffer | Uint8Array;
  contentType: string;
};

export type PutB2ObjectResult = {
  etag: string;
};

/**
 * Writes a single object to B2 via S3 PutObject (path-style). Used only by
 * the #3552 content-ingestion Worker to write an already-approved,
 * already-validated original -- callers are responsible for content-type,
 * size, and checksum validation before calling this.
 *
 * Does not send x-amz-checksum-sha256: that header requires a base64-encoded
 * digest, not hex, and its exact acceptance semantics on B2 (vs. AWS S3
 * proper) are unverified from this environment -- request signing already
 * authenticates the request, and the returned ETag is available for callers
 * that want to compare it against their own checksum.
 */
export async function putB2Object(cfg: B2Bindings, input: PutB2ObjectInput): Promise<PutB2ObjectResult> {
  const aws = b2AwsClient(cfg);
  const url = b2ObjectUrl(cfg, input.key);
  const res = await aws.fetch(url, {
    method: "PUT",
    body: input.body,
    headers: {
      "Content-Type": input.contentType,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`B2 PutObject failed: HTTP ${res.status} ${text.slice(0, 400)}`);
  }
  const etag = (res.headers.get("etag") || "").replace(/^"\s*|\s*"$/g, "");
  return { etag };
}

/**
 * List bucket objects via S3 ListObjectsV2 (path-style URLs used by B2).
 * Stops after `maxObjects` have been collected (pagination-aware).
 */
export async function listB2Objects(cfg: B2Bindings, opts?: { maxObjects?: number }): Promise<ListedB2Object[]> {
  const maxObjects = opts?.maxObjects ?? 100_000;
  const aws = new AwsClient({
    accessKeyId: cfg.B2_KEY_ID,
    secretAccessKey: cfg.B2_APP_KEY,
    sessionToken: undefined,
    service: "s3",
    region: undefined,
    cache: undefined,
    retries: 2,
    initRetryMs: undefined,
  });

  const all: ListedB2Object[] = [];
  let continuationToken: string | undefined;

  do {
    const qs = new URLSearchParams({ "list-type": "2", "max-keys": "1000" });
    if (continuationToken) qs.set("continuation-token", continuationToken);

    const pathBucket = cfg.B2_BUCKET.split("/").map(encodeURIComponent).join("/");
    const url = `${cfg.B2_ENDPOINT}/${pathBucket}?${qs.toString()}`;
    const res = await aws.fetch(url, { method: "GET" });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`B2 ListObjectsV2 failed: HTTP ${res.status} ${text.slice(0, 400)}`);
    }
    const xml = await res.text();
    const page = parseListObjectsV2Xml(xml);
    for (const o of page) {
      all.push(o);
      if (all.length >= maxObjects) return all;
    }
    continuationToken = extractContinuationToken(xml);
  } while (continuationToken && all.length < maxObjects);

  return all;
}
