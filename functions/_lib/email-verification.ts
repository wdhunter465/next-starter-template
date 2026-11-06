// #5112: single-use email verification links for new members.
//
// A token is 32 random bytes, shown once in the emailed link. Only its SHA-256 is stored, so a copy
// of the database cannot be used to verify an address. A token works once and expires after 24 hours.
// A new token is not issued more than once a minute for the same address.

export const VERIFICATION_TOKEN_TTL_HOURS = 24;
export const VERIFICATION_RESEND_SECONDS = 60;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function hashVerificationToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return toHex(new Uint8Array(digest));
}

export function newVerificationToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** True when the member exists and has not verified the address yet. */
export async function isEmailUnverified(db: any, email: string): Promise<boolean> {
  const row = await db
    .prepare(`SELECT email_verified_at FROM members WHERE lower(email) = lower(?1) LIMIT 1`)
    .bind(email)
    .first();
  return Boolean(row) && (row as any).email_verified_at == null;
}

/**
 * Issues a new link token for the address, or returns null when one was issued less than a minute
 * ago. The caller emails the returned token.
 */
export async function issueVerificationToken(db: any, email: string): Promise<string | null> {
  const recent = await db
    .prepare(
      `SELECT 1 AS recent FROM email_verification_tokens
        WHERE lower(email) = lower(?1)
          AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ','now', ?2)
        LIMIT 1`,
    )
    .bind(email, `-${VERIFICATION_RESEND_SECONDS} seconds`)
    .first();
  if (recent) return null;

  const token = newVerificationToken();
  await db
    .prepare(
      `INSERT INTO email_verification_tokens (token_hash, email, expires_at)
       VALUES (?1, lower(?2), strftime('%Y-%m-%dT%H:%M:%fZ','now', ?3))`,
    )
    .bind(await hashVerificationToken(token), email, `+${VERIFICATION_TOKEN_TTL_HOURS} hours`)
    .run();
  return token;
}

/**
 * Uses a token once. Returns the verified address, or null when the token is unknown, already used
 * or expired. The check and the use are one statement, so two clicks cannot both succeed.
 */
export async function consumeVerificationToken(db: any, token: string): Promise<string | null> {
  const cleaned = String(token || '').trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(cleaned)) return null;
  const row = await db
    .prepare(
      `UPDATE email_verification_tokens
          SET used_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
        WHERE token_hash = ?1
          AND used_at IS NULL
          AND expires_at > strftime('%Y-%m-%dT%H:%M:%fZ','now')
        RETURNING email`,
    )
    .bind(await hashVerificationToken(cleaned))
    .first();
  return row ? String((row as any).email) : null;
}

export async function markEmailVerified(db: any, email: string): Promise<void> {
  await db
    .prepare(
      `UPDATE members SET email_verified_at = COALESCE(email_verified_at, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
        WHERE lower(email) = lower(?1)`,
    )
    .bind(email)
    .run();
}

export function verificationLink(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/join/verified/?token=${token}`;
}

export function siteUrlFor(env: any): string {
  return String(env?.NEXT_PUBLIC_SITE_URL || '').trim() || 'https://www.lougehrigfanclub.com';
}
