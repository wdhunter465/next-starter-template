// Candidate registry validation and D1 import helpers for Program #2286 / #2288.

import {
  CANDIDATE_ID_PATTERN,
  CONSENT_STATUSES,
  CONTENT_TYPES,
  CREDIT_PREFERENCES,
  INPUT_STREAMS,
  PRIVACY_FLAGS,
  PRIVACY_REVIEW_STATUSES,
  PUBLICATION_STATUSES,
  PUBLICATION_TARGETS,
  REGISTRY_CLASSES,
  RELEVANCE_STATUSES,
  REVIEW_PRIORITIES,
  REVIEW_STATUSES,
  RIGHTS_STATUSES,
  SOURCE_TRUST_STATUSES,
  SOURCE_TYPES,
  SUBMISSION_TYPES,
} from './content-pipeline-candidate-constants';
import { permissionFieldsForDiscovery, USAGE_BASIS_SET } from './content-pipeline-usage-basis';
import { normalizeSourceUrl, normalizedSourceUrlSql } from './content-pipeline-url-normalize';

export const CONTENT_PIPELINE_CORE_TABLES = [
  'sources',
  'submitters',
  'content_items',
  'tags',
  'content_item_tags',
  'member_submissions',
  'publication_candidates',
  'moderation_events',
  'rights_evidence',
] as const;

export type ContentPipelineCoreTable = (typeof CONTENT_PIPELINE_CORE_TABLES)[number];

export type CandidateRegistry = {
  schema_version: string;
  registry_class: string;
  candidates: CandidateRecord[];
  description?: string;
  registry_purpose?: string;
  content_evidence_level?: string;
  updated_at?: string;
};

export type MemberSubmissionExtension = {
  submitter_id?: string;
  submitter_name: string;
  submitter_contact: string;
  submission_type: string;
  ownership_statement: string;
  permission_statement: string;
  credit_preference: string;
  privacy_notes?: string;
  uploaded_media_reference?: string;
  related_candidate_id?: string;
  consent_status: string;
  admin_followup_required: boolean;
};

export type SourceMetadata = {
  source_record_id?: string;
  date_accessed?: string;
  source_citation?: string;
};

// Raw, source-reported license/rights text captured verbatim at discovery
// time -- automation-first (see #4405): this is evidence, never a
// conclusion. It lets a real rights_evidence row exist for a candidate the
// moment it's discovered instead of only the generic "nothing known yet"
// placeholder, without asserting any rights determination (conclusion stays
// NULL; only a human, via the admin rights-evidence API or
// content-pipeline-batch-rights-approval.ts, may ever record an approving
// conclusion).
export type DiscoveryRightsEvidence = {
  evidence_type: string;
  evidence_text?: string;
  evidence_url?: string;
  // #4405: set ONLY when the source's own structured license field is
  // unambiguous (see classifyLicenseRights in collect-gehrig-external-
  // sources.mjs) -- this records what the source itself already asserts, not
  // a new legal judgment LGFC is making. 'public_domain_confirmed' for a
  // clean CC0/Public Domain Mark; 'permission_granted' for CC-BY/CC-BY-SA
  // (the license itself is the creator's standing permission, conditioned on
  // credit_line being carried through). Any source whose signal is
  // restrictive (CC-BY-NC/-ND), free text (LOC advisories, DPLA
  // rightsCategory), or absent gets no conclusion here and stays on the
  // owner-contact worklist instead.
  conclusion?: 'public_domain_confirmed' | 'permission_granted';
  // #4405: how to reach the copyright owner about this item, when the
  // source offers one (e.g. a Wikimedia uploader's user page). Free text --
  // an email, a profile/contact URL, or left unset when the source gives no
  // usable contact avenue at all.
  contact_info?: string;
  // #4568: the collector's reading of the origin's terms. The import recomputes the stored
  // value with permissionFieldsForDiscovery, which honors a collector's fee flag but never
  // lets usage_basis grant more than `conclusion` already does.
  usage_basis?: string;
  fee_required?: boolean;
  // #4568: SHA-256 (hex) of evidence_text as captured, so a later change in wording is detected.
  evidence_text_sha256?: string;
};

