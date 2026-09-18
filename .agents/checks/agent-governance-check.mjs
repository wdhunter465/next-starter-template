#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BOOTSTRAP_RULE_FILES = [
  '.cursor/rules/00-mandatory-doc-chain.mdc',
  '.cursor/rules/10-pr-governance-preflight.mdc',
  '.cursor/rules/20-stop-conditions.mdc',
];

export const BOOTSTRAP_FILES = [
  ...BOOTSTRAP_RULE_FILES,
  'AGENTS.md',
];

export const BOOTSTRAP_REQUIRED_PATH_REFERENCES = [
  'Agent.md',
  'docs/governance/REPOSITORY-AUTHORITY.md',
  'docs/governance/AGENT-TEAM.md',
  'docs/ops/ai/CORE-RULES.md',
  'docs/ops/ai/CURSOR-RULES.md',
  'docs/ops/ai/CODEX-RULES.md',
  'docs/ops/ai/CHATGPT-RULES.md',
  '.agents/skills/lgfc-pr-governance/SKILL.md',
  '.github/pull_request_template.md',
  'docs/how-to/cursor/open-task-pr.md',
];

export const AGENTS_MD_CLOUD_BOOTSTRAP_REQUIRED_PHRASES = [
  'bootstrap is not complete until the agent has read the canonical chain',
  'Do not merely report that these files are required',
  'repo-work, readiness, implementation, or PR-governance claim',
  'required but not yet read',
  'docs/how-to/cursor/open-task-pr.md',
  'compatibility/router',
  'applicable product-specific pointer',
  'Cursor Cloud route',
];

export const AGENTS_MD_EXCLUSIVE_CURSOR_STEP5 = /^\s*5\.\s*`?docs\/ops\/ai\/CURSOR-RULES\.md`?\s*$/m;

export const AGENTS_MD_BOOTSTRAP_REPORT_REQUIRED = [
  'AGENTS.md: read',
  'Agent.md: read',
  'REPOSITORY-AUTHORITY.md: read',
  'AGENT-TEAM.md: read',
  'CORE-RULES.md: read',
  'CURSOR-RULES.md: read',
];

export const AGENTS_MD_PR_BOOTSTRAP_REPORT_REQUIRED = [
  'lgfc-pr-governance/SKILL.md: read',
  '.github/pull_request_template.md: read',
  'docs/how-to/cursor/open-task-pr.md: read',
];

export const BOOTSTRAP_FORBIDDEN_MCP_PATHS = [
  'mcp.json',
  '.cursor/mcp.json',
];

export const MAX_BOOTSTRAP_RULE_LINES = 80;

const requiredFiles = [
  'Agent.md',
  '.agents/checks/agent-governance-check.mjs',
  '.agents/skills/lgfc-pr-governance/SKILL.md',
  '.agents/skills/lgfc-design-compliance/SKILL.md',
  '.agents/skills/lgfc-docs-authority/SKILL.md',
  '.agents/skills/lgfc-cloudflare-static-export/SKILL.md',
  '.agents/skills/lgfc-verification-closeout/SKILL.md',
  '.github/workflows/agent-governance.yml',
  'governance/ai/AGENT-GOVERNANCE.md',
  'ops/ai/CROSS-AGENT-OPERATING-RULES.md',
  'docs/ops/ai/CORE-RULES.md',
  'docs/ops/ai/CODEX-RULES.md',
];

const requiredAgentText = [
  '.agents/skills/lgfc-pr-governance/SKILL.md',
  '.agents/skills/lgfc-design-compliance/SKILL.md',
  '.agents/skills/lgfc-docs-authority/SKILL.md',
  '.agents/skills/lgfc-cloudflare-static-export/SKILL.md',
  '.agents/skills/lgfc-verification-closeout/SKILL.md',
  'docs/ops/ai/CORE-RULES.md',
  'docs/ops/ai/CODEX-RULES.md',
  '.agents/checks/agent-governance-check.mjs',
  '.github/workflows/agent-governance.yml',
];

// #2823: governance/ai/AGENT-GOVERNANCE.md and ops/ai/CROSS-AGENT-OPERATING-RULES.md
// are retired as authority surfaces (they previously defined a competing authority
// order that never referenced REPOSITORY-AUTHORITY.md). They still exist as
// historical record, and Agent.md still names them as historical/superseded, but
// Agent.md must no longer cite them as required reading — enforce the retirement
// marker instead of the old citation requirement.
const SUPERSEDED_MARKER = 'SUPERSEDED (#2823';

const LEGACY_MARKDOWN_FILES = [
  'governance/ai/AGENT-GOVERNANCE.md',
  'ops/ai/CROSS-AGENT-OPERATING-RULES.md',
];

function filePath(root, relativePath) {
  return path.join(root, relativePath);
}

function exists(root, relativePath) {
  return fs.existsSync(filePath(root, relativePath));
}

function read(root, relativePath) {
  const content = fs.readFileSync(filePath(root, relativePath), 'utf8');
  return content.startsWith('\uFEFF') ? content.slice(1) : content;
}

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return null;
  }

  const values = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    values[key] = value;
  }

  return values;
}

