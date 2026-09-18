import { describe, expect, it } from 'vitest';
import {
  formatAcknowledgment,
  validateAssignmentEnvelope,
  validateProductConfig,
  validateRepoTree
} from '../scripts/ci/agent_config_validate.mjs';

const REPO_ROOT = process.cwd();

const VALID_CONFIG = {
  schema: 'agent-product-config',
  schemaVersion: 1,
  product: 'codex',
  status: 'pilot',
  durableRole: 'Operations',
  roleMappingAuthority: 'docs/governance/AGENT-TEAM.md',
  authorityChain: [
    'Agent.md',
    'docs/governance/REPOSITORY-AUTHORITY.md',
    'docs/governance/AGENT-TEAM.md',
    'docs/ops/ai/CORE-RULES.md',
    'docs/ops/ai/CODEX-RULES.md'
  ],
  pilotIsolation: {
    routedProducts: ['codex'],
    excludedProducts: ['cursor', 'chatgpt', 'claude-code', 'work']
  },
  cannotGrant: ['merge', 'production', 'standing-role', 'self-approval']
};

const VALID_ENVELOPE = {
  schema: 'assignment-envelope',
  schemaVersion: 1,
  product: 'codex',
  sourceIssue: 3124,
  branch: 'sandbox/skeetersoft-replay-ledger',
  mode: 'sandbox',
  promotionProfile: 'sandbox',
  allowlist: ['tools/skeetersoft/**'],
  implementer: 'codex',
  reviewer: 'claude-code',
  implementationGo: 'required-on-source-issue',
  protectedStops: ['main-merge']
};

describe('agent config validator', () => {
  it('accepts the committed Codex product config against live authority files', () => {
    const result = validateProductConfig(VALID_CONFIG, { repoRoot: REPO_ROOT });
    expect(result.ok).toBe(true);
  });

  it('fails closed when an authority path does not exist', () => {
    const result = validateProductConfig(
      {
        ...VALID_CONFIG,
        roleMappingAuthority: 'docs/does-not-exist.md'
      },
      { repoRoot: REPO_ROOT }
    );
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/does not exist/);
  });

  it('fails closed when Codex config routes Cursor', () => {
    const result = validateProductConfig({
      ...VALID_CONFIG,
      pilotIsolation: {
        routedProducts: ['codex', 'cursor'],
        excludedProducts: ['chatgpt', 'claude-code', 'work']
      }
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/must not route cursor/);
  });

  it('fails closed when configuration claims merge authority', () => {
    const result = validateProductConfig({
      ...VALID_CONFIG,
      mergeAuthority: true
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/mergeAuthority/);
  });

  it('fails closed when source Issue is missing', () => {
    const result = validateAssignmentEnvelope({
      ...VALID_ENVELOPE,
      sourceIssue: 0
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/sourceIssue/);
  });

  it('fails closed when implementer and reviewer collide', () => {
    const result = validateAssignmentEnvelope({
      ...VALID_ENVELOPE,
      implementer: 'codex',
      reviewer: 'codex'
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/must be different/);
  });

  it('fails closed when allowlist is a placeholder', () => {
    const result = validateAssignmentEnvelope({
      ...VALID_ENVELOPE,
      allowlist: ['TODO']
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toMatch(/allowlist/);
  });

  it('treats required-on-source-issue as a valid non-executable package', () => {
    const result = validateAssignmentEnvelope(VALID_ENVELOPE);
    expect(result.ok).toBe(true);
    expect(result.executable).toBe(false);
    expect(result.warnings.join(' ')).toMatch(/must not edit/);
  });

  it('marks recorded Go as executable when the rest of the envelope is valid', () => {
    const result = validateAssignmentEnvelope({
      ...VALID_ENVELOPE,
      implementationGo: 'recorded'
    });
    expect(result.ok).toBe(true);
    expect(result.executable).toBe(true);
  });

  it('prints a compact acknowledgment', () => {
    const text = formatAcknowledgment({
      config: VALID_CONFIG,
      envelope: VALID_ENVELOPE,
      validation: { ok: true }
    });
    expect(text).toContain('CONFIG ACK');
    expect(text).toContain('sourceIssue: #3124');
    expect(text).toContain('validation: pass');
  });

  it('validates the committed Codex tree', () => {
    const result = validateRepoTree(REPO_ROOT);
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe(false);
  });
});
