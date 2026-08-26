import fs from 'node:fs';
import path from 'node:path';

const WORKFLOW_DIR = '.github/workflows';

/** @type {Array<{ file: string; workflowName: string; jobIds: string[]; required: boolean; notes?: string }>} */
export const MERGE_PROTECTION_SURFACE = [
  {
    file: 'gate-quality.yml',
    workflowName: 'GATE — Quality Checks',
    jobIds: ['quality'],
    required: true,
    notes: 'Class-aware structure, ZIP, typecheck, lint, targeted test, and build routing.',
  },
  {
    file: 'gitleaks.yml',
    workflowName: 'GATE — Secret Scan',
    jobIds: ['gitleaks'],
    required: true,
    notes: 'Deterministic secret exposure blocker.',
  },
  {
    file: 'reviewer-response-completion.yml',
    workflowName: 'GATE — Reviewer Response Completion',
    jobIds: ['reviewer-response-completion'],
    required: true,
    notes: '#3746: Required so late trusted review events re-pending merge eligibility before enforcement completes.',
  },
];

/** @type {Array<{ file: string; workflowName: string; jobIds: string[]; notes?: string }>} */
export const ADVISORY_PR_PROCESS_WORKFLOWS = [
  {
    file: 'gate-pr-hygiene.yml',
    workflowName: 'GATE — PR Hygiene',
    jobIds: ['pr-hygiene'],
    notes: 'Advisory stable PR-body validation.',
  },
  {
    file: 'gate-diff-scope.yml',
    workflowName: 'GATE — Diff Scope',
    jobIds: ['diff-scope'],
    notes: 'Advisory allowed-path diff validation.',
  },
];

/** @type {Array<{ file: string; workflowName: string; jobIds: string[]; notes?: string }>} */
export const MANUAL_ONLY_PR_PROCESS_WORKFLOWS = [
  {
    file: 'gate-intent-labeler.yml',
    workflowName: 'GATE — Intent Labeler',
    jobIds: ['label-intent'],
    notes: 'Manual-only; avoid label mutation loops until rebuilt advisory-first.',
  },
  {
    file: 'ops-pr-issue-accounting.yml',
    workflowName: 'GATE — PR Issue Accounting',
    jobIds: ['pr-issue-accounting'],
    notes: 'Manual-only while paused during #2208.',
  },
  {
    file: 'gate-drift.yml',
    workflowName: 'GATE — Drift Control',
    jobIds: ['drift-gate'],
    notes: 'Manual-only pending rebuild; do not restore auto-trigger marker.',
  },
  {
    file: 'gate-branch-freshness.yml',
    workflowName: 'GATE — Branch Freshness',
    jobIds: ['branch-freshness'],
    notes: 'Manual-only pending rebuild; do not restore auto-trigger marker.',
  },
  {
    file: 'docs-guardrails.yml',
    workflowName: 'Docs Guardrails',
    jobIds: ['docs_guardrails'],
    notes: 'Manual-only pending rebuild; do not restore auto-trigger marker.',
  },
  {
    file: 'design-compliance-warn.yml',
    workflowName: 'Design Compliance (Warn)',
    jobIds: ['design_compliance_warn'],
    notes: 'Manual-only pending rebuild; do not restore auto-trigger marker.',
  },
  {
    file: 'gate-post-merge-readiness.yml',
    workflowName: 'GATE — Post-Merge Readiness',
    jobIds: ['post-merge-readiness'],
    notes: 'Retired pre-merge auto-trigger; manual backfill only.',
  },
];

/** @type {string[]} */
export const RETIRED_MERGE_PROTECTION_WORKFLOWS = ['gate-zip-safety.yml'];

function extractWorkflowName(contents) {
  const match = contents.match(/^name:\s*(.+)$/m);
  return match ? match[1].trim() : '';
}

function extractJobIds(contents) {
  const jobsMatch = contents.match(/^jobs:\s*$/m);
  if (!jobsMatch) {
    return [];
  }

  const jobsSection = contents.slice(jobsMatch.index);
  const ids = [];
  for (const match of jobsSection.matchAll(/^  ([A-Za-z0-9_-]+):\s*$/gm)) {
    ids.push(match[1]);
  }
  return ids;
}

