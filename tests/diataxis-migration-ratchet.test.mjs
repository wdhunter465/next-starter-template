import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DISPOSITION_MAP_PATH,
  evaluateMigrationRatchet,
  hasMandatoryFollowUp,
  isEmergencyRecovery,
  isHeaderOnlyChange,
  isLegacyAuthorityPath,
  loadDispositionMap,
  normalizeChangedFiles,
  fileCoveredByDisposition,
  isAreaDispositionRow,
  listUnmatchedDocFiles,
  parseDispositionMap,
  referencesLegacyPath,
  renderMigrationRatchetReport,
} from '../scripts/ci/diataxis_migration_ratchet.mjs';

const FIXTURE_DISPOSITION_MAP = `---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: fixture disposition map
Does Not Own: production policy
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-07-13
---

# Fixture Disposition Map

| Current path | Current owner | Target owner | Action | Replacement / notes | Reference-update scope |
| --- | --- | --- | --- | --- | --- |
| \`docs/governance/legacy-migrate-source.md\` | Governance | Documentation and Knowledge | migrate | Move to \`docs/reference/diataxis/migrated-target.md\` | \`Agent.md\` |
| \`docs/governance/legacy-consolidate-source.md\` | Governance | Documentation and Knowledge | consolidate | Merge into \`docs/governance/legacy-consolidate-target.md\` | \`docs/governance/DOCUMENT-ARCHITECTURE.md\` |
| \`docs/governance/legacy-archive-source.md\` | Governance | Documentation and Knowledge | archive | Move to \`docs/archive/legacy-archive-source.md\` | \`docs/governance/DOCUMENT-ARCHITECTURE.md\` |
| \`docs/governance/legacy-supersede-source.md\` | Governance | Documentation and Knowledge | supersede | Competing authority removed | Self, \`docs/governance/DOCUMENT-ARCHITECTURE.md\` |
| \`docs/governance/legacy-delete-source.md\` | Governance | Documentation and Knowledge | delete | No retained value | \`docs/governance/DOCUMENT-ARCHITECTURE.md\` |
| \`docs/governance/legacy-retain-source.md\` | Governance | Documentation and Knowledge | retain | Update content and references | \`Agent.md\` |
| \`docs/governance/legacy-header-only.md\` | Governance | Documentation and Knowledge | retain | Header-only failure fixture | \`Agent.md\` |
| \`docs/governance/legacy-stale-reference.md\` | Governance | Documentation and Knowledge | retain | Stale reference failure fixture | \`Agent.md\` |
| \`docs/governance/legacy-emergency-source.md\` | Governance | Documentation and Knowledge | migrate | Move to \`docs/reference/diataxis/emergency-target.md\` | \`Agent.md\` |
| \`docs/governance/legacy-untouched.md\` | Governance | Documentation and Knowledge | migrate | Pending migration | \`Agent.md\` |
`;

const HEADER = `---
Doc Type: Governance
Audience: Human + AI
Authority Level: Controlled
Owns: fixture
Does Not Own: production
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-07-13
---

# Legacy Document
`;

function evaluateFixture({
  changedFiles,
  fileSnapshots,
  prBody = '',
  dispositionEntries = parseDispositionMap(FIXTURE_DISPOSITION_MAP),
}) {
  return evaluateMigrationRatchet({
    changedFiles,
    fileSnapshots,
    dispositionEntries,
    prBody,
  });
}