export type CandidateRecord = {
  candidate_id: string;
  input_stream: string;
  title: string;
  source_url?: string;
  source_name: string;
  source_owner?: string;
  source_domain?: string;
  source_type: string;
  content_type: string;
  summary: string;
  date_or_period?: string;
  people_tags?: string[];
  topic_tags?: string[];
  location_tags?: string[];
  provenance_notes?: string;
  rights_status: string;
  source_trust_status: string;
  relevance_status: string;
  review_status: string;
  publication_status: string;
  publication_target?: string;
  privacy_flag: string;
  privacy_review_status: string;
  credit_line?: string;
  media_asset_id?: string;
  duplicate_of?: string;
  original_file_url?: string;
  file_format?: string;
  file_bytes?: number;
  width_px?: number;
  height_px?: number;
  copy_group_key?: string;
  copy_role?: 'preferred' | 'alternate' | 'pointer';
  quality_flag?: 'preferred' | 'alternate' | 'low_resolution' | 'known_not_collected';
  review_priority: string;
  admin_notes?: string;
  source_metadata?: SourceMetadata;
  rights_evidence?: DiscoveryRightsEvidence;
  member_submission?: MemberSubmissionExtension;
  submission_queue_id?: number;
  content_inventory_id?: number;
  last_event_at?: string;
  created_at: string;
  updated_at: string;
};

export type RegistryValidationResult =
  | { ok: true }
  | { ok: false; errors: string[] };

export type ImportSqlStatement = {
  table: string;
  sql: string;
  description: string;
};

export type ImportPlan = {
  candidateCount: number;
  statements: ImportSqlStatement[];
};

const REQUIRED_CANDIDATE_FIELDS = [
  'candidate_id',
  'input_stream',
  'title',
  'source_name',
  'source_type',
  'content_type',
  'summary',
  'rights_status',
  'source_trust_status',
  'relevance_status',
  'review_status',
  'publication_status',
  'privacy_flag',
  'privacy_review_status',
  'review_priority',
  'created_at',
  'updated_at',
] as const;

const REQUIRED_NON_EMPTY_STRING_FIELDS = [
  'candidate_id',
  'input_stream',
  'title',
  'source_name',
  'source_type',
  'content_type',
  'summary',
  'rights_status',
  'source_trust_status',
  'relevance_status',
  'review_status',
  'publication_status',
  'privacy_flag',
  'privacy_review_status',
  'review_priority',
  'created_at',
  'updated_at',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => isNonEmptyString(entry));
}

function pushEnumError(errors: string[], path: string, value: unknown, allowed: Set<string>) {
  if (typeof value !== 'string' || !allowed.has(value)) {
    errors.push(`${path} must be one of: ${[...allowed].join(', ')}`);
  }
}

function validateMemberSubmission(
  errors: string[],
  candidateId: string,
  memberSubmission: unknown,
) {
  if (!isRecord(memberSubmission)) {
    errors.push(`${candidateId}: member_submission object is required for member_submission stream`);
    return;
  }

  const required = [
    'submitter_name',
    'submitter_contact',
    'submission_type',
    'ownership_statement',
    'permission_statement',
    'credit_preference',
    'consent_status',
    'admin_followup_required',
  ] as const;

  for (const field of required) {
    if (memberSubmission[field] === undefined || memberSubmission[field] === null) {
      errors.push(`${candidateId}: member_submission.${field} is required`);
    }
  }

  for (const field of ['submitter_name', 'submitter_contact', 'ownership_statement', 'permission_statement'] as const) {
    if (!isNonEmptyString(memberSubmission[field])) {
      errors.push(`${candidateId}: member_submission.${field} must be a non-empty string`);
    }
  }

  pushEnumError(errors, `${candidateId}.member_submission.submission_type`, memberSubmission.submission_type, SUBMISSION_TYPES);
  pushEnumError(errors, `${candidateId}.member_submission.credit_preference`, memberSubmission.credit_preference, CREDIT_PREFERENCES);
  pushEnumError(errors, `${candidateId}.member_submission.consent_status`, memberSubmission.consent_status, CONSENT_STATUSES);

  if (
    memberSubmission.admin_followup_required !== undefined &&
    typeof memberSubmission.admin_followup_required !== 'boolean'
  ) {
    errors.push(`${candidateId}: member_submission.admin_followup_required must be boolean`);
  }
}

