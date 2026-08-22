// Shared admin-session test fixtures for functions/_lib/auth.ts requireAdmin()
// (#3547 — session-only admin authorization, no ADMIN_TOKEN).

export const ADMIN_SESSION_ID = 'test-admin-session';
export const ADMIN_SESSION_COOKIE = `lgfc_session=${ADMIN_SESSION_ID}`;
export const ADMIN_SESSION_EMAIL = 'admin-test@example.com';

type PreparedLike = {
  bind?: (...args: unknown[]) => {
    first?: () => Promise<unknown>;
    all?: () => Promise<unknown>;
    run?: () => Promise<unknown>;
  };
  first?: () => Promise<unknown>;
  all?: () => Promise<unknown>;
  run?: () => Promise<unknown>;
};

/**
 * Wraps a hand-rolled D1 `db` test double so it answers the two auth queries
 * `requireAdminMember()` issues (session lookup, then role lookup) without
 * touching the rest of the mock's SQL-branching logic.
 */
export function withAdminSession<T extends { prepare: (sql: string) => any }>(
  db: T,
  role: 'admin' | 'member' = 'admin',
): T {
  const originalPrepare = db.prepare.bind(db);

  const prepare = (sql: string): PreparedLike => {
    if (sql.includes('member_sessions')) {
      return {
        bind: () => ({
          first: async () => ({ email: ADMIN_SESSION_EMAIL }),
          run: async () => ({ meta: { changes: 1 } }),
        }),
      };
    }
    if (sql.includes('FROM members') && sql.includes('role')) {
      return {
        bind: () => ({
          first: async () => ({ role }),
        }),
      };
    }
    return originalPrepare(sql);
  };

  return { ...db, prepare };
}
