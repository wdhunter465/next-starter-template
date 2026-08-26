import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Post-Merge Model C workflow security', () => {
	it('passes pull request body through the environment instead of interpolating it into shell source', () => {
		const workflow = fs.readFileSync('.github/workflows/post-merge-model-c.yml', 'utf8');

		expect(workflow).toContain('PULL_REQUEST_BODY: ${{ github.event.pull_request.body }}');
		expect(workflow).toContain('printf \'%s\\n\' "$PULL_REQUEST_BODY" > "$RUNNER_TEMP/pr_body.md"');
		expect(workflow).not.toContain('BODY="${{ github.event.pull_request.body }}"');
		expect(workflow).toContain('gh pr view "$PR_NUMBER" --json body -q .body > "$RUNNER_TEMP/pr_body.md"');
	});
});