export function validateMergeProtectionSurface(options = {}) {
  const root = options.root ?? process.cwd();
  const errors = [];

  for (const retired of RETIRED_MERGE_PROTECTION_WORKFLOWS) {
    if (fs.existsSync(path.join(root, WORKFLOW_DIR, retired))) {
      errors.push(`${retired} must be retired; ZIP checks belong in gate-quality.yml`);
    }
  }

  for (const entry of MERGE_PROTECTION_SURFACE) {
    const workflowPath = path.join(root, WORKFLOW_DIR, entry.file);
    if (!fs.existsSync(workflowPath)) {
      errors.push(`Missing merge-protection workflow: ${entry.file}`);
      continue;
    }

    const contents = fs.readFileSync(workflowPath, 'utf8');
    const workflowName = extractWorkflowName(contents);
    const jobIds = extractJobIds(contents);

    if (workflowName !== entry.workflowName) {
      errors.push(`${entry.file} workflow name must be "${entry.workflowName}" (found "${workflowName}")`);
    }

    for (const jobId of entry.jobIds) {
      if (!jobIds.includes(jobId)) {
        errors.push(`${entry.file} must define job id "${jobId}"`);
      }
    }
  }

  for (const entry of ADVISORY_PR_PROCESS_WORKFLOWS) {
    const workflowPath = path.join(root, WORKFLOW_DIR, entry.file);
    if (!fs.existsSync(workflowPath)) {
      errors.push(`Missing advisory PR-process workflow: ${entry.file}`);
      continue;
    }

    const contents = fs.readFileSync(workflowPath, 'utf8');
    const workflowName = extractWorkflowName(contents);
    const jobIds = extractJobIds(contents);

    if (workflowName !== entry.workflowName) {
      errors.push(`${entry.file} workflow name must be "${entry.workflowName}" (found "${workflowName}")`);
    }

    for (const jobId of entry.jobIds) {
      if (!jobIds.includes(jobId)) {
        errors.push(`${entry.file} must define job id "${jobId}"`);
      }
    }
  }

  for (const entry of MANUAL_ONLY_PR_PROCESS_WORKFLOWS) {
    const workflowPath = path.join(root, WORKFLOW_DIR, entry.file);
    if (!fs.existsSync(workflowPath)) {
      errors.push(`Missing manual-only PR-process workflow: ${entry.file}`);
      continue;
    }

    const contents = fs.readFileSync(workflowPath, 'utf8');
    const workflowName = extractWorkflowName(contents);
    const jobIds = extractJobIds(contents);

    if (workflowName !== entry.workflowName) {
      errors.push(`${entry.file} workflow name must be "${entry.workflowName}" (found "${workflowName}")`);
    }

    for (const jobId of entry.jobIds) {
      if (!jobIds.includes(jobId)) {
        errors.push(`${entry.file} must define job id "${jobId}"`);
      }
    }

    if (!/^on:\s*\n\s*workflow_dispatch:/m.test(contents)) {
      errors.push(`${entry.file} must be manual-only (workflow_dispatch trigger only)`);
    }
  }

  const qualityPath = path.join(root, WORKFLOW_DIR, 'gate-quality.yml');
  if (fs.existsSync(qualityPath)) {
    const qualityContents = fs.readFileSync(qualityPath, 'utf8');
    for (const requiredStep of [
      'scripts/ci/pr_class_quality_plan.mjs',
      'scripts/ci/check_no_tracked_zips.sh',
      'scripts/ci/verify_zip_history_pr.sh',
    ]) {
      if (!qualityContents.includes(requiredStep)) {
        errors.push(`gate-quality.yml must invoke ${requiredStep}`);
      }
    }
    if (!qualityContents.includes('scripts/ci/backend_reference_guard.sh')) {
      errors.push('gate-quality.yml must invoke scripts/ci/backend_reference_guard.sh');
    }
  }

  return {
    ok: errors.length === 0,
    errors,
    surface: MERGE_PROTECTION_SURFACE,
    advisory: ADVISORY_PR_PROCESS_WORKFLOWS,
    manualOnly: MANUAL_ONLY_PR_PROCESS_WORKFLOWS,
    retired: RETIRED_MERGE_PROTECTION_WORKFLOWS,
  };
}

export function renderBranchProtectionChecklist() {
  const lines = [
    '## LGFC Merge Protection Required Checks',
    '',
    'Configure branch protection for `main` with these deterministic checks only:',
    '',
  ];

  for (const entry of MERGE_PROTECTION_SURFACE) {
    for (const jobId of entry.jobIds) {
      lines.push(`- \`${jobId}\` (${entry.workflowName})`);
    }
  }

  lines.push('', 'Advisory PR-process checks. Do not require these until promoted by a follow-up Ops issue:', '');
  for (const entry of ADVISORY_PR_PROCESS_WORKFLOWS) {
    for (const jobId of entry.jobIds) {
      lines.push(`- \`${jobId}\` (${entry.workflowName}) — ${entry.notes}`);
    }
  }

  lines.push('', 'Manual-only / paused PR-process workflows (not merge blockers):', '');
  for (const entry of MANUAL_ONLY_PR_PROCESS_WORKFLOWS) {
    for (const jobId of entry.jobIds) {
      lines.push(`- \`${jobId}\` (${entry.workflowName}) — ${entry.notes}`);
    }
  }

  lines.push(
    '',
    'Retired checks (remove from branch protection if still listed):',
    '',
    '- `check-no-zip-files` (`GATE — ZIP Safety`) — assimilated into `quality`',
    '- `post-merge-readiness` — retired as a pre-merge blocker',
    '- `pr-issue-accounting` — manual-only during #2208; do not require while paused',
    '- `drift` — advisory/marker unless explicitly reclassified',
    '',
    'OPS runtime and post-merge workflows must not be required status checks.',
    '',
    '## #3746 late-review race note',
    '',
    'After promoting `reviewer-response-completion`, ensure branch protection / Rulesets',
    'list that check name as required. New trusted review events re-run the check for the',
    'current head SHA; while pending or failed, merge is blocked. Same-PR preparer handback',
    'remains the remediation path.',
  );

  return `${lines.join('\n')}\n`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = validateMergeProtectionSurface();
  if (!result.ok) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(renderBranchProtectionChecklist());
  }
}
