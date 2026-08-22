import type { DatabaseSync } from 'node:sqlite';

// Shared admin-session seeding for real-sqlite (node:sqlite DatabaseSync) test
// fixtures, matching functions/_lib/auth.ts requireAdmin() (#3547 — session-only
// admin authorization, no ADMIN_TOKEN).

export const ADMIN_SESSION_ID = 'test-admin-session';
export const ADMIN_SESSION_COOKIE = `lgfc_session=${ADMIN_SESSION_ID}`;
export const ADMIN_SESSION_EMAIL = 'admin-test@example.com';

export function seedAdminSession(
  sqlite: DatabaseSync,
  email = ADMIN_SESSION_EMAIL,
  sessionId = ADMIN_SESSION_ID,
): string {
  sqlite.exec(`
    INSERT INTO members (email, role) VALUES ('${email}', 'admin')
      ON CONFLICT(email) DO UPDATE SET role = 'admin';
    INSERT INTO member_sessions (id, email, expires_at)
      VALUES ('${sessionId}', '${email}', datetime('now', '+1 day'))
      ON CONFLICT(id) DO UPDATE SET expires_at = datetime('now', '+1 day');
  `);
  return sessionId;
}
