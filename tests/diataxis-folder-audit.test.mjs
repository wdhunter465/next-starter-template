import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  auditDiataxisFile,
  listDocsMarkdown,
  renderDiataxisReport,
  ruleForFile,
  runCli,
} from '../scripts/ci/diataxis_folder_audit.mjs';

const referenceDoc = `---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: reference facts
Does Not Own: procedures
Canonical Reference: docs/reference/example.md
Last Reviewed: 2026-06-02
---

# Reference Doc

## Purpose

Defines facts.
`;

const operationsReportDoc = `---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Evidence
Owns: operational evidence
Does Not Own: DIATAXIS knowledge content
Canonical Reference: docs/ops/reports/example.md
Last Reviewed: 2026-08-08
---

# Operations Report

## Summary

Records operational evidence.
`;

const implementationPlanDoc = `---
Doc Type: Implementation Plan
Audience: Human + AI
Authority Level: Controlled
Owns: implementation planning evidence
Does Not Own: DIATAXIS knowledge content
Canonical Reference: docs/ops/implementation-plans/example.md
Last Reviewed: 2026-08-08
---

# Implementation Plan

## Summary

Records an approved operational plan.
`;

describe('DIATAXIS folder hygiene audit', () => {
  it('maps files to folder intent rules', () => {
    expect(ruleForFile('docs/reference/example.md')?.expectedDocType).toBe('Reference');
    expect(ruleForFile('docs/how-to/example.md')?.expectedDocType).toBe('How-To');
    expect(ruleForFile('docs/ops/reports/example.md')?.folderClass).toBe('operational');
    expect(ruleForFile('README.md')).toBe(null);
  });

  it('accepts a reference document that matches folder intent', () => {
    expect(auditDiataxisFile('docs/reference/example.md', referenceDoc)).toEqual([]);
  });

  it('reports doc type mismatches and forbidden reference procedures', () => {
    const findings = auditDiataxisFile('docs/reference/example.md', `${referenceDoc}\n## Steps\n\n\`\`\`bash\nnpm test\n\`\`\`\n`.replace('Doc Type: Reference', 'Doc Type: How-To'));

    expect(findings.map((finding) => finding.code)).toContain('DOC_TYPE_FOLDER_MISMATCH');
    expect(findings.map((finding) => finding.code)).toContain('FORBIDDEN_STRUCTURE_PRESENT');
  });

  it('reports missing how-to execution structure', () => {
    const findings = auditDiataxisFile('docs/how-to/example.md', referenceDoc.replace('Doc Type: Reference', 'Doc Type: How-To'));
    expect(findings.map((finding) => finding.code)).toContain('REQUIRED_STRUCTURE_MISSING');
  });

  it('accepts operational reports under docs/ops paths', () => {
    expect(auditDiataxisFile('docs/ops/reports/example.md', operationsReportDoc)).toEqual([]);
  });

  it('accepts non-Operations Doc Types under docs/ops (Implementation Plan, Task, etc.)', () => {
    expect(auditDiataxisFile('docs/ops/implementation-plans/example.md', implementationPlanDoc)).toEqual([]);
  });

  it('keeps header validation for operational docs', () => {
    const findings = auditDiataxisFile(
      'docs/ops/reports/example.md',
      operationsReportDoc.replace('Authority Level: Evidence\n', ''),
    );

    expect(findings.map((finding) => finding.code)).toContain('HEADER_FIELD_MISSING');
  });

  it('rejects DIATAXIS knowledge docs misplaced under docs/ops paths', () => {
    const findings = auditDiataxisFile('docs/ops/reports/example.md', referenceDoc);

    expect(findings.map((finding) => finding.code)).toContain('OUTSIDE_DIATAXIS_FOLDER');
  });

  it('accepts Doc Type Specification for locked design specs under docs/reference/design (#4632)', () => {
    const spec = referenceDoc.replace('Doc Type: Reference', 'Doc Type: Specification');

    const design = auditDiataxisFile('docs/reference/design/search.md', spec);
    expect(design.map((finding) => finding.code)).not.toContain('DOC_TYPE_FOLDER_MISMATCH');

    const elsewhere = auditDiataxisFile('docs/reference/example.md', spec);
    expect(elsewhere.map((finding) => finding.code)).toContain('DOC_TYPE_FOLDER_MISMATCH');
  });

  it('still requires a valid Doc Type and keeps the reference-only rules for design specs', () => {
    const wrong = referenceDoc.replace('Doc Type: Reference', 'Doc Type: How-To');
    expect(auditDiataxisFile('docs/reference/design/search.md', wrong).map((f) => f.code)).toContain(
      'DOC_TYPE_FOLDER_MISMATCH',
    );

    const procedural = `${referenceDoc}\n## Steps\n\nDo this.\n`;
    expect(auditDiataxisFile('docs/reference/design/search.md', procedural).map((f) => f.code)).toContain(
      'FORBIDDEN_STRUCTURE_PRESENT',
    );
  });

  it('renders actionable advisory text', () => {
    const report = renderDiataxisReport([
      {
        file: 'docs/reference/example.md',
        code: 'DOC_TYPE_FOLDER_MISMATCH',
        message: 'Doc Type must match folder intent: Reference',
        correction: 'Set Doc Type to Reference.',
      },
    ]);

    expect(report).toContain('DIATAXIS Folder Hygiene Advisory');
    expect(report).toContain('distinguishes DIATAXIS knowledge content from approved operational docs/ops evidence classes');
    expect(report).toContain('Set Doc Type to Reference.');
  });
});

