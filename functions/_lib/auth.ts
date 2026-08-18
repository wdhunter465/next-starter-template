import { requireD1 } from "./d1";
import { getSessionId, getSessionEmail, getMemberRole, touchSession } from "./session";

// Dual gate: a signed-in member session with role=admin is sufficient on its
// own (this is the path operators use from the browser -- no token to paste).
// The static ADMIN_TOKEN remains a fallback for ops scripts, CI, and other
// non-browser automation that has no member session to send.
export async function requireAdmin(request: Request, env: any): Promise<Response | null> {
  const d1 = requireD1(env);
  if (d1.ok) {
    const sessionId = getSessionId(request);
    if (sessionId) {
      const email = await getSessionEmail(d1.db, sessionId);
      if (email) {
        const role = await getMemberRole(d1.db, email);
        if (role === "admin") {
          await touchSession(d1.db, sessionId);
          return null;
        }
      }
    }
  }

  const token = request.headers.get("x-admin-token") || request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const expected = String(env?.ADMIN_TOKEN || "").trim();

  // If neither an admin session nor a configured token is available, fail closed.
  if (!expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Admin access is not configured." }),
      { status: 503, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!token || token !== expected) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized." }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  return null;
}
