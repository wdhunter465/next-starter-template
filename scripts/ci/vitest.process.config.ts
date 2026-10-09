import { defineConfig } from 'vitest/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const knownFailing = JSON.parse(
  fs.readFileSync(path.join(here, 'process-tests-known-failing.json'), 'utf8'),
).files.map((entry: { file: string }) => entry.file);

// Reviewer-lifecycle and post-merge closeout tests. The default config excludes these
// so the UI suite stays fast; this config runs them (#4466).
export default defineConfig({
  root,
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/reviewer-*.test.mjs', 'tests/post-merge-*.test.mjs'],
    exclude: ['**/node_modules/**', ...knownFailing],
  },
});
