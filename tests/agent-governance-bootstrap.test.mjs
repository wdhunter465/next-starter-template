import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import {
  AGENTS_MD_BOOTSTRAP_REPORT_REQUIRED,
  AGENTS_MD_CLOUD_BOOTSTRAP_REQUIRED_PHRASES,
  AGENTS_MD_PR_BOOTSTRAP_REPORT_REQUIRED,
  BOOTSTRAP_RULE_FILES,
  MAX_BOOTSTRAP_RULE_LINES,
  runAgentGovernanceCheck,
  validateBootstrap,
} from '../.agents/checks/agent-governance-check.mjs';

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-bootstrap-'));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return dir;
}

function minimalRuleBody(extra = '') {
  return `---
description: test rule
alwaysApply: true
---

# Bootstrap

Read Agent.md, docs/governance/REPOSITORY-AUTHORITY.md, docs/governance/AGENT-TEAM.md, docs/ops/ai/CORE-RULES.md,
docs/ops/ai/CURSOR-RULES.md, .agents/skills/lgfc-pr-governance/SKILL.md,
.github/pull_request_template.md, docs/how-to/cursor/open-task-pr.md.
${extra}
`;
}

function minimalAgentsMd() {
  const reportLines = [
    ...AGENTS_MD_BOOTSTRAP_REPORT_REQUIRED,
    ...AGENTS_MD_PR_BOOTSTRAP_REPORT_REQUIRED,
  ].join('\n- ');

  return `# AGENTS.md

When a Cloud Agent session loads this file, the bootstrap is not complete until the agent has read the canonical chain below.

Do not merely report that these files are required. Read them before making any repo-work, readiness, implementation, or PR-governance claim:

1. Agent.md
2. docs/governance/REPOSITORY-AUTHORITY.md
3. docs/governance/AGENT-TEAM.md
4. docs/ops/ai/CORE-RULES.md
5. docs/ops/ai/CURSOR-RULES.md
6. .agents/skills/lgfc-pr-governance/SKILL.md
7. .github/pull_request_template.md
8. docs/how-to/cursor/open-task-pr.md

A bootstrap report that says these files are "required but not yet read" is noncompliant.

## First bootstrap report

- ${reportLines}
`;
}

function minimalCanonicalFiles() {
  return {
    'Agent.md': '# Agent\n\n.cursor/rules/\n\nAGENTS.md\n',
    'docs/governance/REPOSITORY-AUTHORITY.md': '# authority\n',
    'docs/governance/AGENT-TEAM.md': '# team\n',
    'docs/ops/ai/CORE-RULES.md': '# core\n',
    'docs/ops/ai/CURSOR-RULES.md': '# cursor\n',
    '.agents/skills/lgfc-pr-governance/SKILL.md': '# pr governance\n',
    '.github/pull_request_template.md': '# template\n',
    'docs/how-to/cursor/open-task-pr.md': '# open task pr\n',
  };
}

function minimalBootstrapFixture(overrides = {}) {
  const ruleFiles = Object.fromEntries(
    BOOTSTRAP_RULE_FILES.map((file) => [file, minimalRuleBody()]),
  );

  return {
    ...minimalCanonicalFiles(),
    ...ruleFiles,
    'AGENTS.md': minimalAgentsMd(),
    ...overrides,
  };
}

describe('agent governance bootstrap validation', () => {
  it('passes on the live repository', () => {
    expect(runAgentGovernanceCheck(repoRoot)).toEqual([]);
  });

  it('reports missing bootstrap files', () => {
    const root = makeTempRepo(minimalCanonicalFiles());
    const failures = validateBootstrap(root);

    expect(failures.some((failure) => failure.includes('missing bootstrap file'))).toBe(true);
  });

  it('reports missing alwaysApply: true', () => {
    const root = makeTempRepo(minimalBootstrapFixture({
      [BOOTSTRAP_RULE_FILES[0]]: `---
description: test
alwaysApply: false
---

# Bootstrap

Read Agent.md, docs/governance/REPOSITORY-AUTHORITY.md, docs/governance/AGENT-TEAM.md, docs/ops/ai/CORE-RULES.md,
docs/ops/ai/CURSOR-RULES.md, .agents/skills/lgfc-pr-governance/SKILL.md,
.github/pull_request_template.md.
`,
    }));

    const failures = validateBootstrap(root);
    expect(failures.some((failure) => failure.includes('alwaysApply: true'))).toBe(true);
  });

  it('reports missing canonical path references', () => {
    const root = makeTempRepo(minimalBootstrapFixture({
      'AGENTS.md': '# AGENTS.md\n\nRead Agent.md only.\n',
      [BOOTSTRAP_RULE_FILES[0]]: `---
description: test
alwaysApply: true
---

# Bootstrap

Read Agent.md only.
`,
      [BOOTSTRAP_RULE_FILES[1]]: `---
description: test
alwaysApply: true
---

# Bootstrap

Read Agent.md only.
`,
      [BOOTSTRAP_RULE_FILES[2]]: `---
description: test
alwaysApply: true
---

# Bootstrap

Read Agent.md only.
`,
    }));

    const failures = validateBootstrap(root);
    expect(failures.some((failure) => failure.includes('canonical path'))).toBe(true);
  });

  it('reports line-budget violations', () => {
    const padding = '\n'.repeat(MAX_BOOTSTRAP_RULE_LINES);
    const root = makeTempRepo(minimalBootstrapFixture({
      [BOOTSTRAP_RULE_FILES[0]]: `${minimalRuleBody()}${padding}`,
    }));

    const failures = validateBootstrap(root);
    expect(failures.some((failure) => failure.includes('exceeds'))).toBe(true);
  });

  it('reports forbidden MCP config paths', () => {
    const root = makeTempRepo({
      ...minimalBootstrapFixture(),
      'mcp.json': '{}\n',
    });

    const failures = validateBootstrap(root);
    expect(failures.some((failure) => failure.includes('forbidden MCP config path'))).toBe(true);
  });

  it('reports missing Cloud bootstrap hardening phrases in AGENTS.md', () => {
    const root = makeTempRepo(minimalBootstrapFixture({
      'AGENTS.md': '# AGENTS.md\n\nRead Agent.md only.\n',
    }));

    const failures = validateBootstrap(root);
    expect(failures.some((failure) => failure.includes('Cloud bootstrap hardening phrase'))).toBe(true);
    expect(failures.some((failure) => failure.includes('bootstrap report contract line'))).toBe(true);
  });

  it('reports missing bootstrap report contract lines in AGENTS.md', () => {
    const root = makeTempRepo(minimalBootstrapFixture({
      'AGENTS.md': `# AGENTS.md

${AGENTS_MD_CLOUD_BOOTSTRAP_REQUIRED_PHRASES.join('\n')}
`,
    }));

    const failures = validateBootstrap(root);
    expect(failures.some((failure) => failure.includes('bootstrap report contract line'))).toBe(true);
  });

  it('passes a minimal valid bootstrap fixture', () => {
    const root = makeTempRepo(minimalBootstrapFixture());
    expect(validateBootstrap(root)).toEqual([]);
  });
});
