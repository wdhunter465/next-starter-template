#!/usr/bin/env node

/**
 * Model C path boundary (#3753)
 *
 * Path-based allowlist / prohibit for documentation-only delivery.
 * Conforms to docs/governance/DELIVERY-AND-RELEASE.md Model C contract (#3752).
 * Does not invent broader write authority than that policy.
 */

import fs from 'node:fs';

/** Approved Model C documentation namespaces (prefix match). */
export const MODEL_C_ALLOWLIST_PREFIXES = [
  'docs/tutorials/',
  'docs/how-to/',
  'docs/reference/',
  'docs/explanation/',
  'docs/governance/',
  'docs/ops/',
  'docs/archive/',
  'docs/templates/',
];

/** Exact exceptional root documentation surfaces (content-only). */
export const MODEL_C_ROOT_EXCEPTIONS = [
  'README.md',
  'LICENSE',
  'LICENSE.md',
  'LICENSE.txt',
  'CHANGELOG',
  'CHANGELOG.md',
  'HISTORY',
  'HISTORY.md',
];

/**
 * Paths that are never Model C eligible (prefix or exact).
 * Extension alone never authorizes Model C.
 */
export const MODEL_C_PROHIBITED_PREFIXES = [
  '.github/workflows/',
  '.github/actions/',
  'scripts/',
  'tests/',
  'test/',
  '__tests__/',
  'migrations/',
  'functions/',
  'workers/',
  'src/',
  'app/',
  'pages/',
  '.app/',
];

export const MODEL_C_PROHIBITED_EXACT = [
  'package.json',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'wrangler.toml',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
];

function normalizePath(filePath = '') {
  return String(filePath || '').replace(/^\.\/+/, '').replace(/\\/g, '/').trim();
}

export function isModelCRootException(filePath) {
  const p = normalizePath(filePath);
  return MODEL_C_ROOT_EXCEPTIONS.includes(p);
}

export function isModelCAllowlistedPath(filePath) {
  const p = normalizePath(filePath);
  if (!p) return false;
  if (isModelCRootException(p)) return true;
  return MODEL_C_ALLOWLIST_PREFIXES.some((prefix) => p.startsWith(prefix));
}

export function isModelCProhibitedPath(filePath) {
  const p = normalizePath(filePath);
  if (!p) return true;
  if (MODEL_C_PROHIBITED_EXACT.includes(p)) return true;
  if (/^wrangler[^/]*\.toml$/.test(p)) return true;
  if (/^\.env(\..+)?$/.test(p)) return true;
  return MODEL_C_PROHIBITED_PREFIXES.some((prefix) => p.startsWith(prefix));
}

/**
 * @param {{ changedFiles?: string[] | null, renames?: Array<{ from: string, to: string }> }} input
 */
export function assessModelCPaths({
  changedFiles,
  renames = [],
} = {}) {
  const errors = [];
  const allowed = [];
  const prohibited = [];

  // Fail closed: missing or empty changed-file evidence is not valid Model C proof.
  if (!Array.isArray(changedFiles) || changedFiles.length === 0) {
    errors.push({
      code: 'missing_changed_files_evidence',
      message: 'Changed-file evidence is required for Model C path boundary checks (missing or empty list fails closed).',
    });
    return { ok: false, errors, allowed, prohibited };
  }

  const files = changedFiles.map(normalizePath).filter(Boolean);
  if (files.length === 0) {
    errors.push({
      code: 'missing_changed_files_evidence',
      message: 'Changed-file evidence is required for Model C path boundary checks (empty after normalize fails closed).',
    });
    return { ok: false, errors, allowed, prohibited };
  }

  for (const file of files) {
    if (isModelCProhibitedPath(file) || !isModelCAllowlistedPath(file)) {
      prohibited.push(file);
      errors.push({
        code: 'model_c_path_prohibited',
        message: `Model C cannot touch path outside approved documentation namespaces: ${file}`,
        path: file,
      });
    } else {
      allowed.push(file);
    }
  }

  for (const rename of renames || []) {
    const from = normalizePath(rename.from);
    const to = normalizePath(rename.to);
    if (!from || !to) continue;
    if (isModelCProhibitedPath(to) || !isModelCAllowlistedPath(to)) {
      errors.push({
        code: 'model_c_cross_boundary_move',
        message: `Model C cannot move/copy documentation into a prohibited or non-allowlisted path: ${from} -> ${to}`,
        from,
        to,
      });
      if (!prohibited.includes(to)) prohibited.push(to);
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    allowed,
    prohibited,
  };
}

export function renderModelCPathReport(result) {
  const lines = [
    'Model C path gate',
    `ok: ${result.ok}`,
    `allowed: ${result.allowed.length}`,
    `prohibited: ${result.prohibited.length}`,
  ];
  for (const err of result.errors || []) {
    lines.push(`- ${err.code}: ${err.message}`);
  }
  return lines.join('\n');
}

function readListFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function readRenamesFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  const raw = fs.readFileSync(filePath, 'utf8').trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function runCli(env = process.env) {
  const changedFiles = readListFile(env.CHANGED_FILES_FILE);
  const renames = readRenamesFile(env.MODEL_C_RENAMES_FILE);
  const result = assessModelCPaths({
    changedFiles: changedFiles === null ? undefined : changedFiles,
    renames,
  });
  console.log(renderModelCPathReport(result));
  if (env.MODEL_C_PATH_RESULT_JSON) {
    fs.writeFileSync(env.MODEL_C_PATH_RESULT_JSON, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
