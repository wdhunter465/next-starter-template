// Cloudflare Pages Function for POST /api/verify-email-resend  (#5112)
// - Sends a new verification link to an address that joined but has not verified it.
// - Always answers the same way, so it does not reveal whether an address is a member.
// - At most one new link per address per minute.

import { sendVerificationEmail } from '../_lib/email';
import { requireD1, requireTables, jsonResponse, type Env } from '../_lib/d1';
import { isEmailUnverified, issueVerificationToken, siteUrlFor, verificationLink } from '../_lib/email-verification';

const SAME_ANSWER = { ok: true, status: 'sent_if_pending' };

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;

  const d1Check = requireD1(env);
  if (!d1Check.ok) return jsonResponse(d1Check.body, d1Check.status);
  const db = d1Check.db;

  const tablesCheck = await requireTables(db, ['email_verification_tokens', 'members']);
  if (!tablesCheck.ok) return jsonResponse(tablesCheck.body, tablesCheck.status);

  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }
    const email = String(body?.email ?? '').trim().toLowerCase();
    if (!email || !email.includes('@')) return jsonResponse({ ok: false, error: 'Email is required.' }, 400);

    if (await isEmailUnverified(db, email)) {
      const token = await issueVerificationToken(db, email);
      if (token) {
        const nameRow = await db.prepare('SELECT first_name FROM join_requests WHERE lower(email) = lower(?1) LIMIT 1').bind(email).first();
        await sendVerificationEmail({
          env,
          toEmail: email,
          toName: (nameRow as any)?.first_name ? String((nameRow as any).first_name) : undefined,
          link: verificationLink(siteUrlFor(env), token),
        });
      }
    }
    return jsonResponse(SAME_ANSWER, 200);
  } catch {
    return jsonResponse({ ok: false, error: 'Server error' }, 500);
  }
}
