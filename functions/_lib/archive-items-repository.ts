// D1 repository for #2073 Work Package item 4 (#4061): physical
// archive-acquisition intake and custody tracking (migration 0065).
//
// Every archive item is anchored to a `content_items` row
// (`input_stream = 'physical_acquisition'`) via `upsertCandidate`, the same
// mechanism every other intake stream uses -- this gets rights_evidence,
// moderation_events, tags, soft-delete/retention, and the candidate_id
// namespace for free, per the reuse guidance in
// docs/reference/content/content-rights-runtime-as-built-2073.md.
//
// donor_name/donor_contact are admin-only by construction: no function in
// this module is called from any public (non-admin) route, and
// serializeArchiveItemForAdmin is the only shape this data is ever
// projected into -- a public-facing serializer, if one is ever built, must
// not import from this file's raw row shape.

import { allocateMemberSubmissionCandidateId } from './content-pipeline-member-submission-intake';
import { upsertCandidate, getCandidateByCandidateId } from './content-pipeline-candidate-repository';
import type { CandidateRecord } from './content-pipeline-candidate-import';
import { requireTables } from './d1';

export const ARCHIVE_ITEMS_TABLES = ['archive_items', 'archive_item_custody_events', 'content_items'] as const;

export const ARCHIVE_ITEM_TYPES = [
  'photograph', 'letter', 'document', 'memorabilia', 'audio', 'video', 'other',
] as const;
export type ArchiveItemType = (typeof ARCHIVE_ITEM_TYPES)[number];

export const ARCHIVE_CUSTODY_TYPES = ['donation', 'loan'] as const;
export type ArchiveCustodyType = (typeof ARCHIVE_CUSTODY_TYPES)[number];

export const ARCHIVE_CUSTODY_STATES = [
  'offered', 'received', 'cataloged', 'stored', 'returned', 'deaccessioned',
] as const;
export type ArchiveCustodyState = (typeof ARCHIVE_CUSTODY_STATES)[number];

// #4059 decision 1/2: the custody state machine. Each key's value lists the
// states directly reachable from it. `returned` only applies to loans and
// `deaccessioned` is reachable from any post-intake state (an item can be
// deaccessioned whether it was merely offered, or fully stored) -- but never
// from a terminal state back into an active one.
const CUSTODY_TRANSITIONS: Record<ArchiveCustodyState, ArchiveCustodyState[]> = {
  offered: ['received', 'deaccessioned'],
  received: ['cataloged', 'returned', 'deaccessioned'],
  cataloged: ['stored', 'returned', 'deaccessioned'],
  stored: ['returned', 'deaccessioned'],
  returned: [],
  deaccessioned: [],
};

export function isValidCustodyTransition(from: ArchiveCustodyState, to: ArchiveCustodyState): boolean {
  return CUSTODY_TRANSITIONS[from]?.includes(to) ?? false;
}

