import { requireAdminMember } from "./session";

// Session-only admin gate (#3547): an authenticated member session with D1
// members.role = 'admin' is the sole authorization path for /api/admin/**.
// There is no shared-secret fallback -- unauthenticated requests fail closed
// with 401, an authenticated non-admin member fails closed with 403, and a
// missing D1 binding fails closed with 503. Delegates to the
// requireAdminMember() session/D1-role helper so there is exactly one place
// that decides who is an admin.
export async function requireAdmin(request: Request, env: any): Promise<Response | null> {
  const result = await requireAdminMember({ env, request });
  if (result.ok) return null;

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}