function validateCandidate(candidate: unknown, index: number): string[] {
  const errors: string[] = [];
  const label = isRecord(candidate) && typeof candidate.candidate_id === 'string'
    ? candidate.candidate_id
    : `candidates[${index}]`;

  if (!isRecord(candidate)) {
    return [`${label}: candidate must be an object`];
  }

  for (const field of REQUIRED_CANDIDATE_FIELDS) {
    if (candidate[field] === undefined || candidate[field] === null || candidate[field] === '') {
      errors.push(`${label}: ${field} is required`);
    }
  }

  for (const field of REQUIRED_NON_EMPTY_STRING_FIELDS) {
    if (candidate[field] !== undefined && candidate[field] !== null && !isNonEmptyString(candidate[field])) {
      errors.push(`${label}: ${field} must be a non-empty string`);
    }
  }

  if (typeof candidate.candidate_id === 'string' && !CANDIDATE_ID_PATTERN.test(candidate.candidate_id)) {
    errors.push(`${label}: candidate_id must match lgfc-gehrig-YYYY-NNNN+ pattern (3 or more sequence digits)`);
  }

  pushEnumError(errors, `${label}.input_stream`, candidate.input_stream, INPUT_STREAMS);
  pushEnumError(errors, `${label}.source_type`, candidate.source_type, SOURCE_TYPES);
  pushEnumError(errors, `${label}.content_type`, candidate.content_type, CONTENT_TYPES);
  pushEnumError(errors, `${label}.rights_status`, candidate.rights_status, RIGHTS_STATUSES);
  pushEnumError(errors, `${label}.source_trust_status`, candidate.source_trust_status, SOURCE_TRUST_STATUSES);
  pushEnumError(errors, `${label}.relevance_status`, candidate.relevance_status, RELEVANCE_STATUSES);
  pushEnumError(errors, `${label}.review_status`, candidate.review_status, REVIEW_STATUSES);
  pushEnumError(errors, `${label}.publication_status`, candidate.publication_status, PUBLICATION_STATUSES);
  pushEnumError(errors, `${label}.privacy_flag`, candidate.privacy_flag, PRIVACY_FLAGS);
  pushEnumError(errors, `${label}.privacy_review_status`, candidate.privacy_review_status, PRIVACY_REVIEW_STATUSES);
  pushEnumError(errors, `${label}.review_priority`, candidate.review_priority, REVIEW_PRIORITIES);

  if (candidate.publication_target !== undefined) {
    pushEnumError(errors, `${label}.publication_target`, candidate.publication_target, PUBLICATION_TARGETS);
  }

  if (candidate.people_tags !== undefined && !isStringArray(candidate.people_tags)) {
    errors.push(`${label}: people_tags must be a string array`);
  }
  if (candidate.topic_tags !== undefined && !isStringArray(candidate.topic_tags)) {
    errors.push(`${label}: topic_tags must be a string array`);
  }
  if (candidate.location_tags !== undefined && !isStringArray(candidate.location_tags)) {
    errors.push(`${label}: location_tags must be a string array`);
  }

  if (candidate.input_stream === 'member_submission') {
    validateMemberSubmission(errors, label, candidate.member_submission);
  }

  if (isRecord(candidate.rights_evidence) && candidate.rights_evidence.usage_basis !== undefined) {
    pushEnumError(errors, `${label}.rights_evidence.usage_basis`, candidate.rights_evidence.usage_basis, USAGE_BASIS_SET);
  }

  if (candidate.publication_status === 'approved_for_publish') {
    if (!isNonEmptyString(candidate.credit_line)) {
      errors.push(`${label}: credit_line is required when publication_status is approved_for_publish`);
    }
    pushEnumError(errors, `${label}.publication_target`, candidate.publication_target, PUBLICATION_TARGETS);
  }

  return errors;
}

export function validateCandidateRegistry(registry: unknown): RegistryValidationResult {
  const errors: string[] = [];

  if (!isRecord(registry)) {
    return { ok: false, errors: ['registry root must be an object'] };
  }

  if (registry.schema_version !== '1') {
    errors.push('schema_version must be "1"');
  }

  if (typeof registry.registry_class !== 'string' || !REGISTRY_CLASSES.has(registry.registry_class)) {
    errors.push('registry_class must be seed_transitional, fixture, or operator_export');
  }

  if (!Array.isArray(registry.candidates)) {
    errors.push('candidates must be an array');
    return { ok: false, errors };
  }

  const seenIds = new Set<string>();
  for (const [index, candidate] of registry.candidates.entries()) {
    const candidateErrors = validateCandidate(candidate, index);
    errors.push(...candidateErrors);

    if (isRecord(candidate) && typeof candidate.candidate_id === 'string') {
      if (seenIds.has(candidate.candidate_id)) {
        errors.push(`${candidate.candidate_id}: duplicate candidate_id in registry`);
      }
      seenIds.add(candidate.candidate_id);
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value ?? {}));
}

function sqlInteger(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  return String(value);
}

function sqlBooleanAsInteger(value: boolean): string {
  return value ? '1' : '0';
}

