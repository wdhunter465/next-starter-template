#!/usr/bin/env node
/**
 * #2901 (#2857 Task 004) — deterministic, zero-cost candidate-qualification
 * readiness harness for the member photo experience.
 *
 * #2857's acceptance criteria require "all parent scenarios pass": tests
 * covering authorization, allowed/rejected files, size/signature/dimension
 * errors, rate limits, B2 failure, D1 failure, pending visibility, approval
 * visibility, attribution, stale media, keyboard navigation, and responsive
 * behavior — plus #2901's own rollback requirement that disabling member
 * upload preserves staff-managed gallery behavior. This harness validates a
 * qualification record mapping every one of those thirteen scenario
 * categories to either real test evidence (file + test name) or an explicit
 * gap with an accountable owner and release condition — never a silently
 * dropped category. It never runs the tests itself and never touches
 * Production; it validates the record an executor fills in after running
 * (or explicitly declining to run) each scenario category.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/** The thirteen scenario categories #2857/#2901 require qualification evidence for. */
export const REQUIRED_SCENARIO_CATEGORIES = Object.freeze([
  'authorization',
  'allowed-rejected-files',
  'size-signature-dimension-errors',
  'rate-limits',
  'b2-failure',
  'd1-failure',
  'pending-visibility',
  'approval-visibility',
  'attribution',
  'stale-media',
  'keyboard-navigation',
  'responsive-behavior',
  'rollback-staff-gallery-preserved',
]);

export const SCENARIO_STATUSES = Object.freeze(['covered', 'gap']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one scenario item. Returns a list of human-readable problem strings (empty = compliant). */
export function validateScenarioItem(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    return ['scenario_not_an_object'];
  }
  const problems = [];
  if (!isNonEmptyString(item.category) || !REQUIRED_SCENARIO_CATEGORIES.includes(item.category)) {
    problems.push('missing_or_unrecognized:category');
  }
  if (!isNonEmptyString(item.status) || !SCENARIO_STATUSES.includes(item.status)) {
    problems.push('missing_or_invalid:status');
    return problems;
  }
  if (item.status === 'covered') {
    if (!isNonEmptyString(item.testFile)) problems.push('missing_or_empty:testFile');
    if (!isNonEmptyString(item.testName)) problems.push('missing_or_empty:testName');
  } else {
    // gap
    if (!isNonEmptyString(item.owner)) problems.push('missing_or_empty:owner');
    if (!isNonEmptyString(item.releaseCondition)) problems.push('missing_or_empty:releaseCondition');
  }
  return problems;
}

/** Validates a full qualification record. Returns a list of human-readable problem strings (empty = compliant). */
export function validateQualificationRecord(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return ['qualification_record_not_an_object'];
  }
  const problems = [];
  if (!isNonEmptyString(record.candidateSha)) {
    problems.push('missing_or_empty:candidateSha');
  }
  if (!Array.isArray(record.scenarios) || record.scenarios.length === 0) {
    problems.push('scenarios_missing_or_empty');
  } else {
    record.scenarios.forEach((item, index) => {
      for (const problem of validateScenarioItem(item)) {
        problems.push(`scenarios[${index}]:${problem}`);
      }
    });
    const seenCategories = new Set(
      record.scenarios
        .filter((item) => item && typeof item === 'object' && isNonEmptyString(item.category))
        .map((item) => item.category),
    );
    for (const category of REQUIRED_SCENARIO_CATEGORIES) {
      if (!seenCategories.has(category)) {
        problems.push(`missing_category:${category}`);
      }
    }
  }
  return problems;
}

/**
 * Combines qualification-record structural validation into one readiness
 * verdict. Mirrors this session's established `{ ready, blockers, detail }`
 * contract shape. `ready: true` means every one of the thirteen scenario
 * categories has an explicit disposition (covered-with-evidence or
 * gap-with-owner-and-release-condition) — it does not mean every category is
 * actually covered; `detail.gapCategories` lists any still open.
 */
export function buildQualificationReadiness({ record }) {
  const problems = validateQualificationRecord(record);
  const blockers = [];
  if (problems.length > 0) blockers.push('qualification_record_incomplete');

  const gapCategories =
    record && Array.isArray(record.scenarios)
      ? record.scenarios
          .filter((item) => item && typeof item === 'object' && item.status === 'gap')
          .map((item) => item.category)
      : [];

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      qualificationRecordProblems: problems,
      gapCategories,
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

  const result = buildQualificationReadiness({ record });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
