#!/usr/bin/env node

import fs from 'node:fs';

export const FOLDER_RULES = [
  {
    prefix: 'docs/tutorials/',
    folderClass: 'diataxis',
    expectedDocType: 'Tutorial',
    requiredStructure: /^##[ \t]+(Goal|Outcome|Steps|Walkthrough)/im,
    requiredMessage: 'tutorial docs must contain learning-flow structure: Goal, Outcome, Steps, or Walkthrough',
  },
  {
    prefix: 'docs/how-to/',
    folderClass: 'diataxis',
    expectedDocType: 'How-To',
    requiredStructure: /^##[ \t]+(Steps|Procedure|Execution)/im,
    requiredMessage: 'how-to docs must contain a task execution section: Steps, Procedure, or Execution',
  },
  {
    prefix: 'docs/reference/',
    folderClass: 'diataxis',
    expectedDocType: 'Reference',
    forbiddenStructure: /^##[ \t]+(Steps|Procedure|How to|Tutorial)|```(bash|sh|zsh|powershell)/im,
    forbiddenMessage: 'reference docs must not contain procedure/tutorial sections or executable command blocks',
  },
  {
    prefix: 'docs/explanation/',
    folderClass: 'diataxis',
    expectedDocType: 'Explanation',
    forbiddenStructure: /^##[ \t]+(Steps|Procedure|Commands|Runbook)|```(bash|sh|zsh|powershell)/im,
    forbiddenMessage: 'explanation docs must not contain procedural/runbook sections or executable command blocks',
  },
  {
    prefix: 'docs/ops/',
    folderClass: 'operational',
  },
];

export const REQUIRED_HEADER_FIELDS = [
  'Doc Type:',
  'Audience:',
  'Authority Level:',
  'Owns:',
  'Does Not Own:',
  'Canonical Reference:',
  'Last Reviewed:',
];

const DIATAXIS_DOC_TYPE_PATTERN = /^Doc Type:[ \t]+(Tutorial|How-To|Reference|Explanation)\b/im;

export function ruleForFile(file) {
  return FOLDER_RULES.find((rule) => file.startsWith(rule.prefix)) || null;
}

export function readChangedFiles(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function auditDiataxisFile(file, content) {
  const rule = ruleForFile(file);
  const findings = [];

  if (!rule) {
    findings.push({
      file,
      code: 'OUTSIDE_DIATAXIS_FOLDER',
      message: 'file is outside approved DIATAXIS knowledge folders and approved operational docs/ops classes',
      correction: 'Move the document into docs/tutorials, docs/how-to, docs/reference, docs/explanation, or an approved docs/ops/** operational path, or remove it from this workflow scope.',
    });
    return findings;
  }

  if (!content.startsWith('---\n')) {
    findings.push({
      file,
      code: 'HEADER_FENCE_MISSING',
      message: 'missing opening YAML-style authority header delimiter',
      correction: 'Insert the repository documentation header block at the top of the file.',
    });
  }

  for (const field of REQUIRED_HEADER_FIELDS) {
    const fieldPattern = new RegExp(`^${field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm');
    if (!fieldPattern.test(content)) {
      findings.push({
        file,
        code: 'HEADER_FIELD_MISSING',
        message: `missing required header field: ${field}`,
        correction: `Populate ${field} in the document header.`,
      });
    }
  }

  if (rule.folderClass === 'operational') {
    // Approved operational paths: keep header checks, reject only DIATAXIS knowledge types.
    // Do not enforce a narrow ops Doc Type allowlist (Implementation Plan, Task, etc. are valid).
    if (DIATAXIS_DOC_TYPE_PATTERN.test(content)) {
      findings.push({
        file,
        code: 'OUTSIDE_DIATAXIS_FOLDER',
        message: 'DIATAXIS knowledge content must live in docs/tutorials, docs/how-to, docs/reference, or docs/explanation; approved docs/ops/** paths are for operational evidence, plans, and reports',
        correction: 'Move the document into the matching DIATAXIS knowledge folder, or keep it under docs/ops/** only if it is an operational document.',
      });
    }
    return findings;
  }

  const docTypePattern = new RegExp(`^Doc Type: .*${rule.expectedDocType}`, 'im');
  if (!docTypePattern.test(content)) {
    findings.push({
      file,
      code: 'DOC_TYPE_FOLDER_MISMATCH',
      message: `Doc Type must match folder intent: ${rule.expectedDocType}`,
      correction: `Set Doc Type to ${rule.expectedDocType} or move the document to the folder that matches its actual type.`,
    });
  }

  if (rule.requiredStructure && !rule.requiredStructure.test(content)) {
    findings.push({
      file,
      code: 'REQUIRED_STRUCTURE_MISSING',
      message: rule.requiredMessage,
      correction: 'Add the required section heading for this DIATAXIS folder.',
    });
  }

  if (rule.forbiddenStructure && rule.forbiddenStructure.test(content)) {
    findings.push({
      file,
      code: 'FORBIDDEN_STRUCTURE_PRESENT',
      message: rule.forbiddenMessage,
      correction: 'Move procedural material to a how-to document, or remove command/tutorial content from this reference/explanation document.',
    });
  }

  return findings;
}

export function auditDiataxisFiles(files, { root = '.' } = {}) {
  const findings = [];
  for (const file of files) {
    if (!file) continue;
    if (!fs.existsSync(`${root}/${file}`)) continue;
    findings.push(...auditDiataxisFile(file, fs.readFileSync(`${root}/${file}`, 'utf8')));
  }
  return findings;
}

export function renderDiataxisReport(findings) {
  const lines = [
    '## DIATAXIS Folder Hygiene Advisory',
    '',
    'This audit distinguishes DIATAXIS knowledge content from approved operational docs/ops evidence classes.',
    '',
  ];
  if (findings.length === 0) {
    lines.push('No DIATAXIS folder hygiene defects detected.');
    return lines.join('\n');
  }

  const byFile = new Map();
  for (const finding of findings) {
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

export function runCli(env = process.env) {
  const changedFilesPath = env.DIATAXIS_CHANGED_FILES_FILE;
  const files = readChangedFiles(changedFilesPath);
  const findings = auditDiataxisFiles(files, { root: env.DIATAXIS_ROOT || '.' });
  console.log(renderDiataxisReport(findings));
  return findings.length === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