// #4841: the in-SQL URL normalizer (normalizedSourceUrlSql) is a nested CTE with a
// recursive part, and Cloudflare D1 fails any statement that embeds it with
// SQLITE_NOMEM -- even a plain SELECT on production. When the caller has already
// matched the candidate's page against the existing rows (findSamePageIds), the
// statement lists those row ids instead of re-running the normalizer in SQL.
function samePageMatchSql(
  urlColumn: string,
  idColumn: string,
  normalized: string,
  samePageIds: number[] | undefined,
): string {
  if (samePageIds === undefined) {
    return `${normalizedSourceUrlSql(urlColumn)} = ${sqlString(normalized)}`;
  }
  const ids = samePageIds.filter((id) => Number.isInteger(id));
  return ids.length > 0 ? `${idColumn} IN (${ids.join(', ')})` : '0';
}

export interface ExistingSourceUrlRow {
  id: number;
  source_url: string | null;
}

// Matches each candidate's page to existing active rows in code, with the same
// normalizer the SQL guard used (normalizeSourceUrl), keyed by candidate_id.
export function findSamePageIds(
  candidates: Array<{ candidate_id: string; source_url?: string | null }>,
  existingRows: ExistingSourceUrlRow[],
): Record<string, number[]> {
  const byNormalized = new Map<string, number[]>();
  for (const row of existingRows) {
    const key = normalizeSourceUrl(row.source_url ?? undefined);
    if (!key) continue;
    byNormalized.set(key, [...(byNormalized.get(key) ?? []), row.id]);
  }
  const result: Record<string, number[]> = {};
  for (const candidate of candidates) {
    const key = normalizeSourceUrl(candidate.source_url ?? undefined);
    result[candidate.candidate_id] = key ? [...(byNormalized.get(key) ?? [])] : [];
  }
  return result;
}

function buildContentItemUpsert(candidate: CandidateRecord, samePageIds?: number[]): ImportSqlStatement {
  const sourceMetadata = candidate.source_metadata ?? {};

  const columns = [
    'candidate_id',
    'input_stream',
    'title',
    'source_url',
    'source_name',
    'source_owner',
    'source_domain',
    'source_type',
    'content_type',
    'summary',
    'date_or_period',
    'provenance_notes',
    'rights_status',
    'source_trust_status',
    'relevance_status',
    'review_status',
    'publication_status',
    'publication_target',
    'privacy_flag',
    'privacy_review_status',
    'credit_line',
    'media_asset_id',
    'duplicate_of',
    'review_priority',
    'admin_notes',
    'source_metadata',
    'submission_queue_id',
    'content_inventory_id',
    'last_event_at',
    'created_at',
    'updated_at',
  ];

  const values = [
    sqlString(candidate.candidate_id),
    sqlString(candidate.input_stream),
    sqlString(candidate.title),
    sqlString(candidate.source_url ?? null),
    sqlString(candidate.source_name),
    sqlString(candidate.source_owner ?? null),
    sqlString(candidate.source_domain ?? null),
    sqlString(candidate.source_type),
    sqlString(candidate.content_type),
    sqlString(candidate.summary),
    sqlString(candidate.date_or_period ?? null),
    sqlString(candidate.provenance_notes ?? null),
    sqlString(candidate.rights_status),
    sqlString(candidate.source_trust_status),
    sqlString(candidate.relevance_status),
    sqlString(candidate.review_status),
    sqlString(candidate.publication_status),
    sqlString(candidate.publication_target ?? null),
    sqlString(candidate.privacy_flag),
    sqlString(candidate.privacy_review_status),
    sqlString(candidate.credit_line ?? null),
    sqlString(candidate.media_asset_id ?? null),
    sqlString(candidate.duplicate_of ?? null),
    sqlString(candidate.review_priority),
    sqlString(candidate.admin_notes ?? null),
    sqlJson(sourceMetadata),
    sqlInteger(candidate.submission_queue_id ?? null),
    sqlInteger(candidate.content_inventory_id ?? null),
    sqlString(candidate.last_event_at ?? null),
    sqlString(candidate.created_at),
    sqlString(candidate.updated_at),
  ];

  const updateAssignments = columns
    .filter((column) => column !== 'candidate_id' && column !== 'created_at')
    .map((column) => `${column} = excluded.${column}`)
    .join(',\n  ');

  // #4568: permission layers, outcome and final status for discovered items. Written on the
  // first insert only and deliberately left out of the ON CONFLICT update, so a re-import never
  // overwrites a person's later decision; a change in the origin's terms creates a new
  // record instead (supersession below).
  if (candidate.input_stream === 'scheduled_discovery') {
    const fields = permissionFieldsForDiscovery(candidate.rights_evidence);
    const decided = fields.outcome_basis !== 'pending';
    columns.push(
      'origin_permission',
      'cmg_permission',
      'mlb_permission',
      'yankees_permission',
      'privacy_status',
      'final_status',
      'outcome_basis',
      'outcome_set_at',
      'outcome_set_by',
    );
    values.push(
      sqlString(fields.layers.origin),
      sqlString(fields.layers.cmg),
      sqlString(fields.layers.mlb),
      sqlString(fields.layers.yankees),
      sqlString(fields.layers.privacy),
      sqlString(fields.final_status),
      sqlString(fields.outcome_basis),
      sqlString(decided ? candidate.created_at : null),
      sqlString(decided ? 'automated:discovery-classifier' : null),
    );
  }

  // Dedupe guard (#3712 phase 1): a candidate whose source_url already
  // belongs to a DIFFERENT active content_items row is never inserted as a
  // new row -- the same real-world photo/article rediscovered under a fresh
  // candidate_id must not create a duplicate. The `candidate_id != ...`
  // exclusion keeps this from ever blocking a normal idempotent re-import
  // of the same candidate_id (the ON CONFLICT upsert below still applies
  // to that case). When source_url is NULL, SQL's NULL-comparison
  // semantics make the EXISTS subquery find nothing, so the guard is a
  // no-op -- there is nothing to dedupe against.
  //
  // #4568 exception: when the origin's captured terms have changed since the
  // active record's last automated capture, the newer record is inserted and
  // the older one is superseded (buildSupersedeOlderRecords), never deleted.
  const sourceUrlSql = sqlString(candidate.source_url ?? null);
  const normalized = normalizeSourceUrl(candidate.source_url);
  const samePageSql = normalized
    ? samePageMatchSql('existing.source_url', 'existing.id', normalized, samePageIds)
    : `existing.source_url = ${sourceUrlSql}`;
  // #4592: a denied, not-permitted, or fee-required page is not re-added under
  // another spelling, even when the origin's captured terms have changed.
  const previouslyDeniedSql = `(
    existing.final_status = 'not_permitted'
    OR EXISTS (
      SELECT 1 FROM rights_evidence denied
      WHERE denied.content_item_id = existing.id
        AND (denied.usage_decision = 'deny' OR denied.fee_required = 1 OR denied.usage_basis = 'fee_required')
    )
  )`;
  const sql = `INSERT INTO content_items (
  ${columns.join(',\n  ')}
)
SELECT
  ${values.join(',\n  ')}
WHERE NOT EXISTS (
  SELECT 1 FROM content_items existing
  WHERE ${samePageSql}
    AND existing.candidate_id != ${sqlString(candidate.candidate_id)}
    AND existing.superseded_at IS NULL
    AND (
      NOT (${termsChangedSql(candidate, 'existing')})
      OR ${previouslyDeniedSql}
    )
)
ON CONFLICT(candidate_id) DO UPDATE SET
  ${updateAssignments};`;

  return {
    table: 'content_items',
    sql,
    description: `Upsert content_items for ${candidate.candidate_id} (skipped if source_url duplicates a different row with unchanged terms)`,
  };
}

