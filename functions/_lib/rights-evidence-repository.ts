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
] as const;

export const RIGHTS_EVIDENCE_CONCLUSIONS = [
  'public_domain_confirmed',
  'permission_granted',
  'lgfc_member_owned_item_photo',
] as const;

export type RightsEvidenceType = (typeof RIGHTS_EVIDENCE_TYPES)[number];
export type RightsEvidenceConclusion = (typeof RIGHTS_EVIDENCE_CONCLUSIONS)[number];

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
        us_publication_or_uraa_confirmed, publication_date_source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
