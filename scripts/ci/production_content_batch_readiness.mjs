#!/usr/bin/env node
/**
 * #2908 (#2859 Task 003) — deterministic, zero-cost batch-plan readiness
 * harness for controlled D1/B2 population batches.
 *
 * Validates a batch-plan record against the eight approved batch classes
 * from #2907's accepted reconciliation register (Section 6): every batch
 * must declare which approved class it belongs to, be attributable,
 * idempotent, recoverable, privacy-safe, free of placeholders/broken
 * references, and preserve original media. It never performs a live D1/B2
 * request and never writes to Production — it validates a batch-plan
 * document the operator/executor fills in before any authorized apply.
 *
 * `productionWriteAuthorization` is tracked but not enforced by default:
 * `ready: true` means the batch plan is structurally sound and dry-run
 * ready, not that a live write is authorized. Pass
 * `requireWriteAuthorization: true` to additionally gate on
 * `productionWriteAuthorization === 'authorized'` when validating
 * live-apply readiness specifically.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The eight ordered batch classes #2907 Section 6 authorizes planning against. */
export const APPROVED_BATCH_CLASSES = Object.freeze([
  'faq-public-seed',
  'milestones-public',
  'friends-partners',
  'events-public',
  'matchup-week-pair',
  'library-inventory',
  'club-home-content',
  'media-member-gallery',
]);

export const PRODUCTION_WRITE_AUTHORIZATION_VALUES = Object.freeze(['not-yet-authorized', 'authorized']);

const REQUIRED_BATCH_FIELDS = Object.freeze([
  'batchClass',
  'attributionEvidence',
  'idempotencyKeyStrategy',
  'recoveryPlan',
  'privacyExclusionEvidence',
  'placeholderExclusionEvidence',
  'originalMediaPreservationEvidence',
  'preCountEvidence',
  'productionWriteAuthorization',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one batch-plan record. Returns a list of human-readable problem strings (empty = compliant). */
export function validateBatchPlan(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['batch_plan_not_an_object'];
  }
  const problems = [];
  for (const field of REQUIRED_BATCH_FIELDS) {
    if (!isNonEmptyString(record[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  if (isNonEmptyString(record.batchClass) && !APPROVED_BATCH_CLASSES.includes(record.batchClass)) {
    problems.push(`unapproved_batch_class:${record.batchClass}`);
  }
  if (
    isNonEmptyString(record.productionWriteAuthorization) &&
    !PRODUCTION_WRITE_AUTHORIZATION_VALUES.includes(record.productionWriteAuthorization)
  ) {
    problems.push(`invalid_production_write_authorization:${record.productionWriteAuthorization}`);
  }
  return problems;
}

/**
 * Combines batch-plan structural validation with an optional live-apply
 * authorization gate into one readiness verdict. Mirrors this session's
 * established `{ ready, blockers, detail }` contract shape.
 */
export function buildBatchReadiness({ record, requireWriteAuthorization = false }) {
  const problems = validateBatchPlan(record);
  const blockers = [];
  if (problems.length > 0) blockers.push('batch_plan_incomplete');

  const authorization =
    record && typeof record === 'object' ? record.productionWriteAuthorization : undefined;
  if (requireWriteAuthorization && authorization !== 'authorized') {
    blockers.push('production_write_not_authorized');
  }

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      batchPlanProblems: problems,
      productionWriteAuthorization: authorization ?? null,
      requireWriteAuthorization,
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
  const requireWriteAuthorization = argv.includes('--require-write-authorization');

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

  const result = buildBatchReadiness({ record, requireWriteAuthorization });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
