#!/usr/bin/env node
/**
 * #2930 (#2782 Task 001) — deterministic, zero-cost candidate-manifest and
 * Go/No-Go evidence-completeness harness for the terminal Production
 * deployment project.
 *
 * This does NOT decide Production Go/No-Go — that is Product Authority's
 * decision, made once every prerequisite below is genuinely satisfied. What
 * this proves, mechanically, is whether the manifest cites *something* for
 * every evidence item #2782's own "Go/No-Go evidence: Required" list names,
 * and that no unresolved protected decision remains open. It never performs
 * a live request and never touches Production; it validates a manifest
 * document the operator/executor fills in with real citations.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

/**
 * One field per bullet in #2782's "Go/No-Go evidence: Required" list. Each
 * value must be a non-empty evidence citation (a link, issue/PR reference,
 * or short description) — never a bare boolean — so the manifest cannot
 * claim completeness without pointing at something concrete.
 */
export const REQUIRED_MANIFEST_FIELDS = Object.freeze([
  'candidateSha',
  'sourceIssueAccounting',
  'contract2776Evidence',
  'sequence2777Evidence',
  'productProjectReadiness',
  'contentDataReadiness',
  'complianceReadiness',
  'communicationReadiness',
  'platformReadiness',
  'recoveryReadiness',
  'monitoringReadiness',
  'operatorReadiness',
  'vendorAccountReadiness',
  'program2781GoRecommendation',
  'ciReviewChecksEvidence',
  'cloudflareEnvironmentIdentity',
  'rollbackTargetAndOwner',
  'noOpenLaunchBlockerEvidence',
  'productAuthorityProductionGo',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one manifest object. Returns a list of human-readable problem strings (empty = compliant). */
export function validateManifest(manifest) {
  if (!manifest || typeof manifest !== 'object') {
    return ['manifest_not_an_object'];
  }
  const problems = [];
  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!isNonEmptyString(manifest[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  return problems;
}

/**
 * Combines manifest structural validation with the unresolved-protected-
 * decisions check into one Go/No-Go readiness verdict. Mirrors #2929's
 * `buildDispositionReadiness` shape (`{ ready, blockers, detail }`) so a
 * future orchestration step can treat every stage of this pipeline
 * uniformly, without #2929 needing to import this module directly (same
 * JSON-output pipeline contract used between #2927/#2928/#2929).
 */
export function buildGoNoGoReadiness({ manifest, unresolvedProtectedDecisions = [] }) {
  const problems = validateManifest(manifest);
  const blockers = [];
  if (problems.length > 0) blockers.push('candidate_manifest_incomplete');
  if (!Array.isArray(unresolvedProtectedDecisions)) {
    blockers.push('unresolved_protected_decisions_malformed');
  } else if (unresolvedProtectedDecisions.length > 0) {
    blockers.push('unresolved_protected_decisions_present');
  }

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      manifestProblems: problems,
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
  const manifestPath = readOptionValue(argv, '--manifest');
  const decisionsFlagPresent = argv.includes('--unresolved-decisions');
  const decisionsPath = readOptionValue(argv, '--unresolved-decisions');

  if (!manifestPath) {
    console.error('FAIL-CLOSED: --manifest <path> is required.');
    process.exitCode = 1;
    return null;
  }
  if (decisionsFlagPresent && !decisionsPath) {
    console.error('FAIL-CLOSED: --unresolved-decisions requires a <path> value when provided — omit the flag entirely if there are none.');
    process.exitCode = 1;
    return null;
  }

  let manifest;
  let unresolvedProtectedDecisions = [];
  try {
    manifest = readJson(manifestPath);
    if (decisionsPath) unresolvedProtectedDecisions = readJson(decisionsPath);
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const result = buildGoNoGoReadiness({ manifest, unresolvedProtectedDecisions });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
