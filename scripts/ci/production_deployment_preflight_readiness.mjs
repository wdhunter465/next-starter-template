#!/usr/bin/env node
/**
 * #2931 (#2782 Task 002) — deterministic, zero-cost preflight-readiness
 * harness for the terminal Production deployment project.
 *
 * Validates that a preflight record names every element #2931's objective
 * requires (change window, executor/verifier roles, preflight evidence,
 * communications, credential boundary, smoke/complete test plans, stop
 * triggers, rollback candidate, recovery owner) and — the one cross-checked
 * invariant this script enforces — that the rollback candidate is not the
 * same SHA as the candidate actually being deployed (#2930's manifest
 * `candidateSha`). A rollback target identical to the deployment candidate
 * cannot recover anything; #2931's acceptance criterion "deployment can be
 * ... stopped deterministically ... without ... improvising an untested
 * recovery path" requires a genuinely distinct, already-qualified target.
 *
 * Never performs a live request, never touches Production. Reads #2930's
 * manifest JSON as a pipeline input (same contract used between
 * #2927/#2928/#2929) rather than importing that module directly.
 */

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

export const REQUIRED_PREFLIGHT_FIELDS = Object.freeze([
  'changeWindowStart',
  'changeWindowEnd',
  'executorRole',
  'verifierRole',
  'preflightChecklistEvidence',
  'communicationPlan',
  'credentialBoundaryStatement',
  'smokeTestPlan',
  'completeVerificationPlan',
  'stopTriggers',
  'rollbackCandidateSha',
  'recoveryOwner',
]);

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validates one preflight record. Returns a list of human-readable problem strings (empty = compliant). */
export function validatePreflightRecord(preflight) {
  if (!preflight || typeof preflight !== 'object') {
    return ['preflight_not_an_object'];
  }
  const problems = [];
  for (const field of REQUIRED_PREFLIGHT_FIELDS) {
    if (!isNonEmptyString(preflight[field])) {
      problems.push(`missing_or_empty:${field}`);
    }
  }
  return problems;
}

/**
 * Combines preflight structural validation with the rollback-distinctness
 * invariant into one deployment-readiness verdict. `deploymentCandidateSha`
 * is #2930's manifest `candidateSha` — passed in directly (not imported)
 * per the established JSON-pipeline contract between these harnesses.
 */
export function buildDeploymentReadiness({ preflight, deploymentCandidateSha }) {
  const problems = validatePreflightRecord(preflight);
  const blockers = [];
  if (problems.length > 0) blockers.push('preflight_incomplete');

  const rollbackSha = preflight && typeof preflight === 'object' ? preflight.rollbackCandidateSha : undefined;
  if (
    isNonEmptyString(rollbackSha) &&
    isNonEmptyString(deploymentCandidateSha) &&
    rollbackSha === deploymentCandidateSha
  ) {
    blockers.push('rollback_candidate_same_as_deployment_candidate');
  }

  return {
    ready: blockers.length === 0,
    blockers,
    detail: {
      preflightProblems: problems,
      deploymentCandidateSha: deploymentCandidateSha ?? null,
      rollbackCandidateSha: rollbackSha ?? null,
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
  const preflightPath = readOptionValue(argv, '--preflight');
  const manifestPath = readOptionValue(argv, '--manifest');

  if (!preflightPath) {
    console.error('FAIL-CLOSED: --preflight <path> is required.');
    process.exitCode = 1;
    return null;
  }

  let preflight;
  let deploymentCandidateSha;
  try {
    preflight = readJson(preflightPath);
    if (manifestPath) {
      const manifest = readJson(manifestPath);
      deploymentCandidateSha = manifest && typeof manifest === 'object' ? manifest.candidateSha : undefined;
    }
  } catch (error) {
    console.error(`FAIL-CLOSED: ${error.message}`);
    process.exitCode = 1;
    return null;
  }

  const result = buildDeploymentReadiness({ preflight, deploymentCandidateSha });
  console.log(JSON.stringify(result, null, 2));
  process.exitCode = result.ready ? 0 : 1;
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
