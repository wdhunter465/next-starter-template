import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Guards docs/reference/design/color-standard.md (#4626): the document and the
// CSS tokens must agree, and a color token is defined in one place only.

const root = process.cwd();
const standard = readFileSync(resolve(root, 'docs/reference/design/color-standard.md'), 'utf8');

function standardTokens(): Map<string, string> {
  const tokens = new Map<string, string>();
  for (const line of standard.split('\n')) {
    const m = line.match(/^\|[^|]*\|\s*`(--[a-z0-9-]+)`\s*\|\s*`(#[0-9a-fA-F]{6})`\s*\|/);
    if (m) tokens.set(m[1], m[2].toLowerCase());
  }
  return tokens;
}

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) cssFiles(p, out);
    else if (name.endsWith('.css')) out.push(p);
  }
  return out;
}

// Every `--name: #hex` declaration in src CSS, with the file it is in.
function declaredColorTokens(): Array<{ token: string; hex: string; file: string }> {
  const found: Array<{ token: string; hex: string; file: string }> = [];
  for (const file of cssFiles(resolve(root, 'src'))) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g)) {
      found.push({ token: m[1], hex: m[2].toLowerCase(), file: file.replace(root + '/', '') });
    }
  }
  return found;
}

describe('color standard (#4626)', () => {
  const documented = standardTokens();
  const declared = declaredColorTokens();
  const colorTokens = declared.filter((d) => /^--(lgfc|brand)-/.test(d.token));

  it('the standard lists the core palette', () => {
    expect(documented.get('--lgfc-blue')).toBe('#0033cc');
    expect(documented.get('--lgfc-blue-hover')).toBe('#0028a3');
    expect(documented.size).toBeGreaterThanOrEqual(15);
  });

  it('every color token in code appears in the standard with the same value', () => {
    const problems = colorTokens
      .filter((d) => documented.get(d.token) !== d.hex)
      .map((d) => `${d.token}=${d.hex} in ${d.file} (standard: ${documented.get(d.token) ?? 'not listed'})`);
    expect(problems).toEqual([]);
  });

  it('every token in the standard is defined in code', () => {
    const inCode = new Set(colorTokens.map((d) => d.token));
    const missing = [...documented.keys()].filter((t) => !inCode.has(t));
    expect(missing).toEqual([]);
  });

  it('no color token is defined twice', () => {
    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const d of colorTokens) {
      if (seen.has(d.token)) duplicates.push(`${d.token} in ${seen.get(d.token)} and ${d.file}`);
      else seen.set(d.token, d.file);
    }
    expect(duplicates).toEqual([]);
  });
});
