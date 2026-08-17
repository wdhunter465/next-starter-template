// Admin API request parsing/validation for #3551/#3552 content_search_runs (migration 0055).

import {
  CONTENT_SEARCH_RUN_TERMINAL_STATUS_SET,
  type ContentSearchRunTerminalStatus,
  type CompleteSearchRunInput,
  type StartSearchRunInput,
} from './content-search-run-repository';

const QUERY_MAX_LENGTH = 500;
const ADAPTER_VERSION_MAX_LENGTH = 100;
const ERROR_SUMMARY_MAX_LENGTH = 4000;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asOptionalTrimmedString(value: unknown, maxLength: number): string | undefined {
  if (value === undefined || value === null) return undefined;
  const trimmed = asTrimmedString(value);
  if (!trimmed) return undefined;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

function asPositiveInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : undefined;
}

function asNonNegativeInt(value: unknown): number | undefined {
  if (value === undefined || value === null) return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : undefined;
}

export type StartSearchRunRequest = Omit<StartSearchRunInput, 'source_id'> & { source_domain: string };

export type ParseStartSearchRunResult =
  | { ok: true; request: StartSearchRunRequest }
  | { ok: false; error: string };

export function parseStartSearchRunRequest(body: unknown): ParseStartSearchRunResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }
  const record = body as Record<string, unknown>;

  const runUid = asTrimmedString(record.run_uid);
  if (!runUid) {
    return { ok: false, error: 'run_uid is required.' };
  }

  const sourceDomain = asTrimmedString(record.source_domain);
  if (!sourceDomain) {
    return { ok: false, error: 'source_domain is required (must be one of the allowlisted sources).' };
  }

  let filters: Record<string, unknown> | undefined;
  if (record.filters !== undefined && record.filters !== null) {
    if (typeof record.filters !== 'object' || Array.isArray(record.filters)) {
      return { ok: false, error: 'filters must be a JSON object.' };
    }
    filters = record.filters as Record<string, unknown>;
  }

  return {
    ok: true,
    request: {
      run_uid: runUid,
      source_domain: sourceDomain,
      query: asOptionalTrimmedString(record.query, QUERY_MAX_LENGTH) ?? null,
      filters,
      result_limit: asPositiveInt(record.result_limit) ?? null,
      page_limit: asPositiveInt(record.page_limit) ?? null,
      adapter_version: asOptionalTrimmedString(record.adapter_version, ADAPTER_VERSION_MAX_LENGTH) ?? null,
      initiated_by: asOptionalTrimmedString(record.initiated_by, 255) ?? null,
    },
  };
}

export type CompleteSearchRunRequest = CompleteSearchRunInput & { run_uid: string };

export type ParseCompleteSearchRunResult =
  | { ok: true; request: CompleteSearchRunRequest }
  | { ok: false; error: string };

export function parseCompleteSearchRunRequest(body: unknown): ParseCompleteSearchRunResult {
  if (!body || typeof body !== 'object') {
    return { ok: false, error: 'Request body must be a JSON object.' };
  }
  const record = body as Record<string, unknown>;

  const runUid = asTrimmedString(record.run_uid);
  if (!runUid) {
    return { ok: false, error: 'run_uid is required.' };
  }

  const status = asTrimmedString(record.status);
  if (!status || !CONTENT_SEARCH_RUN_TERMINAL_STATUS_SET.has(status)) {
    return {
      ok: false,
      error: `status must be one of: ${[...CONTENT_SEARCH_RUN_TERMINAL_STATUS_SET].join(', ')}.`,
    };
  }

  return {
    ok: true,
    request: {
      run_uid: runUid,
      status: status as ContentSearchRunTerminalStatus,
      discovered_count: asNonNegativeInt(record.discovered_count),
      duplicate_count: asNonNegativeInt(record.duplicate_count),
      new_count: asNonNegativeInt(record.new_count),
      deferred_count: asNonNegativeInt(record.deferred_count),
      rights_cleared_count: asNonNegativeInt(record.rights_cleared_count),
      rejected_count: asNonNegativeInt(record.rejected_count),
      error_count: asNonNegativeInt(record.error_count),
      error_summary: asOptionalTrimmedString(record.error_summary, ERROR_SUMMARY_MAX_LENGTH) ?? null,
    },
  };
}
