// Internal D1 repository for LGFC content pipeline candidate metadata (#2286 / #2305).

import { requireTables } from './d1';
import type { CandidateRecord, SourceMetadata } from './content-pipeline-candidate-import';

export const CONTENT_PIPELINE_REPOSITORY_TABLES = [
  'content_items',
  'tags',
  'content_item_tags',
  'moderation_events',
] as const;

export type CandidateTags = {
  people: string[];
  topics: string[];
  places: string[];
};

export type ContentItemRow = {
  id: number;
  candidate_id: string;
  input_stream: string;
  title: string;
  source_url: string | null;
  source_name: string;
  source_owner: string | null;
  source_domain: string | null;
  source_type: string;
  content_type: string;
  summary: string;
  date_or_period: string | null;
  provenance_notes: string | null;
  rights_status: string;
  source_trust_status: string;
  relevance_status: string;
  review_status: string;
  publication_status: string;
  publication_target: string | null;
  privacy_flag: string;
  privacy_review_status: string;
  credit_line: string | null;
  media_asset_id: string | null;
  duplicate_of: string | null;
  review_priority: string;
  admin_notes: string | null;
  source_metadata: string;
  source_id: number | null;
  submission_queue_id: number | null;
  content_inventory_id: number | null;
  last_event_at: string | null;
  deleted_at: string | null;
  retention_reason: string | null;
  purge_eligible_at: string | null;
  created_at: string;
  updated_at: string;
};

export type StoredCandidate = CandidateRecord & {
  id: number;
  tags: CandidateTags;
};

export type CandidateListFilter = {
  review_status?: string;
  input_stream?: string;
  review_priority?: string;
  publication_status?: string;
  include_deleted?: boolean;
  limit?: number;
  offset?: number;
};

export type CandidateReviewStateUpdate = {
  review_status?: string;
  rights_status?: string;
  privacy_review_status?: string;
  publication_status?: string;
  relevance_status?: string;
  source_trust_status?: string;
  admin_notes?: string;
};

export type CandidateRetentionState = {
  deleted_at: string | null;
  retention_reason: string | null;
  purge_eligible_at: string | null;
};

export type CandidateSoftDeleteInput = {
  retention_reason: string;
  purge_eligible_at?: string | null;
};

export type CandidateRetentionUpdate = {
  retention_reason?: string | null;
  purge_eligible_at?: string | null;
};

const REVIEW_STATE_UPDATE_FIELDS = [
  'review_status',
  'rights_status',
  'privacy_review_status',
  'publication_status',
  'relevance_status',
  'source_trust_status',
  'admin_notes',
] as const satisfies readonly (keyof CandidateReviewStateUpdate)[];

type ReviewStateField = (typeof REVIEW_STATE_UPDATE_FIELDS)[number];

export type ContentPipelineModerationEventType =
  | 'review_state_change'
  | 'rights_update'
  | 'privacy_update'
  | 'publication_prep'
  | 'duplicate_flagged'
  | 'promotion'
  | 'soft_delete'
  | 'retention_update';

const REVIEW_STATE_EVENT_TYPES: Record<ReviewStateField, ContentPipelineModerationEventType> = {
  review_status: 'review_state_change',
  rights_status: 'rights_update',
  privacy_review_status: 'privacy_update',
  publication_status: 'publication_prep',
  relevance_status: 'review_state_change',
  source_trust_status: 'review_state_change',
  admin_notes: 'review_state_change',
};

// Media-reference changes use review_state_change because moderation_events has no media-specific enum.
export const CONTENT_PIPELINE_MEDIA_REFERENCE_EVENT_TYPE: ContentPipelineModerationEventType =
  'review_state_change';

export type ModerationEventWrite = {
  contentItemId: number;
  eventType: ContentPipelineModerationEventType;
  fromState: Record<string, unknown> | null;
  toState: Record<string, unknown>;
  actor?: string | null;
  notes?: string | null;
};

export function serializeModerationEventState(state: Record<string, unknown> | null): string | null {
  if (state === null) {
    return null;
  }
  return JSON.stringify(state);
}

export function moderationEventTypeForReviewField(field: ReviewStateField): ContentPipelineModerationEventType {
  return REVIEW_STATE_EVENT_TYPES[field];
}

