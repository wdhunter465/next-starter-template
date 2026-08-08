#!/usr/bin/env node
/**
 * #2927 (#2781 Task 002) — deterministic, zero-cost completeness harness for
 * the launch-rehearsal journey registry.
 *
 * This is the "automation" and "repeatable safe execution path" deliverable
 * for #2927. It never performs a live request against any environment —
 * #2926 (candidate/environment identity) is not yet accepted, so no formal
 * rehearsal execution is authorized here. What it *does* do, deterministically
 * and repeatably:
 *
 *  - validate-registry: every journey in the registry carries all required
 *    #2927 acceptance-criteria fields (expected result, evidence, owner,
 *    privacy control, cleanup, defect routing, execution path), has a
 *    non-empty, unique id, and belongs to one of the approved categories.
 *  - evidence-audit: cross-checks a supplied evidence-log JSON file (one
 *    entry per executed journey id, produced during a *future* formal
 *    rehearsal run under #2928) against the registry, reporting any journey
 *    missing evidence or any evidence entry with no matching registry id.
 *
 * Both modes are read-only and side-effect free.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_JOURNEY_FIELDS = Object.freeze([
  'id',
  'category',
  'name',
  'expectedResult',
  'evidence',
  'owner',
  'privacyControl',
  'cleanup',
  'defectRouting',
  'executionPath',
]);

export const APPROVED_CATEGORIES = Object.freeze([
  'anonymous',
  'membership',
  'fanclub',
  'content',
  'communications',
  'fundraiser',
  'operations',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates one journey entry against the #2927 acceptance-criteria field
 * set. Returns a list of human-readable defect strings (empty = compliant).
 */
export function validateJourney(journey) {
  const defects = [];
  if (!journey || typeof journey !== 'object') {
    return ['journey_not_an_object'];
  }
  for (const field of REQUIRED_JOURNEY_FIELDS) {
    if (!isNonEmptyString(journey[field])) {
      defects.push(`missing_or_empty:${field}`);
    }
  }
  if (isNonEmptyString(journey.category) && !APPROVED_CATEGORIES.includes(journey.category)) {
    defects.push(`unapproved_category:${journey.category}`);
  }
  return defects;
}

/**
 * Validates the full registry: per-journey field completeness plus
 * registry-wide invariants (unique ids, at least one journey per approved
 * category so #2781's "Required journeys" coverage is provable, not assumed).
 */
export function validateRegistry(registry) {
  const journeys = Array.isArray(registry?.journeys) ? registry.journeys : [];
  const perJourney = [];
  const seenIds = new Map();

  for (const journey of journeys) {
    const defects = validateJourney(journey);
    const id = isNonEmptyString(journey?.id) ? journey.id : null;
    if (id) {
      seenIds.set(id, (seenIds.get(id) || 0) + 1);
    }
    perJourney.push({ id: id || '(missing id)', defects });
  }

  const duplicateIds = [...seenIds.entries()].filter(([, count]) => count > 1).map(([id]) => id);

  const coveredCategories = new Set(
    journeys.map((journey) => journey?.category).filter((category) => APPROVED_CATEGORIES.includes(category)),
  );
  const missingCategories = APPROVED_CATEGORIES.filter((category) => !coveredCategories.has(category));

  const journeysWithDefects = perJourney.filter((entry) => entry.defects.length > 0);

  return {
    ok: journeysWithDefects.length === 0 && duplicateIds.length === 0 && missingCategories.length === 0,
    journeyCount: journeys.length,
    journeysWithDefects,
    duplicateIds,
    missingCategories,
  };
}

/**
 * Cross-checks a supplied evidence log (array of `{ journeyId, ... }`
 * entries, or an object keyed by journeyId) against the registry. This is
 * the deterministic check #2929 relies on before it can cite "complete
 * evidence" in its final disposition — it does not itself decide GO/HOLD.
 */
export function auditEvidence(registry, evidenceLog) {
  const journeys = Array.isArray(registry?.journeys) ? registry.journeys : [];
  const journeyIds = new Set(journeys.map((journey) => journey.id).filter(Boolean));

  const evidenceEntries = Array.isArray(evidenceLog)
    ? evidenceLog
    : Object.keys(evidenceLog || {}).map((journeyId) => ({ journeyId, ...evidenceLog[journeyId] }));

  const evidencedIds = new Set(
    evidenceEntries.map((entry) => entry?.journeyId).filter((id) => typeof id === 'string' && id.length > 0),
  );

  const missingEvidence = [...journeyIds].filter((id) => !evidencedIds.has(id)).sort();
  const orphanedEvidence = [...evidencedIds].filter((id) => !journeyIds.has(id)).sort();

  return {
    ok: missingEvidence.length === 0 && orphanedEvidence.length === 0,
    journeyCount: journeyIds.size,
    evidenceCount: evidencedIds.size,
    missingEvidence,
    orphanedEvidence,
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function printResult(mode, result) {
  console.log(JSON.stringify({ mode, ...result }, null, 2));
}

export function main(argv = process.argv.slice(2)) {
  const registryPathIdx = argv.indexOf('--registry');
  const registryPath =
    registryPathIdx >= 0 ? argv[registryPathIdx + 1] : 'docs/ops/reports/launch-rehearsal-journey-registry-2927.json';
  const registry = readJson(registryPath);

  const modeIdx = argv.indexOf('--mode');
  const mode = modeIdx >= 0 ? argv[modeIdx + 1] : 'validate-registry';

  if (mode === 'validate-registry') {
    const result = validateRegistry(registry);
    printResult(mode, result);
    if (!result.ok) process.exitCode = 1;
    return result;
  }

  if (mode === 'evidence-audit') {
    const evidenceIdx = argv.indexOf('--evidence');
    if (evidenceIdx < 0) {
      console.error('FAIL: --evidence <path> is required for evidence-audit mode.');
      process.exitCode = 1;
      return null;
    }
    const evidenceLog = readJson(argv[evidenceIdx + 1]);
    const result = auditEvidence(registry, evidenceLog);
    printResult(mode, result);
    if (!result.ok) process.exitCode = 1;
    return result;
  }

  console.error(`FAIL: unknown --mode "${mode}". Expected validate-registry or evidence-audit.`);
  process.exitCode = 1;
  return null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
