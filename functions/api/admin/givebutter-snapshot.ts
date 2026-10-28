// GET /api/admin/givebutter-snapshot
// Returns the live Givebutter campaign, participant and team totals as an
// aggregate-only snapshot for the admin fundraiser preview (#4993, #4432).
// Protected by an authenticated D1 admin member session (requireAdmin).
//
// Reads GIVEBUTTER_API_KEY and GIVEBUTTER_CAMPAIGN_ID from the environment. When
// either is missing it answers { ok: true, configured: false } and never reveals
// a value. Nothing is written to D1 and nothing is public.

import { requireAdmin } from "../../_lib/auth";
import { fetchGivebutterSnapshot, givebutterConfigFromEnv, GivebutterError } from "../../_lib/givebutter";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const { request, env } = context;

  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  const config = givebutterConfigFromEnv(env);
  if (!config) return json({ ok: true, configured: false });

  try {
    const snapshot = await fetchGivebutterSnapshot(config);
    return json({ ok: true, configured: true, snapshot });
  } catch (err) {
    const code = err instanceof GivebutterError ? err.code : "network_error";
    console.error("admin givebutter-snapshot error:", code);
    return json({ ok: false, configured: true, error: code }, 502);
  }
};
