#!/usr/bin/env node
/**
 * #2928 (#2781 Task 003) — deterministic, zero-cost defect-ledger and
 * retest-coverage harness for the formal launch rehearsal.
 *
 * Like #2927's `launch_rehearsal_harness.mjs`, this never performs a live
 * request or touches any environment — #2926's candidate/environment
 * identity is not yet accepted, so no formal rehearsal has run. What this
 * *does* do, deterministically and repeatably, once #2928 formally executes
 * a rehearsal and produces real evidence/defect data:
 *
 *  - validate-ledger: every defect record carries the fields #2928's
 *    acceptance criteria require (severity, disposition, owner, summary,
 *    evidence linkage) and uses only the approved severity/disposition
 *    vocabulary.
 *  - retest-coverage: cross-checks a defect ledger against an #2927-style
 *    evidence log, proving every `fail` evidence entry has a matching
 *    defect record, and every defect marked `requires-retest` has a later
 *    passing evidence entry for the same journey on an explicitly
 *    different (requalified) candidate SHA — never against the same SHA
 *    ("no candidate drift is hidden" per #2928's acceptance criteria; a
 *    retest against an unchanged SHA is exactly the hidden-drift failure
 *    mode this check exists to catch).
 *
 * Both modes are read-only and side-effect free.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const DEFECT_SEVERITIES = Object.freeze(['launch-blocker', 'major', 'minor']);

/**
 * `resolved` / `formally-dispositioned-accepted-risk` are terminal — no
 * further rehearsal action required, but must cite evidence. `requires-retest`
 * is non-terminal and drives the retest-coverage check. `deferred-with-owner`
 * is non-terminal and explicit per #2781's "explicit deferred/fallback
 * dispositions" requirement — it must name an accountable owner.
 */
export const DEFECT_DISPOSITIONS = Object.freeze([
  'resolved',
  'formally-dispositioned-accepted-risk',
  'requires-retest',
  'deferred-with-owner',
]);

const REQUIRED_DEFECT_FIELDS = Object.freeze(['id', 'journeyId', 'severity', 'summary', 'disposition', 'candidateSha']);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates one defect record. Returns a list of human-readable defect
 * strings describing what is wrong with the *record itself* (empty = compliant).
 */
export function validateDefectRecord(defect) {
  const problems = [];
  if (!defect || typeof defect !== 'object') {
    return ['defect_not_an_object'];
  }
  for (const field of REQUIRED_DEFECT_FIELDS) {
    if (!isNonEmptyString(defect[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  if (isNonEmptyString(defect.severity) && !DEFECT_SEVERITIES.includes(defect.severity)) {
    problems.push(`unapproved_severity:${defect.severity}`);
  }
  if (isNonEmptyString(defect.disposition) && !DEFECT_DISPOSITIONS.includes(defect.disposition)) {
    problems.push(`unapproved_disposition:${defect.disposition}`);
  }
  if ((defect.disposition === 'resolved' || defect.disposition === 'formally-dispositioned-accepted-risk') && !isNonEmptyString(defect.evidenceRef)) {
    problems.push('resolved_or_accepted_defect_missing_evidenceRef');
  }
  if (defect.disposition === 'deferred-with-owner' && !isNonEmptyString(defect.deferredOwner)) {
    problems.push('deferred_defect_missing_deferredOwner');
  }
  return problems;
}

/** Validates every record in a defect ledger array. */
export function validateLedger(ledger) {
  const defects = Array.isArray(ledger?.defects) ? ledger.defects : [];
  const perDefect = defects.map((defect) => ({
    id: isNonEmptyString(defect?.id) ? defect.id : '(missing id)',
    problems: validateDefectRecord(defect),
  }));
  const defectsWithProblems = perDefect.filter((entry) => entry.problems.length > 0);
  return {
    ok: defectsWithProblems.length === 0,
    defectCount: defects.length,
    defectsWithProblems,
  };
}

/**
 * Cross-checks a defect ledger against an #2927-style evidence log.
 * `evidenceLog` is the same array-or-object-keyed shape `auditEvidence` in
 * `launch_rehearsal_harness.mjs` accepts, but here every entry must also
 * carry `result` ('pass' | 'fail') and `candidateSha` for retest-coverage
 * to be checkable.
 */
export function auditRetestCoverage(evidenceLog, ledger) {
  const entries = Array.isArray(evidenceLog)
    ? evidenceLog
    : Object.keys(evidenceLog || {}).map((journeyId) => ({
        journeyId,
        ...(evidenceLog[journeyId] && typeof evidenceLog[journeyId] === 'object' ? evidenceLog[journeyId] : {}),
      }));

  const failingEntries = entries.filter((entry) => entry?.result === 'fail' && isNonEmptyString(entry?.journeyId));
  const defects = Array.isArray(ledger?.defects) ? ledger.defects : [];

  const missingDefectRecord = failingEntries
    .filter((entry) => !defects.some((defect) => defect.journeyId === entry.journeyId && defect.candidateSha === entry.candidateSha))
    .map((entry) => `${entry.journeyId}@${entry.candidateSha || '(unknown-sha)'}`)
    .sort();

  const requiresRetest = defects.filter((defect) => defect.disposition === 'requires-retest');

  const uncoveredRetests = requiresRetest
    .filter((defect) => {
      const laterPass = entries.some(
        (entry) =>
          entry?.journeyId === defect.journeyId &&
          entry?.result === 'pass' &&
          isNonEmptyString(entry?.candidateSha) &&
          entry.candidateSha !== defect.candidateSha,
      );
      return !laterPass;
    })
    .map((defect) => defect.id)
    .sort();

  return {
    ok: missingDefectRecord.length === 0 && uncoveredRetests.length === 0,
    failingEvidenceCount: failingEntries.length,
    defectCount: defects.length,
    missingDefectRecord,
    uncoveredRetests,
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

function printResult(mode, result) {
  console.log(JSON.stringify({ mode, ...result }, null, 2));
}

export function main(argv = process.argv.slice(2)) {
  const mode = readOptionValue(argv, '--mode') || 'validate-ledger';
  const ledgerPath = readOptionValue(argv, '--ledger');

  if (!ledgerPath) {
    console.error('FAIL-CLOSED: --ledger <path> is required.');
    process.exitCode = 1;
    return null;
  }

  let ledger;
  try {
    ledger = readJson(ledgerPath);
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  if (mode === 'validate-ledger') {
    const result = validateLedger(ledger);
    printResult(mode, result);
    if (!result.ok) process.exitCode = 1;
    return result;
  }

  if (mode === 'retest-coverage') {
    const evidencePath = readOptionValue(argv, '--evidence');
    if (!evidencePath) {
      console.error('FAIL-CLOSED: --evidence <path> is required for retest-coverage mode.');
      process.exitCode = 1;
      return null;
    }
    let evidenceLog;
    try {
      evidenceLog = readJson(evidencePath);
    } catch (error) {
      console.error(`FAIL-CLOSED: ${error.message}`);
      process.exitCode = 1;
      return null;
    }
    const result = auditRetestCoverage(evidenceLog, ledger);
    printResult(mode, result);
    if (!result.ok) process.exitCode = 1;
    return result;
  }

  console.error(`FAIL-CLOSED: unknown --mode "${mode}". Expected validate-ledger or retest-coverage.`);
  process.exitCode = 1;
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
