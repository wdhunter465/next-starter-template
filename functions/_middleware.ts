// functions/_middleware.ts
// ZIP 5: Content Security Policy (CSP)
//
// Rollout strategy:
// - Start in REPORT-ONLY mode to avoid breaking third-party resources during stabilization.
// - Capture violations via POST /api/csp-report.
// - Once staging is clean, switch the header name to `Content-Security-Policy` (enforced).

function buildCsp(): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "img-src 'self' data: blob: https://*.elfsight.com https://elfsightcdn.com https://cdn.elfsight.com https://files.elfsightcdn.com https://scontent.cdninstagram.com https://scontent-*.cdninstagram.com https://platform-lookaside.fbsbx.com https://www.google-analytics.com https://*.google-analytics.com",
    "script-src 'self' 'unsafe-inline' https://static.elfsight.com https://elfsightcdn.com https://www.googletagmanager.com",
    "style-src 'self' 'unsafe-inline' https://elfsightcdn.com",
    "connect-src 'self' https://*.elfsight.com https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com",
    "frame-src https://*.elfsight.com",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    "upgrade-insecure-requests",
    "report-uri /api/csp-report",
  ];
  return directives.join("; ");
}

// #4698: the Pages project root address serves the same Production data as www and is indexable.
// Send it to the canonical host. Branch and per-deployment preview hosts (subdomains of the root
// address) are a different hostname, so they are not matched and keep serving previews.
const ROOT_PAGES_HOST = "next-starter-template-6yr.pages.dev";
const CANONICAL_ORIGIN = "https://www.lougehrigfanclub.com";

function redirectRootPagesHost(request: Request): Response | null {
  const url = new URL(request.url);
  if (url.hostname.toLowerCase() !== ROOT_PAGES_HOST) return null;

  const method = request.method.toUpperCase();
  const status = method === "GET" || method === "HEAD" ? 301 : 308;
  return new Response(null, {
    status,
    headers: {
      Location: `${CANONICAL_ORIGIN}${url.pathname}${url.search}`,
      "X-Robots-Tag": "noindex",
      // Short cache so the redirect can be rolled back quickly; a bare 301 is cached for a long time.
      "Cache-Control": "public, max-age=300",
    },
  });
}

export async function onRequest(context: {
  request: Request;
  next: () => Promise<Response>;
}): Promise<Response> {
  const redirect = redirectRootPagesHost(context.request);
  if (redirect) return redirect;

  const response = await context.next();

  // REPORT-ONLY during rollout.
  response.headers.set("Content-Security-Policy-Report-Only", buildCsp());

  // Minimal, safe security headers (kept tight to ZIP #5 scope).
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}
