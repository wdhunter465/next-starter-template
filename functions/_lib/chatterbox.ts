// #3415 (Chatterbox) prototype — persistent agentic project communication
// layer. GitHub Issues/PRs remain the system of record; this module only
// records and surfaces the room conversation, task claims, and check-ins
// described in that Issue. It never authors GitHub state itself.

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
 * (migration 0046); this function only rejects claim attempts that are
 * knowably invalid before ever reaching the database, so the caller can
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
 */
export function buildCatchUpDigest(options: BuildCatchUpDigestOptions): CatchUpDigest {
  const tailLimit = options.tailLimit ?? 20;
  const pmoInstructionLimit = options.pmoInstructionLimit ?? 10;
  const unread = options.events.filter((event) => event.id > options.lastSeenEventId);

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
