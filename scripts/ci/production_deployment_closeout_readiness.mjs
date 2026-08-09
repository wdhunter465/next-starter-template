#!/usr/bin/env node
/**
 * #2933 (#2782 Task 004) — deterministic, zero-cost verification,
 * stabilization, acceptance, Day-2 transfer, and closeout readiness harness
 * for the terminal Production deployment project.
 *
 * Validates a closeout record against #2933's acceptance criteria (public
 * behavior matches acceptance, no unresolved launch blocker remains,
 * recovery and monitoring are active, Product acceptance and Day-2
 * ownership are recorded, Issue/PR/release evidence is consistent) and
 * cross-checks that #2932's smoke-verification result was itself `ready`
 * before closeout can be declared — accepted deployment evidence, not a
 * hopeful restatement of it, is what closeout is allowed to build on. Never
 * performs a live request, never touches Production. Reads #2932's
 * smoke-verification JSON as a pipeline input (same contract used between
 * #2927-#2932) rather than importing that module directly.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_CLOSEOUT_FIELDS = Object.freeze([
  'publicBehaviorAcceptanceEvidence',
  'noOpenLaunchBlockerEvidence',
  'recoveryActiveEvidence',
  'monitoringActiveEvidence',
  'productAcceptanceEvidence',
  'day2OwnershipEvidence',
  'issuePrReleaseEvidenceConsistency',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isOkResult(result) {
  return Boolean(result) && typeof result === 'object' && result.ready === true;
}

/** Validates one closeout record. Returns a list of human-readable problem strings (empty = compliant). */
export function validateCloseoutRecord(closeout) {
  if (!closeout || typeof closeout !== 'object' || Array.isArray(closeout)) {
    return ['closeout_not_an_object'];
  }
  const problems = [];
  for (const field of REQUIRED_CLOSEOUT_FIELDS) {
    if (!isNonEmptyString(closeout[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  return problems;
}

/**
 * Combines closeout structural validation with #2932's smoke-verification
 * readiness result and the unresolved-protected-decisions check into one
 * closeout verdict. Mirrors #2929/#2930/#2931's `{ ready, blockers, detail }`
 * contract shape so a future orchestration step can treat every stage of
 * this pipeline uniformly.
 */
export function buildCloseoutReadiness({ closeout, smokeVerificationResult, unresolvedProtectedDecisions = [] }) {
  const problems = validateCloseoutRecord(closeout);
  const blockers = [];
  if (problems.length > 0) blockers.push('closeout_incomplete');

  if (!isOkResult(smokeVerificationResult)) {
    // Closeout cannot declare deployment accepted on the strength of its own
    // narrative — it must point at a smoke-verification result that was
    // itself ready. A missing, malformed, or not-ready upstream result fails
    // closed rather than being silently treated as "presumably fine".
    blockers.push('smoke_verification_not_ready');
  }

  const decisionsIsArray = Array.isArray(unresolvedProtectedDecisions);
  if (!decisionsIsArray) {
    blockers.push('unresolved_protected_decisions_malformed');
  } else if (unresolvedProtectedDecisions.length > 0) {
    blockers.push('unresolved_protected_decisions_present');
  }

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      closeoutProblems: problems,
      smokeVerificationReady: isOkResult(smokeVerificationResult),
      unresolvedProtectedDecisions: decisionsIsArray ? unresolvedProtectedDecisions : [],
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
  const closeoutFlagPresent = argv.includes('--closeout');
  const closeoutPath = readOptionValue(argv, '--closeout');
  const smokeResultFlagPresent = argv.includes('--smoke-result');
  const smokeResultPath = readOptionValue(argv, '--smoke-result');
  const decisionsFlagPresent = argv.includes('--unresolved-decisions');
  const decisionsPath = readOptionValue(argv, '--unresolved-decisions');

  if (!closeoutFlagPresent || !closeoutPath) {
    console.error('FAIL-CLOSED: --closeout <path> is required.');
    process.exitCode = 1;
    return null;
  }
  if (!smokeResultFlagPresent || !smokeResultPath) {
    console.error('FAIL-CLOSED: --smoke-result <path> is required.');
    process.exitCode = 1;
    return null;
  }
  if (decisionsFlagPresent && !decisionsPath) {
    console.error('FAIL-CLOSED: --unresolved-decisions requires a <path> value when provided — omit the flag entirely if there are none.');
    process.exitCode = 1;
    return null;
  }

  let closeout;
  let smokeVerificationResult;
  let unresolvedProtectedDecisions = [];
  try {
    closeout = readJson(closeoutPath);
    smokeVerificationResult = readJson(smokeResultPath);
    if (decisionsPath) unresolvedProtectedDecisions = readJson(decisionsPath);
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const result = buildCloseoutReadiness({ closeout, smokeVerificationResult, unresolvedProtectedDecisions });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
