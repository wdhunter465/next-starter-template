// Append-only content_inventory publication audit (Task 005 design / Task 007 storage slice).
// Does not write pipeline moderation_events.

import type { OperationalState, PublicationAction } from "./publication-transition-gate";

export const PUBLICATION_AUDIT_ACTIONS = [
  "stage",
  "review",
  "approve",
  "schedule",
  "pause",
  "cancel_schedule",
  "publish",
  "rotate",
  "unpublish",
  "rollback",
  "archive",
  "reject",
  "suppress",
  "reopen",
  "return_to_draft",
] as const;

export type PublicationAuditAction = (typeof PUBLICATION_AUDIT_ACTIONS)[number];

export type PublicationAuditEvent = {
  inventoryId: number;
  action: PublicationAction;
  actor?: string | null;
  actorRole?: string | null;
  fromState?: OperationalState | string | null;
  toState?: OperationalState | string | null;
  reason?: string | null;
  eventAt: string;
  candidateId?: string | null;
  rollbackGroupId?: string | null;
  scheduleId?: string | null;
  publicationTarget?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  sourceName?: string | null;
  creditLine?: string | null;
};

const INSERT_SQL = `INSERT INTO content_inventory_events (
  rollback_group_id, event_at, actor, actor_role, candidate_id, inventory_id,
  from_state, to_state, action, reason, schedule_id, publication_target,
  approval_snapshot, source_snapshot, public_check
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

function trim(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function toAuditAction(action: PublicationAction): PublicationAuditAction {
  if (action === "pause_schedule") return "pause";
  return action as PublicationAuditAction;
}

export function buildPublicationEventBinds(event: PublicationAuditEvent): unknown[] {
  const action = toAuditAction(event.action);
  const toState = trim(event.toState);
  const approvedBy = trim(event.approvedBy);
  const approvedAt = trim(event.approvedAt);
  const sourceName = trim(event.sourceName);
  const creditLine = trim(event.creditLine);
  return [
    trim(event.rollbackGroupId) || null,
    event.eventAt,
    trim(event.actor) || null,
    trim(event.actorRole) || "reviewing editor",
    trim(event.candidateId) || null,
    event.inventoryId,
    trim(event.fromState) || null,
    toState || null,
    action,
    trim(event.reason) || null,
    trim(event.scheduleId) || null,
    trim(event.publicationTarget) || null,
    approvedBy || approvedAt
      ? JSON.stringify({ approved_by: approvedBy || null, approved_at: approvedAt || null })
      : null,
    sourceName || creditLine
      ? JSON.stringify({ source_name: sourceName || null, credit_line: creditLine || null })
      : null,
    toState === "published" ? 1 : 0,
  ];
}

export async function recordPublicationEvent(db: { prepare: (sql: string) => any }, event: PublicationAuditEvent): Promise<void> {
  if (event.action === "rollback") {
    throw new Error("rollback audit writes are not implemented in this Task 007 slice.");
  }
  await db.prepare(INSERT_SQL).bind(...buildPublicationEventBinds(event)).run();
}

export { INSERT_SQL as PUBLICATION_EVENT_INSERT_SQL };