describe('approved adjacent folders (DIATAXIS-FOLDER-AUTHORITY.md)', () => {
  const governanceDoc = referenceDoc.replace('Doc Type: Reference', 'Doc Type: Governance');

  it('classes governance, archive, templates and docs/README.md as approved, not outside', () => {
    for (const file of ['docs/governance/A.md', 'docs/archive/x/B.md', 'docs/templates/C.md', 'docs/README.md']) {
      expect(ruleForFile(file)?.folderClass).toBe('approved-adjacent');
    }
    expect(ruleForFile('README.md')).toBe(null);
    expect(ruleForFile('docs/READMEX.md')).toBe(null);
    expect(ruleForFile('docs/other/D.md')).toBe(null);
  });

  it('does not report OUTSIDE_DIATAXIS_FOLDER for them', () => {
    for (const file of ['docs/governance/A.md', 'docs/archive/B.md', 'docs/templates/C.md', 'docs/README.md']) {
      expect(auditDiataxisFile(file, governanceDoc)).toEqual([]);
    }
  });

  it('applies no Doc Type or structure rule, so an archived Reference or a procedure is fine', () => {
    const archivedReference = `${referenceDoc}\n## Steps\n\n\`\`\`bash\nnpm test\n\`\`\`\n`;
    expect(auditDiataxisFile('docs/archive/pr-process/README.md', archivedReference)).toEqual([]);
  });

  it('still checks the header', () => {
    const noOwner = governanceDoc.replace('Owns: reference facts\n', '');
    const codes = auditDiataxisFile('docs/governance/A.md', noOwner).map((f) => f.code);
    expect(codes).toEqual(['HEADER_FIELD_MISSING']);
    expect(auditDiataxisFile('docs/archive/B.md', 'no header here').map((f) => f.code)).toContain(
      'HEADER_FENCE_MISSING',
    );
  });

  it('still flags a file outside every approved folder', () => {
    expect(auditDiataxisFile('docs/other/D.md', referenceDoc).map((f) => f.code)).toEqual([
      'OUTSIDE_DIATAXIS_FOLDER',
    ]);
  });
});

describe('full-tree mode', () => {
  const dirs = [];
  const makeTree = (files) => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'diataxis-audit-'));
    dirs.push(root);
    for (const [rel, content] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
      fs.writeFileSync(path.join(root, rel), content);
    }
    return root;
  };

  afterEach(() => {
    vi.restoreAllMocks();
    while (dirs.length) fs.rmSync(dirs.pop(), { recursive: true, force: true });
  });

  it('lists only markdown under docs, sorted, and tolerates a missing docs folder', () => {
    const root = makeTree({ 'docs/b.md': 'x', 'docs/a/c.md': 'x', 'docs/a/note.txt': 'x', 'README.md': 'x' });
    expect(listDocsMarkdown(root)).toEqual(['docs/a/c.md', 'docs/b.md']);
    expect(listDocsMarkdown(makeTree({ 'README.md': 'x' }))).toEqual([]);
  });

  it('DIATAXIS_ALL=1 audits every docs file and reports a defect with exit code 1', () => {
    const root = makeTree({
      'docs/reference/ok.md': referenceDoc,
      'docs/reference/bad.md': referenceDoc.replace('Doc Type: Reference', 'Doc Type: How-To'),
      'docs/governance/G.md': referenceDoc.replace('Doc Type: Reference', 'Doc Type: Governance'),
    });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(runCli({ DIATAXIS_ROOT: root, DIATAXIS_ALL: '1' })).toBe(1);
    expect(err).toHaveBeenCalledWith('DIATAXIS audit: 3 file(s) audited, 1 finding(s)');
    const report = log.mock.calls.map((c) => c[0]).join('\n');
    expect(report).toContain('docs/reference/bad.md');
    expect(report).not.toContain('docs/governance/G.md');
    expect(report).not.toContain('docs/reference/ok.md');
  });

  it('without a changed-files list it audits nothing and says so on stderr', () => {
    const root = makeTree({ 'docs/reference/bad.md': 'no header' });
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(runCli({ DIATAXIS_ROOT: root })).toBe(0);
    expect(err).toHaveBeenCalledWith('DIATAXIS audit: 0 file(s) audited, 0 finding(s)');
    expect(log.mock.calls.map((c) => c[0]).join('\n')).toContain('No DIATAXIS folder hygiene defects detected.');
  });

  it('keeps the changed-files behavior and the stdout report text', () => {
    const root = makeTree({ 'docs/reference/bad.md': 'no header', 'docs/reference/ok.md': referenceDoc });
    fs.writeFileSync(path.join(root, 'changed.txt'), 'docs/reference/ok.md\n');
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(runCli({ DIATAXIS_ROOT: root, DIATAXIS_CHANGED_FILES_FILE: path.join(root, 'changed.txt') })).toBe(0);
    expect(err).toHaveBeenCalledWith('DIATAXIS audit: 1 file(s) audited, 0 finding(s)');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toContain('No DIATAXIS folder hygiene defects detected.');
  });
});
