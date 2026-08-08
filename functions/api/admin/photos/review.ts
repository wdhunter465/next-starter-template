import { requireAdmin } from '../../../_lib/auth';
import { reviewPendingPhoto, type PhotoModerationAction } from '../../../_lib/member-photo-moderation';

export const onRequestPost = async (context: any): Promise<Response> => {
  const denied = requireAdmin(context.request, context.env);
  if (denied) return denied;

  const db = context.env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Database unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: any = {};
  try {
    body = await context.request.json();
  } catch {
    body = {};
  }

  const action = String(body?.action || '').trim().toLowerCase() as PhotoModerationAction;
  const photoId = Number(body?.photo_id ?? body?.id);
  const reviewer = String(body?.reviewer || context.request.headers.get('x-admin-actor') || 'admin').trim();
  const notes = body?.notes == null ? null : String(body.notes);
  const skipObjectPromote = Boolean(body?.skip_object_promote);

  const result = await reviewPendingPhoto(db, context.env || {}, {
    photoId,
    action,
    reviewer,
    notes,
    skipObjectPromote,
  });

  if (!result.ok) {
    return new Response(JSON.stringify({ ok: false, error: result.error, code: result.code }), {
      status: result.status || 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, id: result.id, status: result.status, publishedKey: result.publishedKey }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