export function buildFieldModerationEvent(
  contentItemId: number,
  field: string,
  eventType: ContentPipelineModerationEventType,
  from: unknown,
  to: unknown,
  options: { actor?: string | null; notes?: string | null } = {},
): ModerationEventWrite {
  return {
    contentItemId,
    eventType,
    fromState: { [field]: from ?? null },
    toState: { [field]: to ?? null },
    actor: options.actor ?? null,
    notes: options.notes ?? null,
  };
}

export function buildMultiFieldModerationEvent(
  contentItemId: number,
  eventType: ContentPipelineModerationEventType,
  fromState: Record<string, unknown>,
  toState: Record<string, unknown>,
  options: { actor?: string | null; notes?: string | null } = {},
): ModerationEventWrite {
  return {
    contentItemId,
    eventType,
    fromState,
    toState,
    actor: options.actor ?? null,
    notes: options.notes ?? null,
  };
}

export function createModerationEventStatement(db: any, event: ModerationEventWrite): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO moderation_events (
        content_item_id, event_type, actor, from_state, to_state, notes
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      event.contentItemId,
      event.eventType,
      event.actor ?? null,
      serializeModerationEventState(event.fromState),
      serializeModerationEventState(event.toState),
      event.notes ?? null,
    );
}

function createConditionalModerationEventStatement(db: any, event: ModerationEventWrite): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO moderation_events (
        content_item_id, event_type, actor, from_state, to_state, notes
      )
      SELECT ?, ?, ?, ?, ?, ?
      WHERE changes() > 0`,
    )
    .bind(
      event.contentItemId,
      event.eventType,
      event.actor ?? null,
      serializeModerationEventState(event.fromState),
      serializeModerationEventState(event.toState),
      event.notes ?? null,
    );
}

function normalizeAuditComparable(value: unknown): unknown {
  if (value === undefined || value === null) {
    return null;
  }
  return value;
}

function buildRetentionAuditSnapshot(state: CandidateRetentionState): Record<string, unknown> {
  return {
    deleted_at: state.deleted_at,
    retention_reason: state.retention_reason,
    purge_eligible_at: state.purge_eligible_at,
  };
}

async function loadCandidateRetentionState(
  db: any,
  candidateId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<{ id: number; state: CandidateRetentionState } | null> {
  const includeDeleted = options.includeDeleted === true;
  const row = await db
    .prepare(
      `SELECT id, deleted_at, retention_reason, purge_eligible_at
       FROM content_items
       WHERE candidate_id = ?
         AND (? = 1 OR deleted_at IS NULL)
       LIMIT 1`,
    )
    .bind(candidateId, includeDeleted ? 1 : 0)
    .first();

  if (!row) {
    return null;
  }

  const typedRow = row as {
    id: number;
    deleted_at?: string | null;
    retention_reason?: string | null;
    purge_eligible_at?: string | null;
  };

  return {
    id: typedRow.id,
    state: {
      deleted_at: typedRow.deleted_at ?? null,
      retention_reason: typedRow.retention_reason ?? null,
      purge_eligible_at: typedRow.purge_eligible_at ?? null,
    },
  };
}

function resolvedUpsertReviewFieldValue(candidate: CandidateRecord, field: ReviewStateField): unknown {
  if (field === 'admin_notes') {
    return candidate.admin_notes ?? null;
  }
  return candidate[field];
}

function createModerationEventStatementForCandidateId(
  db: any,
  candidateId: string,
  event: ModerationEventWrite,
): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO moderation_events (
        content_item_id, event_type, actor, from_state, to_state, notes
      )
      SELECT ci.id, ?, ?, ?, ?, ?
      FROM content_items ci
      WHERE ci.candidate_id = ?
      LIMIT 1`,
    )
    .bind(
      event.eventType,
      event.actor ?? null,
      serializeModerationEventState(event.fromState),
      serializeModerationEventState(event.toState),
      event.notes ?? null,
      candidateId,
    );
}

