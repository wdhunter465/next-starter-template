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

export const CONTENT_PIPELINE_CORE_TABLES = [
  'sources',
  'submitters',
  'content_items',
  'tags',
  'content_item_tags',
  'member_submissions',
  'publication_candidates',
  'moderation_events',
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
  review_priority: string;
  admin_notes?: string;
  source_metadata?: SourceMetadata;
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

function buildContentItemUpsert(candidate: CandidateRecord): ImportSqlStatement {
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

  const sql = `INSERT INTO content_items (
  ${columns.join(',\n  ')}
) VALUES (
  ${values.join(',\n  ')}
)
ON CONFLICT(candidate_id) DO UPDATE SET
  ${updateAssignments};`;

  return {
    table: 'content_items',
    sql,
    description: `Upsert content_items for ${candidate.candidate_id}`,
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

export function buildCandidateImportPlan(registry: CandidateRegistry): ImportPlan {
  const validation = validateCandidateRegistry(registry);
  if (!validation.ok) {
    throw new Error(`Registry validation failed: ${validation.errors.join('; ')}`);
  }

  const statements: ImportSqlStatement[] = [];

  for (const candidate of registry.candidates) {
    statements.push(buildContentItemUpsert(candidate));
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
