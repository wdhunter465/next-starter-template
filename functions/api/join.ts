// Cloudflare Pages Function for POST /api/join
// - Stores a join request in D1 `join_requests`
// - Sends welcome email via MailChannels
// - Returns 409 for duplicate emails (idempotent)

import {
  assertEmailEnvOrThrow,
  sendAdminJoinNotification,
  sendTransactionalJoinConfirmation,
  sendWelcomeEmail,
} from "../_lib/email";
import { requireD1, requireTables, jsonResponse, type Env } from "../_lib/d1";

type EmailLogResult = {
  result: "sent" | "failed" | "skipped";
  provider: string;
  statusCode?: number;
  error?: string;
};

async function logEmailAttempt(opts: {
  db: any;
  requestId: string;
  messageType: "welcome" | "admin";
  recipientEmail: string;
  sendResult: { sent: boolean; provider: string; statusCode?: number; error?: string; skipped?: boolean };
}) {
  const { db, requestId, messageType, recipientEmail, sendResult } = opts;
  const result: EmailLogResult["result"] =
    sendResult.sent ? "sent" : (sendResult.skipped || sendResult.provider === "disabled") ? "skipped" : "failed";

  try {
    await db
      .prepare(
        `INSERT INTO join_email_log
          (request_id, message_type, recipient_email, result, provider, status_code, error)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
      )
      .bind(
        requestId,
        messageType,
        recipientEmail,
        result,
        String(sendResult.provider || "unknown"),
        sendResult.statusCode ?? null,
        sendResult.error ?? null
      )
      .run();
  } catch (e) {
    // Never fail the join flow because audit logging failed.
    console.error("join_email_log insert failed:", e);
  }
}

// Helper: insert join request into DB using INSERT...SELECT...WHERE NOT EXISTS
// Returns true if inserted (new record), false if duplicate (already exists)
async function insertJoinRequest(
  db: any,
  data: {
    name: string;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
    screen_name?: string | null;
    email_opt_in?: boolean | null;
  }
): Promise<boolean> {
  const stmt = db.prepare(
    `INSERT INTO join_requests (name, email, first_name, last_name, screen_name, email_opt_in, created_at)
     SELECT ?1, ?2, ?3, ?4, ?5, ?6, datetime('now')
     WHERE NOT EXISTS (
       SELECT 1 FROM join_requests WHERE lower(email) = lower(?2)
     )`
  );
  const emailOptIn = data.email_opt_in == null ? 1 : (data.email_opt_in ? 1 : 0);
  const result = await stmt
    .bind(
      data.name,
      data.email,
      data.first_name ?? null,
      data.last_name ?? null,
      data.screen_name ?? null,
      emailOptIn
    )
    .run();
  // If changes === 1, insert succeeded (new record)
  // If changes === 0, duplicate was detected (no insert)
  return result.meta.changes === 1;
}

export async function onRequestPost(context: { env: Env; request: Request }): Promise<Response> {
  const { request, env } = context;
  const requestId = `req_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 11)}`;

  // Step 1: Check D1 binding exists
  const d1Check = requireD1(env);
  if (!d1Check.ok) {
    return jsonResponse(d1Check.body, d1Check.status);
  }
  
  const db = d1Check.db;

  // Step 2: Check required tables exist
  const tablesCheck = await requireTables(db, ['join_requests', 'join_email_log', 'members']);
  if (!tablesCheck.ok) {
    return jsonResponse(tablesCheck.body, tablesCheck.status);
  }

  try {
    const ct = (request.headers.get("content-type") || "").toLowerCase();

      let body: any = {};
      if (ct.includes("application/json")) {
        body = await request.json();
      } else if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
        const fd = await request.formData();
        body = Object.fromEntries(fd.entries());
      } else {
        // best effort fallback
        try { body = await request.json(); } catch { body = {}; }
      }

      // Map legacy fields coming from the /auth form:
      // - alias -> screen_name
      if (body && body.alias != null && body.screen_name == null) body.screen_name = String(body.alias);
      // - full name -> split to first/last if missing
      if (body && body.name && (!body.first_name || !body.last_name)) {
        const parts = String(body.name).trim().split(/\s+/).filter(Boolean);
        body.first_name = body.first_name || (parts[0] || "");
        body.last_name = body.last_name || (parts.slice(1).join(" ") || "");
      }

  // Phase 7 guardrail: if email is enabled, fail fast on missing required env vars.
  try {
    assertEmailEnvOrThrow(env);
  } catch (e: any) {
    return jsonResponse(
      { ok: false, error: "Email is enabled but required configuration is missing.", detail: String(e?.message || e), requestId },
      500
    );
  }

    // Accept both legacy `name` and new profile fields.
    const first_name = (body?.first_name ?? "").toString().trim();
    const last_name = (body?.last_name ?? "").toString().trim();
    const screen_name_raw = body?.screen_name;
    const screen_name = (screen_name_raw == null ? "" : String(screen_name_raw)).trim();
    const legacyName = (body?.name ?? "").toString().trim();
    const emailRaw = (body?.email ?? "").toString();
    const email = emailRaw.trim().toLowerCase();
    const email_opt_in = body?.email_opt_in == null ? true : Boolean(body.email_opt_in);

    const name = legacyName || `${first_name} ${last_name}${screen_name ? ` (${screen_name})` : ''}`.trim();

    if (!email) {
      return jsonResponse(
        { ok: false, error: "Email is required.", requestId },
        400
      );
    }

    if (!name || !first_name || !last_name) {
      return jsonResponse(
        { ok: false, error: "First name and last name are required.", requestId },
        400
      );
    }

    // Attempt insert using INSERT...SELECT...WHERE NOT EXISTS
    const inserted = await insertJoinRequest(db, { name, email, first_name, last_name, screen_name: screen_name || null, email_opt_in });

    if (inserted) {
      // SUCCESS: first-time join (insert occurred)

      // Day 1 contract: joining creates a member record.
      try {
        await db.prepare("INSERT OR IGNORE INTO members (email, role) VALUES (?1, 'member');").bind(email).run();
      } catch {}

      // Optional: admin-managed welcome email copy.
      let welcomeIntroMd: string | undefined = undefined;
      try {
        const row = await db
          .prepare(
            `SELECT body_md FROM welcome_email_content WHERE status='posted' ORDER BY updated_at DESC, id DESC LIMIT 1`
          )
          .first();
        if ((row as any)?.body_md) welcomeIntroMd = String((row as any).body_md);
      } catch {
        // ignore; fallback to default welcome copy
      }

      // Email (optional). Join succeeds even if email fails; results are returned and logged.
      // #2919: email_opt_in gates the promotional/periodic-update welcome message.
      // Members who did not opt in still receive a strictly-transactional
      // confirmation that their account was created — never the promotional copy.
      const welcomeResult = email_opt_in
        ? await sendWelcomeEmail({ env, toEmail: email, toName: name, introMd: welcomeIntroMd })
        : await sendTransactionalJoinConfirmation({ env, toEmail: email, toName: name });
      await logEmailAttempt({
        db,
        requestId,
        messageType: "welcome",
        recipientEmail: email,
        sendResult: welcomeResult,
      });

      const adminRecipients = String(env?.MAIL_ADMIN_TO || "")
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const adminResult = await sendAdminJoinNotification({ env, name, email, requestId });
      for (const r of adminRecipients.length ? adminRecipients : [String(env?.MAIL_ADMIN_TO || "").trim()].filter(Boolean)) {
        await logEmailAttempt({
          db,
          requestId,
          messageType: "admin",
          recipientEmail: r,
          sendResult: adminResult,
        });
      }

      return jsonResponse(
        {
          ok: true,
          status: "joined",
          requestId,
          email: {
            welcome: welcomeResult,
            admin: adminResult,
          },
        },
        200
      );
} else {
      // DUPLICATE: email already exists (no insert)
      return jsonResponse(
        {
          ok: false,
          status: "already_joined",
          requestId,
        },
        409
      );
    }
  } catch (err) {
    // Guaranteed fallback return (prevents TS fallthrough)
    return jsonResponse(
      { ok: false, error: "Server error", requestId },
      500
    );
  }
}