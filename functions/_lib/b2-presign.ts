/**
 * Signed, expiring links for objects in the private B2 bucket (#5131).
 *
 * The bucket `LouGehrigFanClub` is private. Stored photo addresses in D1 keep the
 * original `https://s3.<region>.backblazeb2.com/<bucket>/<key>` form; endpoints call
 * `signB2UrlsDeep` on their response body, after their own access check, so every
 * image address that leaves the site is a SigV4 query-signed GET link.
 *
 * Fail-closed on configuration: with missing B2 secrets, or an address that is not in
 * our bucket, the value is returned unchanged. Secrets are never logged or returned.
 */

import { AwsClient } from "./aws4fetch";

export const B2_SIGNED_LINK_SECONDS = 3600;

type B2Env = Record<string, unknown> | undefined | null;

type B2SignConfig = {
  endpoint: string;
  bucket: string;
  region: string;
  keyId: string;
  appKey: string;
  /** Optional legacy public base (PUBLIC_B2_BASE_URL): addresses under it map to the same bucket keys. */
  publicBase: string;
};

function readConfig(env: B2Env): B2SignConfig | null {
  if (!env) return null;
  const endpoint = String(env.B2_ENDPOINT ?? "").trim().replace(/\/$/, "");
  const bucket = String(env.B2_BUCKET ?? "").trim();
  const keyId = String(env.B2_KEY_ID ?? "").trim();
  const appKey = String(env.B2_APP_KEY ?? "").trim();
  if (!endpoint || !bucket || !keyId || !appKey) return null;
  const host = (() => {
    try {
      return new URL(endpoint).hostname;
    } catch {
      return "";
    }
  })();
  const region = host.match(/^s3\.([^.]+)\.backblazeb2\.com$/)?.[1];
  if (!region) return null;
  const rawBase = String(env.PUBLIC_B2_BASE_URL ?? "").trim();
  const publicBase = rawBase ? (rawBase.endsWith("/") ? rawBase : `${rawBase}/`) : "";
  return { endpoint, bucket, region, keyId, appKey, publicBase };
}

/** The S3-endpoint address of the object a stored value points at, or null when it is not ours. */
function toObjectUrl(cfg: B2SignConfig, value: string): string | null {
  if (value.startsWith(`${cfg.endpoint}/${cfg.bucket}/`)) return value;
  if (cfg.publicBase && value.startsWith(cfg.publicBase) && value.length > cfg.publicBase.length) {
    const key = value.slice(cfg.publicBase.length).replace(/^\/+/, "");
    return `${cfg.endpoint}/${encodeURIComponent(cfg.bucket)}/${key}`;
  }
  return null;
}

function makeClient(cfg: B2SignConfig): AwsClient {
  return new AwsClient({
    accessKeyId: cfg.keyId,
    secretAccessKey: cfg.appKey,
    sessionToken: undefined,
    service: "s3",
    region: cfg.region,
    cache: undefined,
    retries: 0,
    initRetryMs: undefined,
  });
}

function isOurObjectUrl(cfg: B2SignConfig, value: string): boolean {
  return toObjectUrl(cfg, value) !== null;
}

/** Signs one stored B2 address. Returns the value unchanged when it cannot or should not be signed. */
export async function signB2Url(
  env: B2Env,
  value: string,
  expiresSeconds: number = B2_SIGNED_LINK_SECONDS,
  client?: AwsClient,
): Promise<string> {
  const cfg = readConfig(env);
  const objectUrl = cfg && typeof value === "string" ? toObjectUrl(cfg, value) : null;
  if (!cfg || !objectUrl) return value;
  try {
    const url = new URL(objectUrl);
    // Re-signing an already signed link would double the signature parameters.
    if (url.searchParams.has("X-Amz-Signature")) return value;
    url.searchParams.set("X-Amz-Expires", String(expiresSeconds));
    const aws =
      client ??
      makeClient(cfg);
    const signed = await aws.sign(url.toString(), { method: "GET", aws: { signQuery: true } });
    return signed.url;
  } catch {
    return value;
  }
}

/**
 * Returns a copy of `value` with every string that is a stored address in our bucket
 * replaced by a signed link. Walks plain objects and arrays; other values pass through.
 */
export async function signB2UrlsDeep<T>(env: B2Env, value: T, expiresSeconds: number = B2_SIGNED_LINK_SECONDS): Promise<T> {
  const cfg = readConfig(env);
  if (!cfg) return value;
  const client = makeClient(cfg);
  const memo = new Map<string, Promise<string>>();

  const visit = async (node: unknown): Promise<unknown> => {
    if (typeof node === "string") {
      if (!isOurObjectUrl(cfg, node)) return node;
      let pending = memo.get(node);
      if (!pending) {
        pending = signB2Url(env, node, expiresSeconds, client);
        memo.set(node, pending);
      }
      return pending;
    }
    if (Array.isArray(node)) return Promise.all(node.map(visit));
    if (node && typeof node === "object" && Object.getPrototypeOf(node) === Object.prototype) {
      const entries = await Promise.all(
        Object.entries(node as Record<string, unknown>).map(async ([k, v]) => [k, await visit(v)] as const),
      );
      return Object.fromEntries(entries);
    }
    return node;
  };

  return (await visit(value)) as T;
}
