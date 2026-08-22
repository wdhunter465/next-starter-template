// functions/api/_middleware.ts
// ZIP 4: Cloudflare-native rate limiting + fail-fast env validation on sensitive API routes.
//
// Applies ONLY to a limited set of sensitive routes.
// Returns 429 when the rate limit is exceeded.
// Returns 500 (missing_env) when a required binding/env is absent.
//
// Rate limiting binding docs:
// - https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

import { checkEnv, jsonMissingResponse } from "../_lib/env";

function getClientKey(request: Request, pathname: string): string {
  // Best-effort. Cloudflare recommends stable user identifiers; IP can be shared.
  // We combine IP + path to reduce blast radius while still stopping obvious abuse.
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    request.headers.get("X-Real-IP") ||
    "unknown";
  return `${ip}:${pathname}`;
}

function isSensitivePath(pathname: string): boolean {
  // Keep this tight: only auth/admin/member surfaces.
  if (pathname === "/api/join") return true;
  if (pathname === "/api/login") return true;
  if (pathname.startsWith("/api/member")) return true;
  if (pathname.startsWith("/api/admin")) return true;
  if (pathname.startsWith("/api/cms")) return true;
  return false;
}

export async function onRequest(context: {
  request: Request;
  env: Record<string, any>;
  next: () => Promise<Response>;
}): Promise<Response> {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (!isSensitivePath(pathname)) {
    return next();
  }

  // Fail-fast validation for sensitive routes.
  // NOTE: API_RATE_LIMITER is optional - gracefully degrade if not configured
  const missing = checkEnv({
    env,
    requiredBindings: [
      { key: "DB", hint: "D1 binding is required for auth/admin/member APIs" },
    ],
    // We intentionally do NOT require ADMIN_TOKEN globally here, because most /api/admin/*
    // endpoints already guard themselves and return a clear error when missing.
  });

  if (missing.length) {
    return jsonMissingResponse(missing);
  }

  // Apply rate limiting for write operations and auth attempts (if binding is available).
  const method = request.method.toUpperCase();
  const shouldLimit = method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE";
  const hasRateLimiter = env.API_RATE_LIMITER && 
                          typeof env.API_RATE_LIMITER === 'object' && 
                          typeof env.API_RATE_LIMITER.limit === 'function';
  
  if (shouldLimit && hasRateLimiter) {
    const key = getClientKey(request, pathname);
    try {
      const { success } = await env.API_RATE_LIMITER.limit({ key });
      if (!success) {
        return new Response(
          JSON.stringify({ ok: false, error: "rate_limited", status: 429 }),
          { status: 429, headers: { "Content-Type": "application/json" } }
        );
      }
    } catch (e) {
      // Rate limiter failed - log but continue (graceful degradation)
      console.warn('Rate limiter error:', e);
    }
  }

  return next();
}
