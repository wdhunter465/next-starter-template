// GET /api/admin/b2-signing-check
// Admin member session only. Explains why signed B2 links are or are not active (#5131):
// yes/no facts about the B2 settings, and the HTTP status B2 gives to one signed request for
// a stored photo. No key, key id, secret or setting value is returned. Read-only.

import { requireAdminMember } from "../../_lib/session";
import { diagnoseB2Signing, signB2Url } from "../../_lib/b2-presign";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function addressForm(url: string): string {
  if (/^https:\/\/s3\.[^./]+\.backblazeb2\.com\//.test(url)) return "s3-endpoint address";
  if (/^https:\/\/f\d+\.backblazeb2\.com\/file\//.test(url)) return "friendly download address";
  return "other address";
}

export const onRequestGet = async (context: any): Promise<Response> => {
  const auth = await requireAdminMember(context);
  if (!auth.ok) return json(auth.body, auth.status);

  const env = context.env ?? {};
  const settings = diagnoseB2Signing(env);

  let sample: Record<string, unknown> = { available: false };
  try {
    const row = (await auth.db
      .prepare("SELECT url FROM photos WHERE url IS NOT NULL AND url <> '' ORDER BY id DESC LIMIT 1")
      .first()) as { url?: string } | null;
    if (row?.url) {
      const signed = await signB2Url(env, row.url);
      sample = { available: true, address_form: addressForm(row.url), signed: signed !== row.url };
      if (signed !== row.url) {
        const res = await fetch(signed, { method: "GET", headers: { Range: "bytes=0-0" } });
        const text = res.ok ? "" : await res.text().catch(() => "");
        sample = {
          ...sample,
          b2_status: res.status,
          b2_error_code: text.match(/<Code>([^<]{1,60})<\/Code>/)?.[1] ?? null,
        };
      }
    }
  } catch (err: any) {
    sample = { ...sample, error: "sample request failed" };
  }

  return json({ ok: true, settings, sample }, 200);
};