// #4568: true when `alias` (an active record for the same source_url) is older than this
// candidate and its latest automated capture of the same evidence type says something different
// from this candidate's capture. Human-recorded evidence is not compared: its wording follows a
// different format and is a decision, not a capture of the origin's terms.
function termsChangedSql(candidate: CandidateRecord, alias: string): string {
  const evidence = candidate.input_stream === 'scheduled_discovery' ? candidate.rights_evidence : undefined;
  if (!evidence?.evidence_text) {
    return '0';
  }
  return `${alias}.created_at < ${sqlString(candidate.created_at)}
      AND EXISTS (
        SELECT 1 FROM rights_evidence captured
        WHERE captured.id = (
          SELECT MAX(prior.id) FROM rights_evidence prior
          WHERE prior.content_item_id = ${alias}.id
            AND prior.evidence_type = ${sqlString(evidence.evidence_type)}
            AND prior.reviewer LIKE 'automated:discovery-%'
        )
          AND captured.evidence_text IS NOT NULL
          AND captured.evidence_text != ${sqlString(evidence.evidence_text)}
      )`;
}

// #4568: the newest dated record defines use. Once the newer record exists, every older active
// record for the same source_url is marked superseded by it. No row is deleted.
function buildSupersedeOlderRecords(candidate: CandidateRecord, samePageIds?: number[]): ImportSqlStatement | null {
  if (candidate.input_stream !== 'scheduled_discovery' || !candidate.source_url) {
    return null;
  }
  const candidateIdSql = sqlString(candidate.candidate_id);
  const normalized = normalizeSourceUrl(candidate.source_url);
  const samePageSql = normalized
    ? samePageMatchSql('source_url', 'id', normalized, samePageIds)
    : `source_url = ${sqlString(candidate.source_url)}`;
  const sql = `UPDATE content_items
SET superseded_at = ${sqlString(candidate.created_at)},
    superseded_by = ${candidateIdSql}
WHERE ${samePageSql}
  AND candidate_id != ${candidateIdSql}
  AND superseded_at IS NULL
  AND created_at < ${sqlString(candidate.created_at)}
  AND EXISTS (
    SELECT 1 FROM content_items newer
    WHERE newer.candidate_id = ${candidateIdSql}
      AND newer.superseded_at IS NULL
  );`;
  return {
    table: 'content_items',
    sql,
    description: `Supersede older records for the source_url of ${candidate.candidate_id}`,
  };
}

