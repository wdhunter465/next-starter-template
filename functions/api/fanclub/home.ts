import { fetchClubHomeContent } from '../../_lib/content-inventory-club-home';
import { requireMember } from '../../_lib/session';
import { signB2UrlsDeep } from '../../_lib/b2-presign';
import { jsonResponse, requireTables } from '../../_lib/d1';

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const tables = await requireTables(auth.db, ['content_inventory']);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

    const payload = await fetchClubHomeContent(auth.db, {
      request: context.request,
      publicB2BaseUrl: context.env?.PUBLIC_B2_BASE_URL,
    });
    return new Response(JSON.stringify(await signB2UrlsDeep(context.env, payload), null, 2), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ ok: false, error: String(err?.message || err) }, null, 2), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
