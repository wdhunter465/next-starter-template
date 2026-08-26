#!/usr/bin/env node

/**
 * Lightweight Model C post-merge verification (#3753)
 *
 * Confirms documentation-only merge outcomes without Production smoke.
 */

import fs from 'node:fs';
import { assessModelCPaths } from './model_c_path_gate.mjs';
import { auditDiataxisFiles } from './diataxis_folder_audit.mjs';

/**
 * @param {{
 *   changedFiles?: string[],
 *   renames?: Array<{ from: string, to: string }>,
 *   root?: string,
 *   issueClosed?: boolean | null,
 *   prMerged?: boolean | null,
 *   skipDiataxis?: boolean,
 * }} input
 */
export function assessModelCPostMerge({
  changedFiles = [],
  renames = [],
  root = '.',
  issueClosed = null,
  prMerged = null,
  skipDiataxis = false,
} = {}) {
  const errors = [];
  const pathResult = assessModelCPaths({ changedFiles, renames });
  if (!pathResult.ok) {
    errors.push(...pathResult.errors);
  }

  let diataxisFindings = [];
  if (!skipDiataxis) {
    const markdown = (changedFiles || []).filter((f) => /\.md$/i.test(f));
    diataxisFindings = auditDiataxisFiles(markdown, { root });
    for (const finding of diataxisFindings) {
      // Governance / templates / archive / root exceptions are outside strict DIATAXIS knowledge folders.
      if (finding.code === 'OUTSIDE_DIATAXIS_FOLDER') {
        const p = finding.file || '';
        if (
          p.startsWith('docs/governance/')
          || p.startsWith('docs/templates/')
          || p.startsWith('docs/archive/')
          || p === 'README.md'
        ) {
          continue;
        }
      }
      errors.push({
        code: `diataxis_${finding.code}`.toLowerCase(),
        message: `${finding.file}: ${finding.message}`,
        path: finding.file,
      });
    }
  }

  if (prMerged === false) {
    errors.push({
      code: 'pr_not_merged',
      message: 'Expected PR merged state for Model C post-merge verification.',
    });
  }

  // issueClosed is advisory when null; only fail when explicitly false after merge.
  if (prMerged === true && issueClosed === false) {
    errors.push({
      code: 'source_issue_open',
      message: 'Source Issue remains open after Model C merge; closeout evidence incomplete.',
    });
  }

  return {
    ok: errors.length === 0,
    errors,
    pathResult,
    diataxisFindingCount: diataxisFindings.length,
  };
}

export function renderModelCPostMergeReport(result) {
  const lines = [
    'Model C post-merge verification',
    `ok: ${result.ok}`,
    `path ok: ${result.pathResult?.ok}`,
    `diataxis findings considered: ${result.diataxisFindingCount}`,
  ];
  for (const err of result.errors || []) {
    lines.push(`- ${err.code}: ${err.message}`);
  }
  return lines.join('\n');
}

function readListFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return [];
  return fs.readFileSync(filePath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function runCli(env = process.env) {
  const changedFiles = readListFile(env.CHANGED_FILES_FILE);
  const result = assessModelCPostMerge({
    changedFiles,
    root: env.MODEL_C_ROOT || '.',
    issueClosed: env.MODEL_C_ISSUE_CLOSED === 'true' ? true : env.MODEL_C_ISSUE_CLOSED === 'false' ? false : null,
    prMerged: env.MODEL_C_PR_MERGED === 'true' ? true : env.MODEL_C_PR_MERGED === 'false' ? false : null,
    skipDiataxis: env.MODEL_C_SKIP_DIATAXIS === 'true',
  });
  console.log(renderModelCPostMergeReport(result));
  if (env.MODEL_C_POST_MERGE_RESULT_JSON) {
    fs.writeFileSync(env.MODEL_C_POST_MERGE_RESULT_JSON, `${JSON.stringify(result, null, 2)}\n`);
  }
  return result.ok ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
