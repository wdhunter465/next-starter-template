// Shared LGFC content pipeline candidate enum constants (#2286 / #2288 / #2310).

export const CANDIDATE_ID_PATTERN = /^lgfc-gehrig-[0-9]{4}-[0-9]{3,}$/;

export const CANDIDATE_ID_VALIDATION_MESSAGE =
  'candidate_id must match lgfc-gehrig-YYYY-NNN with at least 3 trailing digits.';

export const CONTENT_PIPELINE_INPUT_STREAMS = [
  'public_research',
  'member_submission',
  'admin_seed',
  'scheduled_discovery',
] as const;

export const CONTENT_PIPELINE_SOURCE_TYPES = [
  'archive',
  'museum',
  'newspaper',
  'library',
  'member',
  'social',
  'auction',
  'institution',
  'operator',
  'other',
] as const;

export const CONTENT_PIPELINE_CONTENT_TYPES = [
  'photo',
  'article',
  'record',
  'story',
  'video',
  'audio',
  'artifact',
  'quote',
  'timeline_fact',
  'biography_note',
  'source_lead',
  'correction',
  'identification',
  'other',
] as const;

export const CONTENT_PIPELINE_RIGHTS_STATUSES = [
  'unknown',
  'public_domain_candidate',
  'permission_needed',
  'permission_requested',
  'permission_granted',
  'copyright_restricted',
  'blocked',
  'lgfc_owned_confirmed',
] as const;

export const CONTENT_PIPELINE_SOURCE_TRUST_STATUSES = [
  'pending',
  'trusted',
  'questionable',
  'blocked',
  'deleted',
] as const;

export const CONTENT_PIPELINE_RELEVANCE_STATUSES = [
  'pending',
  'relevant',
  'not_relevant',
  'uncertain',
] as const;

export const CONTENT_PIPELINE_REVIEW_STATUSES = [
  'pending_review',
  'approved_internal_reference',
  'approved_public_candidate',
  'approved_citation_reference_only',
  'deferred_source_verification',
  'deferred_rights_review',
  'deferred_privacy_review',
  'rejected',
  'private_internal_only',
] as const;

export const CONTENT_PIPELINE_PUBLICATION_STATUSES = [
  'not_ready',
  'draft_candidate',
  'staged',
  'approved_for_publish',
  'published',
  'unpublished',
  'archived',
] as const;

export const ADMIN_REVIEW_PUBLICATION_STATUSES = [
  'not_ready',
  'draft_candidate',
  'staged',
  'approved_for_publish',
  'unpublished',
  'archived',
] as const;

export const ADMIN_REVIEW_PUBLICATION_STATUS_BLOCKED_MESSAGE =
  'publication_status published is reserved for the publication/conversion workflow.';

export const CONTENT_PIPELINE_PUBLICATION_TARGETS = [
  'biography',
  'timeline',
  'gallery',
  'library',
  'memorabilia',
  'article',
  'homepage_feature',
  'lou_gehrig_day',
  'newsletter',
  'social',
  'internal_reference_only',
] as const;

export const CONTENT_PIPELINE_PRIVACY_FLAGS = [
  'none',
  'living_person',
  'donor_member',
  'minors',
  'sensitive',
  'other',
] as const;

export const CONTENT_PIPELINE_PRIVACY_REVIEW_STATUSES = [
  'not_applicable',
  'pending_review',
  'approved',
  'restricted',
  'blocked',
] as const;

export const CONTENT_PIPELINE_REVIEW_PRIORITIES = ['low', 'normal', 'high'] as const;

export const CONTENT_PIPELINE_SUBMISSION_TYPES = [
  'story',
  'photo',
  'memorabilia',
  'correction',
  'identification',
  'source_lead',
  'historical_note',
] as const;

export const CONTENT_PIPELINE_CREDIT_PREFERENCES = [
  'public_credit',
  'anonymous',
  'private',
  'custom',
] as const;

export const CONTENT_PIPELINE_CONSENT_STATUSES = ['pending', 'granted', 'restricted', 'denied'] as const;

export const CONTENT_PIPELINE_REGISTRY_CLASSES = [
  'seed_transitional',
  'fixture',
  'operator_export',
] as const;

function toSet<T extends string>(values: readonly T[]): Set<string> {
  return new Set(values);
}

export const INPUT_STREAMS = toSet(CONTENT_PIPELINE_INPUT_STREAMS);
export const SOURCE_TYPES = toSet(CONTENT_PIPELINE_SOURCE_TYPES);
export const CONTENT_TYPES = toSet(CONTENT_PIPELINE_CONTENT_TYPES);
export const RIGHTS_STATUSES = toSet(CONTENT_PIPELINE_RIGHTS_STATUSES);
export const SOURCE_TRUST_STATUSES = toSet(CONTENT_PIPELINE_SOURCE_TRUST_STATUSES);
export const RELEVANCE_STATUSES = toSet(CONTENT_PIPELINE_RELEVANCE_STATUSES);
export const REVIEW_STATUSES = toSet(CONTENT_PIPELINE_REVIEW_STATUSES);
export const PUBLICATION_STATUSES = toSet(CONTENT_PIPELINE_PUBLICATION_STATUSES);
export const ADMIN_REVIEW_PUBLICATION_STATUS_SET = toSet(ADMIN_REVIEW_PUBLICATION_STATUSES);
export const PUBLICATION_TARGETS = toSet(CONTENT_PIPELINE_PUBLICATION_TARGETS);
export const PRIVACY_FLAGS = toSet(CONTENT_PIPELINE_PRIVACY_FLAGS);
export const PRIVACY_REVIEW_STATUSES = toSet(CONTENT_PIPELINE_PRIVACY_REVIEW_STATUSES);
export const REVIEW_PRIORITIES = toSet(CONTENT_PIPELINE_REVIEW_PRIORITIES);
export const SUBMISSION_TYPES = toSet(CONTENT_PIPELINE_SUBMISSION_TYPES);
export const CREDIT_PREFERENCES = toSet(CONTENT_PIPELINE_CREDIT_PREFERENCES);
export const CONSENT_STATUSES = toSet(CONTENT_PIPELINE_CONSENT_STATUSES);
export const REGISTRY_CLASSES = toSet(CONTENT_PIPELINE_REGISTRY_CLASSES);