export type ArchiveItemRow = {
  id: number;
  content_item_id: number;
  item_type: ArchiveItemType;
  custody_type: ArchiveCustodyType;
  custody_state: ArchiveCustodyState;
  loan_expected_return_at: string | null;
  loan_returned_at: string | null;
  storage_location: string | null;
  condition_notes: string | null;
  donor_name: string | null;
  donor_contact: string | null;
  donor_consent_public_credit: 0 | 1;
  credit_line: string | null;
  intake_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ArchiveItemCustodyEventRow = {
  id: number;
  archive_item_id: number;
  from_state: ArchiveCustodyState | null;
  to_state: ArchiveCustodyState;
  actor: string;
  note: string | null;
  recorded_at: string;
};

export async function requireArchiveItemsTables(db: unknown) {
  return requireTables(db, [...ARCHIVE_ITEMS_TABLES]);
}

export type CreateArchiveItemInput = {
  title: string;
  summary: string;
  item_type: ArchiveItemType;
  custody_type: ArchiveCustodyType;
  loan_expected_return_at?: string | null;
  donor_name?: string | null;
  donor_contact?: string | null;
  donor_consent_public_credit?: 0 | 1;
  credit_line?: string | null;
  storage_location?: string | null;
  condition_notes?: string | null;
  intake_notes?: string | null;
  actor: string;
};

export type ArchiveItemWithCandidate = ArchiveItemRow & { candidate_id: string };

async function insertArchiveItemRow(
  db: any,
  contentItemId: number,
  input: CreateArchiveItemInput,
): Promise<number> {
  const result = await db
    .prepare(
      `INSERT INTO archive_items (
        content_item_id, item_type, custody_type, custody_state,
        loan_expected_return_at, storage_location, condition_notes,
        donor_name, donor_contact, donor_consent_public_credit, credit_line, intake_notes
      ) VALUES (?, ?, ?, 'offered', ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      contentItemId,
      input.item_type,
      input.custody_type,
      input.custody_type === 'loan' ? (input.loan_expected_return_at ?? null) : null,
      input.storage_location ?? null,
      input.condition_notes ?? null,
      input.donor_name ?? null,
      input.donor_contact ?? null,
      input.donor_consent_public_credit ?? 0,
      input.credit_line ?? null,
      input.intake_notes ?? null,
    )
    .run();

  return Number(result?.meta?.last_row_id ?? 0);
}

async function insertCustodyEvent(
  db: any,
  archiveItemId: number,
  fromState: ArchiveCustodyState | null,
  toState: ArchiveCustodyState,
  actor: string,
  note: string | null,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO archive_item_custody_events (archive_item_id, from_state, to_state, actor, note)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(archiveItemId, fromState, toState, actor, note ?? null)
    .run();
}

// Creates the content_items row (input_stream = 'physical_acquisition') and
// the archive_items row together, plus the initial 'offered' custody event.
// Not wrapped in db.batch(): upsertCandidate itself issues multiple
// statements internally and returns the resulting row, so the archive_items
// insert (which needs that row's id) must follow it, not run alongside it.
export async function createArchiveItem(
  db: any,
  input: CreateArchiveItemInput,
): Promise<ArchiveItemWithCandidate> {
  const year = new Date().getUTCFullYear();
  const candidateId = await allocateMemberSubmissionCandidateId(db, year);
  const now = new Date().toISOString();

  const candidate: CandidateRecord = {
    candidate_id: candidateId,
    input_stream: 'physical_acquisition',
    title: input.title,
    source_name: 'LGFC physical archive intake',
    source_type: 'member',
    content_type: input.item_type === 'photograph' ? 'photo' : 'artifact',
    summary: input.summary,
    rights_status: 'unknown',
    source_trust_status: 'trusted',
    relevance_status: 'pending',
    review_status: 'pending_review',
    publication_status: 'not_ready',
    privacy_flag: input.donor_name ? 'donor_member' : 'none',
    privacy_review_status: 'pending_review',
    review_priority: 'normal',
    credit_line: input.credit_line ?? undefined,
    created_at: now,
    updated_at: now,
  };

  const stored = await upsertCandidate(db, candidate);
  const archiveItemId = await insertArchiveItemRow(db, stored.id, input);
  await insertCustodyEvent(db, archiveItemId, null, 'offered', input.actor, 'Intake created.');

  const created = await getArchiveItemById(db, archiveItemId);
  if (!created) {
    throw new Error(`Failed to load archive_items row after insert (id=${archiveItemId})`);
  }
  return created;
}

export async function getArchiveItemById(db: any, id: number): Promise<ArchiveItemWithCandidate | null> {
  const row = await db
    .prepare(
      `SELECT ai.*, ci.candidate_id
       FROM archive_items ai
       JOIN content_items ci ON ci.id = ai.content_item_id
       WHERE ai.id = ?`,
    )
    .bind(id)
    .first();
  return (row as ArchiveItemWithCandidate) ?? null;
}

export type ArchiveItemListFilter = {
  custody_state?: ArchiveCustodyState;
  custody_type?: ArchiveCustodyType;
  limit?: number;
  offset?: number;
};

export async function listArchiveItems(
  db: any,
  filter: ArchiveItemListFilter = {},
): Promise<ArchiveItemWithCandidate[]> {
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const conditions: string[] = [];
  const params: unknown[] = [];
  if (filter.custody_state) {
    conditions.push('ai.custody_state = ?');
    params.push(filter.custody_state);
  }
  if (filter.custody_type) {
    conditions.push('ai.custody_type = ?');
    params.push(filter.custody_type);
  }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const result = await db
    .prepare(
      `SELECT ai.*, ci.candidate_id
       FROM archive_items ai
       JOIN content_items ci ON ci.id = ai.content_item_id
       ${where}
       ORDER BY ai.updated_at DESC, ai.id DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(...params, limit, offset)
    .all();

  return (result.results ?? []) as ArchiveItemWithCandidate[];
}

export class InvalidCustodyTransitionError extends Error {
  constructor(from: ArchiveCustodyState, to: ArchiveCustodyState) {
    super(`Invalid custody transition: ${from} -> ${to}.`);
    this.name = 'InvalidCustodyTransitionError';
  }
}

export type UpdateCustodyStateInput = {
  archiveItemId: number;
  toState: ArchiveCustodyState;
  actor: string;
  note?: string | null;
};

// PMO/ops-operated per #4059 decision 2 -- enforced by the caller
// (requireAdmin at the API layer), not by this function. Always records a
// new archive_item_custody_events row (append-only), matching the rest of
// this pipeline's evidence/audit conventions.
export async function updateCustodyState(
  db: any,
  input: UpdateCustodyStateInput,
): Promise<ArchiveItemWithCandidate> {
  const current = await getArchiveItemById(db, input.archiveItemId);
  if (!current) {
    throw new Error(`archive_items row not found (id=${input.archiveItemId})`);
  }

  if (!isValidCustodyTransition(current.custody_state, input.toState)) {
    throw new InvalidCustodyTransitionError(current.custody_state, input.toState);
  }

  const returnedAtUpdate = input.toState === 'returned' ? ", loan_returned_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')" : '';

  await db
    .prepare(
      `UPDATE archive_items
       SET custody_state = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')${returnedAtUpdate}
       WHERE id = ?`,
    )
    .bind(input.toState, input.archiveItemId)
    .run();

  await insertCustodyEvent(db, input.archiveItemId, current.custody_state, input.toState, input.actor, input.note ?? null);

  const updated = await getArchiveItemById(db, input.archiveItemId);
  if (!updated) {
    throw new Error(`Failed to reload archive_items row after update (id=${input.archiveItemId})`);
  }
  return updated;
}

export async function listCustodyEvents(db: any, archiveItemId: number): Promise<ArchiveItemCustodyEventRow[]> {
  const result = await db
    .prepare(
      `SELECT * FROM archive_item_custody_events WHERE archive_item_id = ? ORDER BY recorded_at DESC, id DESC`,
    )
    .bind(archiveItemId)
    .all();
  return (result.results ?? []) as ArchiveItemCustodyEventRow[];
}

// Admin-facing projection. Deliberately the ONLY function in this module
// that decides what a caller sees -- every field, including donor_contact,
// stays visible here because this projection is only ever returned to a
// requireAdmin-gated caller (see functions/api/admin/archive-items/*.ts).
// donor_name/donor_contact/credit_line stay admin-visible regardless of
// donor_consent_public_credit (that flag only gates a future PUBLIC
// serializer, which does not exist yet -- #4062 -- and must strip
// donor_contact entirely when it is built).
export function serializeArchiveItemForAdmin(item: ArchiveItemWithCandidate) {
  return {
    id: item.id,
    content_item_id: item.content_item_id,
    candidate_id: item.candidate_id,
    item_type: item.item_type,
    custody_type: item.custody_type,
    custody_state: item.custody_state,
    loan_expected_return_at: item.loan_expected_return_at,
    loan_returned_at: item.loan_returned_at,
    storage_location: item.storage_location,
    condition_notes: item.condition_notes,
    donor_name: item.donor_name,
    donor_contact: item.donor_contact,
    donor_consent_public_credit: item.donor_consent_public_credit,
    credit_line: item.credit_line,
    intake_notes: item.intake_notes,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}

// Re-exported for callers that need the candidate row itself (e.g. to
// record rights_evidence against it) without a second lookup.
export { getCandidateByCandidateId };