function buildTagStatements(candidate: CandidateRecord): ImportSqlStatement[] {
  const tagGroups: Array<{ category: 'people' | 'topics' | 'places'; tags?: string[] }> = [
    { category: 'people', tags: candidate.people_tags },
    { category: 'topics', tags: candidate.topic_tags },
    { category: 'places', tags: candidate.location_tags },
  ];

  const statements: ImportSqlStatement[] = [
    {
      table: 'content_item_tags',
      sql: `DELETE FROM content_item_tags
WHERE content_item_id = (
  SELECT id FROM content_items WHERE candidate_id = ${sqlString(candidate.candidate_id)}
);`,
      description: `Clear tag links for ${candidate.candidate_id} before registry sync`,
    },
  ];

  for (const group of tagGroups) {
    for (const tagName of group.tags ?? []) {
      statements.push({
        table: 'tags',
        sql: `INSERT INTO tags (tag_name, tag_category)
VALUES (${sqlString(tagName)}, ${sqlString(group.category)})
ON CONFLICT(tag_name, tag_category) DO NOTHING;`,
        description: `Ensure tag ${group.category}:${tagName}`,
      });

      statements.push({
        table: 'content_item_tags',
        sql: `INSERT INTO content_item_tags (content_item_id, tag_id)
SELECT ci.id, t.id
FROM content_items ci
JOIN tags t ON t.tag_name = ${sqlString(tagName)} AND t.tag_category = ${sqlString(group.category)}
WHERE ci.candidate_id = ${sqlString(candidate.candidate_id)}
ON CONFLICT(content_item_id, tag_id) DO NOTHING;`,
        description: `Link tag ${group.category}:${tagName} to ${candidate.candidate_id}`,
      });
    }
  }

  return statements;
}

function buildSubmitterUpsert(member: MemberSubmissionExtension): ImportSqlStatement | null {
  if (!member.submitter_name || !member.submitter_contact) {
    return null;
  }

  const sql = member.submitter_id
    ? `INSERT INTO submitters (member_submitter_id, submitter_name, submitter_contact)
VALUES (${sqlString(member.submitter_id)}, ${sqlString(member.submitter_name)}, ${sqlString(member.submitter_contact)})
ON CONFLICT(member_submitter_id) DO UPDATE SET
  submitter_name = excluded.submitter_name,
  submitter_contact = excluded.submitter_contact,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`
    : `INSERT INTO submitters (member_submitter_id, submitter_name, submitter_contact)
SELECT NULL, ${sqlString(member.submitter_name)}, ${sqlString(member.submitter_contact)}
WHERE NOT EXISTS (
  SELECT 1
  FROM submitters
  WHERE submitter_name = ${sqlString(member.submitter_name)}
    AND submitter_contact = ${sqlString(member.submitter_contact)}
);`;

  return {
    table: 'submitters',
    sql,
    description: `Upsert submitter ${member.submitter_name}`,
  };
}

