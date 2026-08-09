#!/usr/bin/env node
/**
 * #2926 (#2781 Task 001) — deterministic, zero-cost entry-criteria
 * reconciliation harness for the integrated launch rehearsal.
 *
 * Validates an entry-criteria record: candidate identity, isolated
 * environment identity, synthetic/redacted test-data plan, executor/
 * verifier/recovery roles, cleanup plan, and evidence that private
 * Production data is never used as disposable test data — plus a list of
 * individual entry criteria, each of which must be either satisfied (with
 * evidence) or explicitly deferred (with an accountable owner and release
 * condition). #2926's acceptance criterion is exactly this: "Every entry
 * criterion is satisfied or explicitly identified with an accountable
 * owner and release condition" — an entry criterion with neither is a
 * silently dropped gap, not a compliant deferral.
 *
 * Never performs a live request, never touches Production. #2780's
 * acceptance governs final monitoring dependencies but does not block this
 * reconciliation/planning work per #2926's own non-blocking prerequisite
 * rule.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_ENTRY_RECORD_FIELDS = Object.freeze([
  'candidateIdentity',
  'environmentIdentity',
  'testDataPlan',
  'executorRole',
  'verifierRole',
  'recoveryOwner',
  'cleanupPlan',
  'productionDataExclusionEvidence',
]);

export const ENTRY_CRITERION_STATUSES = Object.freeze(['satisfied', 'deferred']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one entry-criterion item. Returns a list of human-readable problem strings (empty = compliant). */
export function validateEntryCriterionItem(item) {
  if (!item || typeof item !== 'object') {
    return ['criterion_not_an_object'];
  }
  const problems = [];
  if (!isNonEmptyString(item.name)) {
    problems.push('missing_or_empty:name');
  }
  if (!isNonEmptyString(item.status) || !ENTRY_CRITERION_STATUSES.includes(item.status)) {
    problems.push('missing_or_invalid:status');
    return problems;
  }
  if (item.status === 'satisfied') {
    if (!isNonEmptyString(item.evidence)) problems.push('missing_or_empty:evidence');
  } else {
    // deferred
    if (!isNonEmptyString(item.owner)) problems.push('missing_or_empty:owner');
    if (!isNonEmptyString(item.releaseCondition)) problems.push('missing_or_empty:releaseCondition');
  }
  return problems;
}

/** Validates a full entry-criteria record. Returns a list of human-readable problem strings (empty = compliant). */
export function validateEntryRecord(record) {
  if (!record || typeof record !== 'object') {
    return ['entry_record_not_an_object'];
  }
  const problems = [];
  for (const field of REQUIRED_ENTRY_RECORD_FIELDS) {
    if (!isNonEmptyString(record[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  if (!Array.isArray(record.entryCriteria) || record.entryCriteria.length === 0) {
    problems.push('entry_criteria_missing_or_empty');
  } else {
    record.entryCriteria.forEach((item, index) => {
      for (const problem of validateEntryCriterionItem(item)) {
        problems.push(`entryCriteria[${index}]:${problem}`);
      }
    });
  }
  return problems;
}

/**
 * Combines entry-record structural validation into one reconciliation
 * readiness verdict. Mirrors #2929/#2930/#2931/#2933's `{ ready, blockers,
 * detail }` contract shape so a future orchestration step can treat every
 * stage of the launch-rehearsal pipeline uniformly.
 */
export function buildEntryReadiness({ record }) {
  const problems = validateEntryRecord(record);
  const blockers = [];
  if (problems.length > 0) blockers.push('entry_record_incomplete');

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      entryRecordProblems: problems,
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

  const result = buildEntryReadiness({ record });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
