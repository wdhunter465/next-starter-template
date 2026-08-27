// #3794 (Chatterbox self-hosted room-actor design), ported forward from the
// #3415 prototype (component/chatterbox-prototype) and extended per
// docs/explanation/chatterbox-self-hosted-room-actor-redesign.md and Jules's
// #3579 review. GitHub Issues/PRs remain the system of record; this module
// only records and surfaces the room conversation, task claims, check-ins,
// and PMO follow-through described in those Issues. It never authors GitHub
// state itself.

export const EVENT_TYPES = [
  'CLAIM',
  'RELEASE',
  'STATUS',
  'QUESTION',
  'ANSWER',
  'COMPLETE',
  'PMO_INSTRUCTION',
  'PMO_ACCEPT',
  'DECISION_RECORDED',
  'CHECK_IN',
  'CHECK_OUT',
  'SYSTEM',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

// Event types a system-clerk participant (role_class 'system_clerk', e.g. a
// GitHub Actions identity) may post. Deliberately excludes COMPLETE,
// PMO_ACCEPT, and DECISION_RECORDED: those are substantive PMO/Product
// transitions, and the clerk may only execute an already-authorized
// transition, never decide one (review point 6, issue #3415).
export const SYSTEM_CLERK_ALLOWED_EVENT_TYPES: readonly EventType[] = [
  'STATUS',
  'SYSTEM',
  'CHECK_IN',
  'CHECK_OUT',
] as const;

export const ROLE_CLASSES = [
  'product_authority',
  'pmo',
  'implementation_agent',
  'engineering_validation',
  'independent_verifier',
  'preparation_research',
  'system_clerk',
] as const;
export type RoleClass = (typeof ROLE_CLASSES)[number];

// Role classes authorized to force-release another participant's active
// claim (#3794 JULES-5). Ordinary implementation/verification roles may
// only release their own claims.
const FORCE_RELEASE_ROLE_CLASSES: ReadonlySet<RoleClass> = new Set(['pmo', 'product_authority']);

export const TASK_STATES = [
  'PLANNED',
  'BLOCKED',
  'AVAILABLE',
  'CLAIMED',
  'IN_PROGRESS',
  'QUESTION',
  'READY_FOR_REVIEW',
  'ACCEPTED',
  'REWORK',
  'COMPLETE',
  'CANCELLED',
] as const;
export type TaskState = (typeof TASK_STATES)[number];

// Task states that satisfy a dependency edge. A dependency in REWORK does
// not count as satisfied even though it was once ACCEPTED/COMPLETE.
const DEPENDENCY_SATISFYING_STATES: ReadonlySet<TaskState> = new Set(['ACCEPTED', 'COMPLETE']);

export function isValidEventType(value: unknown): value is EventType {
  return typeof value === 'string' && (EVENT_TYPES as readonly string[]).includes(value);
}

export function isValidRoleClass(value: unknown): value is RoleClass {
  return typeof value === 'string' && (ROLE_CLASSES as readonly string[]).includes(value);
}

export function isValidTaskState(value: unknown): value is TaskState {
  return typeof value === 'string' && (TASK_STATES as readonly string[]).includes(value);
}

export function isSystemClerkEventAllowed(eventType: EventType): boolean {
  return SYSTEM_CLERK_ALLOWED_EVENT_TYPES.includes(eventType);
}

export function canForceRelease(roleClass: string): boolean {
  return FORCE_RELEASE_ROLE_CLASSES.has(roleClass as RoleClass);
}

export function parseDependsOn(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return [];
  }
}

export type TaskStateByKey = Record<string, TaskState | undefined>;

export function dependenciesSatisfied(dependsOn: string[], taskStatesByKey: TaskStateByKey): boolean {
  return dependsOn.every((key) => {
    const state = taskStatesByKey[key];
    return state !== undefined && DEPENDENCY_SATISFYING_STATES.has(state);
  });
}

export type ClaimCheckTask = {
  task_key: string;
  state: TaskState;
  depends_on: unknown;
};

export type ClaimCheckResult = { ok: true } | { ok: false; reason: string };

/**
 * Pure precondition check for #3415's "claims must be atomic" requirement.
 * The actual atomicity guarantee is the database's partial unique index
 * (migration 0050, idx_chatterbox_claims_active_task); this function only
 * rejects claim attempts that are knowably invalid before ever reaching
 * the database, so the caller can
 * fail fast with a specific reason instead of a generic conflict.
 */
export function canClaim(task: ClaimCheckTask, taskStatesByKey: TaskStateByKey): ClaimCheckResult {
  if (task.state !== 'AVAILABLE') {
    return { ok: false, reason: `task_not_available:${task.state}` };
  }
  const dependsOn = parseDependsOn(task.depends_on);
  if (!dependenciesSatisfied(dependsOn, taskStatesByKey)) {
    return { ok: false, reason: 'unsatisfied_dependencies' };
  }
  return { ok: true };
}

