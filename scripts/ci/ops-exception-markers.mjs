// Shared markers for Operations exception Issues (#5328 / #4444 / #4637).
// One open ops-exception Issue per workflow: later openers comment instead of creating another.

export const EXCEPTION_WORKFLOW_PREFIX = 'ops-exception-workflow:';
export const HALT_FILE_PREFIX = 'ops-halt:';

export function exceptionMarker(workflowName) {
  return `<!-- ${EXCEPTION_WORKFLOW_PREFIX}${workflowName} -->`;
}

export function haltMarker(file) {
  return `<!-- ${HALT_FILE_PREFIX}${file} -->`;
}

/**
 * Find one open non-PR Issue that already represents this workflow.
 * Matches either the workflow-name marker (#4444) or the halt-file marker (#4637).
 */
export function findOpenOpsException(issues, { name, file } = {}) {
  const markers = [];
  if (name) markers.push(exceptionMarker(name));
  if (file) markers.push(haltMarker(file));
  if (markers.length === 0) return null;
  return (issues || []).find((issue) => {
    if (issue.pull_request) return false;
    if (issue.state && issue.state !== 'open') return false;
    if (typeof issue.body !== 'string') return false;
    return markers.some((marker) => issue.body.includes(marker));
  }) || null;
}