function buildMemberSubmissionUpsert(candidate: CandidateRecord): ImportSqlStatement | null {
  const member = candidate.member_submission;
  if (!member) {
    return null;
  }

  const submitterJoin = member.submitter_id
    ? `LEFT JOIN submitters s ON s.id = (
  SELECT MIN(id) FROM submitters WHERE member_submitter_id = ${sqlString(member.submitter_id)}
)`
    : `LEFT JOIN submitters s ON s.id = (
  SELECT MIN(id) FROM submitters
  WHERE submitter_name = ${sqlString(member.submitter_name)}
    AND submitter_contact = ${sqlString(member.submitter_contact)}
)`;

  const sql = `INSERT INTO member_submissions (
  content_item_id,
  submitter_id,
  submission_type,
  ownership_statement,
  permission_statement,
  credit_preference,
  privacy_notes,
  uploaded_media_reference,
  related_candidate_id,
  consent_status,
  admin_followup_required,
  submission_queue_id
)
SELECT
  ci.id,
  s.id,
  ${sqlString(member.submission_type)},
  ${sqlString(member.ownership_statement)},
  ${sqlString(member.permission_statement)},
  ${sqlString(member.credit_preference)},
  ${sqlString(member.privacy_notes ?? null)},
  ${sqlString(member.uploaded_media_reference ?? null)},
  ${sqlString(member.related_candidate_id ?? null)},
  ${sqlString(member.consent_status)},
  ${sqlBooleanAsInteger(member.admin_followup_required)},
  ${sqlInteger(candidate.submission_queue_id ?? null)}
FROM content_items ci
${submitterJoin}
WHERE ci.candidate_id = ${sqlString(candidate.candidate_id)}
ON CONFLICT(content_item_id) DO UPDATE SET
  submitter_id = excluded.submitter_id,
  submission_type = excluded.submission_type,
  ownership_statement = excluded.ownership_statement,
  permission_statement = excluded.permission_statement,
  credit_preference = excluded.credit_preference,
  privacy_notes = excluded.privacy_notes,
  uploaded_media_reference = excluded.uploaded_media_reference,
  related_candidate_id = excluded.related_candidate_id,
  consent_status = excluded.consent_status,
  admin_followup_required = excluded.admin_followup_required,
  submission_queue_id = excluded.submission_queue_id,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`;

  return {
    table: 'member_submissions',
    sql,
    description: `Upsert member_submissions for ${candidate.candidate_id}`,
  };
}

// #4374 Q2: scheduled_discovery candidates get zero rights_evidence rows
// today -- the discovery workflow only ever writes content_items metadata
// (rights_status='unknown'), so a freshly-discovered item is invisible to
// any rights queue until a human happens to look at it. Recording a
// 'rights_undetermined' row makes "not yet determined" a real, queryable
// state instead of silence. This is safe for automation to write with no
// human in the loop -- "we don't know yet" asserts nothing about rights,
// unlike an approving conclusion (see rights-evidence-repository.ts's
// recordUndeterminedRightsEvidence, which this mirrors in raw-SQL form for
// the CLI import path). Only fires for scheduled_discovery -- member
// submissions have their own separate rights model (#2270) and must not
// gain an extra evidence row from this path.
// #4405: automation-first discovery. When a collector captured real,
// source-reported license/rights text (candidate.rights_evidence), record it
// verbatim as its correctly-typed evidence row (openverse_license,
// loc_statement, commons_license, dpla_rights_statement, ...) instead of the
// generic placeholder -- this is what actually makes an owner/rights
// worklist queryable per source claim. conclusion stays NULL: capturing what
// a source says is not a rights determination, so this remains exactly as
// safe for automation to write as the placeholder it replaces (only a human,
// via the admin rights-evidence API or content-pipeline-batch-rights-
// approval.ts, may ever record an approving conclusion).
//
// When no source evidence was captured at all (the common case for LOC/DPLA
// items with no usable rights statement), falls back to the original
// generic 'rights_undetermined' placeholder so "nothing known yet" remains a
// real, queryable state either way.
function buildDiscoveryRightsEvidenceInsert(candidate: CandidateRecord): ImportSqlStatement | null {
  if (candidate.input_stream !== 'scheduled_discovery') {
    return null;
  }

  const evidence = candidate.rights_evidence;
  // #4405: an auto-confirmable signal (evidence.conclusion set) is recorded
  // as a real conclusion on the 'website' channel with usage_decision
  // 'permit' -- this is what actually unblocks the existing publication-prep
  // gate (content-pipeline-publication-prep.ts) and the existing B2 ingest
  // gate (functions/api/admin/content-pipeline/ingest.ts requires exactly a
  // recorded rights_evidence conclusion) with no separate human step, for
  // the narrow band of unambiguous source-asserted licenses. Everything else
  // keeps recording evidence only (conclusion NULL, channel
  // 'internal_archive_only', usage_decision 'hold') so it surfaces on the
  // owner-contact worklist instead.
  // #4568: usage_basis and the fee flag come from the same mapping as the record's layers. A
  // fee-required item is recorded with usage_decision 'deny' and no conclusion.
  const fields = permissionFieldsForDiscovery(evidence);
  const reviewer =
    fields.conclusion || fields.fee_required ? 'automated:discovery-classifier' : 'automated:discovery-import';
  const channel = fields.conclusion ? 'website' : 'internal_archive_only';

  const sql = evidence
    ? `INSERT INTO rights_evidence (
  content_item_id, evidence_type, evidence_text, evidence_url, reviewer,
  conclusion, channel, usage_decision, contact_info,
  usage_basis, fee_required, evidence_text_sha256
)
SELECT
  ci.id, ${sqlString(evidence.evidence_type)}, ${sqlString(evidence.evidence_text ?? null)}, ${sqlString(evidence.evidence_url ?? null)},
  ${sqlString(reviewer)}, ${sqlString(fields.conclusion)}, ${sqlString(channel)}, ${sqlString(fields.usage_decision)}, ${sqlString(evidence.contact_info ?? null)},
  ${sqlString(fields.usage_basis)}, ${sqlInteger(fields.fee_required)}, ${sqlString(evidence.evidence_text_sha256 ?? null)}
FROM content_items ci
WHERE ci.candidate_id = ${sqlString(candidate.candidate_id)}
  AND NOT EXISTS (
    SELECT 1 FROM rights_evidence re WHERE re.content_item_id = ci.id
  );`
    : `INSERT INTO rights_evidence (
  content_item_id, evidence_type, reviewer, conclusion, conclusion_rationale,
  channel, usage_decision
)
SELECT
  ci.id, 'other', 'automated:discovery-import',
  'rights_undetermined',
  'Rights could not be determined automatically at discovery time; awaiting curator review.',
  'internal_archive_only', 'hold'
FROM content_items ci
WHERE ci.candidate_id = ${sqlString(candidate.candidate_id)}
  AND NOT EXISTS (
    SELECT 1 FROM rights_evidence re WHERE re.content_item_id = ci.id
  );`;

  return {
    table: 'rights_evidence',
    sql,
    description: evidence
      ? `Record ${evidence.evidence_type} evidence for ${candidate.candidate_id} (first import only)`
      : `Record rights_undetermined evidence for ${candidate.candidate_id} (first import only)`,
  };
}