export type ChatterboxEventRow = {
  id: number;
  event_type: string;
  participant_id: number;
  target_participant_id: number | null;
  in_reply_to_event_id: number | null;
  task_ref: string | null;
  body: string;
  github_ref: string | null;
  created_at: string;
};

export type CatchUpDigest = {
  openQuestions: ChatterboxEventRow[];
  pmoInstructions: ChatterboxEventRow[];
  tail: ChatterboxEventRow[];
  unreadCount: number;
};

export type BuildCatchUpDigestOptions = {
  events: ChatterboxEventRow[];
  participantId: number;
  lastSeenEventId: number;
  tailLimit?: number;
  pmoInstructionLimit?: number;
};

/**
 * Bounded catch-up digest (review point 2, issue #3415): a room meant to
 * span a full program lifecycle accumulates far more events than fit in a
 * reasonable read. This returns open questions addressed to the caller,
 * recent PMO instructions, and a capped raw tail — not a full replay.
 *
 * `options.events` must be exactly the room's events as read at one point
 * in time by the caller (see #3794 JULES-3 / atomicCheckInWindow below) —
 * this function trusts that upper bound and does not re-derive it, so the
 * caller is responsible for the snapshot's correctness.
 */
export function buildCatchUpDigest(options: BuildCatchUpDigestOptions): CatchUpDigest {
  const tailLimit = options.tailLimit ?? 20;
  const pmoInstructionLimit = options.pmoInstructionLimit ?? 10;
  // CHECK_IN/CHECK_OUT are presence markers, not content to catch up on —
  // every check-in inserts its own CHECK_IN row (module comment above), so
  // counting these would inflate unreadCount by one on every subsequent
  // check-in for no informational gain.
  const unread = options.events.filter(
    (event) => event.id > options.lastSeenEventId && event.event_type !== 'CHECK_IN' && event.event_type !== 'CHECK_OUT',
  );

  // Answered-ness is a property of the whole conversation, not just the
  // unread window — an old question answered long ago must not resurface as
  // open just because the answer itself already scrolled past. Computed
  // once, O(n), and reused as the sole "is this answered" check below.
  const answeredQuestionIds = new Set(
    options.events
      .filter((event) => event.event_type === 'ANSWER' && event.in_reply_to_event_id !== null)
      .map((event) => event.in_reply_to_event_id as number),
  );

  const openQuestions = options.events.filter(
    (event) =>
      event.event_type === 'QUESTION' &&
      (event.target_participant_id === null || event.target_participant_id === options.participantId) &&
      !answeredQuestionIds.has(event.id),
  );

  const pmoInstructions = unread
    .filter((event) => event.event_type === 'PMO_INSTRUCTION')
    .slice(-pmoInstructionLimit);

  const tail = unread.slice(-tailLimit);

  return {
    openQuestions,
    pmoInstructions,
    tail,
    unreadCount: unread.length,
  };
}

/**
 * #3794 Layer 1 / Jules #3579 JULES-3 fix: derive the check-in high-
 * watermark from a set of events already read at one point in time, before
 * this call's own CHECK_IN event exists. The caller must advance the
 * participant's checkpoint to exactly this value — never to the id of the
 * CHECK_IN event this call is about to insert.
 *
 * Why this fixes the race: any event concurrently written by another
 * participant between this read and this call's own writes necessarily
 * receives an id greater than this watermark (ids are monotonic), so it is
 * correctly excluded from this digest AND from this checkpoint advance —
 * it remains unread for the *next* check-in rather than being silently
 * skipped. The old bug advanced the checkpoint to the newly-inserted
 * CHECK_IN event's own id instead, which could exceed a concurrent event's
 * id that this read never saw.
 */
export function computeCheckInHighWatermark(priorEvents: readonly ChatterboxEventRow[], lastSeenEventId: number): number {
  if (priorEvents.length === 0) return lastSeenEventId;
  return priorEvents[priorEvents.length - 1].id;
}

function isoNow(): string {
  return new Date().toISOString();
}

export type Db = {
  prepare: (sql: string) => {
    bind: (...args: unknown[]) => { first: () => Promise<any>; all: () => Promise<{ results?: any[] }>; run: () => Promise<any> };
  };
};

export async function ensureRoom(
  db: Db,
  params: { roomKey: string; sourceIssueRef: string; title: string },
): Promise<{ id: number }> {
  const existing = await db
    .prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?')
    .bind(params.roomKey)
    .first();
  if (existing?.id) return { id: Number(existing.id) };

  // Check-then-insert is inherently racy: two concurrent callers can both
  // miss `existing` above. "Ensure" means this must still succeed when that
  // happens — a unique-constraint failure here means someone else just
  // created the room, so fall through to re-reading it instead of throwing.
  try {
    await db
      .prepare('INSERT INTO chatterbox_rooms (room_key, source_issue_ref, title) VALUES (?, ?, ?)')
      .bind(params.roomKey, params.sourceIssueRef, params.title)
      .run();
  } catch (error: any) {
    const message = String(error?.message ?? error);
    if (!/unique|constraint/i.test(message)) throw error;
  }

  const created = await db.prepare('SELECT id FROM chatterbox_rooms WHERE room_key = ?').bind(params.roomKey).first();
  return { id: Number(created.id) };
}

