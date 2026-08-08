import { requireAdmin } from '../../../_lib/auth';
import { listPendingPhotos } from '../../../_lib/member-photo-moderation';

export const onRequestGet = async (context: any): Promise<Response> => {
  const denied = requireAdmin(context.request, context.env);
  if (denied) return denied;

  const db = context.env?.DB;
  if (!db) {
    return new Response(JSON.stringify({ ok: false, error: 'Database unavailable' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const url = new URL(context.request.url);
  const limit = Number(url.searchParams.get('limit') || '50');
  const result = await listPendingPhotos(db, { limit });
  if (!result.ok) {
    const status = result.code === 'SCHEMA_UNAVAILABLE' ? 503 : 500;
    return new Response(JSON.stringify({ ok: false, error: result.error, code: result.code }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ ok: true, items: result.items }, null, 2), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