export function validateLegacyAgentGovernance(root) {
  const failures = [];

  for (const file of requiredFiles) {
    if (!exists(root, file)) {
      failures.push(`missing required file: ${file}`);
    }
  }

  if (exists(root, 'Agent.md')) {
    const agent = read(root, 'Agent.md');
    for (const required of requiredAgentText) {
      if (!agent.includes(required)) {
        failures.push(`Agent.md does not reference required path: ${required}`);
      }
    }
  }

  for (const markdownFile of LEGACY_MARKDOWN_FILES) {
    if (!exists(root, markdownFile)) {
      continue;
    }

    const content = read(root, markdownFile);
    if (!/^---\r?\n/.test(content)) {
      failures.push(`${markdownFile} is missing required docs header fence`);
    }
    if (!content.includes(SUPERSEDED_MARKER)) {
      failures.push(`${markdownFile} is missing its superseded/retirement marker`);
    }
  }

  if (exists(root, 'Agent.md')) {
    const agent = read(root, 'Agent.md');
    for (const legacyFile of LEGACY_MARKDOWN_FILES) {
      if (!agent.includes(legacyFile)) {
        failures.push(`Agent.md does not reference retired path: ${legacyFile}`);
      }
    }
    if (!agent.includes('historical/superseded')) {
      failures.push('Agent.md must mark the legacy governance/ops files as historical/superseded, not required navigation');
    }
  }

  return failures;
}

export function validateBootstrap(root) {
  const failures = [];

  for (const file of BOOTSTRAP_FILES) {
    if (!exists(root, file)) {
      failures.push(`missing bootstrap file: ${file}`);
    }
  }

  for (const file of BOOTSTRAP_FORBIDDEN_MCP_PATHS) {
    if (exists(root, file)) {
      failures.push(`forbidden MCP config path must not exist: ${file}`);
    }
  }

  if (exists(root, 'Agent.md')) {
    const agent = read(root, 'Agent.md');
    if (!agent.includes('.cursor/rules/')) {
      failures.push('Agent.md must reference .cursor/rules/ bootstrap');
    }
    if (!agent.includes('AGENTS.md')) {
      failures.push('Agent.md must reference AGENTS.md bootstrap');
    }
  }

  const bootstrapContents = [];

  for (const ruleFile of BOOTSTRAP_RULE_FILES) {
    if (!exists(root, ruleFile)) {
      continue;
    }

    const content = read(root, ruleFile);
    bootstrapContents.push(content);
    const lineCount = content.split('\n').length;
    if (lineCount > MAX_BOOTSTRAP_RULE_LINES) {
      failures.push(`${ruleFile} exceeds ${MAX_BOOTSTRAP_RULE_LINES} lines (${lineCount})`);
    }

    const frontmatter = parseFrontmatter(content);
    if (!frontmatter) {
      failures.push(`${ruleFile} is missing YAML frontmatter`);
      continue;
    }

    if (frontmatter.alwaysApply !== 'true') {
      failures.push(`${ruleFile} must set alwaysApply: true`);
    }
  }

  let agentsMd = '';

  if (exists(root, 'AGENTS.md')) {
    agentsMd = read(root, 'AGENTS.md');
    bootstrapContents.push(agentsMd);

    for (const phrase of AGENTS_MD_CLOUD_BOOTSTRAP_REQUIRED_PHRASES) {
      if (!agentsMd.includes(phrase)) {
        failures.push(`AGENTS.md must include Cloud bootstrap hardening phrase: ${phrase}`);
      }
    }

    for (const reportLine of [
      ...AGENTS_MD_BOOTSTRAP_REPORT_REQUIRED,
      ...AGENTS_MD_PR_BOOTSTRAP_REPORT_REQUIRED,
    ]) {
      if (!agentsMd.includes(reportLine)) {
        failures.push(`AGENTS.md must define bootstrap report contract line: ${reportLine}`);
      }
    }

    if (AGENTS_MD_EXCLUSIVE_CURSOR_STEP5.test(agentsMd)) {
      failures.push('AGENTS.md must not force every product through CURSOR-RULES.md as numbered step 5');
    }

    for (const productPointer of ['docs/ops/ai/CODEX-RULES.md', 'docs/ops/ai/CHATGPT-RULES.md']) {
      if (!agentsMd.includes(productPointer)) {
        failures.push(`AGENTS.md must route the matching product through ${productPointer}`);
      }
    }
  }

  const combinedBootstrap = bootstrapContents.join('\n');
  for (const requiredPath of BOOTSTRAP_REQUIRED_PATH_REFERENCES) {
    if (!combinedBootstrap.includes(requiredPath)) {
      failures.push(`bootstrap files must reference canonical path: ${requiredPath}`);
    }
    if (!exists(root, requiredPath)) {
      failures.push(`bootstrap references missing canonical file: ${requiredPath}`);
    }
  }

  return failures;
}

export function runAgentGovernanceCheck(root) {
  return [
    ...validateLegacyAgentGovernance(root),
    ...validateBootstrap(root),
  ];
}

function main(root) {
  const failures = runAgentGovernanceCheck(root);

  if (failures.length > 0) {
    console.error('Agent governance check FAILED.');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Agent governance check PASSED.');
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  main(root);
}