function buildCandidateUpsertAuditEvents(
  contentItemId: number,
  existing: StoredCandidate | null,
  candidate: CandidateRecord,
): ModerationEventWrite[] {
  if (!existing) {
    // Candidate creation maps to review_state_change; no dedicated create enum exists in migration 0042.
    return [
      buildMultiFieldModerationEvent(
        contentItemId,
        'review_state_change',
        {},
        {
          candidate_id: candidate.candidate_id,
          input_stream: candidate.input_stream,
          review_status: candidate.review_status,
          rights_status: candidate.rights_status,
          privacy_review_status: candidate.privacy_review_status,
          publication_status: candidate.publication_status,
        },
        { notes: 'candidate registry create' },
      ),
    ];
  }

  const events: ModerationEventWrite[] = [];

  for (const field of REVIEW_STATE_UPDATE_FIELDS) {
    const fromValue = normalizeAuditComparable(existing[field]);
    const toValue = normalizeAuditComparable(resolvedUpsertReviewFieldValue(candidate, field));
    if (fromValue === toValue) {
      continue;
    }
    events.push(
      buildFieldModerationEvent(
        contentItemId,
        field,
        REVIEW_STATE_EVENT_TYPES[field],
        fromValue,
        toValue,
        { notes: 'candidate registry upsert' },
      ),
    );
  }

  const fromMedia = normalizeAuditComparable(existing.media_asset_id);
  const toMedia = normalizeAuditComparable(candidate.media_asset_id ?? null);
  if (fromMedia !== toMedia) {
    events.push(
      buildFieldModerationEvent(
        contentItemId,
        'media_asset_id',
        CONTENT_PIPELINE_MEDIA_REFERENCE_EVENT_TYPE,
        fromMedia,
        toMedia,
        { notes: 'candidate registry upsert' },
      ),
    );
  }

  const fromDuplicate = normalizeAuditComparable(existing.duplicate_of);
  const toDuplicate = normalizeAuditComparable(candidate.duplicate_of ?? null);
  if (fromDuplicate !== toDuplicate) {
    events.push(
      buildFieldModerationEvent(
        contentItemId,
        'duplicate_of',
        toDuplicate ? 'duplicate_flagged' : 'review_state_change',
        fromDuplicate,
        toDuplicate,
        { notes: 'candidate registry upsert' },
      ),
    );
  }

  return events;
}

const TAG_CATEGORY_TO_ARRAY: Record<'people' | 'topics' | 'places', keyof CandidateTags> = {
  people: 'people',
  topics: 'topics',
  places: 'places',
};

const TAG_ARRAY_TO_CATEGORY: Record<keyof CandidateTags, 'people' | 'topics' | 'places'> = {
  people: 'people',
  topics: 'topics',
  places: 'places',
};

type D1PreparedStatement = {
  run: () => Promise<unknown>;
};

