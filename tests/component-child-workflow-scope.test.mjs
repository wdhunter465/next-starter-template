import fs from 'node:fs';

import { describe, expect, it } from 'vitest';

describe('Component Child Integration workflow scope', () => {
	it('guards review and workflow-run events to component bases before runner allocation', () => {
		const workflow = fs.readFileSync('.github/workflows/component-child-integration.yml', 'utf8');

		expect(workflow).toContain("startsWith(github.event.pull_request.base.ref, 'component/')");
		expect(workflow).toContain("startsWith(github.event.workflow_run.pull_requests[0].base.ref, 'component/')");
		expect(workflow).toContain("github.event.workflow_run.pull_requests[0].number != null");
	});
});
