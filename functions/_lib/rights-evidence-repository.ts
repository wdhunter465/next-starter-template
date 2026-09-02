// D1 repository for #3551/#3552 rights evidence records (migration 0055).
// Evidence rows are append-only: each reviewer action records a new row
// rather than mutating a prior one, preserving the full evidentiary trail.

import { requireTables } from './d1';

export const RIGHTS_EVIDENCE_TABLES = ['rights_evidence', 'content_items'] as const;

export const RIGHTS_EVIDENCE_TYPES = [
  'openverse_license',
  'loc_statement',
  'commons_license',
  'dpla_rights_statement',
  'usco_search',
  'cmg_grant',
  'pre_1931_publication',
  'member_ownership',
  'other',
  // #2073/#4059: consent evidence for a physical archive donation/loan.
  'donor_agreement',
] as const;

export const RIGHTS_EVIDENCE_CONCLUSIONS = [
  'public_domain_confirmed',
  'permission_granted',
  'lgfc_member_owned_item_photo',
] as const;

export type RightsEvidenceType = (typeof RIGHTS_EVIDENCE_TYPES)[number];
export type RightsEvidenceConclusion = (typeof RIGHTS_EVIDENCE_CONCLUSIONS)[number];

// #3552 phase 5 (#3748): per-photo triage, separate from `conclusion`.
// 'hold' is the default for any row that has not been resolved yet --
// see migration 0061's comment for why this exists as persisted data
// rather than an absence of a conclusion.
export const RIGHTS_EVIDENCE_USAGE_DECISIONS = ['permit', 'deny', 'hold'] as const;
export type RightsEvidenceUsageDecision = (typeof RIGHTS_EVIDENCE_USAGE_DECISIONS)[number];

// #3551's 2026-08-18 directive: rights conclusions are channel/use-specific,
// not one blanket approval. A conclusion recorded for one channel never
// silently authorizes another. See getCurrentConclusionForCandidateChannel
// below, the authoritative per-channel resolver for gating.
export const RIGHTS_EVIDENCE_CHANNELS = [
  'website',
  'social_media',
  'newsletter_email',
  'fundraiser_campaign',
  'internal_archive_only',
] as const;
export type RightsEvidenceChannel = (typeof RIGHTS_EVIDENCE_CHANNELS)[number];

function toSet<T extends string>(values: readonly T[]): Set<string> {
  return new Set(values);
}

export const RIGHTS_EVIDENCE_TYPE_SET = toSet(RIGHTS_EVIDENCE_TYPES);
export const RIGHTS_EVIDENCE_CONCLUSION_SET = toSet(RIGHTS_EVIDENCE_CONCLUSIONS);
export const RIGHTS_EVIDENCE_CHANNEL_SET = toSet(RIGHTS_EVIDENCE_CHANNELS);

export type RightsEvidenceRow = {
  id: number;
  content_item_id: number;
  source_id: number | null;
  search_run_id: number | null;
  evidence_type: RightsEvidenceType;
  evidence_text: string | null;
  evidence_url: string | null;
  evidence_metadata: string;
  reviewer: string | null;
  conclusion: RightsEvidenceConclusion | null;
  conclusion_rationale: string | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
  channel: RightsEvidenceChannel | null;
  rights_holder: string | null;
  repository_or_collection: string | null;
  publication_established: number | null;
  us_publication_or_uraa_confirmed: number | null;
  publication_date_source: string | null;
  source_filename: string | null;
  tagging_requirements: string | null;
  usage_decision: RightsEvidenceUsageDecision;
};

export type StoredRightsEvidence = Omit<RightsEvidenceRow, 'evidence_metadata'> & {
  evidence_metadata: Record<string, unknown>;
};