describe('DIATAXIS migration ratchet fixtures', () => {
  it('parses disposition map rows deterministically', () => {
    const entries = parseDispositionMap(FIXTURE_DISPOSITION_MAP);
    expect(entries.map((entry) => entry.path)).toContain('docs/governance/legacy-migrate-source.md');
    expect(entries.find((entry) => entry.path.endsWith('legacy-archive-source.md'))?.action).toBe('archive');
  });

  it('loads the repository disposition map', () => {
    const entries = loadDispositionMap();
    expect(entries.length).toBeGreaterThan(5);
    expect(DEFAULT_DISPOSITION_MAP_PATH).toBe('docs/reference/diataxis/two-model-authority-disposition-map.md');
  });

  it('passes migrate disposition when source is retired and target is touched', () => {
    const report = evaluateFixture({
      changedFiles: [
        { path: 'docs/governance/legacy-migrate-source.md', status: 'deleted' },
        { path: 'docs/reference/diataxis/migrated-target.md', status: 'added' },
        { path: 'Agent.md', status: 'modified' },
      ],
      fileSnapshots: {
        'docs/governance/legacy-migrate-source.md': {
          before: `${HEADER}\nOld routing.\n`,
          after: '',
          status: 'deleted',
        },
        'docs/reference/diataxis/migrated-target.md': {
          before: '',
          after: `${HEADER}\nMigrated content.\n`,
          status: 'added',
        },
        'Agent.md': {
          before: 'See docs/governance/legacy-migrate-source.md',
          after: 'See docs/reference/diataxis/migrated-target.md',
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(true);
    expect(report.touchedLegacyPaths).toEqual(['docs/governance/legacy-migrate-source.md']);
  });

  it('passes consolidate disposition when source is superseded and target is updated', () => {
    const report = evaluateFixture({
      changedFiles: [
        { path: 'docs/governance/legacy-consolidate-source.md', status: 'modified' },
        { path: 'docs/governance/legacy-consolidate-target.md', status: 'modified' },
        { path: 'docs/governance/DOCUMENT-ARCHITECTURE.md', status: 'modified' },
      ],
      fileSnapshots: {
        'docs/governance/legacy-consolidate-source.md': {
          before: `${HEADER}\nOld content.\n`,
          after: `${HEADER.replace('Controlled', 'Superseded')}\n**Superseded.** Consolidated elsewhere.\n`,
          status: 'modified',
        },
        'docs/governance/legacy-consolidate-target.md': {
          before: `${HEADER}\nTarget before.\n`,
          after: `${HEADER}\nTarget after with consolidated content.\n`,
          status: 'modified',
        },
        'docs/governance/DOCUMENT-ARCHITECTURE.md': {
          before: 'legacy-consolidate-source.md',
          after: 'legacy-consolidate-target.md',
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(true);
  });

  it('passes archive disposition when legacy material moves under docs/archive', () => {
    const report = evaluateFixture({
      changedFiles: [
        { path: 'docs/governance/legacy-archive-source.md', status: 'deleted' },
        { path: 'docs/archive/legacy-archive-source.md', status: 'added' },
        { path: 'docs/governance/DOCUMENT-ARCHITECTURE.md', status: 'modified' },
      ],
      fileSnapshots: {
        'docs/governance/legacy-archive-source.md': {
          before: `${HEADER}\nArchive me.\n`,
          after: '',
          status: 'deleted',
        },
        'docs/archive/legacy-archive-source.md': {
          before: '',
          after: `${HEADER}\nArchived copy.\n`,
          status: 'added',
        },
        'docs/governance/DOCUMENT-ARCHITECTURE.md': {
          before: 'legacy-archive-source.md',
          after: 'docs/archive/legacy-archive-source.md',
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(true);
  });

  it('passes supersede disposition when competing authority is marked inactive', () => {
    const report = evaluateFixture({
      changedFiles: [
        { path: 'docs/governance/legacy-supersede-source.md', status: 'modified' },
        { path: 'docs/governance/DOCUMENT-ARCHITECTURE.md', status: 'modified' },
      ],
      fileSnapshots: {
        'docs/governance/legacy-supersede-source.md': {
          before: `${HEADER}\nCompeting authority.\n`,
          after: `${HEADER.replace('Controlled', 'Superseded')}\n**Superseded.** Use REPOSITORY-AUTHORITY.md.\n`,
          status: 'modified',
        },
        'docs/governance/DOCUMENT-ARCHITECTURE.md': {
          before: 'legacy-supersede-source.md',
          after: 'REPOSITORY-AUTHORITY.md',
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(true);
  });

  it('passes delete disposition when the legacy file is removed', () => {
    const report = evaluateFixture({
      changedFiles: [
        { path: 'docs/governance/legacy-delete-source.md', status: 'deleted' },
        { path: 'docs/governance/DOCUMENT-ARCHITECTURE.md', status: 'modified' },
      ],
      fileSnapshots: {
        'docs/governance/legacy-delete-source.md': {
          before: `${HEADER}\nDelete me.\n`,
          after: '',
          status: 'deleted',
        },
        'docs/governance/DOCUMENT-ARCHITECTURE.md': {
          before: 'legacy-delete-source.md',
          after: 'REPOSITORY-AUTHORITY.md',
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(true);
  });

  it('does not create noise for untouched legacy inventory paths', () => {
    const report = evaluateFixture({
      changedFiles: ['docs/reference/diataxis/unrelated-active-doc.md'],
      fileSnapshots: {
        'docs/reference/diataxis/unrelated-active-doc.md': {
          before: `${HEADER}\nActive only.\n`,
          after: `${HEADER}\nActive only updated.\n`,
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(true);
    expect(report.touchedLegacyPaths).toEqual([]);
    expect(report.findings).toEqual([]);
  });

  it('fails header-only legacy edits', () => {
    const report = evaluateFixture({
      changedFiles: ['docs/governance/legacy-header-only.md'],
      fileSnapshots: {
        'docs/governance/legacy-header-only.md': {
          before: `${HEADER}\nSame body.\n`,
          after: `${HEADER.replace('2026-07-13', '2026-07-14')}\nSame body.\n`,
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('HEADER_ONLY_INCOMPLETE');
  });

  it('fails stale-reference edits when required scope still routes to the legacy path', () => {
    const report = evaluateFixture({
      changedFiles: [
        'docs/governance/legacy-stale-reference.md',
        'Agent.md',
      ],
      fileSnapshots: {
        'docs/governance/legacy-stale-reference.md': {
          before: `${HEADER}\nOld body.\n`,
          after: `${HEADER}\nUpdated body.\n`,
          status: 'modified',
        },
        'Agent.md': {
          before: 'docs/governance/legacy-stale-reference.md',
          after: 'docs/governance/legacy-stale-reference.md',
          status: 'modified',
        },
      },
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('STALE_REFERENCE');
  });

  it('records emergency deferral instead of blocking when follow-up is linked', () => {
    const prBody = `# PR Summary

- **Issue:** #2500
- Delivery model: emergency-recovery
- Change mode: emergency
- Gate profile: emergency-recovery
- Follow-up issue required: YES
- Follow-up issue: #2501

## Change Summary

Stabilization-first recovery.
`;

    const report = evaluateFixture({
      changedFiles: ['docs/governance/legacy-emergency-source.md'],
      fileSnapshots: {
        'docs/governance/legacy-emergency-source.md': {
          before: `${HEADER}\nBroken state.\n`,
          after: `${HEADER}\nTemporary stabilization.\n`,
          status: 'modified',
        },
      },
      prBody,
    });

    expect(isEmergencyRecovery(prBody)).toBe(true);
    expect(hasMandatoryFollowUp(prBody)).toBe(true);
    expect(report.emergencyDeferral).toBe(true);
    expect(report.ok).toBe(true);
    expect(report.findings.map((finding) => finding.code)).toContain('EMERGENCY_DEFERRAL');
  });

  it('requires mandatory follow-up for emergency recovery touching legacy authority', () => {
    const prBody = `# PR Summary

- Delivery model: emergency-recovery
- Change mode: emergency
- Follow-up issue required: NO
`;

    const report = evaluateFixture({
      changedFiles: ['docs/governance/legacy-emergency-source.md'],
      fileSnapshots: {
        'docs/governance/legacy-emergency-source.md': {
          before: `${HEADER}\nBroken state.\n`,
          after: `${HEADER}\nTemporary stabilization.\n`,
          status: 'modified',
        },
      },
      prBody,
    });

    expect(report.ok).toBe(false);
    expect(report.findings.map((finding) => finding.code)).toContain('EMERGENCY_FOLLOW_UP_REQUIRED');
  });

  it('renders actionable advisory output', () => {
    const report = evaluateFixture({
      changedFiles: ['docs/governance/legacy-header-only.md'],
      fileSnapshots: {
        'docs/governance/legacy-header-only.md': {
          before: `${HEADER}\nSame body.\n`,
          after: `${HEADER.replace('2026-07-13', '2026-07-14')}\nSame body.\n`,
          status: 'modified',
        },
      },
    });

    const rendered = renderMigrationRatchetReport(report);
    expect(rendered).toContain('DIATAXIS Migration Ratchet Advisory');
    expect(rendered).toContain('HEADER_ONLY_INCOMPLETE');
  });
});

describe('DIATAXIS migration ratchet helpers', () => {
  it('detects header-only changes and legacy paths', () => {
    expect(isHeaderOnlyChange(`${HEADER}\nBody`, `${HEADER.replace('2026-07-13', '2026-07-14')}\nBody`)).toBe(true);
    expect(isLegacyAuthorityPath('docs/governance/example.md')).toBe(true);
    expect(isLegacyAuthorityPath('src/app/page.tsx')).toBe(false);
  });

  it('reads an area row as covering only files under that folder', () => {
    const entries = parseDispositionMap(`| Current path | Current owner | Target owner | Action | Replacement / notes | Reference-update scope |
| --- | --- | --- | --- | --- | --- |
| \`docs/ops/reports/\` | ops | ops | retain | Area row for retained reports | — |
| \`docs/ops/ai/CORE-RULES.md\` | ops | governance | retain | Exact file row | — |
`);
    const area = entries.find((entry) => entry.path === 'docs/ops/reports/');
    expect(isAreaDispositionRow(area)).toBe(true);
    expect(fileCoveredByDisposition('docs/ops/reports/a.md', entries)).toBe(true);
    expect(fileCoveredByDisposition('docs/ops/ai/CORE-RULES.md', entries)).toBe(true);
    expect(fileCoveredByDisposition('docs/ops/ai/OTHER.md', entries)).toBe(false);
    expect(listUnmatchedDocFiles([
      'docs/ops/reports/a.md',
      'docs/ops/ai/CORE-RULES.md',
      'docs/ops/ai/OTHER.md',
      'README.md',
    ], entries)).toEqual(['docs/ops/ai/OTHER.md']);
  });

  it('normalizes changed file inputs', () => {
    expect(normalizeChangedFiles(['docs/a.md'])).toEqual([{ path: 'docs/a.md', status: 'modified' }]);
  });

  it('detects active legacy references', () => {
    expect(referencesLegacyPath('See docs/governance/legacy-stale-reference.md', 'docs/governance/legacy-stale-reference.md')).toBe(true);
    expect(referencesLegacyPath('Superseded pointer only', 'docs/governance/legacy-stale-reference.md')).toBe(false);
  });
});
