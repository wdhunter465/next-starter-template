#!/usr/bin/env node
/**
 * Unit tests for orchestrator preflight duplicate-detection helpers.
 * Run with: node scripts/orchestrator/test-preflight.mjs
 * (re-triggered for CI)
 */

import {
  normalizeTitle,
  isDuplicateOrSupersededIssueBody,
  issuePreflightResult
} from './create-issues.mjs';

import {
  isDuplicateIssueBody,
  issuePrSearchQuery,
  existingMergedPrForIssue
} from './create-draft-pr.mjs';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed += 1;
  } else {
    console.log(`  PASS: ${message}`);
    passed += 1;
  }
}

// ─── normalizeTitle ──────────────────────────────────────────────────────────
console.log('\nnormalizeTitle');
assert(normalizeTitle('Hello World') === 'hello-world', 'lowercases and hyphenates spaces');
assert(normalizeTitle('[Task-001] Fix: the bug!') === 'task-001-fix-the-bug', 'strips brackets, colons, exclamation');
assert(normalizeTitle('  leading/trailing  ') === 'leading-trailing', 'trims leading/trailing hyphens');
assert(normalizeTitle('UPPERCASE') === 'uppercase', 'lowercases');
assert(normalizeTitle('multiple   spaces') === 'multiple-spaces', 'collapses spaces');

// ─── isDuplicateOrSupersededIssueBody ────────────────────────────────────────
console.log('\nisDuplicateOrSupersededIssueBody');
assert(isDuplicateOrSupersededIssueBody('Duplicate of Issue #42'), 'detects Duplicate of Issue #N');
assert(isDuplicateOrSupersededIssueBody('Duplicate of #42'), 'detects Duplicate of #N');
assert(isDuplicateOrSupersededIssueBody('This was closed as duplicate'), 'detects closed as duplicate');
assert(isDuplicateOrSupersededIssueBody('Superseded by Issue #100'), 'detects superseded by');
assert(isDuplicateOrSupersededIssueBody('DUPLICATE OF #1'), 'case insensitive');
assert(!isDuplicateOrSupersededIssueBody('Normal issue body'), 'non-duplicate body returns false');
assert(!isDuplicateOrSupersededIssueBody(null), 'null body returns false');
assert(!isDuplicateOrSupersededIssueBody(''), 'empty body returns false');

// ─── issuePreflightResult ────────────────────────────────────────────────────
console.log('\nissuePreflightResult');
assert(issuePreflightResult(null).action === 'create', 'no existing issue => create');

assert(
  issuePreflightResult({ state: 'OPEN', number: 5, body: '', labels: [] }).action === 'reuse',
  'open issue => reuse'
);
assert(
  issuePreflightResult({ state: 'OPEN', number: 5, body: '', labels: [] }).number === 5,
  'reuse carries correct number'
);

assert(
  issuePreflightResult({ state: 'CLOSED', number: 6, body: 'Duplicate of #1', labels: [] }).action === 'blocked-duplicate',
  'closed duplicate => blocked-duplicate'
);

assert(
  issuePreflightResult({
    state: 'CLOSED',
    number: 7,
    body: '',
    labels: [{ name: 'status:complete' }]
  }).action === 'blocked-complete',
  'closed complete => blocked-complete'
);

assert(
  issuePreflightResult({ state: 'CLOSED', number: 8, body: '', labels: [] }).action === 'create',
  'closed non-complete non-duplicate => create (reopen allowed)'
);

// ─── isDuplicateIssueBody (create-draft-pr) ──────────────────────────────────
console.log('\nisDuplicateIssueBody (create-draft-pr)');
assert(isDuplicateIssueBody('Duplicate of #5'), 'detects duplicate marker');
assert(isDuplicateIssueBody('closed as duplicate'), 'detects closed as duplicate');
assert(!isDuplicateIssueBody('Normal body'), 'non-duplicate returns false');

// ─── issuePrSearchQuery ──────────────────────────────────────────────────────
console.log('\nissuePrSearchQuery');
const q = issuePrSearchQuery(42);
assert(q.includes('"orchestrator-source-issue: 42"'), 'includes orchestrator-source-issue marker');
assert(q.includes('"- **Issue:** #42"'), 'includes Issue: #N marker');

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
