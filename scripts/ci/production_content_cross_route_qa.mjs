#!/usr/bin/env node
/**
 * #2909 (#2859 Task 004) — deterministic, zero-cost cross-route QA
 * readiness harness for the production content launch surface matrix.
 *
 * #2906's matrix (docs/ops/reports/production-content-launch-surface-matrix-2906.md)
 * assigns every launch-required surface a disposition; its own handoff
 * section says "#2909 QA should walk every missing-actionable and
 * protected-pending-decision row." This harness validates a QA record
 * mapping every such row to either verified-safe-fallback evidence (a real
 * test proving the surface degrades safely when its data is absent) or an
 * explicit deferral with an accountable owner and release condition drawn
 * from the matrix's own Owner/Successor columns — never a silently dropped
 * row. It never performs a live D1/B2 request and never touches Production.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const QA_ROW_STATUSES = Object.freeze(['verified-safe-fallback', 'deferred']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one matrix-row QA item. Returns a list of human-readable problem strings (empty = compliant). */
export function validateQaRowItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return ['row_not_an_object'];
  }
  const problems = [];
  if (!isNonEmptyString(item.matrixId)) {
    problems.push('missing_or_empty:matrixId');
  }
  if (!isNonEmptyString(item.status) || !QA_ROW_STATUSES.includes(item.status)) {
    problems.push('missing_or_invalid:status');
    return problems;
  }
  if (item.status === 'verified-safe-fallback') {
    if (!isNonEmptyString(item.testFile)) problems.push('missing_or_empty:testFile');
    if (!isNonEmptyString(item.testName)) problems.push('missing_or_empty:testName');
  } else {
    // deferred
    if (!isNonEmptyString(item.owner)) problems.push('missing_or_empty:owner');
    if (!isNonEmptyString(item.releaseCondition)) problems.push('missing_or_empty:releaseCondition');
  }
  return problems;
}

/**
 * Validates a full cross-route QA record. `requiredMatrixIds` is the exact
 * set of matrix row IDs (missing-actionable + protected-pending-decision)
 * this QA pass must account for — passed in by the caller rather than
 * hardcoded here, since the matrix itself is the source of truth for which
 * IDs exist. Returns a list of human-readable problem strings (empty =
 * compliant).
 */
export function validateCrossRouteQaRecord(record, { requiredMatrixIds = [] } = {}) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['qa_record_not_an_object'];
  }
  const problems = [];
  if (!isNonEmptyString(record.matrixSourceSha)) {
    problems.push('missing_or_empty:matrixSourceSha');
  }
  if (!Array.isArray(record.rows) || record.rows.length === 0) {
    problems.push('rows_missing_or_empty');
  } else {
    record.rows.forEach((item, index) => {
      for (const problem of validateQaRowItem(item)) {
        problems.push(`rows[${index}]:${problem}`);
      }
    });
    const seenIds = new Set(
      record.rows
        .filter((item) => item && typeof item === 'object' && isNonEmptyString(item.matrixId))
        .map((item) => item.matrixId),
    );
    for (const matrixId of requiredMatrixIds) {
      if (!seenIds.has(matrixId)) {
        problems.push(`missing_matrix_id:${matrixId}`);
      }
    }
  }
  return problems;
}

/**
 * Combines cross-route QA record validation into one readiness verdict.
 * Mirrors this session's established `{ ready, blockers, detail }` contract
 * shape. `ready: true` means every required matrix row has an explicit
 * disposition (verified-safe-fallback-with-evidence or
 * deferred-with-owner-and-release-condition) — not that every row's
 * underlying content is actually populated; `detail.deferredMatrixIds`
 * lists rows still deferred to a successor/Product Authority decision.
 */
export function buildCrossRouteQaReadiness({ record, requiredMatrixIds = [] }) {
  const problems = validateCrossRouteQaRecord(record, { requiredMatrixIds });
  const blockers = [];
  if (problems.length > 0) blockers.push('qa_record_incomplete');

  const deferredMatrixIds =
    record && Array.isArray(record.rows)
      ? record.rows
          .filter((item) => item && typeof item === 'object' && item.status === 'deferred')
          .map((item) => item.matrixId)
      : [];

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      qaRecordProblems: problems,
      deferredMatrixIds,
    },
  };
}

function readJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`could not read "${filePath}": ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`could not parse "${filePath}" as JSON: ${error.message}`);
  }
}

function readListFile(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function readOptionValue(argv, flag) {
  const idx = argv.indexOf(flag);
  if (idx < 0) return undefined;
  const value = argv[idx + 1];
  if (typeof value !== 'string' || value.startsWith('--')) return undefined;
  return value;
}

export function main(argv = process.argv.slice(2)) {
  const recordFlagPresent = argv.includes('--record');
  const recordPath = readOptionValue(argv, '--record');
  const requiredIdsPath = readOptionValue(argv, '--required-ids-file');

  if (!recordFlagPresent || !recordPath) {
    console.error('FAIL-CLOSED: --record <path> is required.');
    process.exitCode = 1;
    return null;
  }

  let record;
  try {
    record = readJson(recordPath);
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const requiredMatrixIds = readListFile(requiredIdsPath);

  const result = buildCrossRouteQaReadiness({ record, requiredMatrixIds });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
