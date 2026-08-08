#!/usr/bin/env node
/**
 * #2929 (#2781 Task 004) — deterministic, zero-cost disposition-readiness
 * check for the final rehearsal report.
 *
 * This does NOT decide GO / HOLD / ADJUSTMENT / NO-GO — that is a protected
 * Product Authority decision #2929's human-authored report makes, citing
 * this check's output as supporting evidence. What this script proves,
 * mechanically, is whether the *mechanical preconditions* for citing
 * "complete evidence" are satisfied. It deliberately does not import
 * #2927's `launch_rehearsal_harness.mjs` or #2928's
 * `launch_rehearsal_defect_ledger.mjs` — those ship on separate component-
 * branch PRs and this script instead consumes their JSON *output* as a
 * pipeline contract (run each prior script, feed its result here), the same
 * pattern a real CI pipeline uses between steps:
 *
 *  - `registryResult`: output of #2927's `--mode validate-registry`;
 *  - `evidenceResult`: output of #2927's `--mode evidence-audit`;
 *  - `ledgerResult`: output of #2928's `--mode validate-ledger`;
 *  - `retestResult`: output of #2928's `--mode retest-coverage`;
 *  - `unresolvedProtectedDecisions`: an explicit input list — this script
 *    cannot discover those on its own, only refuse to call the run "ready"
 *    while any exist.
 *
 * Read-only and side-effect free; never performs a live request.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * @param {object} inputs
 * @param {{ ok: boolean }} inputs.registryResult - #2927 `validate-registry` output
 * @param {{ ok: boolean }} inputs.evidenceResult - #2927 `evidence-audit` output
 * @param {{ ok: boolean }} inputs.ledgerResult - #2928 `validate-ledger` output
 * @param {{ ok: boolean }} inputs.retestResult - #2928 `retest-coverage` output
 * @param {string[]} [inputs.unresolvedProtectedDecisions] - explicit list of
 *   still-open protected Product/Production decisions, if any
 * @returns {{ ready: boolean, blockers: string[], detail: object }}
 */
/** True only for a well-formed `{ ok: true, ... }` sub-result — anything else (null, a thrown-away string, `{ ok: false }`, a missing `ok` field) is treated as not-ok rather than dereferenced and thrown on. */
function isOkResult(result) {
  return Boolean(result) && typeof result === 'object' && result.ok === true;
}

export function buildDispositionReadiness({
  registryResult,
  evidenceResult,
  ledgerResult,
  retestResult,
  unresolvedProtectedDecisions = [],
}) {
  const blockers = [];
  if (!isOkResult(registryResult)) blockers.push('journey_registry_invalid');
  if (!isOkResult(evidenceResult)) blockers.push('evidence_incomplete');
  if (!isOkResult(ledgerResult)) blockers.push('defect_ledger_invalid');
  if (!isOkResult(retestResult)) blockers.push('retest_coverage_incomplete');
  if (!Array.isArray(unresolvedProtectedDecisions)) {
    blockers.push('unresolved_protected_decisions_malformed');
  } else if (unresolvedProtectedDecisions.length > 0) {
    blockers.push('unresolved_protected_decisions_present');
  }

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      registryResult,
      evidenceResult,
      ledgerResult,
      retestResult,
      unresolvedProtectedDecisions,
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
  const registryResultPath = readOptionValue(argv, '--registry-result');
  const evidenceResultPath = readOptionValue(argv, '--evidence-result');
  const ledgerResultPath = readOptionValue(argv, '--ledger-result');
  const retestResultPath = readOptionValue(argv, '--retest-result');
  const decisionsFlagPresent = argv.includes('--unresolved-decisions');
  const decisionsPath = readOptionValue(argv, '--unresolved-decisions');

  if (!registryResultPath || !evidenceResultPath || !ledgerResultPath || !retestResultPath) {
    console.error(
      'FAIL-CLOSED: --registry-result, --evidence-result, --ledger-result, and --retest-result are all required ' +
        '(each the JSON output of the corresponding #2927/#2928 harness mode).',
    );
    process.exitCode = 1;
    return null;
  }

  if (decisionsFlagPresent && !decisionsPath) {
    console.error('FAIL-CLOSED: --unresolved-decisions requires a <path> value when provided — omit the flag entirely if there are none.');
    process.exitCode = 1;
    return null;
  }

  let registryResult;
  let evidenceResult;
  let ledgerResult;
  let retestResult;
  let unresolvedProtectedDecisions = [];
  try {
    registryResult = readJson(registryResultPath);
    evidenceResult = readJson(evidenceResultPath);
    ledgerResult = readJson(ledgerResultPath);
    retestResult = readJson(retestResultPath);
    if (decisionsPath) unresolvedProtectedDecisions = readJson(decisionsPath);
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const result = buildDispositionReadiness({
    registryResult,
    evidenceResult,
    ledgerResult,
    retestResult,
    unresolvedProtectedDecisions,
  });
  console.log(JSON.stringify(result, null, 2));
  // Set deterministically (not just on failure) so a successful call after an
  // earlier failing call in the same process — e.g. repeated main() calls in
  // a test run — doesn't inherit a stale non-zero exit code.
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
