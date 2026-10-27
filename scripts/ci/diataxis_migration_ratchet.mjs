#!/usr/bin/env node

import fs from 'node:fs';

export const RATCHET_MARKER = '<!-- diataxis-migration-ratchet-advisory -->';
export const DEFAULT_DISPOSITION_MAP_PATH = 'docs/reference/diataxis/two-model-authority-disposition-map.md';

export const DISPOSITION_ACTIONS = new Set([
  'retain',
  'consolidate',
  'migrate',
  'archive',
  'supersede',
  'delete',
]);

const HEADER_FENCE_PATTERN = /^---\n[\s\S]*?\n---\n([\s\S]*)$/;
const PATH_IN_BACKTICKS = /`((?:docs|\.github|scripts)[^`]+)`/g;
const LEGACY_PATH_PATTERN = /^(docs\/(?:governance|ops|reference|how-to)\/|docs\/archive\/)/;

function readListFile(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function readOptionalFile(path, root = '.') {
  const fullPath = `${root}/${path}`.replace(/\/\.\//g, '/');
  if (!fs.existsSync(fullPath)) return null;
  return fs.readFileSync(fullPath, 'utf8');
}

function normalizeAction(rawAction = '') {
  const cleaned = String(rawAction || '')
    .replace(/\([^)]*\)/g, '')
    .trim()
    .toLowerCase();
  for (const action of DISPOSITION_ACTIONS) {
    if (cleaned === action || cleaned.startsWith(`${action} `)) {
      return action;
    }
  }
  return cleaned;
}

function extractPathFromCell(cell = '') {
  const match = String(cell).match(/`([^`]+)`/);
  return match ? match[1].trim() : '';
}

function splitReferenceScope(scope = '', entryPath = '') {
  return String(scope || '')
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => (part.toLowerCase() === 'self' ? entryPath : part));
}

export function parseDispositionMap(content = '') {
  const entries = [];
  const lines = String(content).split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith('| `')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 6) continue;

    const path = extractPathFromCell(cells[0]);
    if (!path) continue;

    entries.push({
      path,
      currentOwner: cells[1] || '',
      targetOwner: cells[2] || '',
      action: normalizeAction(cells[3]),
      replacementNotes: cells[4] || '',
      referenceUpdateScope: cells[5] || '',
    });
  }

  return entries;
}

/** Folder row: path ends with `/`. Coverage only. Migration checks stay exact-path. */
export function isAreaDispositionRow(entry) {
  return typeof entry?.path === 'string' && entry.path.endsWith('/');
}