export async function getParticipantByKey(db: Db, participantKey: string): Promise<any | null> {
  const row = await db
    .prepare('SELECT * FROM chatterbox_participants WHERE participant_key = ? AND revoked_at IS NULL')
    .bind(participantKey)
    .first();
  return row ?? null;
}

export type ClaimAttemptResult =
  | { ok: true; claimId: number }
  | { ok: false; reason: string };

/**
 * Atomic claim. Relies on the partial unique index on
 * chatterbox_claims(task_id) WHERE status='ACTIVE' for the actual
 * concurrency guarantee — this function pre-checks state/dependencies
 * (canClaim) for a fast, specific rejection, then lets the database reject
 * a genuine race with a constraint violation rather than a second
 * application-level check.
 */
export async function atomicClaimTask(
  db: Db,
  params: { taskId: number; taskKey: string; participantId: number; roomId: number; taskStatesByKey: TaskStateByKey; task: ClaimCheckTask },
): Promise<ClaimAttemptResult> {
  const precheck = canClaim(params.task, params.taskStatesByKey);
  if (!precheck.ok) return precheck;

  try {
    const at = isoNow();
    await db
      .prepare(
        `INSERT INTO chatterbox_claims (task_id, participant_id, status, claimed_at, renewed_at)
         VALUES (?, ?, 'ACTIVE', ?, ?)`,
      )
      .bind(params.taskId, params.participantId, at, at)
      .run();
  } catch (error: any) {
    const message = String(error?.message ?? error);
    if (/unique|constraint/i.test(message)) {
      return { ok: false, reason: 'already_claimed' };
    }
    throw error;
  }

  await db
    .prepare(`UPDATE chatterbox_tasks SET state = 'CLAIMED', updated_at = ? WHERE id = ?`)
    .bind(isoNow(), params.taskId)
    .run();

  const claimRow = await db
    .prepare(`SELECT id FROM chatterbox_claims WHERE task_id = ? AND status = 'ACTIVE'`)
    .bind(params.taskId)
    .first();

  return { ok: true, claimId: Number(claimRow.id) };
}

// --- #3794 Layer 3 — PMO action queue -------------------------------------

export const PMO_ACTION_TYPES = ['CLOSE_ISSUE', 'UPDATE_TRACKER', 'RELEASE_SUCCESSOR', 'OTHER'] as const;
export type PmoActionType = (typeof PMO_ACTION_TYPES)[number];

export const PMO_ACTION_STATUSES = ['PENDING', 'ACKED', 'DONE', 'EXPIRED'] as const;
export type PmoActionStatus = (typeof PMO_ACTION_STATUSES)[number];

export function isValidPmoActionType(value: unknown): value is PmoActionType {
  return typeof value === 'string' && (PMO_ACTION_TYPES as readonly string[]).includes(value);
}

const DEFAULT_PMO_ACTION_EXPIRY_HOURS = 24;

export function computeDefaultExpiry(now: Date = new Date(), hours = DEFAULT_PMO_ACTION_EXPIRY_HOURS): string {
  return new Date(now.getTime() + hours * 3600_000).toISOString();
}

export type PmoActionRow = {
  id: number;
  room_id: number;
  source_event_id: number;
  task_ref: string;
  action_type: string;
  status: string;
  created_at: string;
  expires_at: string;
  acked_at: string | null;
  completed_at: string | null;
  completed_by_participant_id: number | null;
  reconciliation_note: string | null;
};

/**
 * A PENDING action becomes escalation-worthy once it is past its own
 * expiry without ever having been acknowledged. An ACKED action is not
 * escalated by this check — acknowledgement is itself evidence someone is
 * on it; this only catches items nobody has touched at all (design doc
 * Layer 3/4: "escalate anything left PENDING past a missed-cycle
 * threshold").
 */
export function isPmoActionOverdue(action: Pick<PmoActionRow, 'status' | 'expires_at'>, now: Date = new Date()): boolean {
  if (action.status !== 'PENDING') return false;
  return new Date(action.expires_at).getTime() < now.getTime();
}

// --- #3794 JULES-5 — stale-claim detection --------------------------------

const DEFAULT_STALE_CLAIM_THRESHOLD_MS = 24 * 3600_000;

/**
 * A claim is a candidate for reclamation once its lease (renewed_at) is
 * older than the threshold. This function only flags — per #3415's own
 * caution ("a stale claim must be flagged for reconciliation rather than
 * blindly reassigned"), nothing here reassigns a claim automatically.
 */
export function isClaimStale(
  claim: { renewed_at: string },
  now: Date = new Date(),
  thresholdMs: number = DEFAULT_STALE_CLAIM_THRESHOLD_MS,
): boolean {
  return now.getTime() - new Date(claim.renewed_at).getTime() > thresholdMs;
}
