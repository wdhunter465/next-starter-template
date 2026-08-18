import { requireAdmin } from '../../../_lib/auth';
import {
  normalizeFaqStatus,
  parsePinned,
  parsePositiveInt,
  parseStrictBoolean,
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
    if (!id) {
      return new Response(JSON.stringify({ ok: false, error: 'Valid FAQ entry ID required.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const db = env.DB as {
      prepare: (sql: string) => {
        bind: (...args: unknown[]) => { first: () => Promise<unknown>; run: () => Promise<unknown> };
      };
    };

    const existing = (await db
      .prepare('SELECT id, question, answer, status, pinned FROM faq_entries WHERE id = ?')
      .bind(id)
      .first()) as Record<string, unknown> | null;

    if (!existing) {
      return new Response(JSON.stringify({ ok: false, error: 'FAQ entry not found.' }, null, 2), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const question =
      body?.question != null ? String(body.question) : String(existing.question ?? '');
    const answer = body?.answer != null ? String(body.answer) : String(existing.answer ?? '');
    let status =
      body?.status != null
        ? normalizeFaqStatus(body.status)
        : normalizeFaqStatus(existing.status);

    if (body?.published != null || body?.approved != null) {
      const published =
        parseStrictBoolean(body?.published) ?? parseStrictBoolean(body?.approved);
      if (published === null) {
        return new Response(JSON.stringify({ ok: false, error: 'Invalid published flag.' }, null, 2), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      status = published ? 'approved' : 'pending';
    }

    const pinned = body?.pinned != null ? parsePinned(body.pinned) : parsePinned(existing.pinned);

    if (!status) {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid FAQ status.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (pinned === null) {
      return new Response(JSON.stringify({ ok: false, error: 'Pinned must be 0 or 1.' }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const questionError = validateFaqQuestion(question);
    if (questionError) {
      return new Response(JSON.stringify({ ok: false, error: questionError }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const answerError = validateFaqAnswer(answer, status === 'approved');
    if (answerError) {
      return new Response(JSON.stringify({ ok: false, error: answerError }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    await db
      .prepare(
        `UPDATE faq_entries
         SET question = ?, answer = ?, status = ?, pinned = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(question.trim(), answer.trim(), status, pinned, id)
      .run();

    return new Response(JSON.stringify({ ok: true, id, status, pinned }, null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    console.error('admin faq/update error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to update FAQ entry.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
