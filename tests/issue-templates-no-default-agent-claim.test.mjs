import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEMPLATE_DIR = path.join(process.cwd(), '.github', 'ISSUE_TEMPLATE');
const AGENT_CLAIM_LABEL = /^agent:(cursor|claude|grok|work|codex)$/i;

function parseFrontmatterLabels(source) {
  const match = String(source || '').match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return [];
  const labelsLine = match[1].split(/\r?\n/).find((line) => /^\s*labels\s*:/.test(line));
  if (!labelsLine) return [];
  const quoted = [...labelsLine.matchAll(/['"]([^'"]+)['"]/g)].map((entry) => entry[1]);
  if (quoted.length > 0) return quoted;
  const inline = labelsLine.replace(/^\s*labels\s*:\s*/, '').trim();
  if (!inline || inline === '[]') return [];
  return inline
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

describe('GitHub issue templates do not pre-assign agent claims (#3240)', () => {
  const files = fs
    .readdirSync(TEMPLATE_DIR)
    .filter((name) => name.endsWith('.md') || name.endsWith('.yml') || name.endsWith('.yaml'))
    .sort();

  it('finds issue templates to audit', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('does not set agent:* claim labels by default', () => {
    const violations = [];
    for (const name of files) {
      const body = fs.readFileSync(path.join(TEMPLATE_DIR, name), 'utf8');
      const labels = parseFrontmatterLabels(body);
      const claims = labels.filter((label) => AGENT_CLAIM_LABEL.test(label));
      if (claims.length > 0) {
        violations.push(`${name}: ${claims.join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
