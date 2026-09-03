// Structured editorial audit trail (P1-08 / #3416).
// Shared by the admin editorial review/publish/inventory endpoints so the
// event shape, fail-open policy, and table name stay in one place.

export type EditorialAuditEvent = {
  action: string;
  objectType: string;
  objectId?: number | null;
  actor?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  meta?: Record<string, unknown> | null;
};

/** Fail-open — never blocks a successful editorial mutation. */
export async function recordEditorialAudit(db: any, event: EditorialAuditEvent): Promise<void> {
  try {
    const nowRow = await db.prepare("SELECT datetime('now') AS now").first();
    const now = String((nowRow as any)?.now || new Date().toISOString());
    await db
      .prepare(
        `INSERT INTO editorial_audit_events
           (action, object_type, object_id, actor, outcome, before_json, after_json, meta_json, created_at)
         VALUES (?, ?, ?, ?, 'success', ?, ?, ?, ?)`,
      )
      .bind(
        event.action,
        event.objectType,
        event.objectId ?? null,
        event.actor ?? null,
        event.before ? JSON.stringify(event.before) : null,
        event.after ? JSON.stringify(event.after) : null,
        event.meta ? JSON.stringify(event.meta) : null,
        now,
      )
      .run();
  } catch (err) {
    console.error("editorial audit write error:", err);
  }
}
