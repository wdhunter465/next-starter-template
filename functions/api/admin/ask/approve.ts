import { requireAdmin } from '../../../_lib/auth';
import {
  parsePositiveInt,
  validateFaqAnswer,
  validateFaqQuestion,
} from '../../../_lib/faqModeration';

export const onRequestPost = async (context: { request: Request; env: { DB?: unknown } }): Promise<Response> => {
  const { request, env } = context;
  const deny = await requireAdmin(request, env);
  if (deny) return deny;

  try {
    const body = await request.json().catch(() => ({}));
    const id = parsePositiveInt(body?.id);
    const answer = String(body?.answer ?? '').trim();
    const moderationNote = String(body?.moderation_note ?? '').trim() || null;
    const createFaq = body?.create_faq === true;

    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid ask inbox ID required.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB as any;

    const row = (await db
      .prepare(
        `SELECT id, first_name, last_name, screen_name, email, question, status, faq_entry_id
         FROM ask_inbox WHERE id = ?`,
      )
      .bind(id)
      .first()) as Record<string, unknown> | null;

    if (!row) {
      return new Response(JSON.stringify({ ok: false, error: 'Ask inbox entry not found.' }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status = String(row.status ?? '');
    if (!['open', 'pending'].includes(status)) {
      return new Response(JSON.stringify({ ok: false, error: 'Only pending ask entries can be approved.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const question = String(row.question ?? '');
    const publishAnswer = answer;
    let faqEntryId = parsePositiveInt(row.faq_entry_id);

    if (createFaq && !faqEntryId) {
      const questionError = validateFaqQuestion(question);
      if (questionError) {
        return new Response(JSON.stringify({ ok: false, error: questionError }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const answerError = validateFaqAnswer(publishAnswer, true);
      if (answerError) {
        return new Response(JSON.stringify({ ok: false, error: answerError }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      const insert = await db
        .prepare(
          `INSERT INTO faq_entries (question, answer, status, submitter_email, pinned, view_count, created_at, updated_at)
           VALUES (?, ?, 'approved', ?, 0, 0, datetime('now'), datetime('now'))`,
        )
        .bind(question.trim(), publishAnswer, String(row.email ?? '').trim().toLowerCase())
        .run();

      faqEntryId = parsePositiveInt(insert.meta?.last_row_id);
    }

    const update = await db
      .prepare(
        `UPDATE ask_inbox
         SET status = 'approved', moderation_note = ?, faq_entry_id = ?
         WHERE id = ? AND status IN ('open', 'pending')`,
      )
      .bind(moderationNote, faqEntryId, id)
      .run();

    if (!update.meta?.changes) {
      return new Response(JSON.stringify({ ok: false, error: 'Ask entry is no longer pending.' }, null, 2), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, id, faq_entry_id: faqEntryId }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('admin ask/approve error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to approve ask entry.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
