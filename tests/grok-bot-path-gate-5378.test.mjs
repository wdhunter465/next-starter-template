import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GROK_BOT_BRANCH_PREFIX,
  assessGrokBotPaths,
  escapeAnnotation,
  isGrokBotBranch,
  renderGrokBotReport,
  runCli,
} from '../scripts/ci/grok_bot_path_gate.mjs';

const BRANCH = 'grok-bot/5370-doc-fix';

describe('Grok Bot branch identification (#5378)', () => {
  it('matches only the agent prefix at the start of the branch name', () => {
    expect(GROK_BOT_BRANCH_PREFIX).toBe('grok-bot/');
    expect(isGrokBotBranch('grok-bot/5370-doc-fix')).toBe(true);
    for (const other of ['grok-bot', 'grok/5370', 'claude/grok-bot/x', 'Grok-Bot/x', 'cursor/5370', '', undefined, null]) {
      expect(isGrokBotBranch(other)).toBe(false);
    }
  });

  it('does not apply to a pull request from another agent', () => {
    const result = assessGrokBotPaths({ headRef: 'cursor/5427-x', changedFiles: ['src/app/page.tsx'] });
    expect(result).toMatchObject({ applies: false, ok: true });
  });
});

describe('Grok Bot path rules (#5378)', () => {
  it('passes a documentation-only pull request', () => {
    const result = assessGrokBotPaths({ headRef: BRANCH, changedFiles: ['docs/how-to/website/a.md', 'docs/explanation/b.md'] });
    expect(result.ok).toBe(true);
    expect(result.violations).toEqual([]);
  });

  it('fails a pull request that touches a code file', () => {
    for (const file of ['src/app/page.tsx', 'functions/api/x.ts', 'scripts/ci/x.mjs', '.github/workflows/x.yml', 'tests/x.test.mjs', 'package.json', 'migrations/0001.sql']) {
      const result = assessGrokBotPaths({ headRef: BRANCH, changedFiles: ['docs/how-to/a.md', file] });
      expect(result.ok, file).toBe(false);
      expect(result.violations.map((v) => v.path)).toContain(file);
    }
  });

  it('fails on the excluded documents even though Model C allows some of them', () => {
    for (const file of ['AGENTS.md', 'docs/governance/REPOSITORY-AUTHORITY.md', 'docs/governance/standards/X.md', 'docs/ops/ai/CURSOR-RULES.md', '.claude/skills/x/SKILL.md', '.cursor/rules/40-session-open.mdc', 'CLAUDE.md', 'context.md']) {
      const result = assessGrokBotPaths({ headRef: BRANCH, changedFiles: [file] });
      expect(result.ok, file).toBe(false);
      expect(result.violations[0].code, file).toBe('excluded_document');
    }
  });

  it('allows other docs/ops documents that are not product rules files', () => {
    expect(assessGrokBotPaths({ headRef: BRANCH, changedFiles: ['docs/ops/pmo/some-plan.md'] }).ok).toBe(true);
  });

  it('lists reference documents for the verifying agent without failing them', () => {
    const result = assessGrokBotPaths({ headRef: BRANCH, changedFiles: ['docs/reference/ci/x.md'] });
    expect(result.ok).toBe(true);
    expect(result.advisories).toHaveLength(1);
    expect(result.advisories[0].path).toBe('docs/reference/ci/x.md');
  });

  it('fails closed with no changed-file evidence', () => {
    expect(assessGrokBotPaths({ headRef: BRANCH }).violations[0].code).toBe('missing_changed_files_evidence');
    expect(assessGrokBotPaths({ headRef: BRANCH, changedFiles: [] }).ok).toBe(false);
  });

  it('fails a move across the documentation boundary', () => {
    const result = assessGrokBotPaths({
      headRef: BRANCH,
      changedFiles: ['docs/how-to/a.md'],
      renames: [{ from: 'docs/how-to/a.md', to: 'src/a.md' }],
    });
    expect(result.violations.map((v) => v.code)).toContain('cross_boundary_move');
    const out = assessGrokBotPaths({
      headRef: BRANCH,
      changedFiles: ['docs/how-to/a.md'],
      renames: [{ from: 'docs/governance/X.md', to: 'docs/archive/X.md' }],
    });
    expect(out.violations.map((v) => v.code)).toContain('cross_boundary_move');
  });

  it('keeps the report readable and escapes workflow commands', () => {
    const bad = assessGrokBotPaths({ headRef: BRANCH, changedFiles: ['src/x.ts'] });
    expect(renderGrokBotReport(bad, { enforce: false })).toMatch(/report-only/);
    expect(renderGrokBotReport(bad, { enforce: true })).toMatch(/enforcing/);
    expect(escapeAnnotation('a%b\nc\r::error::x')).toBe('a%25b%0Ac%0D::error::x');
  });
});

