#!/usr/bin/env node

import fs from 'node:fs';

export const REQUIRED_TEMPLATE_SECTIONS = [
  'PR Summary',
  'Scope',
  'Change Summary',
  'Verification',
  'Acceptance Criteria',
  'Reviewer / Bot Review Attestation',
];

export const VALID_PR_CLASSES = [
  'docs-governance',
  'docs-content',
  'code',
  'config',
  'ci',
  'release',
  'ops',
  'mixed-approved',
];

export function normalizeHeading(value = '') {
  return String(value).trim().replace(/\s+/g, ' ').toLowerCase();
}

export function findIssueReferences(body) {
  const text = body || '';
  return [...text.matchAll(/#(\d+)/g)].map((match) => Number(match[1]));
}

export function hasRequiredIssueLine(body) {
  return /^\s*-\s*\*\*Issue:\*\*\s+#\d+\s*$/m.test(body || '');
}

export function findCanonicalIssueLine(body) {
  const text = body || '';
  return text.split(/\r?\n/).find((line) => /^\s*-\s*\*\*Issue:\*\*\s+#\d+\s*$/.test(line.trim())) || '';
}

export function suggestCanonicalIssueLine(body) {
  const references = [...new Set(findIssueReferences(body))];
  if (references.length !== 1) return '';
  return `- **Issue:** #${references[0]}`;
}

export function hasZipSafetyStatement(body) {
  const text = body || '';
  return /No ZIP file exists in the repo root/i.test(text)
    || /No ZIP found in repo root/i.test(text)
    || /Any ZIP file present in the repo root was deleted before any other change/i.test(text);
}

export function extractMarkdownSection(body = '', heading = '') {
  const lines = String(body || '').split(/\r?\n/);
  const target = normalizeHeading(heading);
  let startIndex = -1;
  let startLevel = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const title = normalizeHeading(match[2]);
    if (title === target) {
      startIndex = index;
      startLevel = match[1].length;
      break;
    }
  }

  if (startIndex === -1) return '';

  const sectionLines = [];
  for (const line of lines.slice(startIndex + 1)) {
    const match = line.match(/^\s*(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (match && match[1].length <= startLevel) break;
    sectionLines.push(line);
  }

  return sectionLines.join('\n').trim();
}

export function hasSection(body = '', heading = '') {
  return extractMarkdownSection(body, heading).length > 0;
}

function cleanListValue(value = '') {
  return value.trim().replace(/^`|`$/g, '').trim();
}

function isPlaceholderPath(value = '') {
  return !value
    || /^path\/to\//i.test(value)
    || /^<.+>$/.test(value)
    || value.includes('____')
    || value.toLowerCase() === 'not-applicable';
}

export function parseAllowedFiles(body) {
  const lines = (body || '').split(/\r?\n/);
  const allowedIndex = lines.findIndex((line) => /^(Allowed paths|Allowed files):\s*$/i.test(line.trim()));
  if (allowedIndex === -1) return [];

  const files = [];
  for (const line of lines.slice(allowedIndex + 1)) {
    if (/^\s*#{1,6}\s+/.test(line)) break;
    if (/^\s*[^-\s].+?:\s*/.test(line) && line.trim() !== 'All other files are out of scope') break;
    if (line.trim() === 'All other files are out of scope') break;

    const match = line.match(/^\s*[-*]\s+`?([^`\n]+?)`?\s*$/);
    if (!match) continue;
    const value = cleanListValue(match[1]);
    if (!isPlaceholderPath(value)) files.push(value);
  }
  return files;
}

export function missingTemplateSections(body) {
  return REQUIRED_TEMPLATE_SECTIONS.filter((section) => !hasSection(body, section));
}

function allowedFileMatches(changedFile, allowedPattern) {
  if (allowedPattern.endsWith('/**')) {
    return changedFile.startsWith(allowedPattern.slice(0, -3));
  }
  return changedFile === allowedPattern;
}

export function findUnlistedChangedFiles(changedFiles, allowedFiles) {
  return changedFiles.filter((changedFile) => !allowedFiles.some((allowedFile) => allowedFileMatches(changedFile, allowedFile)));
}

function extractPrSummaryLine(body = '', label = '') {
  const section = extractMarkdownSection(body, 'PR Summary') || body;
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^\\s*-\\s*${escaped}:\\s*(.+?)\\s*$`, 'im');
  const match = section.match(pattern);
  return match ? match[1].trim() : '';
}

function stripHtmlComments(value = '') {
  return value.replace(/<!--([\s\S]*?)-->/g, '').trim();
}

function isMissingStableValue(value = '') {
  const cleaned = stripHtmlComments(value).trim();
  return !cleaned
    || cleaned.includes('____')
    || cleaned.includes('<')
    || cleaned.includes('>')
    || cleaned === '#____'
    || /^not-applicable$/i.test(cleaned);
}

export function parseIntentLabel(body = '') {
  return extractPrSummaryLine(body, 'Intent label');
}

export function parsePrClass(body = '') {
  return extractPrSummaryLine(body, 'PR class');
}

export function hasRequiredIntentLabel(body = '') {
  return !isMissingStableValue(parseIntentLabel(body));
}

export function hasRequiredPrClass(body = '') {
  const value = stripHtmlComments(parsePrClass(body)).trim();
  return VALID_PR_CLASSES.includes(value);
}

export function sectionHasSubstantiveText(body = '', heading = '') {
  const section = stripHtmlComments(extractMarkdownSection(body, heading));
  return section
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => !line.startsWith('- [ ]') && !/^Required:|^<!--|^PASS \/ FAIL|^YES \/ NO/i.test(line));
}

export function hasVerificationEvidence(body = '') {
  const section = extractMarkdownSection(body, 'Verification');
  return /Local verification:/i.test(section)
    && /CI verification:/i.test(section)
    // Reject template placeholder `Result: PASS / FAIL / NOT RUN` (matches prefix PASS)
    // and do not treat FAIL as clean verification evidence.
    && /Result:\s*(PASS|NOT RUN)\b(?!\s*\/)/i.test(section);
}

export function hasAcceptanceCriteriaEvidence(body = '') {
  const section = extractMarkdownSection(body, 'Acceptance Criteria');
  return /Source issue acceptance criteria reviewed/i.test(section)
    && /Follow-up issue required:/i.test(section);
}

export function hasReviewerAttestation(body = '') {
  const section = extractMarkdownSection(body, 'Reviewer / Bot Review Attestation');
  return /read all human review threads/i.test(section)
    && /read all bot\/advisory findings/i.test(section);
}

export const PR_HYGIENE_MARKER = '<!-- pr-hygiene-advisory -->';

/** Post-merge exception codes shifted left; these fail the hygiene job even while soft checks stay advisory. */
export const HARD_HYGIENE_CODES = new Set([
  'missing_allowlist',
  'allowlist_violation',
  'unchecked_acceptance_criterion',
  'forbidden_placeholder_token',
]);

const FORBIDDEN_PLACEHOLDER_PATTERN = /\b(TODO|TBD|placeholder)\b/i;

function firstAcceptanceSection(body = '') {
  for (const heading of [
    'Acceptance Criteria',
    'ACCEPTANCE CRITERIA',
    'ACCEPTANCE CRITERIA STATUS (MANDATORY)',
  ]) {
    const section = extractMarkdownSection(body, heading);
    if (section) return section;
  }
  return '';
}

/**
 * Hard pre-merge hygiene failures matching the dominant post-merge exception codes
 * (allowlist, unchecked AC checkboxes, forbidden placeholder tokens).
 */
export function hardHygieneFailures({ body = '', changedFiles = [] } = {}) {
  const failures = [];
  const allowedFiles = parseAllowedFiles(body);
  const normalizedChanged = (changedFiles || [])
    .map((file) => (typeof file === 'string' ? file : file?.filename || file?.path || ''))
    .filter(Boolean);

  if (!allowedFiles.length) {
    failures.push({
      code: 'missing_allowlist',
      message: 'PR body does not declare a file-touch allowlist.',
    });
  } else {
    for (const file of findUnlistedChangedFiles(normalizedChanged, allowedFiles)) {
      failures.push({
        code: 'allowlist_violation',
        message: `Changed file is outside declared allowlist: ${file}`,
      });
    }
  }

  const acceptanceSection = firstAcceptanceSection(body);
  for (const line of acceptanceSection.split(/\r?\n/)) {
    if (/^\s*[-*]\s*\[\s\]\s+/.test(line)) {
      failures.push({
        code: 'unchecked_acceptance_criterion',
        message: `Acceptance criterion left unchecked before merge: ${line.trim()}`,
      });
    }
  }

  if (FORBIDDEN_PLACEHOLDER_PATTERN.test(String(body || ''))) {
    failures.push({
      code: 'forbidden_placeholder_token',
      message: 'PR body contains a forbidden placeholder token.',
    });
  }

  return failures;
}

export function buildPrHygieneArtifact(report) {
  const hardFailures = report.hardFailures || [];
  return {
    gate: 'pr-hygiene',
    schemaVersion: 2,
    advisory: hardFailures.length === 0,
    isClean: report.isClean,
    hardFailures,
    checks: {
      hasRequiredIssueLine: report.hasRequiredIssueLine,
      hasRequiredIntentLabel: report.hasRequiredIntentLabel,
      hasRequiredPrClass: report.hasRequiredPrClass,
      hasAllowedFiles: report.hasAllowedFiles,
      hasChangeSummary: report.hasChangeSummary,
      hasVerificationEvidence: report.hasVerificationEvidence,
      hasAcceptanceCriteriaEvidence: report.hasAcceptanceCriteriaEvidence,
      hasReviewerAttestation: report.hasReviewerAttestation,
    },
    issueReferences: report.issueReferences,
    canonicalIssueLine: report.canonicalIssueLine,
    suggestedIssueLine: report.suggestedIssueLine,
    intentLabel: report.intentLabel,
    prClass: report.prClass,
    allowedFiles: report.allowedFiles,
    missingSections: report.missingSections,
    unlistedChangedFiles: report.unlistedChangedFiles,
  };
}

export function writePrHygieneArtifacts(report, env = process.env) {
  const artifact = buildPrHygieneArtifact(report);
  const jsonPath = env.PR_HYGIENE_RESULT_JSON || env.PR_VALIDATION_RESULT_JSON;
  const markdownPath = env.PR_HYGIENE_RESULT_MD || env.PR_VALIDATION_RESULT_MD;

  if (jsonPath) {
    fs.writeFileSync(jsonPath, `${JSON.stringify(artifact, null, 2)}\n`);
  }
  if (markdownPath) {
    fs.writeFileSync(markdownPath, `${renderPrHygieneReport(report)}\n`);
  }

  return artifact;
}

export function buildPrHygieneReport({ body = '', changedFiles = [] } = {}) {
  const allowedFiles = parseAllowedFiles(body);
  const missingSections = missingTemplateSections(body);
  const unlistedChangedFiles = findUnlistedChangedFiles(changedFiles, allowedFiles);
  const hardFailures = hardHygieneFailures({ body, changedFiles });
  const issueReferences = [...new Set(findIssueReferences(body))];
  const canonicalIssueLine = findCanonicalIssueLine(body);
  const suggestedIssueLine = hasRequiredIssueLine(body) ? canonicalIssueLine : suggestCanonicalIssueLine(body);
  const intentLabel = parseIntentLabel(body);
  const prClass = parsePrClass(body);

  const checks = {
    hasRequiredIssueLine: hasRequiredIssueLine(body),
    hasRequiredIntentLabel: hasRequiredIntentLabel(body),
    hasRequiredPrClass: hasRequiredPrClass(body),
    hasAllowedFiles: allowedFiles.length > 0,
    hasChangeSummary: sectionHasSubstantiveText(body, 'Change Summary'),
    hasVerificationEvidence: hasVerificationEvidence(body),
    hasAcceptanceCriteriaEvidence: hasAcceptanceCriteriaEvidence(body),
    hasReviewerAttestation: hasReviewerAttestation(body),
  };

  return {
    ...checks,
    issueReferences,
    canonicalIssueLine,
    suggestedIssueLine,
    intentLabel,
    prClass,
    allowedFiles,
    missingSections,
    unlistedChangedFiles,
    hardFailures,
    isClean: Object.values(checks).every(Boolean)
      && missingSections.length === 0
      && unlistedChangedFiles.length === 0
      && hardFailures.length === 0,
  };
}

export function renderPrHygieneReport(report) {
  const hardFailures = report.hardFailures || [];
  const lines = [
    hardFailures.length > 0 ? '## PR Hygiene Gate' : '## PR Hygiene Advisory',
    '',
  ];

  if (report.isClean && hardFailures.length === 0) {
    lines.push('No PR hygiene defects detected.');
    return lines.join('\n');
  }

  if (hardFailures.length > 0) {
    lines.push('### Blocking pre-merge hygiene failures');
    for (const failure of hardFailures) {
      lines.push(`- ${failure.code}: ${failure.message}`);
    }
    lines.push('');
  }

  if (report.isClean) {
    return lines.join('\n').trimEnd();
  }

  if (!report.hasRequiredIssueLine) {
    lines.push('- Missing canonical source issue line: `- **Issue:** #123`.');
    if (report.suggestedIssueLine) {
      lines.push(`  - Suggested correction: \`${report.suggestedIssueLine}\`.`);
    }
    if (report.issueReferences.length > 1) {
      lines.push(`  - Multiple issue references detected: ${report.issueReferences.map((issue) => `#${issue}`).join(', ')}. Keep exactly one primary source issue in the canonical line.`);
    }
  }

  if (!report.hasRequiredIntentLabel) {
    lines.push('- Missing stable `Intent label:` value in `# PR Summary`.');
  }

  if (!report.hasRequiredPrClass) {
    lines.push(`- Missing or invalid stable \`PR class:\` value in \`# PR Summary\`. Valid classes: ${VALID_PR_CLASSES.join(', ')}.`);
  }

  for (const section of report.missingSections) {
    lines.push(`- Missing required stable PR template section: \`${section}\`.`);
  }

  if (!report.hasAllowedFiles) {
    lines.push('- Missing or empty `Allowed paths:` list under `## Scope`.');
  }

  if (report.unlistedChangedFiles.length > 0) {
    lines.push('- Changed files not covered by `Allowed paths:`:');
    for (const file of report.unlistedChangedFiles) {
      lines.push(`  - \`${file}\``);
    }
  }

  if (!report.hasChangeSummary) {
    lines.push('- Missing substantive `## Change Summary` evidence.');
  }

  if (!report.hasVerificationEvidence) {
    lines.push('- Missing stable `## Verification` evidence with local and CI verification fields.');
  }

  if (!report.hasAcceptanceCriteriaEvidence) {
    lines.push('- Missing stable `## Acceptance Criteria` evidence.');
  }

  if (!report.hasReviewerAttestation) {
    lines.push('- Missing `## Reviewer / Bot Review Attestation` checkboxes.');
  }

  return lines.join('\n');
}

function readListFile(path) {
  if (!path || !fs.existsSync(path)) return [];
  return fs.readFileSync(path, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function runCli(env = process.env) {
  const bodyPath = env.PR_HYGIENE_BODY_FILE;
  const changedFilesPath = env.PR_HYGIENE_CHANGED_FILES_FILE;

  if (!bodyPath || !fs.existsSync(bodyPath)) {
    console.error('PR_HYGIENE_BODY_FILE is required.');
    return 2;
  }

  const body = fs.readFileSync(bodyPath, 'utf8');
  const changedFiles = readListFile(changedFilesPath);
  const report = buildPrHygieneReport({ body, changedFiles });
  writePrHygieneArtifacts(report, env);
  console.log(renderPrHygieneReport(report));

  // Hard codes always fail closed pre-merge (#2683 rec 1). Soft hygiene stays advisory unless enforced.
  if ((report.hardFailures || []).length > 0) return 1;
  const enforceFailure = (env.PR_HYGIENE_ENFORCE_FAILURE || 'false') === 'true';
  if (report.isClean) return 0;
  return enforceFailure ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
