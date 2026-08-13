import { requireMember } from "../../_lib/session";
import { jsonResponse, requireTables } from "../../_lib/d1";

function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

// #2919: rights/consent capture. Kept in this handler (not imported from the
// separate content-pipeline module) because submission_queue is a distinct
// schema/table from that system's member_submissions.
const CREDIT_PREFERENCES = new Set(["public_credit", "anonymous", "private", "custom"]);


export const onRequestPost = async (context: any): Promise<Response> => {
  const auth = await requireMember(context);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const tables = await requireTables(auth.db, ["submission_queue"]);
    if (!tables.ok) return jsonResponse(tables.body, tables.status);

    const body = await context.request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return new Response(
        JSON.stringify({ ok: false, error: "Invalid JSON body" }, null, 2),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const name = String((body as any).name ?? "").trim();
    const title = String((body as any).title ?? "").trim();
    const content = String((body as any).content ?? "").trim();
    const sourceName = String((body as any).source_name ?? "").trim() || null;
    const sourceUrl = String((body as any).source_url ?? "").trim() || null;
    const creditLine = String((body as any).credit_line ?? "").trim() || null;
    const mediaUrl = String((body as any).media_url ?? "").trim() || null;
    const mediaReference = String((body as any).media_reference ?? mediaUrl ?? "").trim() || null;
    const proposedTag = slugifyTag(String((body as any).proposed_tag ?? title).trim());

    // #2919: rights/consent capture — required, fail-closed for every new submission.
    const ownershipStatement = String((body as any).ownership_statement ?? "").trim();
    const permissionStatement = String((body as any).permission_statement ?? "").trim();
    const creditPreference = String((body as any).credit_preference ?? "").trim();

    // email is derived from the authenticated session — never trust client input
    const email = auth.email;

    if (!name || !title || !content) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            error: "Fields 'name', 'title', and 'content' are all required",
          },
          null,
          2
        ),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!ownershipStatement || !permissionStatement || !creditPreference) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            error:
              "Fields 'ownership_statement', 'permission_statement', and 'credit_preference' are all required",
          },
          null,
          2
        ),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!CREDIT_PREFERENCES.has(creditPreference)) {
      return new Response(
        JSON.stringify(
          {
            ok: false,
            error: `credit_preference must be one of: ${[...CREDIT_PREFERENCES].join(", ")}`,
          },
          null,
          2
        ),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const submittedBy = `${name} <${email}>`;
    const payload = JSON.stringify({
      submitted_by: submittedBy,
      title,
      description: content,
      source_name: sourceName,
      source_url: sourceUrl,
      credit_line: creditLine,
      proposed_tag: proposedTag || null,
      media_reference: mediaReference,
    });

    // consent_status is never accepted from the client; member intake always
    // starts 'pending' and only an admin reviewer may grant/restrict/deny it.
    const result = await auth.db.prepare(
      `INSERT INTO submission_queue
        (submitted_by, payload, title, description, source_name, source_url, credit_line,
         proposed_tag, media_url, media_reference, status,
         ownership_statement, permission_statement, credit_preference, consent_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?, 'pending');`
    )
      .bind(
        submittedBy,
        payload,
        title,
        content,
        sourceName,
        sourceUrl,
        creditLine,
        proposedTag || null,
        mediaUrl,
        mediaReference,
        ownershipStatement,
        permissionStatement,
        creditPreference,
      )
      .run();

    const insertedId =
      (result as any)?.meta?.last_row_id ?? (result as any)?.meta?.lastRowId ?? null;

    return new Response(
      JSON.stringify(
        {
          ok: true,
          id: insertedId,
          message: "Submission queued for editorial review",
        },
        null,
        2
      ),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify(
        {
          ok: false,
          error: String(err?.message ?? err),
        },
        null,
        2
      ),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
};
