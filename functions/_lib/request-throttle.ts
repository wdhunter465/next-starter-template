// Small per-IP and per-address throttles for the public POSTs (#5302, item 1 of #4767).
//
// Storage reuses the existing login_attempts table, so there is no new table and no migration:
//   - join and ask throttles record a marker row (email = 'throttle:<bucket>', ok = 1). The sign-in limits only
//     count ok = 0 rows, so a marker row never affects them.
//   - the per-address sign-in limit counts the existing failed rows (ok = 0) for one address from any IP.
// Every check fails OPEN: if the database cannot answer, the request goes through (a limiter must not lock
// real people out, and this is defence in depth beside the per-IP login limit).

export const LOGIN_FAILED_PER_ADDRESS_PER_HOUR = 5;
export const JOIN_PER_IP_PER_HOUR = 10;
export const ASK_PER_IP_PER_HOUR = 10;

type Db = { prepare(sql: string): { bind(...v: unknown[]): { first(): Promise<unknown>; run(): Promise<unknown> } } };

export async function countFailedLoginsForAddress(db: Db, email: string): Promise<number> {
  try {
    const row = (await db
      .prepare(
        `SELECT COUNT(1) AS n FROM login_attempts
         WHERE lower(email) = lower(?1) AND ok = 0 AND datetime(created_at) >= datetime('now','-1 hour')`,
      )
      .bind(email)
      .first()) as { n?: unknown } | null;
    const n = Number(row?.n ?? 0);
    return Number.isFinite(n) ? n : 0;
  } catch {
    return 0;
  }
}

/** True when the caller is over the limit. Otherwise records this request and returns false. */
export async function overIpThrottle(db: Db, ip: string, bucket: 'join' | 'ask', max: number): Promise<boolean> {
  const marker = `throttle:${bucket}`;
  try {
    const row = (await db
      .prepare(
        `SELECT COUNT(1) AS n FROM login_attempts
         WHERE ip = ?1 AND email = ?2 AND datetime(created_at) >= datetime('now','-1 hour')`,
      )
      .bind(ip, marker)
      .first()) as { n?: unknown } | null;
    const n = Number(row?.n ?? 0);
    if (Number.isFinite(n) && n >= max) return true;
    await db
      .prepare(`INSERT INTO login_attempts (ip, email, ok, created_at) VALUES (?1, ?2, 1, datetime('now'))`)
      .bind(ip, marker)
      .run();
    return false;
  } catch {
    return false;
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For') ||
    request.headers.get('X-Real-IP') ||
    'unknown'
  );
}
