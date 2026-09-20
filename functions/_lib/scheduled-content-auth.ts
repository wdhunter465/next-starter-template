// #4253 -- bounded bridge-token auth for the scheduled-content publish sweep.
//
// main's /api/admin/* gate (functions/_lib/auth.ts) is a website member
// session gate with no shared-secret fallback (#3547), so it cannot be
// called by an unattended GitHub Actions cron job. This module is a
// deliberately separate, narrower credential model for exactly one bounded
// action -- flipping already-authored draft content_blocks rows to
// published once their scheduled_publish_at has arrived -- modeled on the
// existing CHATTERBOX_BRIDGE_PROD_TOKEN relay pattern in
// functions/_lib/chatterbox-auth.ts. It grants no authoring, editing, or
// admin-session capability.

function json(data: any, status: number): Response {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { 'Content-Type': 'application/json' } });
}

function extractBearerToken(request: Request): string | null {
  const header = request.headers.get('Authorization') || '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

export type ScheduledContentAuthResult = { ok: true } | { ok: false; response: Response };

export function requireScheduledContentBridge(request: Request, env: any): ScheduledContentAuthResult {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, response: json({ ok: false, error: 'missing bearer token' }, 401) };
  }

  // .trim() on both sides so a trailing newline/space picked up when the
  // secret is pasted into a dashboard input doesn't silently break the
  // comparison on only one side (same lesson as #3845 for the Chatterbox
  // bridge token).
  const bridgeToken =
    typeof env?.SCHEDULED_CONTENT_BRIDGE_TOKEN === 'string' ? env.SCHEDULED_CONTENT_BRIDGE_TOKEN.trim() : '';

  if (!bridgeToken) {
    return { ok: false, response: json({ ok: false, error: 'scheduled-content publishing is not configured' }, 503) };
  }

  if (token !== bridgeToken) {
    return { ok: false, response: json({ ok: false, error: 'invalid bridge token' }, 401) };
  }

  return { ok: true };
}
