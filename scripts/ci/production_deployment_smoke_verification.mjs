#!/usr/bin/env node
/**
 * #2932 (#2782 Task 003) — deterministic, zero-cost smoke-verification
 * readiness harness for the terminal Production deployment project.
 *
 * Validates a suite of smoke-test result records against #2932's acceptance
 * criteria: exact deployed identity is proven (every record cites the same
 * deployedCandidateSha, and — when a manifest is supplied — that SHA matches
 * #2930's accepted candidateSha), every required category (public,
 * auth/member, content/data/media, email/fundraiser-state, monitoring,
 * failure behavior) reports a result, and no record reports an unhandled
 * failure — a category may only report `fail` if stop/rollback is what
 * actually happened next (`stop_rollback_activated`), never a silent pass-
 * through. Never performs a live request, never touches Production, and
 * never executes a deployment. Reads #2930/#2931's manifest/preflight JSON
 * as pipeline inputs (same contract used between #2927-#2931) rather than
 * importing those modules directly.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_SMOKE_TEST_CATEGORIES = Object.freeze([
  'public',
  'auth_member',
  'content_data_media',
  'email_fundraiser_state',
  'monitoring',
  'failure_behavior',
]);

export const SMOKE_TEST_RESULTS = Object.freeze(['pass', 'fail', 'stop_rollback_activated']);

const REQUIRED_RECORD_FIELDS = Object.freeze(['category', 'result', 'evidence', 'deployedCandidateSha']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one smoke-test result record. Returns a list of human-readable problem strings (empty = compliant). */
export function validateSmokeTestRecord(record) {
  if (!record || typeof record !== 'object') {
    return ['record_not_an_object'];
  }
  const problems = [];
  for (const field of REQUIRED_RECORD_FIELDS) {
    if (!isNonEmptyString(record[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  if (isNonEmptyString(record.category) && !REQUIRED_SMOKE_TEST_CATEGORIES.includes(record.category)) {
    problems.push(`unknown_category:${record.category}`);
  }
  if (isNonEmptyString(record.result) && !SMOKE_TEST_RESULTS.includes(record.result)) {
    problems.push(`unknown_result:${record.result}`);
  }
  return problems;
}

/**
 * Validates a full smoke-test suite: every record is individually compliant,
 * every required category is represented, and every record agrees on the
 * exact deployed candidate SHA (the acceptance criterion "no changed
 * candidate bypasses qualification" requires one identity proven across the
 * whole suite, not per-category).
 */
export function validateSmokeTestSuite(records) {
  if (!Array.isArray(records)) {
    return { problems: ['smoke_suite_not_an_array'], categoriesPresent: [], agreedCandidateSha: null };
  }

  const problems = [];
  const categoriesPresent = new Set();
  const candidateShas = new Set();

  records.forEach((record, index) => {
    const recordProblems = validateSmokeTestRecord(record);
    for (const problem of recordProblems) problems.push(`record[${index}]:${problem}`);
    if (record && typeof record === 'object') {
      if (isNonEmptyString(record.category)) categoriesPresent.add(record.category);
      if (isNonEmptyString(record.deployedCandidateSha)) candidateShas.add(record.deployedCandidateSha);
    }
  });

  for (const category of REQUIRED_SMOKE_TEST_CATEGORIES) {
    if (!categoriesPresent.has(category)) problems.push(`missing_category:${category}`);
  }

  if (candidateShas.size > 1) problems.push('deployed_candidate_identity_mismatch');

  return {
    problems,
    categoriesPresent: [...categoriesPresent],
    agreedCandidateSha: candidateShas.size === 1 ? [...candidateShas][0] : null,
  };
}

/**
 * Combines suite validation with the manifest-identity cross-check and the
 * unhandled-failure check into one smoke-verification readiness verdict.
 * `deploymentCandidateSha` is #2930's manifest `candidateSha` — passed in
 * directly (not imported) per the established JSON-pipeline contract.
 */
export function buildSmokeVerificationReadiness({ records, deploymentCandidateSha, manifestProvided = false }) {
  const { problems, agreedCandidateSha } = validateSmokeTestSuite(records);
  const blockers = [];
  if (problems.length > 0) blockers.push('smoke_suite_incomplete');

  if (manifestProvided && !isNonEmptyString(deploymentCandidateSha)) {
    // A manifest was supplied specifically to prove exact deployed identity
    // against #2930's accepted candidate. Silently skipping that comparison
    // because the manifest omitted candidateSha would let a mismatched or
    // unqualified candidate pass unnoticed — fail closed instead.
    blockers.push('manifest_candidate_sha_missing_or_invalid');
  } else if (
    isNonEmptyString(agreedCandidateSha) &&
    isNonEmptyString(deploymentCandidateSha) &&
    agreedCandidateSha !== deploymentCandidateSha
  ) {
    blockers.push('deployed_candidate_does_not_match_manifest_candidate');
  }

  const unhandledFailures = Array.isArray(records)
    ? records
        .filter((record) => record && typeof record === 'object' && record.result === 'fail')
        .map((record) => (isNonEmptyString(record.category) ? record.category : '(unknown category)'))
    : [];
  if (unhandledFailures.length > 0) blockers.push('critical_smoke_test_failure');

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      suiteProblems: problems,
      agreedDeployedCandidateSha: agreedCandidateSha,
      deploymentCandidateSha: deploymentCandidateSha ?? null,
      manifestProvided,
      unhandledFailureCategories: unhandledFailures,
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
  const recordsFlagPresent = argv.includes('--records');
  const recordsPath = readOptionValue(argv, '--records');
  const manifestFlagPresent = argv.includes('--manifest');
  const manifestPath = readOptionValue(argv, '--manifest');

  if (!recordsFlagPresent || !recordsPath) {
    console.error('FAIL-CLOSED: --records <path> is required.');
    process.exitCode = 1;
    return null;
  }
  if (manifestFlagPresent && !manifestPath) {
    console.error('FAIL-CLOSED: --manifest requires a <path> value when provided — omit the flag entirely if there is none.');
    process.exitCode = 1;
    return null;
  }

  let records;
  let deploymentCandidateSha;
  const manifestProvided = Boolean(manifestPath);
  try {
    records = readJson(recordsPath);
    if (manifestProvided) {
      const manifest = readJson(manifestPath);
      deploymentCandidateSha = manifest && typeof manifest === 'object' ? manifest.candidateSha : undefined;
    }
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const result = buildSmokeVerificationReadiness({ records, deploymentCandidateSha, manifestProvided });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
