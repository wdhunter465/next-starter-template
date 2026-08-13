/**
 * Structured audit events for weekly matchup repair / pair-change attempts.
 * Non-blocking: logging only. Never throws for logging failures.
 */

export type MatchupRepairAuditEvent = {
  event: 'matchup_repair_audit';
  at: string;
  trigger: 'public_repair_post' | 'current_get_probe' | 'current_get_eligibility' | 'admin_authorized' | 'admin_update';
  week_start: string | null;
  broken_photo_id: number | null;
  slot: 'a' | 'b' | 'both' | 'unknown' | null;
  probe_available: boolean | null;
  probe_status: number | null;
  before_photo_a_id: number | null;
  before_photo_b_id: number | null;
  after_photo_a_id: number | null;
  after_photo_b_id: number | null;
  mutated: boolean;
  votes_cleared: boolean;
  source_issue: string | null;
  mutation_blocked_reason: string | null;
  client_ua: string | null;
  client_ip_hash: string | null;
};

/** Normalize `#3028` / `3028` / `Issue 3028` → `#3028`. Rejects any other text (#3030). */
export function normalizeSourceIssue(raw: unknown): string | null {
  if (raw === null || raw === undefined) return null;
  const text = String(raw).trim();
  const match = text.match(/^(?:issue\s+)?#?\s*(\d{1,7})$/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `#${n}`;
}

function hashIp(ip: string | null): string | null {
  if (!ip) return null;
  // Lightweight non-cryptographic fingerprint for ops correlation (not auth).
  let h = 2166136261;
  for (let i = 0; i < ip.length; i += 1) {
    h ^= ip.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `ip_${(h >>> 0).toString(16)}`;
}

export function clientAuditHints(request: Request | null | undefined): {
  client_ua: string | null;
  client_ip_hash: string | null;
} {
  if (!request) return { client_ua: null, client_ip_hash: null };
  const ua = request.headers.get('user-agent');
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    null;
  return {
    client_ua: ua ? ua.slice(0, 180) : null,
    client_ip_hash: hashIp(ip),
  };
}

export function logMatchupRepairAudit(event: MatchupRepairAuditEvent): void {
  try {
    console.log(JSON.stringify(event));
  } catch {
    // never block request path
  }
}
