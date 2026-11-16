// POST /api/ask — visitor question intake + optional first-time join side effects

import { sendAdminJoinNotification, sendWelcomeEmail } from '../_lib/email';
import { jsonResponse, requireD1, requireTables, type Env } from '../_lib/d1';
import { ASK_PER_IP_PER_HOUR, clientIp, overIpThrottle } from '../_lib/request-throttle';

function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return trimmed.length > 0 && trimmed.length <= 254 && emailRegex.test(trimmed);
}

async function insertJoinRequest(
  db: any,
  data: {
    name: string;
    email: string;
    first_name: string;
    last_name: string;
    screen_name: string | null;
  },
): Promise<boolean> {
  const stmt = db.prepare(
    `INSERT INTO join_requests (name, email, first_name, last_name, screen_name, email_opt_in, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, 1, datetime('now')
     WHERE NOT EXISTS (
       SELECT 1 FROM join_requests WHERE lower(email) = lower(?2)
     )`,
  );
  const result = await stmt
    .bind(data.name, data.email, data.first_name, data.last_name, data.screen_name)
    .run();
  return result.meta.changes === 1;
}

async function logEmailAttempt(opts: {
  db: any;
  requestId: string;
  messageType: 'welcome' | 'admin';
  recipientEmail: string;
  sendResult: { sent: boolean; provider: string; statusCode?: number; error?: string; skipped?: boolean };
}) {
  const { db, requestId, messageType, recipientEmail, sendResult } = opts;
  const result =
    sendResult.sent ? 'sent' : sendResult.skipped || sendResult.provider === 'disabled' ? 'skipped' : 'failed';

  try {
    await db
      .prepare(
        `INSERT INTO join_email_log
          (request_id, message_type, recipient_email, result, provider, status_code, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        requestId,
        messageType,
        recipientEmail,
        result,
        String(sendResult.provider || 'unknown'),
        sendResult.statusCode ?? null,
        sendResult.error ?? null,
      )
      .run();
  } catch (e) {
    console.error('join_email_log insert failed:', e);
  }
}

async function maybeJoinNewVisitor(opts: {
  env: Env;
  db: any;
  requestId: string;
  first_name: string;
  last_name: string;
  screen_name: string | null;
  email: string;
}): Promise<void> {
  const { env, db, requestId, first_name, last_name, screen_name, email } = opts;
  const name = `${first_name} ${last_name}${screen_name ? ` (${screen_name})` : ''}`.trim();

  const inserted = await insertJoinRequest(db, {
    name,
    email,
    first_name,
    last_name,
    screen_name,
  });

  if (!inserted) return;

  try {
    await db.prepare("INSERT OR IGNORE INTO members (email, role) VALUES (?1, 'member');").bind(email).run();
  } catch {
    // non-blocking
  }

  let welcomeIntroMd: string | undefined;
  try {
    const row = await db
      .prepare(
        `SELECT body_md FROM welcome_email_content WHERE status='posted' ORDER BY updated_at DESC, id DESC LIMIT 1`,
      )
      .first();
    if ((row as { body_md?: string })?.body_md) welcomeIntroMd = String((row as { body_md: string }).body_md);
  } catch {
    // fallback welcome copy
  }

  try {
    const welcomeResult = await sendWelcomeEmail({ env, toEmail: email, toName: name, introMd: welcomeIntroMd });
    await logEmailAttempt({
      db,
      requestId,
      messageType: 'welcome',
      recipientEmail: email,
      sendResult: welcomeResult,
    });

    const adminResult = await sendAdminJoinNotification({ env, name, email, requestId });
    const adminRecipients = String(env?.MAIL_ADMIN_TO || '')
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    for (const recipient of adminRecipients) {
      await logEmailAttempt({
        db,
        requestId,
        messageType: 'admin',
        recipientEmail: recipient,
        sendResult: adminResult,
      });
    }
  } catch (e) {
    console.error('ask join email side effect failed:', e);
  }
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { env, request } = context;
  const requestId = `ask_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const d1Check = requireD1(env);
  if (!d1Check.ok) return jsonResponse(d1Check.body, d1Check.status);

  const db = d1Check.db;
  const tablesCheck = await requireTables(db, ['ask_inbox', 'join_requests', 'join_email_log', 'members']);
  if (!tablesCheck.ok) return jsonResponse(tablesCheck.body, tablesCheck.status);

  // #5302: simple per-IP throttle (10 per hour); fails open if the database cannot answer.
  if (await overIpThrottle(db, clientIp(request), 'ask', ASK_PER_IP_PER_HOUR)) {
    return jsonResponse({ ok: false, error: 'Too many requests. Please wait an hour and try again.', requestId }, 429);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const first_name = String(body?.first_name ?? '').trim();
    const last_name = String(body?.last_name ?? '').trim();
    const screen_name_raw = body?.screen_name;
    const screen_name = (screen_name_raw == null ? '' : String(screen_name_raw)).trim() || null;
    const email = String(body?.email ?? '')
      .trim()
      .toLowerCase();
    const question = String(body?.question ?? '').trim();

    if (!first_name || !last_name) {
      return jsonResponse({ ok: false, error: 'First name and last name are required.' }, 400);
    }

    if (!email || !isValidEmail(email)) {
      return jsonResponse({ ok: false, error: 'Valid email is required.' }, 400);
    }

    if (!question || question.length < 10) {
      return jsonResponse({ ok: false, error: 'Question must be at least 10 characters.' }, 400);
    }

    await db
      .prepare(
        `INSERT INTO ask_inbox (first_name, last_name, screen_name, email, question, status)
         VALUES (?1, ?2, ?3, ?4, ?5, 'open')`,
      )
      .bind(first_name, last_name, screen_name, email, question)
      .run();

    await maybeJoinNewVisitor({
      env,
      db,
      requestId,
      first_name,
      last_name,
      screen_name,
      email,
    });

    return jsonResponse({ ok: true }, 200);
  } catch (err: unknown) {
    console.error('ask submission failed:', err);
    return jsonResponse({ ok: false, error: 'Submission failed.' }, 500);
  }
}