describe('Grok Bot gate CLI modes (#5378)', () => {
  function run(files, env = {}) {
    const dir = mkdtempSync(path.join(tmpdir(), 'grok-bot-gate-'));
    const list = path.join(dir, 'files.txt');
    writeFileSync(list, files.join('\n'));
    return runCli({ PR_HEAD_REF: BRANCH, CHANGED_FILES_FILE: list, ...env });
  }

  it('reports but does not fail while report-only', () => {
    expect(run(['src/x.ts'])).toBe(0);
  });

  it('fails a violating pull request once enforcing, and passes a clean one', () => {
    expect(run(['src/x.ts'], { GROK_BOT_PATH_GATE_ENFORCE: 'true' })).toBe(1);
    expect(run(['docs/how-to/a.md'], { GROK_BOT_PATH_GATE_ENFORCE: 'true' })).toBe(0);
  });

  it('ignores a pull request that is not from a grok-bot branch', () => {
    expect(run(['src/x.ts'], { PR_HEAD_REF: 'cursor/1-x', GROK_BOT_PATH_GATE_ENFORCE: 'true' })).toBe(0);
  });
});

describe('Grok Bot gate workflow (#5378)', () => {
  const yml = readFileSync(path.join(process.cwd(), '.github/workflows/gate-grok-bot-paths.yml'), 'utf8');

  it('only runs for grok-bot branches, with read-only permissions', () => {
    expect(yml).toMatch(/if: startsWith\(github\.event\.pull_request\.head\.ref, 'grok-bot\/'\)/);
    expect(yml).toMatch(/permissions:\n\s+contents: read\n\s+pull-requests: read/);
    expect(yml).not.toMatch(/pull_request_target/);
  });

  it('reads the gate script from the base commit and inlines no expression into a shell', () => {
    expect(yml).toMatch(/ref: \$\{\{ github\.event\.pull_request\.base\.sha \}\}/);
    // Collect the body of every `run:` step. Values reach the shell through `env:` only.
    const lines = yml.split('\n');
    const bodies = [];
    for (let i = 0; i < lines.length; i += 1) {
      const m = lines[i].match(/^(\s+)run:\s*(.*)$/);
      if (!m) continue;
      const indent = m[1].length;
      let body = m[2].replace(/^\|\s*$/, '');
      for (let j = i + 1; j < lines.length; j += 1) {
        const next = lines[j];
        if (next.trim() === '') { body += '\n'; continue; }
        if (next.search(/\S/) <= indent) break;
        body += `\n${next}`;
      }
      bodies.push(body);
    }
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    for (const body of bodies) expect(body).not.toContain('${{');
    expect(yml).toMatch(/PR_HEAD_REF: \$\{\{ github\.event\.pull_request\.head\.ref \}\}/);
  });

  it('is report-only unless the repository variable says otherwise', () => {
    expect(yml).toMatch(/GROK_BOT_PATH_GATE_ENFORCE: \$\{\{ vars\.GROK_BOT_PATH_GATE_ENFORCE \|\| 'false' \}\}/);
  });
});
