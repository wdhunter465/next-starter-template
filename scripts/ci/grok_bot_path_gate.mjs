#!/usr/bin/env node
/**
 * Grok Bot documentation-paths gate (#5378).
 *
 * Product Authority's rule for the Documentation maintenance role (#5370): Grok Bot
 * never touches code and never writes to the excluded documents. This is the machine
 * check for that rule. It identifies a Grok Bot pull request by the branch-name agent
 * prefix `grok-bot/` (`docs/governance/DELIVERY-AND-RELEASE.md`, Branch names and the
 * implementing agent), reuses the Model C path rules, and adds the excluded documents.
 *
 * Report-only unless GROK_BOT_PATH_GATE_ENFORCE=true. Making the check required is a
 * branch-protection change that needs Product Authority's explicit Go.
 */
import fs from 'node:fs';
import {
  isModelCAllowlistedPath,
  isModelCProhibitedPath,
} from './model_c_path_gate.mjs';

export const GROK_BOT_BRANCH_PREFIX = 'grok-bot/';

/** Excluded documents that can be named by path (AGENT-TEAM.md, Documentation maintenance). */
export const GROK_BOT_EXCLUDED_PREFIXES = [
  'docs/governance/',
  'docs/ops/ai/',
  '.claude/',
  '.cursor/',
];
export const GROK_BOT_EXCLUDED_EXACT = ['AGENTS.md', 'CLAUDE.md', 'context.md'];

/**
 * The role also excludes "reference contracts that state rules agents must follow".
 * That cannot be decided from a path, so every documentation change under this prefix
 * is listed as an advisory for the verifying agent instead of a violation.
 */
export const GROK_BOT_REFERENCE_PREFIX = 'docs/reference/';

function normalizePath(filePath = '') {
  return String(filePath).trim().replace(/\\/g, '/').replace(/^\.\//, '');
}

export function isGrokBotBranch(headRef) {
  return typeof headRef === 'string' && headRef.startsWith(GROK_BOT_BRANCH_PREFIX);
}

export function isGrokBotExcludedPath(filePath) {
  const p = normalizePath(filePath);
  if (GROK_BOT_EXCLUDED_EXACT.includes(p)) return true;
  return GROK_BOT_EXCLUDED_PREFIXES.some((prefix) => p.startsWith(prefix));
}

function classify(filePath) {
  const p = normalizePath(filePath);
  if (isGrokBotExcludedPath(p)) return 'excluded_document';
  if (isModelCProhibitedPath(p) || !isModelCAllowlistedPath(p)) return 'not_documentation_path';
  return null;
}

/**
 * @param {{ headRef?: string, changedFiles?: string[], renames?: Array<{from:string,to:string}> }} input
 */
export function assessGrokBotPaths({ headRef, changedFiles, renames = [] } = {}) {
  const result = { applies: false, ok: true, violations: [], advisories: [], allowed: [] };
  if (!isGrokBotBranch(headRef)) return result;
  result.applies = true;

  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    result.ok = false;
    result.violations.push({
      code: 'missing_changed_files_evidence',
      message: 'Changed-file evidence is required for a Grok Bot pull request (missing or empty list fails closed).',
    });
    return result;
  }

  for (const raw of changedFiles) {
    const file = normalizePath(raw);
    if (!file) continue;
    const reason = classify(file);
    if (reason) {
      result.violations.push({
        code: reason,
        path: file,
        message: reason === 'excluded_document'
          ? `Grok Bot never writes to an excluded document: ${file}`
          : `Grok Bot pull requests may contain documentation files only: ${file}`,
      });
      continue;
    }
    result.allowed.push(file);
    if (file.startsWith(GROK_BOT_REFERENCE_PREFIX)) {
      result.advisories.push({
        code: 'reference_contract_check',
        path: file,
        message: `Verifying agent: confirm ${file} is not a reference contract that states rules agents must follow.`,
      });
    }
  }

  for (const rename of renames || []) {
    const from = normalizePath(rename?.from);
    const to = normalizePath(rename?.to);
    if (!from || !to) continue;
    const bad = classify(to) || classify(from);
    if (bad) {
      result.violations.push({
        code: 'cross_boundary_move',
        path: to,
        message: `Grok Bot cannot move or copy a file across the documentation boundary: ${from} -> ${to}`,
      });
    }
  }

  result.ok = result.violations.length === 0;
  return result;
}

export function renderGrokBotReport(result, { enforce = false } = {}) {
  if (!result.applies) {
    return '## Grok Bot path gate\n\nNot a Grok Bot pull request (branch prefix is not `grok-bot/`). Skipped.\n';
  }
  const lines = [
    '## Grok Bot path gate',
    '',
    `Mode: ${enforce ? 'enforcing' : 'report-only'}`,
    `Result: ${result.ok ? 'PASS' : 'FAIL'}`,
    '',
  ];
  if (result.violations.length) {
    lines.push('### Violations', '');
    for (const v of result.violations) lines.push(`- ${v.message}`);
    lines.push('');
  }
  if (result.advisories.length) {
    lines.push('### For the verifying agent', '');
    for (const a of result.advisories) lines.push(`- ${a.message}`);
    lines.push('');
  }
  if (result.ok && !result.advisories.length) lines.push('Every changed path is an allowed documentation path.', '');
  return lines.join('\n');
}

/** Escape text for a GitHub Actions workflow command so a path or ref cannot inject one. */
export function escapeAnnotation(value) {
  return String(value).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
}

function readList(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return undefined;
  return fs.readFileSync(filePath, 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
}

export function runCli(env = process.env) {
  const enforce = String(env.GROK_BOT_PATH_GATE_ENFORCE || '').toLowerCase() === 'true';
  const result = assessGrokBotPaths({
    headRef: env.PR_HEAD_REF,
    changedFiles: readList(env.CHANGED_FILES_FILE),
  });
  const report = renderGrokBotReport(result, { enforce });
  console.log(report);
  if (env.GITHUB_STEP_SUMMARY) fs.appendFileSync(env.GITHUB_STEP_SUMMARY, `${report}\n`);
  if (result.applies) {
    const level = enforce ? 'error' : 'warning';
    for (const v of result.violations) {
      console.log(`::${level} title=Grok Bot path gate::${escapeAnnotation(v.message)}`);
    }
  }
  if (!result.applies || result.ok) return 0;
  return enforce ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
