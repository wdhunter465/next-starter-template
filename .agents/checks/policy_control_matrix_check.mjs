#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// #2821: structural non-hallucination check for the policy-control capability
// matrix. It confirms every Enforced/Verified row cites an evidence path that
// actually exists in the repository - it does not (and cannot) confirm the
// underlying control still behaves as claimed; that stays a reviewer
// responsibility on each update.

export const MATRIX_PATH = 'docs/reference/governance/policy-control-capability-matrix.md';

const CLAIM_STATES = ['Enforced', 'Verified'];
const REQUIRED_COLUMNS = ['Control', 'Domain owner', 'State', 'Evidence', 'Last verified'];

function splitTableRow(line) {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isSeparatorRow(cells) {
  return cells.every((cell) => /^:?-+:?$/.test(cell));
}

// Extracts backtick-quoted repo-relative paths from an evidence cell.
// Evidence cells may cite more than one path (e.g. a script and its test);
// at least one must resolve for the row to pass.
function extractCandidatePaths(evidenceCell) {
  const matches = evidenceCell.match(/`([^`]+)`/g) || [];
  return matches
    .map((m) => m.slice(1, -1))
    .filter((candidate) => /[./]/.test(candidate) && !candidate.includes(' '));
}

// Rejects a candidate (e.g. `../../etc/passwd` or an absolute path) that would
// resolve outside the repository root, so a row can't "pass" by pointing at
// evidence that isn't actually in-repo.
function resolvesWithinRoot(root, candidate) {
  const resolvedRoot = path.resolve(root);
  const resolvedCandidate = path.resolve(root, candidate);
  return resolvedCandidate === resolvedRoot || resolvedCandidate.startsWith(resolvedRoot + path.sep);
}

export function checkPolicyControlMatrix(root) {
  const failures = [];
  const matrixFullPath = path.join(root, MATRIX_PATH);

  if (!fs.existsSync(matrixFullPath)) {
    return [`matrix file is missing: ${MATRIX_PATH}`];
  }

  const lines = fs.readFileSync(matrixFullPath, 'utf8').split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => line.trim().startsWith('| Control |'));

  if (headerIndex === -1) {
    return [`${MATRIX_PATH} is missing the "| Control |" table header`];
  }

  const header = splitTableRow(lines[headerIndex]);
  for (const required of REQUIRED_COLUMNS) {
    if (!header.includes(required)) {
      failures.push(`${MATRIX_PATH} table header is missing required column: ${required}`);
    }
  }

  const separator = lines[headerIndex + 1] ? splitTableRow(lines[headerIndex + 1]) : [];
  if (!separator.length || !isSeparatorRow(separator)) {
    failures.push(`${MATRIX_PATH} table is missing a valid header separator row`);
  }

  const controlIdx = header.indexOf('Control');
  const stateIdx = header.indexOf('State');
  const evidenceIdx = header.indexOf('Evidence');

  // A required column reported missing above means its index is -1; reading
  // rows against that index would throw rather than fail gracefully.
  if (controlIdx === -1 || stateIdx === -1 || evidenceIdx === -1) {
    return failures;
  }

  let rowCount = 0;
  for (let i = headerIndex + 2; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim().startsWith('|')) {
      break;
    }

    const cells = splitTableRow(line);
    if (cells.length !== header.length) {
      failures.push(`${MATRIX_PATH} row ${i + 1} has ${cells.length} columns, expected ${header.length}: ${line.trim()}`);
      continue;
    }

    rowCount += 1;
    const control = cells[controlIdx];
    const state = cells[stateIdx];
    const evidence = cells[evidenceIdx];

    for (const [colName, value] of [['Control', control], ['State', state], ['Evidence', evidence]]) {
      if (!value) {
        failures.push(`${MATRIX_PATH} row "${control || '(unnamed)'}" has an empty required column: ${colName}`);
      }
    }

    const claimsCapability = CLAIM_STATES.some((claim) => state.startsWith(claim));
    if (!claimsCapability) {
      continue;
    }

    const candidates = extractCandidatePaths(evidence);
    if (!candidates.length) {
      failures.push(`${MATRIX_PATH} row "${control}" claims "${state}" but Evidence cites no repository path`);
      continue;
    }

    const anyExists = candidates.some(
      (candidate) => resolvesWithinRoot(root, candidate) && fs.existsSync(path.join(root, candidate)),
    );
    if (!anyExists) {
      failures.push(
        `${MATRIX_PATH} row "${control}" claims "${state}" but none of its cited evidence paths exist: ${candidates.join(', ')}`,
      );
    }
  }

  if (rowCount === 0) {
    failures.push(`${MATRIX_PATH} table has no data rows`);
  }

  return failures;
}

function main(root) {
  const failures = checkPolicyControlMatrix(root);

  if (failures.length > 0) {
    console.error('Policy-control matrix check FAILED.');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Policy-control matrix check PASSED.');
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  main(root);
}
