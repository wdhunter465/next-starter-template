#!/usr/bin/env node

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { findUnlistedChangedFiles, parseAllowedFiles } from './pr_hygiene_audit.mjs';
import {
  GitHubInfrastructureError,
  formatAttemptEvidence,
  githubApiFetch,
} from './github_api_retry.mjs';

export const DIFF_SCOPE_MARKER = '<!-- diff-scope-advisory -->';

export function buildDiffScopeReport({ body = '', changedFiles = [] } = {}) {
  const allowedFiles = parseAllowedFiles(body);
  const unlistedChangedFiles = findUnlistedChangedFiles(changedFiles, allowedFiles);

  return {
    gate: 'diff-scope',
    schemaVersion: 1,
    advisory: true,
    allowedFiles,
    changedFiles,
    unlistedChangedFiles,
    hasAllowedFiles: allowedFiles.length > 0,
    ok: allowedFiles.length > 0 && unlistedChangedFiles.length === 0,
  };
}

export function renderDiffScopeReport(report) {
  const lines = ['## Diff Scope Gate', ''];

  if (report.ok) {
    lines.push('All changed files are covered by the PR `Allowed paths:` list.');
    return lines.join('\n');
  }

  if (!report.hasAllowedFiles) {
    lines.push('- Missing or empty `Allowed paths:` list in the PR body.');
  }

  if (report.unlistedChangedFiles.length > 0) {
    lines.push('- Changed files outside declared `Allowed paths:`:');
    for (const file of report.unlistedChangedFiles) {
      lines.push(`  - \`${file}\``);
    }
  }

  return lines.join('\n');
}

export function writeDiffScopeArtifacts(report, env = process.env) {
  const jsonPath = env.DIFF_SCOPE_RESULT_JSON || env.PR_VALIDATION_RESULT_JSON;
  const markdownPath = env.DIFF_SCOPE_RESULT_MD || env.PR_VALIDATION_RESULT_MD;

  if (jsonPath) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  }
  if (markdownPath) {
    fs.writeFileSync(markdownPath, `${renderDiffScopeReport(report)}\n`);
  }
}

function readListFile(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function writeGithubOutput(env, key, value) {
  if (!env.GITHUB_OUTPUT) return;
  const text = String(value ?? '');
  if (text.includes('\n')) {
    const delimiter = `EOF_${key.toUpperCase()}_${Date.now()}`;
    fs.appendFileSync(env.GITHUB_OUTPUT, `${key}<<${delimiter}\n${text}\n${delimiter}\n`);
    return;
  }
  fs.appendFileSync(env.GITHUB_OUTPUT, `${key}=${text}\n`);
}

async function githubJsonRequest({ token, path, method = 'GET', fetchFn, sleepFn, maxRetries }) {
  const { response, bodyText, attemptLog } = await githubApiFetch({
    url: `https://api.github.com${path}`,
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'lgfc-diff-scope-gate',
    },
    maxRetries,
    sleepFn,
    fetchFn,
    pathLabel: path,
  });

  if (attemptLog.length) {
    console.warn(`GitHub API retry evidence for ${method} ${path}:\n${formatAttemptEvidence(attemptLog)}`);
  }

  if (!response.ok) {
    throw new Error(`${method} ${path} failed: ${response.status} ${bodyText || ''}`);
  }

  return response.status === 204 ? null : response.json();
}

async function paginatePullFiles({ token, owner, repo, prNumber, fetchFn, sleepFn, maxRetries }) {
  const files = [];
  let page = 1;

  while (true) {
    const batch = await githubJsonRequest({
      token,
      path: `/repos/${owner}/${repo}/pulls/${prNumber}/files?per_page=100&page=${page}`,
      fetchFn,
      sleepFn,
      maxRetries,
    });
    if (!Array.isArray(batch) || batch.length === 0) break;
    files.push(...batch);
    if (batch.length < 100) break;
    page += 1;
  }

  return files;
}

export async function resolveDiffScopeContext({
  token,
  repository,
  prNumber,
  fetchFn = fetch,
  sleepFn,
  maxRetries = 3,
} = {}) {
  if (!token) throw new Error('GITHUB_TOKEN or GH_TOKEN is required.');
  if (!repository) throw new Error('GITHUB_REPOSITORY is required.');
  if (!prNumber) throw new Error('PR_NUMBER is required.');

  const [owner, repo] = String(repository).split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY: ${repository}`);

  const pull = await githubJsonRequest({
    token,
    path: `/repos/${owner}/${repo}/pulls/${prNumber}`,
    fetchFn,
    sleepFn,
    maxRetries,
  });
  const files = await paginatePullFiles({
    token,
    owner,
    repo,
    prNumber,
    fetchFn,
    sleepFn,
    maxRetries,
  });

  return {
    prNumber: Number(prNumber),
    body: pull.body || '',
    files: files.map((file) => file.filename),
  };
}

export async function runResolveContextCli(env = process.env) {
  const token = env.GITHUB_TOKEN || env.GH_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  const prNumber = env.PR_NUMBER;

  try {
    const context = await resolveDiffScopeContext({
      token,
      repository,
      prNumber,
    });

    const bodyPath = env.DIFF_SCOPE_BODY_FILE || `${env.RUNNER_TEMP || '/tmp'}/pr_body.md`;
    const filesPath = env.DIFF_SCOPE_CHANGED_FILES_FILE || `${env.RUNNER_TEMP || '/tmp'}/pr_changed_files.txt`;
    fs.writeFileSync(bodyPath, `${context.body}\n`);
    fs.writeFileSync(filesPath, `${context.files.join('\n')}${context.files.length ? '\n' : ''}`);

    writeGithubOutput(env, 'pr_number', String(context.prNumber));
    writeGithubOutput(env, 'body_file', bodyPath);
    writeGithubOutput(env, 'files_file', filesPath);

    console.log(`Resolved diff-scope context for PR #${context.prNumber} (${context.files.length} files).`);
    return 0;
  } catch (error) {
    if (error instanceof GitHubInfrastructureError) {
      console.error(`INFRASTRUCTURE_FAILURE classification=${error.classification}`);
      console.error(error.message);
      if (error.attemptLog?.length) {
        console.error(formatAttemptEvidence(error.attemptLog));
      }
      return 1;
    }
    console.error(error);
    return 1;
  }
}

export function runCli(env = process.env) {
  const bodyPath = env.DIFF_SCOPE_BODY_FILE || env.PR_HYGIENE_BODY_FILE;
  const changedFilesPath = env.DIFF_SCOPE_CHANGED_FILES_FILE || env.PR_HYGIENE_CHANGED_FILES_FILE;

  if (!bodyPath || !fs.existsSync(bodyPath)) {
    console.error('DIFF_SCOPE_BODY_FILE or PR_HYGIENE_BODY_FILE is required.');
    return 2;
  }

  const body = fs.readFileSync(bodyPath, 'utf8');
  const changedFiles = readListFile(changedFilesPath);
  const report = buildDiffScopeReport({ body, changedFiles });
  writeDiffScopeArtifacts(report, env);
  console.log(renderDiffScopeReport(report));

  const enforceFailure = (env.DIFF_SCOPE_ENFORCE_FAILURE || 'false') === 'true';
  if (report.ok) return 0;
  return enforceFailure ? 1 : 0;
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  const mode = process.argv[2] || '';
  if (mode === '--resolve-context') {
    process.exitCode = await runResolveContextCli();
  } else {
    process.exitCode = runCli();
  }
}