export type RightsEvidenceInput = {
  content_item_id: number;
  source_id?: number | null;
  search_run_id?: number | null;
  evidence_type: RightsEvidenceType;
  evidence_text?: string | null;
  evidence_url?: string | null;
  evidence_metadata?: Record<string, unknown>;
  reviewer?: string | null;
  conclusion?: RightsEvidenceConclusion | null;
  conclusion_rationale?: string | null;
  channel?: RightsEvidenceChannel | null;
  rights_holder?: string | null;
  repository_or_collection?: string | null;
  publication_established?: number | null;
  us_publication_or_uraa_confirmed?: number | null;
  publication_date_source?: string | null;
  source_filename?: string | null;
  tagging_requirements?: string | null;
  // Defaults to 'hold' (matching the column's DB default) when omitted --
  // an explicit 'permit'/'deny' always requires the caller to have actually
  // made that determination, never inferred.
  usage_decision?: RightsEvidenceUsageDecision;
};

export async function requireRightsEvidenceTables(db: unknown) {
  return requireTables(db, [...RIGHTS_EVIDENCE_TABLES]);
}

function parseEvidenceMetadata(raw: string): Record<string, unknown> {
  if (!raw || raw.trim() === '') {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function mapRightsEvidenceRow(row: RightsEvidenceRow): StoredRightsEvidence {
  return {
    ...row,
    evidence_metadata: parseEvidenceMetadata(row.evidence_metadata),
  };
}

// Low-level insert. `channel` is NOT enforced as required here -- this
// function is the shared primitive that #2270's member-submission writers
// (content-pipeline-member-submission-intake.ts, member-photo-submission-
// repository.ts; both outside #3657's allowlist) call directly and
// intentionally without a channel. That is deliberate: those two are
// #2270's separate member-submission rights model (per #3551's 2026-08-18
// comment: "#3551 remains the controlling path for content LGFC itself
// discovers/collects from approved external sources... complements #2270's
// member-submission rights model"), and channelForPublicationTarget's gate
// in content-pipeline-publication-prep.ts is scoped to
// `input_stream === 'scheduled_discovery'`, so a member-submission
// candidate's channel-less rows are never read by that gate.
//
// Governed/external-source callers (the admin rights-evidence API) MUST NOT
// call this function directly -- use recordGovernedRightsEvidence below,
// which enforces the channel-when-conclusion invariant at this repository
// layer rather than relying solely on the admin HTTP request parser
// (rights-evidence-admin.ts). #3657's 2026-08-24 reopened finding was
// exactly this: the parser enforced it for one HTTP path, but nothing
// prevented a governed caller from reaching this permissive primitive
// directly. recordGovernedRightsEvidence closes that gap architecturally.
export async function recordRightsEvidence(
  db: any,
  input: RightsEvidenceInput,
): Promise<StoredRightsEvidence> {
  const metadata = JSON.stringify(input.evidence_metadata ?? {});

  const result = await db
    .prepare(
      `INSERT INTO rights_evidence (
        content_item_id, source_id, search_run_id, evidence_type, evidence_text,
        evidence_url, evidence_metadata, reviewer, conclusion, conclusion_rationale,
        channel, rights_holder, repository_or_collection, publication_established,
        us_publication_or_uraa_confirmed, publication_date_source,
        source_filename, tagging_requirements, usage_decision
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      input.content_item_id,
      input.source_id ?? null,
      input.search_run_id ?? null,
      input.evidence_type,
      input.evidence_text ?? null,
      input.evidence_url ?? null,
      metadata,
      input.reviewer ?? null,
      input.conclusion ?? null,
      input.conclusion_rationale ?? null,
      input.channel ?? null,
      input.rights_holder ?? null,
      input.repository_or_collection ?? null,
      input.publication_established ?? null,
      input.us_publication_or_uraa_confirmed ?? null,
      input.publication_date_source ?? null,
      input.source_filename ?? null,
      input.tagging_requirements ?? null,
      input.usage_decision ?? 'hold',
    )
    .run();

  const insertedId = Number(result?.meta?.last_row_id ?? 0);
  const row = await db
    .prepare(`SELECT * FROM rights_evidence WHERE id = ? LIMIT 1`)
    .bind(insertedId)
    .first();

  if (!row) {
    throw new Error(`Failed to load rights_evidence after insert for content_item_id=${input.content_item_id}`);
  }

  return mapRightsEvidenceRow(row as RightsEvidenceRow);
}

// Governed/external-source write path (the admin rights-evidence API and
// any other scheduled_discovery-facing caller). Enforces #3551's 2026-08-18
// channel-scoping directive at this repository layer: a conclusion can
// never be recorded without a channel, independent of whatever validation
// an individual HTTP caller happens to run first. #2270's member-submission
// callers are not governed/external-source and must keep calling
// recordRightsEvidence directly -- see the comment above it.
export class GovernedRightsEvidenceChannelRequiredError extends Error {
  constructor() {
    super('channel is required when recording a governed rights_evidence conclusion.');
    this.name = 'GovernedRightsEvidenceChannelRequiredError';
  }
}

export async function recordGovernedRightsEvidence(
  db: any,
  input: RightsEvidenceInput,
): Promise<StoredRightsEvidence> {
  if (input.conclusion != null && input.channel == null) {
    throw new GovernedRightsEvidenceChannelRequiredError();
  }
  return recordRightsEvidence(db, input);
}

export async function listRightsEvidenceForCandidate(
  db: any,
  contentItemId: number,
): Promise<StoredRightsEvidence[]> {
  const result = await db
    .prepare(
      `SELECT * FROM rights_evidence
       WHERE content_item_id = ?
       ORDER BY recorded_at DESC, id DESC`,
    )
    .bind(contentItemId)
    .all();

  return ((result.results ?? []) as RightsEvidenceRow[]).map(mapRightsEvidenceRow);
}

// The most recent evidence row that carries a conclusion, across ALL
// channels. This is informational/overview only -- it is NOT authoritative
// for any publication gate, since #3551's 2026-08-18 directive requires
// conclusions to be channel-scoped: a conclusion recorded for one channel
// must not silently authorize another. Use
// getCurrentConclusionForCandidateChannel below for any gating decision.
export async function getCurrentConclusionForCandidate(
  db: any,
  contentItemId: number,
): Promise<StoredRightsEvidence | null> {
  const row = await db
    .prepare(
      `SELECT * FROM rights_evidence
       WHERE content_item_id = ? AND conclusion IS NOT NULL
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(contentItemId)
    .first();

  return row ? mapRightsEvidenceRow(row as RightsEvidenceRow) : null;
}

// #3552 phase 5 (#3748): the most recent usage_decision recorded for this
// candidate, across all evidence rows. Every row carries a usage_decision
// (default 'hold'), so unlike getCurrentConclusionForCandidate this never
// returns null for a candidate with at least one evidence row -- a candidate
// with none yet has no decision at all, which is distinct from 'hold'.
export async function getCurrentUsageDecisionForCandidate(
  db: any,
  contentItemId: number,
): Promise<StoredRightsEvidence | null> {
  const row = await db
    .prepare(
      `SELECT * FROM rights_evidence
       WHERE content_item_id = ?
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(contentItemId)
    .first();

  return row ? mapRightsEvidenceRow(row as RightsEvidenceRow) : null;
}

export type HoldQueueEntry = {
  content_item_id: number;
  candidate_id: string;
  title: string;
  source_name: string | null;
  source_url: string | null;
  source_domain: string | null;
  media_asset_id: string | null;
  content_type: string | null;
  latest_evidence: StoredRightsEvidence;
};

// #3827: the curator-facing hold queue. Per content item, resolves only its
// single most recent rights_evidence row (matching getCurrentUsageDecision
// ForCandidate's own "latest row wins" rule) and keeps items where that row
// is still usage_decision = 'hold'. An item with zero evidence rows has no
// decision at all yet and is correctly absent -- that is a different state
// from 'hold', not a superset of it (see getCurrentUsageDecisionForCandidate
// above). Ordered oldest-first so the longest-waiting items surface first.
export async function listHoldQueue(
  db: any,
  options: { limit?: number; offset?: number } = {},
): Promise<HoldQueueEntry[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const offset = Math.max(options.offset ?? 0, 0);

  const result = await db
    .prepare(
      `SELECT
         ci.id AS content_item_id,
         ci.candidate_id,
         ci.title,
         ci.source_name,
         ci.source_url,
         ci.source_domain,
         ci.media_asset_id,
         ci.content_type,
         re.*
       FROM content_items ci
       JOIN rights_evidence re ON re.id = (
         SELECT re2.id FROM rights_evidence re2
         WHERE re2.content_item_id = ci.id
         ORDER BY re2.recorded_at DESC, re2.id DESC
         LIMIT 1
       )
       WHERE re.usage_decision = 'hold' AND ci.deleted_at IS NULL
       ORDER BY re.recorded_at ASC, re.id ASC
       LIMIT ? OFFSET ?`,
    )
    .bind(limit, offset)
    .all();

  return ((result.results ?? []) as Array<RightsEvidenceRow & Omit<HoldQueueEntry, 'latest_evidence'>>).map((row) =>
    ({
      content_item_id: Number(row.content_item_id),
      candidate_id: String(row.candidate_id),
      title: String(row.title),
      source_name: row.source_name ?? null,
      source_url: row.source_url ?? null,
      source_domain: row.source_domain ?? null,
      media_asset_id: row.media_asset_id ?? null,
      content_type: row.content_type ?? null,
      // row also carries the ci.* columns selected alongside re.* above;
      // pickRightsEvidenceRowFields keeps latest_evidence to exactly
      // RightsEvidenceRow's own fields rather than that whole joined row.
      latest_evidence: mapRightsEvidenceRow(pickRightsEvidenceRowFields(row)),
    }),
  );
}

// Picks exactly RightsEvidenceRow's own columns off a row that may carry
// extra joined columns alongside them (see listHoldQueue above).
function pickRightsEvidenceRowFields(row: RightsEvidenceRow): RightsEvidenceRow {
  return {
    id: row.id,
    content_item_id: row.content_item_id,
    source_id: row.source_id,
    search_run_id: row.search_run_id,
    evidence_type: row.evidence_type,
    evidence_text: row.evidence_text,
    evidence_url: row.evidence_url,
    evidence_metadata: row.evidence_metadata,
    reviewer: row.reviewer,
    conclusion: row.conclusion,
    conclusion_rationale: row.conclusion_rationale,
    recorded_at: row.recorded_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
    channel: row.channel,
    rights_holder: row.rights_holder,
    repository_or_collection: row.repository_or_collection,
    publication_established: row.publication_established,
    us_publication_or_uraa_confirmed: row.us_publication_or_uraa_confirmed,
    publication_date_source: row.publication_date_source,
    source_filename: row.source_filename,
    tagging_requirements: row.tagging_requirements,
    usage_decision: row.usage_decision,
  };
}

// Authoritative resolver for gating: the most recent conclusion recorded
// specifically for this channel. A conclusion recorded for a different
// channel never satisfies this -- #3551's 2026-08-18 directive that a
// clearance for one channel must not silently authorize another.
export async function getCurrentConclusionForCandidateChannel(
  db: any,
  contentItemId: number,
  channel: RightsEvidenceChannel,
): Promise<StoredRightsEvidence | null> {
  const row = await db
    .prepare(
      `SELECT * FROM rights_evidence
       WHERE content_item_id = ? AND channel = ? AND conclusion IS NOT NULL
       ORDER BY recorded_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(contentItemId, channel)
    .first();

  return row ? mapRightsEvidenceRow(row as RightsEvidenceRow) : null;
}
