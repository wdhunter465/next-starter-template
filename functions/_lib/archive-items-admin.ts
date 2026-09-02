// Admin API request parsing/validation for #2073 archive-item intake and
// custody transitions (migration 0065).

import {
  ARCHIVE_ITEM_TYPES,
  ARCHIVE_CUSTODY_STATES,
  ARCHIVE_CUSTODY_TYPES,
  type ArchiveItemType,
  type ArchiveCustodyState,
  type ArchiveCustodyType,
} from './archive-items-repository';

const ARCHIVE_ITEM_TYPE_SET = new Set<string>(ARCHIVE_ITEM_TYPES);
const ARCHIVE_CUSTODY_TYPE_SET = new Set<string>(ARCHIVE_CUSTODY_TYPES);
const ARCHIVE_CUSTODY_STATE_SET = new Set<string>(ARCHIVE_CUSTODY_STATES);

const TITLE_MAX_LENGTH = 500;
const SUMMARY_MAX_LENGTH = 4000;
const DONOR_NAME_MAX_LENGTH = 255;
const DONOR_CONTACT_MAX_LENGTH = 500;
const CREDIT_LINE_MAX_LENGTH = 500;
const STORAGE_LOCATION_MAX_LENGTH = 500;
const NOTES_MAX_LENGTH = 4000;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = asTrimmedString(value);
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function asBooleanishFlag(value: unknown): 0 | 1 {
  return value === true || value === 1 || value === '1' || value === 'true' ? 1 : 0;
}

export type CreateArchiveItemRequest = {
  title: string;
  summary: string;
  item_type: ArchiveItemType;
  custody_type: ArchiveCustodyType;
  loan_expected_return_at?: string;
  donor_name?: string;
  donor_contact?: string;
  donor_consent_public_credit?: 0 | 1;
  credit_line?: string;
  storage_location?: string;
  condition_notes?: string;
  intake_notes?: string;
  actor: string;
};

export type ParseResult<T> = { ok: true; request: T } | { ok: false; error: string };

export function parseCreateArchiveItemRequest(body: unknown): ParseResult<CreateArchiveItemRequest> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }
  const record = body as Record<string, unknown>;

  const title = asTrimmedString(record.title);
  if (!title) return { ok: false, error: 'title is required.' };
  if (title.length > TITLE_MAX_LENGTH) return { ok: false, error: `title must be ${TITLE_MAX_LENGTH} characters or fewer.` };

  const summary = asTrimmedString(record.summary);
  if (!summary) return { ok: false, error: 'summary is required.' };
  if (summary.length > SUMMARY_MAX_LENGTH) return { ok: false, error: `summary must be ${SUMMARY_MAX_LENGTH} characters or fewer.` };

  const itemType = asTrimmedString(record.item_type);
  if (!itemType || !ARCHIVE_ITEM_TYPE_SET.has(itemType)) {
    return { ok: false, error: `item_type must be one of: ${[...ARCHIVE_ITEM_TYPE_SET].join(', ')}.` };
  }

  const custodyType = asTrimmedString(record.custody_type);
  if (!custodyType || !ARCHIVE_CUSTODY_TYPE_SET.has(custodyType)) {
    return { ok: false, error: `custody_type must be one of: ${[...ARCHIVE_CUSTODY_TYPE_SET].join(', ')}.` };
  }

  const actor = asTrimmedString(record.actor);
  if (!actor) return { ok: false, error: 'actor is required.' };

  const loanExpectedReturnAt = asOptionalTrimmedString(record.loan_expected_return_at, 40);
  if (custodyType === 'loan' && !loanExpectedReturnAt) {
    return { ok: false, error: 'loan_expected_return_at is required when custody_type is loan.' };
  }

  const request: CreateArchiveItemRequest = {
    title,
    summary,
    item_type: itemType as ArchiveItemType,
    custody_type: custodyType as ArchiveCustodyType,
    loan_expected_return_at: loanExpectedReturnAt,
    donor_name: asOptionalTrimmedString(record.donor_name, DONOR_NAME_MAX_LENGTH),
    donor_contact: asOptionalTrimmedString(record.donor_contact, DONOR_CONTACT_MAX_LENGTH),
    donor_consent_public_credit: asBooleanishFlag(record.donor_consent_public_credit),
    credit_line: asOptionalTrimmedString(record.credit_line, CREDIT_LINE_MAX_LENGTH),
    storage_location: asOptionalTrimmedString(record.storage_location, STORAGE_LOCATION_MAX_LENGTH),
    condition_notes: asOptionalTrimmedString(record.condition_notes, NOTES_MAX_LENGTH),
    intake_notes: asOptionalTrimmedString(record.intake_notes, NOTES_MAX_LENGTH),
    actor,
  };

  return { ok: true, request };
}

export type UpdateCustodyStateRequest = {
  archive_item_id: number;
  to_state: ArchiveCustodyState;
  actor: string;
  note?: string;
};

export function parseUpdateCustodyStateRequest(body: unknown): ParseResult<UpdateCustodyStateRequest> {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }
  const record = body as Record<string, unknown>;

  const archiveItemId = record.archive_item_id;
  if (typeof archiveItemId !== 'number' || !Number.isFinite(archiveItemId) || archiveItemId <= 0) {
    return { ok: false, error: 'archive_item_id must be a positive number.' };
  }

  const toState = asTrimmedString(record.to_state);
  if (!toState || !ARCHIVE_CUSTODY_STATE_SET.has(toState)) {
    return { ok: false, error: `to_state must be one of: ${[...ARCHIVE_CUSTODY_STATE_SET].join(', ')}.` };
  }

  const actor = asTrimmedString(record.actor);
  if (!actor) return { ok: false, error: 'actor is required.' };

  return {
    ok: true,
    request: {
      archive_item_id: Math.trunc(archiveItemId),
      to_state: toState as ArchiveCustodyState,
      actor,
      note: asOptionalTrimmedString(record.note, NOTES_MAX_LENGTH),
    },
  };
}