export function fileCoveredByDisposition(filePath, entries = []) {
  const normalized = String(filePath || '').replace(/^\.\//, '');
  return entries.some((entry) => {
    if (!entry?.path) return false;
    if (entry.path === normalized) return true;
    return isAreaDispositionRow(entry) && normalized.startsWith(entry.path);
  });
}

export function listUnmatchedDocFiles(files = [], entries = []) {
  return files
    .map((file) => String(file).replace(/^\.\//, ''))
    .filter((file) => file.startsWith('docs/') && file.endsWith('.md'))
    .filter((file) => !fileCoveredByDisposition(file, entries))
    .sort();
}

export function loadDispositionMap({ root = '.', mapPath = DEFAULT_DISPOSITION_MAP_PATH } = {}) {
  const content = readOptionalFile(mapPath, root);
  return content ? parseDispositionMap(content) : [];
}

export function stripAuthorityHeader(content = '') {
  const match = String(content).match(HEADER_FENCE_PATTERN);
  return match ? match[1].trim() : String(content).trim();
}

export function isHeaderOnlyChange(before = '', after = '') {
  if (before === after) return false;
  return stripAuthorityHeader(before) === stripAuthorityHeader(after);
}

export function isLegacyAuthorityPath(path = '') {
  return LEGACY_PATH_PATTERN.test(String(path || ''));
}

export function isEmergencyRecovery(body = '') {
  const text = String(body || '');
  return /Delivery model:\s*emergency-recovery/i.test(text)
    || /Change mode:\s*emergency/i.test(text)
    || /Gate profile:\s*emergency-recovery/i.test(text);
}

export function hasMandatoryFollowUp(body = '') {
  const text = String(body || '');
  return /Follow-up issue required:\s*YES/i.test(text)
    && /(?:Follow-up issue|follow-up issue)[^#\r\n]*#\d+/i.test(text);
}

export function extractReplacementTargets(entry = {}) {
  const targets = new Set();
  for (const match of String(entry.replacementNotes || '').matchAll(PATH_IN_BACKTICKS)) {
    targets.add(match[1]);
  }
  return [...targets];
}

export function referencesLegacyPath(content = '', legacyPath = '') {
  if (!content || !legacyPath) return false;
  const escaped = legacyPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const activePattern = new RegExp(`(?<!superseded[^\\n]{0,80})${escaped}`, 'i');
  return activePattern.test(content);
}

export function hasSupersededMarker(content = '') {
  return /Authority Level:\s*Superseded/i.test(content)
    || /\*\*Superseded/i.test(content)
    || /^Status:\s*\*\*Superseded/i.test(content);
}

export function normalizeChangedFiles(changedFiles = []) {
  return changedFiles.map((item) => {
    if (typeof item === 'string') {
      return { path: item, status: 'modified' };
    }
    return {
      path: item.path,
      status: item.status || 'modified',
    };
  }).filter((item) => item.path);
}

function buildFinding({ file, code, message, correction, severity = 'error' }) {
  return { file, code, message, correction, severity };
}

function evaluateReferenceUpdates(entry, ctx) {
  const findings = [];
  const scopeTargets = splitReferenceScope(entry.referenceUpdateScope, entry.path);
  if (scopeTargets.length === 0) return findings;

  const changedSet = new Set(ctx.changedPaths);
  const unresolvedScopes = [];

  for (const scopeTarget of scopeTargets) {
    const matchingPaths = Object.keys(ctx.fileSnapshots).filter((filePath) => (
      filePath === scopeTarget
      || filePath.endsWith(`/${scopeTarget}`)
      || filePath.includes(scopeTarget.replace(/^`|`$/g, ''))
    ));

    if (matchingPaths.length === 0) {
      unresolvedScopes.push(scopeTarget);
      continue;
    }

    for (const filePath of matchingPaths) {
      const snapshot = ctx.fileSnapshots[filePath];
      const after = snapshot?.after ?? '';
      if (!changedSet.has(filePath) && referencesLegacyPath(after, entry.path)) {
        findings.push(buildFinding({
          file: filePath,
          code: 'STALE_REFERENCE',
          message: `Active reference to ${entry.path} remains after legacy document was touched.`,
          correction: `Update references in ${filePath} per disposition scope: ${entry.referenceUpdateScope}.`,
        }));
      }
      if (changedSet.has(filePath) && referencesLegacyPath(after, entry.path) && !hasSupersededMarker(after)) {
        findings.push(buildFinding({
          file: filePath,
          code: 'STALE_REFERENCE',
          message: `Touched reference file still routes to ${entry.path} without supersession.`,
          correction: `Replace active routing to ${entry.path} or mark the source superseded.`,
        }));
      }
    }
  }

  if (unresolvedScopes.length > 0 && !ctx.changedPaths.some((filePath) => (
    unresolvedScopes.some((scopeTarget) => filePath.includes(scopeTarget))
  ))) {
    findings.push(buildFinding({
      file: entry.path,
      code: 'REFERENCE_SCOPE_NOT_UPDATED',
      message: `Required reference-update scope was not touched: ${entry.referenceUpdateScope}.`,
      correction: 'Update every file listed in the disposition reference-update scope.',
    }));
  }

  return findings;
}

function evaluateActionCompletion(entry, ctx) {
  const { path } = entry;
  const changedSet = new Set(ctx.changedPaths);
  const snapshot = ctx.fileSnapshots[path] || {};
  const status = ctx.statusByPath.get(path) || 'modified';
  const action = entry.action;

  if (ctx.emergencyDeferral) {
    return [buildFinding({
      file: path,
      code: 'EMERGENCY_DEFERRAL',
      message: 'Legacy migration deferred under emergency recovery with mandatory follow-up.',
      correction: 'Complete DIATAXIS disposition in the linked follow-up issue before closing recovery work.',
      severity: 'warning',
    })];
  }

  if (action === 'delete') {
    if (status !== 'deleted') {
      return [buildFinding({
        file: path,
        code: 'DISPOSITION_INCOMPLETE',
        message: 'Delete disposition requires removing the legacy document from the active tree.',
        correction: 'Delete the legacy file or record an approved emergency deferral.',
      })];
    }
    return [];
  }

  if (action === 'archive') {
    const archivePath = ctx.changedPaths.find((filePath) => (
      filePath.startsWith('docs/archive/') && filePath.endsWith(path.split('/').pop())
    ));
    if (!archivePath && status !== 'deleted') {
      return [buildFinding({
        file: path,
        code: 'DISPOSITION_INCOMPLETE',
        message: 'Archive disposition requires moving the document under docs/archive/.',
        correction: 'Move the legacy document into docs/archive/ and remove active routing.',
      })];
    }
    return evaluateReferenceUpdates(entry, ctx);
  }

  if (action === 'supersede') {
    const after = snapshot.after ?? '';
    if (!hasSupersededMarker(after)) {
      return [buildFinding({
        file: path,
        code: 'DISPOSITION_INCOMPLETE',
        message: 'Supersede disposition requires an explicit superseded marker and inactive routing.',
        correction: 'Mark the document superseded and remove competing active authority.',
      })];
    }
    return evaluateReferenceUpdates(entry, ctx);
  }

  if (action === 'migrate' || action === 'consolidate') {
    const targets = extractReplacementTargets(entry);
    const targetTouched = targets.some((target) => changedSet.has(target));
    const sourceRetired = status === 'deleted' || hasSupersededMarker(snapshot.after ?? '');

    if (!targetTouched || !sourceRetired) {
      return [buildFinding({
        file: path,
        code: 'DISPOSITION_INCOMPLETE',
        message: `${action} disposition requires a replacement target and retiring the source path.`,
        correction: `Touch the replacement path (${targets.join(', ') || 'see disposition map'}) and supersede or remove ${path}.`,
      })];
    }

    return evaluateReferenceUpdates(entry, ctx);
  }

  if (action === 'retain') {
    const before = snapshot.before ?? '';
    const after = snapshot.after ?? '';
    if (isHeaderOnlyChange(before, after)) {
      return [buildFinding({
        file: path,
        code: 'HEADER_ONLY_INCOMPLETE',
        message: 'Header-only edits do not complete legacy document disposition.',
        correction: 'Apply substantive content, ownership, and reference updates required by the disposition map.',
      })];
    }
    return evaluateReferenceUpdates(entry, ctx);
  }

  return [buildFinding({
    file: path,
    code: 'UNKNOWN_DISPOSITION',
    message: `Unsupported disposition action: ${entry.action || 'unknown'}.`,
    correction: 'Use migrate, consolidate, archive, supersede, delete, or retain.',
  })];
}

export function evaluateMigrationRatchet({
  changedFiles = [],
  fileSnapshots = {},
  dispositionEntries = [],
  prBody = '',
  enforceLegacyOnly = true,
} = {}) {
  const normalizedChanges = normalizeChangedFiles(changedFiles);
  const changedPaths = normalizedChanges.map((item) => item.path);
  const changedSet = new Set(changedPaths);
  const statusByPath = new Map(normalizedChanges.map((item) => [item.path, item.status]));
  const entryByPath = new Map(dispositionEntries.map((entry) => [entry.path, entry]));

  const emergencyDeferral = isEmergencyRecovery(prBody) && hasMandatoryFollowUp(prBody);
  const ctx = {
    changedPaths,
    changedSet,
    statusByPath,
    fileSnapshots,
    emergencyDeferral,
  };

  const findings = [];
  const touchedEntries = dispositionEntries.filter((entry) => changedSet.has(entry.path));

  for (const entry of touchedEntries) {
    if (enforceLegacyOnly && !isLegacyAuthorityPath(entry.path)) continue;
    findings.push(...evaluateActionCompletion(entry, ctx));
  }

  if (isEmergencyRecovery(prBody) && touchedEntries.length > 0 && !hasMandatoryFollowUp(prBody)) {
    findings.push(buildFinding({
      file: touchedEntries[0].path,
      code: 'EMERGENCY_FOLLOW_UP_REQUIRED',
      message: 'Emergency recovery touched legacy authority without a mandatory follow-up issue.',
      correction: 'Set `Follow-up issue required: YES` and link `#NNNN` for deferred DIATAXIS migration.',
    }));
  }

  const report = {
    gate: 'diataxis-migration-ratchet',
    schemaVersion: 1,
    advisory: true,
    changedPaths,
    touchedLegacyPaths: touchedEntries.map((entry) => entry.path),
    emergencyDeferral,
    findings,
    ok: findings.every((finding) => finding.severity !== 'error'),
  };

  report.legacyInventorySize = dispositionEntries.length;
  report.entryByPath = entryByPath;
  return report;
}

export function renderMigrationRatchetReport(report) {
  const lines = ['## DIATAXIS Migration Ratchet Advisory', ''];

  if (report.emergencyDeferral) {
    lines.push('- Emergency recovery deferral recorded; complete deferred migration in the linked follow-up issue.');
    lines.push('');
  }

  if ((report.findings || []).length === 0) {
    lines.push('No DIATAXIS migration ratchet defects detected.');
    return lines.join('\n');
  }

  const byFile = new Map();
  for (const finding of report.findings) {
    if (!byFile.has(finding.file)) byFile.set(finding.file, []);
    byFile.get(finding.file).push(finding);
  }

  for (const [file, fileFindings] of byFile) {
    lines.push(`### \`${file}\``);
    for (const finding of fileFindings) {
      lines.push(`- ${finding.code}: ${finding.message}`);
      lines.push(`  - Correction: ${finding.correction}`);
    }
    lines.push('');
  }

  return lines.join('\n').trimEnd();
}

export function buildFileSnapshots(changedFiles, { root = '.', beforeRoot = root, afterRoot = root } = {}) {
  const snapshots = {};
  for (const item of normalizeChangedFiles(changedFiles)) {
    const before = readOptionalFile(item.path, beforeRoot);
    const after = item.status === 'deleted'
      ? null
      : readOptionalFile(item.path, afterRoot);
    snapshots[item.path] = {
      before: before ?? '',
      after: after ?? '',
      status: item.status,
    };
  }
  return snapshots;
}

export function runCli(env = process.env) {
  const changedFilesPath = env.DIATAXIS_CHANGED_FILES_FILE || env.MIGRATION_RATCHET_CHANGED_FILES_FILE;
  const bodyPath = env.MIGRATION_RATCHET_BODY_FILE || env.PR_HYGIENE_BODY_FILE;
  const root = env.DIATAXIS_ROOT || env.MIGRATION_RATCHET_ROOT || '.';
  const beforeRoot = env.MIGRATION_RATCHET_BEFORE_ROOT || root;
  const mapPath = env.MIGRATION_RATCHET_DISPOSITION_MAP || DEFAULT_DISPOSITION_MAP_PATH;
  const enforceFailure = (env.MIGRATION_RATCHET_ENFORCE_FAILURE || 'false') === 'true';

  const changedFiles = readListFile(changedFilesPath);
  const dispositionEntries = loadDispositionMap({ root, mapPath });
  const fileSnapshots = buildFileSnapshots(changedFiles, { root, beforeRoot, afterRoot: root });
  const prBody = bodyPath && fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : '';

  const report = evaluateMigrationRatchet({
    changedFiles,
    fileSnapshots,
    dispositionEntries,
    prBody,
  });

  const markdown = renderMigrationRatchetReport(report);
  console.log(markdown);

  const jsonPath = env.MIGRATION_RATCHET_RESULT_JSON;
  const markdownPath = env.MIGRATION_RATCHET_RESULT_MD;
  if (jsonPath) fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  if (markdownPath) fs.writeFileSync(markdownPath, `${markdown}\n`);

  if (report.ok) return 0;
  return enforceFailure ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