function buildPublicationCandidateUpsert(candidate: CandidateRecord): ImportSqlStatement | null {
  if (candidate.publication_status !== 'approved_for_publish' || !candidate.publication_target) {
    return null;
  }

  const idempotentSql = `INSERT INTO publication_candidates (
  content_item_id,
  publication_target,
  credit_line,
  status
)
SELECT
  ci.id,
  ${sqlString(candidate.publication_target)},
  ${sqlString(candidate.credit_line ?? null)},
  'staging'
FROM content_items ci
WHERE ci.candidate_id = ${sqlString(candidate.candidate_id)}
ON CONFLICT(content_item_id, publication_target) DO UPDATE SET
  credit_line = excluded.credit_line,
  updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now');`;

  return {
    table: 'publication_candidates',
    sql: idempotentSql,
    description: `Stage publication_candidates for ${candidate.candidate_id}`,
  };
}

export interface ImportPlanOptions {
  // candidate_id -> ids of existing active content_items rows for the same page.
  samePageIds?: Record<string, number[]>;
}

export function buildCandidateImportPlan(registry: CandidateRegistry, options: ImportPlanOptions = {}): ImportPlan {
  const validation = validateCandidateRegistry(registry);
  if (!validation.ok) {
    throw new Error(`Registry validation failed: ${validation.errors.join('; ')}`);
  }

  const statements: ImportSqlStatement[] = [];

  for (const candidate of registry.candidates) {
    if (candidate.copy_role === 'pointer') continue;
    const samePageIds = options.samePageIds?.[candidate.candidate_id];
    statements.push(buildContentItemUpsert(candidate, samePageIds));
    const supersedeStatement = buildSupersedeOlderRecords(candidate, samePageIds);
    if (supersedeStatement) {
      statements.push(supersedeStatement);
    }
    statements.push(...buildTagStatements(candidate));

    if (candidate.member_submission) {
      const submitterStatement = buildSubmitterUpsert(candidate.member_submission);
      if (submitterStatement) {
        statements.push(submitterStatement);
      }
      const memberStatement = buildMemberSubmissionUpsert(candidate);
      if (memberStatement) {
        statements.push(memberStatement);
      }
    }

    const publicationStatement = buildPublicationCandidateUpsert(candidate);
    if (publicationStatement) {
      statements.push(publicationStatement);
    }

    const rightsEvidenceStatement = buildDiscoveryRightsEvidenceInsert(candidate);
    if (rightsEvidenceStatement) {
      statements.push(rightsEvidenceStatement);
    }
  }

  return {
    candidateCount: registry.candidates.length,
    statements,
  };
}

export function buildImportSqlBatch(plan: ImportPlan): string {
  const body = plan.statements.map((statement) => statement.sql).join('\n');
  return `BEGIN;\n${body}\nCOMMIT;`;
}

export function countUpsertsByCandidate(plan: ImportPlan): Map<string, number> {
  const counts = new Map<string, number>();
  for (const statement of plan.statements) {
    if (statement.table !== 'content_items') {
      continue;
    }
    const match = statement.description.match(/for (lgfc-gehrig-[0-9]{4}-[0-9]+)/);
    if (match) {
      counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
    }
  }
  return counts;
}
