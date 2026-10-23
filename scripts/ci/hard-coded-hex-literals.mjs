import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const TOKEN_FILES = new Set(['src/app/globals.css', 'src/styles/variables.css']);
const SOURCE_EXT = new Set(['.css', '.tsx', '.ts', '.jsx', '.js', '.mjs']);
const HEX = /#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;

function normalizeHex(hex) {
  const value = hex.toLowerCase();
  if (value.length === 4) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return value;
}

function isTokenFallback(line, index) {
  return /var\(\s*--[a-z0-9-]+\s*,\s*$/.test(line.slice(0, index));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

export function collectHardCodedHexLiterals(root = process.cwd()) {
  const src = resolve(root, 'src');
  const found = [];
  for (const file of walk(src)) {
    const ext = file.slice(file.lastIndexOf('.'));
    if (!SOURCE_EXT.has(ext)) continue;
    const rel = relative(root, file).split('\\').join('/');
    if (TOKEN_FILES.has(rel)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, index) => {
      for (const match of line.matchAll(HEX)) {
        if (isTokenFallback(line, match.index ?? 0)) continue;
        found.push(`${rel}:${index + 1}:${normalizeHex(match[0])}`);
      }
    });
  }
  found.sort();
  return found;
}
