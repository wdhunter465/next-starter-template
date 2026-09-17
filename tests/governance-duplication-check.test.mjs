import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { checkGovernanceDuplication } from '../.agents/checks/governance-duplication-check.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const tempDirs = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempRepo(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'governance-dup-'));
  tempDirs.push(dir);

  for (const [relativePath, content] of Object.entries(files)) {
    const fullPath = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }

  return dir;
}

describe('governance duplication check (#2820)', () => {
  it('passes on the live repository', () => {
    expect(checkGovernanceDuplication(repoRoot)).toEqual([]);
  });

  it('flags a governance file that repeats the owning phrase without citing the owner', () => {
    const dir = makeTempRepo({
      'docs/governance/WORK-QUEUES-AND-COLLABORATION.md': 'Canonical event pattern:\nCOLLABORATION ACKNOWLEDGED\n',
      'docs/governance/PR_PROCESS.md': 'Some doc that says COLLABORATION ACKNOWLEDGED without citing the owner.',
    });

    const failures = checkGovernanceDuplication(dir);

    expect(failures).toContainEqual(
      expect.stringContaining('docs/governance/PR_PROCESS.md repeats the owning phrase'),
    );
  });

  it('passes when the repeating file cites the owner path', () => {
    const dir = makeTempRepo({
      'docs/governance/WORK-QUEUES-AND-COLLABORATION.md': 'Canonical event pattern:\nCOLLABORATION ACKNOWLEDGED\n',
      'docs/governance/PR_PROCESS.md':
        'See docs/governance/WORK-QUEUES-AND-COLLABORATION.md for the canonical pattern: COLLABORATION ACKNOWLEDGED.',
    });

    expect(checkGovernanceDuplication(dir)).toEqual([]);
  });

  it('reports a missing declared owner file', () => {
    const dir = makeTempRepo({
      'docs/governance/PR_PROCESS.md': 'no owner file present here',
    });

    const failures = checkGovernanceDuplication(dir);

    expect(failures).toContainEqual(
      expect.stringContaining('declared owner file is missing: docs/governance/WORK-QUEUES-AND-COLLABORATION.md'),
    );
  });
});
