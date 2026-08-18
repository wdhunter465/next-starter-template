import { requireAdmin } from '../../../_lib/auth';
import {
  parsePinned,
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
    const question = String(body?.question ?? '');
    const answer = String(body?.answer ?? '');
    const publish =
      parseStrictBoolean(body?.published) ?? parseStrictBoolean(body?.publish) ?? false;
    const pinned = parsePinned(body?.pinned);
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

    const answerError = validateFaqAnswer(answer, publish);
    if (answerError) {
      return new Response(JSON.stringify({ ok: false, error: answerError }, null, 2), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const status = publish ? 'approved' : 'pending';
    const db = env.DB as {
      prepare: (sql: string) => {
        bind: (...args: unknown[]) => {
          run: () => Promise<{ meta?: { last_row_id?: number } }>;
        };
      };
    };

    const result = await db
      .prepare(
        `INSERT INTO faq_entries (question, answer, status, pinned, submitter_email, view_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, 0, datetime('now'), datetime('now'))`,
      )
      .bind(question.trim(), answer.trim(), status, pinned)
      .run();

    return new Response(
      JSON.stringify({ ok: true, id: result.meta?.last_row_id ?? null, status }, null, 2),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err: unknown) {
    console.error('admin faq/create error:', err);
    return new Response(JSON.stringify({ ok: false, error: 'Failed to create FAQ entry.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
