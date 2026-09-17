#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// #2820: catch normative restatement of a subject outside its canonical
// owning document. Each entry below is a real, previously-found duplication
// instance (not a hypothetical rule) - the registry is meant to grow as new
// instances are found, not to be exhaustive on day one.
export const DUPLICATION_SIGNATURES = [
  {
    label: 'collaboration canonical event pattern (#2820)',
    ownerPath: 'docs/governance/WORK-QUEUES-AND-COLLABORATION.md',
    phrase: 'COLLABORATION ACKNOWLEDGED',
  },
];

const GOVERNANCE_SCAN_ROOTS = [
  'docs/governance',
  'docs/ops/ai',
  'governance/ai',
  'ops/ai',
];

const EXTRA_SCAN_FILES = ['Agent.md', 'AGENTS.md'];

function listMarkdownFiles(root, base) {
  const dir = path.join(base, root);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    // Join with a literal '/' (not path.join) so the returned relative path
    // is always POSIX-style, matching the hardcoded '/'-separated ownerPath
    // values in DUPLICATION_SIGNATURES regardless of host OS.
    const rel = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      out.push(...listMarkdownFiles(rel, base));
    } else if (entry.name.endsWith('.md')) {
      out.push(rel);
    }
  }
  return out;
}

function collectScanFiles(root) {
  const files = new Set();
  for (const scanRoot of GOVERNANCE_SCAN_ROOTS) {
    for (const file of listMarkdownFiles(scanRoot, root)) {
      files.add(file);
    }
  }
  for (const file of EXTRA_SCAN_FILES) {
    if (fs.existsSync(path.join(root, file))) {
      files.add(file);
    }
  }
  return [...files];
}

export function checkGovernanceDuplication(root) {
  const failures = [];
  const files = collectScanFiles(root);

  for (const signature of DUPLICATION_SIGNATURES) {
    const ownerFullPath = path.join(root, signature.ownerPath);
    if (!fs.existsSync(ownerFullPath)) {
      failures.push(`${signature.label}: declared owner file is missing: ${signature.ownerPath}`);
      continue;
    }

    const ownerContent = fs.readFileSync(ownerFullPath, 'utf8');
    if (!ownerContent.includes(signature.phrase)) {
      failures.push(`${signature.label}: phrase not found in declared owner ${signature.ownerPath}`);
    }

    for (const file of files) {
      if (file === signature.ownerPath) {
        continue;
      }

      const content = fs.readFileSync(path.join(root, file), 'utf8');
      if (content.includes(signature.phrase) && !content.includes(signature.ownerPath)) {
        failures.push(
          `${signature.label}: ${file} repeats the owning phrase without citing ${signature.ownerPath}`,
        );
      }
    }
  }

  return failures;
}

function main(root) {
  const failures = checkGovernanceDuplication(root);

  if (failures.length > 0) {
    console.error('Governance duplication check FAILED.');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log('Governance duplication check PASSED.');
}

const isMain = process.argv[1]
  && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isMain) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  main(root);
}