function parseSourceMetadata(raw: string | null | undefined): SourceMetadata | undefined {
  if (!raw || raw.trim() === '' || raw.trim() === '{}') {
    return undefined;
  }
  try {
    const parsed = JSON.parse(raw) as SourceMetadata;
    return Object.keys(parsed).length > 0 ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function emptyTags(): CandidateTags {
  return { people: [], topics: [], places: [] };
}

function applyTagRows(tags: CandidateTags, rows: Array<{ tag_name: unknown; tag_category: unknown }>) {
  for (const row of rows) {
    const tagName = String(row.tag_name || '');
    const category = String(row.tag_category || '') as keyof typeof TAG_CATEGORY_TO_ARRAY;
    const bucket = TAG_CATEGORY_TO_ARRAY[category];
    if (bucket && tagName) {
      tags[bucket].push(tagName);
    }
  }
}

async function runD1Batch(db: any, statements: D1PreparedStatement[]) {
  await runD1BatchWithResults(db, statements);
}

async function runD1BatchWithResults(db: any, statements: D1PreparedStatement[]): Promise<unknown[]> {
  if (statements.length === 0) {
    return [];
  }

  if (typeof db.batch === 'function') {
    const results = await db.batch(statements);
    return Array.isArray(results) ? results : statements.map(() => ({ success: true }));
  }

  if (typeof db.exec === 'function') {
    await db.exec('BEGIN');
    try {
      const results: unknown[] = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      await db.exec('COMMIT');
      return results;
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }

  throw new Error('D1 database does not support transactional batch execution');
}

type D1RunResult = {
  meta?: { changes?: number };
};

function d1UpdateChangedRows(result: unknown): number {
  return Number((result as D1RunResult)?.meta?.changes ?? 0);
}

async function runRowChangingUpdateWithAudit(
  db: any,
  updateStatement: D1PreparedStatement,
  auditEvent: ModerationEventWrite,
): Promise<boolean> {
  const results = await runD1BatchWithResults(db, [
    updateStatement,
    createConditionalModerationEventStatement(db, auditEvent),
  ]);
  return d1UpdateChangedRows(results[0]) > 0;
}

export function mapContentItemRowToCandidate(
  row: ContentItemRow,
  tags: CandidateTags = emptyTags(),
): StoredCandidate {
  const sourceMetadata = parseSourceMetadata(row.source_metadata);
  return {
    id: row.id,
    candidate_id: row.candidate_id,
    input_stream: row.input_stream,
    title: row.title,
    source_url: row.source_url ?? undefined,
    source_name: row.source_name,
    source_owner: row.source_owner ?? undefined,
    source_domain: row.source_domain ?? undefined,
    source_type: row.source_type,
    content_type: row.content_type,
    summary: row.summary,
    date_or_period: row.date_or_period ?? undefined,
    provenance_notes: row.provenance_notes ?? undefined,
    rights_status: row.rights_status,
    source_trust_status: row.source_trust_status,
    relevance_status: row.relevance_status,
    review_status: row.review_status,
    publication_status: row.publication_status,
    publication_target: row.publication_target ?? undefined,
    privacy_flag: row.privacy_flag,
    privacy_review_status: row.privacy_review_status,
    credit_line: row.credit_line ?? undefined,
    media_asset_id: row.media_asset_id ?? undefined,
    duplicate_of: row.duplicate_of ?? undefined,
    review_priority: row.review_priority,
    admin_notes: row.admin_notes ?? undefined,
    source_metadata: sourceMetadata,
    submission_queue_id: row.submission_queue_id ?? undefined,
    content_inventory_id: row.content_inventory_id ?? undefined,
    last_event_at: row.last_event_at ?? undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
    people_tags: tags.people.length > 0 ? tags.people : undefined,
    topic_tags: tags.topics.length > 0 ? tags.topics : undefined,
    location_tags: tags.places.length > 0 ? tags.places : undefined,
    tags,
  };
}

export async function requireContentPipelineCandidateTables(db: unknown) {
  return requireTables(db, [...CONTENT_PIPELINE_REPOSITORY_TABLES]);
}

export async function fetchCandidateTagsByContentItemIds(
  db: any,
  contentItemIds: number[],
): Promise<Map<number, CandidateTags>> {
  const tagsById = new Map<number, CandidateTags>();
  if (contentItemIds.length === 0) {
    return tagsById;
  }

  for (const contentItemId of contentItemIds) {
    tagsById.set(contentItemId, emptyTags());
  }

  const placeholders = contentItemIds.map(() => '?').join(',');
  const result = await db
    .prepare(
      `SELECT cit.content_item_id, t.tag_name, t.tag_category
       FROM content_item_tags cit
       JOIN tags t ON t.id = cit.tag_id
       WHERE cit.content_item_id IN (${placeholders})
       ORDER BY cit.content_item_id ASC, t.tag_category ASC, t.tag_name ASC`,
    )
    .bind(...contentItemIds)
    .all();

  for (const row of result.results || []) {
    const contentItemId = Number(row.content_item_id);
    const tags = tagsById.get(contentItemId) ?? emptyTags();
    applyTagRows(tags, [row]);
    tagsById.set(contentItemId, tags);
  }

  return tagsById;
}

export async function fetchCandidateTags(db: any, contentItemId: number): Promise<CandidateTags> {
  const tagsById = await fetchCandidateTagsByContentItemIds(db, [contentItemId]);
  return tagsById.get(contentItemId) ?? emptyTags();
}

async function loadStoredCandidate(
  db: any,
  row: ContentItemRow | null,
  tags?: CandidateTags,
): Promise<StoredCandidate | null> {
  if (!row) {
    return null;
  }

  const resolvedTags = tags ?? (await fetchCandidateTags(db, row.id));
  return mapContentItemRowToCandidate(row as ContentItemRow, resolvedTags);
}

export async function getCandidateByCandidateId(
  db: any,
  candidateId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<StoredCandidate | null> {
  const includeDeleted = options.includeDeleted === true;
  const row = await db
    .prepare(
      `SELECT *
       FROM content_items
       WHERE candidate_id = ?
         AND (? = 1 OR deleted_at IS NULL)
       LIMIT 1`,
    )
    .bind(candidateId, includeDeleted ? 1 : 0)
    .first();

  return loadStoredCandidate(db, row as ContentItemRow | null);
}

export async function listCandidates(
  db: any,
  filter: CandidateListFilter = {},
): Promise<StoredCandidate[]> {
  const clauses: string[] = [];
  const binds: unknown[] = [];

  if (!filter.include_deleted) {
    clauses.push('deleted_at IS NULL');
  }
  if (filter.review_status) {
    clauses.push('review_status = ?');
    binds.push(filter.review_status);
  }
  if (filter.input_stream) {
    clauses.push('input_stream = ?');
    binds.push(filter.input_stream);
  }
  if (filter.review_priority) {
    clauses.push('review_priority = ?');
    binds.push(filter.review_priority);
  }
  if (filter.publication_status) {
    clauses.push('publication_status = ?');
    binds.push(filter.publication_status);
  }

  const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : '';
  const limit = Math.min(Math.max(filter.limit ?? 50, 1), 200);
  const offset = Math.max(filter.offset ?? 0, 0);

  const result = await db
    .prepare(
      `SELECT *
       FROM content_items
       ${whereSql}
       ORDER BY
         CASE review_priority WHEN 'high' THEN 0 WHEN 'normal' THEN 1 ELSE 2 END,
         updated_at DESC,
         candidate_id ASC
       LIMIT ? OFFSET ?`,
    )
    .bind(...binds, limit, offset)
    .all();

  const rows = (result.results || []) as ContentItemRow[];
  const contentItemIds = rows.map((row) => row.id);
  const tagsById = await fetchCandidateTagsByContentItemIds(db, contentItemIds);

  return rows.map((row) =>
    mapContentItemRowToCandidate(row, tagsById.get(row.id) ?? emptyTags()),
  );
}

async function syncCandidateTags(db: any, contentItemId: number, candidate: CandidateRecord) {
  const statements: D1PreparedStatement[] = [
    db.prepare('DELETE FROM content_item_tags WHERE content_item_id = ?').bind(contentItemId),
  ];

  const tagEntries: Array<{ category: 'people' | 'topics' | 'places'; name: string }> = [];
  for (const name of candidate.people_tags ?? []) {
    tagEntries.push({ category: 'people', name });
  }
  for (const name of candidate.topic_tags ?? []) {
    tagEntries.push({ category: 'topics', name });
  }
  for (const name of candidate.location_tags ?? []) {
    tagEntries.push({ category: 'places', name });
  }

  for (const entry of tagEntries) {
    statements.push(
      db
        .prepare(
          `INSERT INTO tags (tag_name, tag_category)
           VALUES (?, ?)
           ON CONFLICT(tag_name, tag_category) DO NOTHING`,
        )
        .bind(entry.name, entry.category),
    );
    statements.push(
      db
        .prepare(
          `INSERT INTO content_item_tags (content_item_id, tag_id)
           SELECT ?, t.id
           FROM tags t
           WHERE t.tag_name = ? AND t.tag_category = ?
           ON CONFLICT(content_item_id, tag_id) DO NOTHING`,
        )
        .bind(contentItemId, entry.name, entry.category),
    );
  }

  await runD1Batch(db, statements);
}

export async function upsertCandidate(db: any, candidate: CandidateRecord): Promise<StoredCandidate> {
  const existing = await getCandidateByCandidateId(db, candidate.candidate_id, { includeDeleted: true });
  const sourceMetadata = JSON.stringify(candidate.source_metadata ?? {});
  const now = candidate.updated_at;

  const upsertStatement = db
    .prepare(
      `INSERT INTO content_items (
        candidate_id, input_stream, title, source_url, source_name, source_owner, source_domain,
        source_type, content_type, summary, date_or_period, provenance_notes,
        rights_status, source_trust_status, relevance_status, review_status, publication_status,
        publication_target, privacy_flag, privacy_review_status, credit_line, media_asset_id,
        duplicate_of, review_priority, admin_notes, source_metadata, submission_queue_id,
        content_inventory_id, last_event_at, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?
      )
      ON CONFLICT(candidate_id) DO UPDATE SET
        input_stream = excluded.input_stream,
        title = excluded.title,
        source_url = excluded.source_url,
        source_name = excluded.source_name,
        source_owner = excluded.source_owner,
        source_domain = excluded.source_domain,
        source_type = excluded.source_type,
        content_type = excluded.content_type,
        summary = excluded.summary,
        date_or_period = excluded.date_or_period,
        provenance_notes = excluded.provenance_notes,
        rights_status = excluded.rights_status,
        source_trust_status = excluded.source_trust_status,
        relevance_status = excluded.relevance_status,
        review_status = excluded.review_status,
        publication_status = excluded.publication_status,
        publication_target = excluded.publication_target,
        privacy_flag = excluded.privacy_flag,
        privacy_review_status = excluded.privacy_review_status,
        credit_line = excluded.credit_line,
        media_asset_id = excluded.media_asset_id,
        duplicate_of = excluded.duplicate_of,
        review_priority = excluded.review_priority,
        admin_notes = excluded.admin_notes,
        source_metadata = excluded.source_metadata,
        submission_queue_id = excluded.submission_queue_id,
        content_inventory_id = excluded.content_inventory_id,
        last_event_at = excluded.last_event_at,
        updated_at = excluded.updated_at`,
    )
    .bind(
      candidate.candidate_id,
      candidate.input_stream,
      candidate.title,
      candidate.source_url ?? null,
      candidate.source_name,
      candidate.source_owner ?? null,
      candidate.source_domain ?? null,
      candidate.source_type,
      candidate.content_type,
      candidate.summary,
      candidate.date_or_period ?? null,
      candidate.provenance_notes ?? null,
      candidate.rights_status,
      candidate.source_trust_status,
      candidate.relevance_status,
      candidate.review_status,
      candidate.publication_status,
      candidate.publication_target ?? null,
      candidate.privacy_flag,
      candidate.privacy_review_status,
      candidate.credit_line ?? null,
      candidate.media_asset_id ?? null,
      candidate.duplicate_of ?? null,
      candidate.review_priority,
      candidate.admin_notes ?? null,
      sourceMetadata,
      candidate.submission_queue_id ?? null,
      candidate.content_inventory_id ?? null,
      candidate.last_event_at ?? null,
      candidate.created_at,
      now,
    );

  const statements: D1PreparedStatement[] = [upsertStatement];
  if (existing) {
    const auditEvents = buildCandidateUpsertAuditEvents(existing.id, existing, candidate);
    for (const event of auditEvents) {
      statements.push(createModerationEventStatement(db, event));
    }
  } else {
    const auditEvents = buildCandidateUpsertAuditEvents(0, null, candidate);
    for (const event of auditEvents) {
      statements.push(createModerationEventStatementForCandidateId(db, candidate.candidate_id, event));
    }
  }

  await runD1Batch(db, statements);

  const stored = await getCandidateByCandidateId(db, candidate.candidate_id, { includeDeleted: true });
  if (!stored) {
    throw new Error(`Failed to load candidate after upsert: ${candidate.candidate_id}`);
  }

  if (
    candidate.people_tags !== undefined ||
    candidate.topic_tags !== undefined ||
    candidate.location_tags !== undefined
  ) {
    await syncCandidateTags(db, stored.id, candidate);
    const reloaded = await getCandidateByCandidateId(db, candidate.candidate_id, { includeDeleted: true });
    if (!reloaded) {
      throw new Error(`Failed to load candidate after tag sync: ${candidate.candidate_id}`);
    }
    return reloaded;
  }

  return stored;
}

export async function updateCandidateReviewState(
  db: any,
  candidateId: string,
  update: CandidateReviewStateUpdate,
  options: { actor?: string; notes?: string } = {},
): Promise<StoredCandidate | null> {
  const existing = await getCandidateByCandidateId(db, candidateId);
  if (!existing) {
    return null;
  }

  const assignments: string[] = [];
  const binds: unknown[] = [];
  const events: Array<{ field: ReviewStateField; from: unknown; to: unknown }> = [];

  for (const field of REVIEW_STATE_UPDATE_FIELDS) {
    const nextValue = update[field];
    if (nextValue === undefined || nextValue === existing[field]) {
      continue;
    }
    assignments.push(`${field} = ?`);
    binds.push(nextValue);
    events.push({ field, from: existing[field], to: nextValue });
  }

  if (assignments.length === 0) {
    return existing;
  }

  assignments.push(`updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`);
  binds.push(candidateId);

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE content_items
         SET ${assignments.join(', ')}
         WHERE candidate_id = ?
           AND deleted_at IS NULL`,
      )
      .bind(...binds),
  ];

  for (const event of events) {
    statements.push(
      createModerationEventStatement(
        db,
        buildFieldModerationEvent(
          existing.id,
          event.field,
          REVIEW_STATE_EVENT_TYPES[event.field],
          event.from,
          event.to,
          { actor: options.actor ?? null, notes: options.notes ?? null },
        ),
      ),
    );
  }

  await runD1Batch(db, statements);
  return getCandidateByCandidateId(db, candidateId);
}

export async function softDeleteCandidate(
  db: any,
  candidateId: string,
  input: CandidateSoftDeleteInput,
  options: { actor?: string; notes?: string; deleted_at?: string } = {},
): Promise<StoredCandidate | null> {
  const existing = await loadCandidateRetentionState(db, candidateId, { includeDeleted: true });
  if (!existing) {
    return null;
  }

  const deletedAt = options.deleted_at ?? new Date().toISOString();
  const nextState: CandidateRetentionState = {
    deleted_at: deletedAt,
    retention_reason: input.retention_reason,
    purge_eligible_at:
      input.purge_eligible_at === undefined ? existing.state.purge_eligible_at : input.purge_eligible_at,
  };

  await runRowChangingUpdateWithAudit(
    db,
    db
      .prepare(
        `UPDATE content_items
         SET deleted_at = ?,
             retention_reason = ?,
             purge_eligible_at = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE candidate_id = ?
           AND deleted_at IS NULL`,
      )
      .bind(
        nextState.deleted_at,
        nextState.retention_reason,
        nextState.purge_eligible_at,
        candidateId,
      ),
    buildMultiFieldModerationEvent(
      existing.id,
      'soft_delete',
      buildRetentionAuditSnapshot(existing.state),
      buildRetentionAuditSnapshot(nextState),
      { actor: options.actor ?? null, notes: options.notes ?? 'candidate soft delete' },
    ),
  );

  return getCandidateByCandidateId(db, candidateId, { includeDeleted: true });
}

export async function updateCandidateRetention(
  db: any,
  candidateId: string,
  update: CandidateRetentionUpdate,
  options: { actor?: string; notes?: string } = {},
): Promise<StoredCandidate | null> {
  const existing = await loadCandidateRetentionState(db, candidateId, { includeDeleted: true });
  if (!existing) {
    return null;
  }

  const nextState: CandidateRetentionState = {
    deleted_at: existing.state.deleted_at,
    retention_reason:
      update.retention_reason === undefined ? existing.state.retention_reason : update.retention_reason,
    purge_eligible_at:
      update.purge_eligible_at === undefined ? existing.state.purge_eligible_at : update.purge_eligible_at,
  };

  if (
    normalizeAuditComparable(existing.state.retention_reason) ===
      normalizeAuditComparable(nextState.retention_reason) &&
    normalizeAuditComparable(existing.state.purge_eligible_at) ===
      normalizeAuditComparable(nextState.purge_eligible_at)
  ) {
    return getCandidateByCandidateId(db, candidateId, {
      includeDeleted: existing.state.deleted_at !== null,
    });
  }

  const statements: D1PreparedStatement[] = [
    db
      .prepare(
        `UPDATE content_items
         SET retention_reason = ?,
             purge_eligible_at = ?,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE candidate_id = ?
           AND (
             IFNULL(retention_reason, '') != IFNULL(?, '')
             OR IFNULL(purge_eligible_at, '') != IFNULL(?, '')
           )`,
      )
      .bind(
        nextState.retention_reason,
        nextState.purge_eligible_at,
        candidateId,
        nextState.retention_reason,
        nextState.purge_eligible_at,
      ),
  ];

  await runRowChangingUpdateWithAudit(
    db,
    statements[0],
    buildMultiFieldModerationEvent(
      existing.id,
      'retention_update',
      buildRetentionAuditSnapshot(existing.state),
      buildRetentionAuditSnapshot(nextState),
      { actor: options.actor ?? null, notes: options.notes ?? 'candidate retention update' },
    ),
  );

  return getCandidateByCandidateId(db, candidateId, {
    includeDeleted: nextState.deleted_at !== null,
  });
}

export async function restoreSoftDeletedCandidate(
  db: any,
  candidateId: string,
  options: { actor?: string; notes?: string } = {},
): Promise<StoredCandidate | null> {
  const existing = await loadCandidateRetentionState(db, candidateId, { includeDeleted: true });
  if (!existing) {
    return null;
  }

  const nextState: CandidateRetentionState = {
    deleted_at: null,
    retention_reason: existing.state.retention_reason,
    purge_eligible_at: existing.state.purge_eligible_at,
  };

  await runRowChangingUpdateWithAudit(
    db,
    db
      .prepare(
        `UPDATE content_items
         SET deleted_at = NULL,
             updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE candidate_id = ?
           AND deleted_at IS NOT NULL`,
      )
      .bind(candidateId),
    buildMultiFieldModerationEvent(
      existing.id,
      'retention_update',
      buildRetentionAuditSnapshot(existing.state),
      buildRetentionAuditSnapshot(nextState),
      { actor: options.actor ?? null, notes: options.notes ?? 'candidate restore' },
    ),
  );

  return getCandidateByCandidateId(db, candidateId);
}

export function groupTagsByCategory(
  rows: Array<{ tag_name: string; tag_category: string }>,
): CandidateTags {
  const tags = emptyTags();
  for (const row of rows) {
    const category = row.tag_category as keyof typeof TAG_ARRAY_TO_CATEGORY;
    const bucket = TAG_ARRAY_TO_CATEGORY[category];
    if (bucket && row.tag_name) {
      tags[bucket].push(row.tag_name);
    }
  }
  return tags;
}

export type CandidateMediaReferenceUpdate = {
  media_asset_id?: string | null;
  uploaded_media_reference?: string | null;
};

export const MEMBER_SUBMISSION_MEDIA_REFERENCE_MISSING_CODE = 'member_submission_media_reference_missing';

export class MemberSubmissionMediaReferenceMissingError extends Error {
  readonly code = MEMBER_SUBMISSION_MEDIA_REFERENCE_MISSING_CODE;
  readonly candidateId: string;

  constructor(candidateId: string) {
    super(
      `uploaded_media_reference update requested for candidate ${candidateId} without a member_submissions row.`,
    );
    this.name = 'MemberSubmissionMediaReferenceMissingError';
    this.candidateId = candidateId;
  }
}

export function isMemberSubmissionMediaReferenceMissingError(
  error: unknown,
): error is MemberSubmissionMediaReferenceMissingError {
  return error instanceof MemberSubmissionMediaReferenceMissingError;
}

export async function getUploadedMediaReferenceForCandidate(
  db: any,
  contentItemId: number,
): Promise<string | null> {
  const row = await db
    .prepare(
      `SELECT uploaded_media_reference
       FROM member_submissions
       WHERE content_item_id = ?
       LIMIT 1`,
    )
    .bind(contentItemId)
    .first();

  if (!row) {
    return null;
  }

  const value = String((row as { uploaded_media_reference?: string | null }).uploaded_media_reference ?? '').trim();
  return value || null;
}

export async function updateCandidateMediaReferences(
  db: any,
  candidateId: string,
  update: CandidateMediaReferenceUpdate,
  options: { actor?: string; notes?: string } = {},
): Promise<StoredCandidate | null> {
  const existing = await getCandidateByCandidateId(db, candidateId);
  if (!existing) {
    return null;
  }

  const statements: D1PreparedStatement[] = [];
  const mediaChanges: Record<string, { from: unknown; to: unknown }> = {};

  if (update.media_asset_id !== undefined) {
    const nextValue = update.media_asset_id;
    const currentValue = existing.media_asset_id ?? null;
    if (nextValue !== currentValue) {
      statements.push(
        db
          .prepare(
            `UPDATE content_items
             SET media_asset_id = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE candidate_id = ?
               AND deleted_at IS NULL`,
          )
          .bind(nextValue, candidateId),
      );
      mediaChanges.media_asset_id = { from: currentValue, to: nextValue };
    }
  }

  if (update.uploaded_media_reference !== undefined) {
    const memberRow = await db
      .prepare(
        `SELECT id, uploaded_media_reference
         FROM member_submissions
         WHERE content_item_id = ?
         LIMIT 1`,
      )
      .bind(existing.id)
      .first();

    if (!memberRow) {
      throw new MemberSubmissionMediaReferenceMissingError(candidateId);
    }

    const currentValue =
      (memberRow as { uploaded_media_reference?: string | null }).uploaded_media_reference ?? null;
    const nextValue = update.uploaded_media_reference;
    if (nextValue !== currentValue) {
      statements.push(
        db
          .prepare(
            `UPDATE member_submissions
             SET uploaded_media_reference = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
             WHERE content_item_id = ?`,
          )
          .bind(nextValue, existing.id),
      );
      mediaChanges.uploaded_media_reference = { from: currentValue, to: nextValue };
    }
  }

  if (statements.length === 0) {
    return existing;
  }

  if (Object.keys(mediaChanges).length > 0) {
    statements.push(
      createModerationEventStatement(
        db,
        buildMultiFieldModerationEvent(
          existing.id,
          CONTENT_PIPELINE_MEDIA_REFERENCE_EVENT_TYPE,
          Object.fromEntries(Object.entries(mediaChanges).map(([key, value]) => [key, value.from])),
          Object.fromEntries(Object.entries(mediaChanges).map(([key, value]) => [key, value.to])),
          { actor: options.actor ?? null, notes: options.notes ?? 'media reference update' },
        ),
      ),
    );
  }

  await runD1Batch(db, statements);
  return getCandidateByCandidateId(db, candidateId);
}
