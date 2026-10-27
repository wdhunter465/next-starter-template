#!/usr/bin/env node
// Advisory runner for the four PMO contract validators (#4778).
// Pull-request mode always exits 0. Scheduled mode exits 1 when an in-scope
// record has a finding, so the workflow can open an Operations exception.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { evaluateAtomicClaim } from './claim-collision-contract.mjs';
import { evaluateDeterministicEligibility } from './deterministic-approval-inventory.mjs';
import { evaluateCandidateIntake } from './engineering-candidate-intake.mjs';
import { evaluateExecutableChildContract } from './executable-child-contract.mjs';

const CANDIDATE_MARKERS = ['evidence:', 'stated deficiency:', 'provenance:'];

export function labelNames(issue = {}) {
  return (issue.labels || []).map((label) => (typeof label === 'string' ? label : label.name)).filter(Boolean);
}

export function issueNumberFromText(text = '') {
  const labeled = String(text).match(/Issue(?:\*\*)?:\*{0,2}\s*#(\d+)/i);
  return labeled ? Number(labeled[1]) : null;
}

function fieldValue(body, label) {
  const match = String(body || '').match(new RegExp(`^${label}:\\s*(.+)$`, 'im'));
  return match ? match[1].trim() : '';
}

export function selectScope(issue = {}) {
  const labels = labelNames(issue);
  const body = String(issue.body || '');
  const lower = body.toLowerCase();
  const candidateMarkers = CANDIDATE_MARKERS.filter((marker) => lower.includes(marker)).length;
  return {
    child: labels.includes('pmo:task'),
    candidate: candidateMarkers >= 2,
    approval: /^gate category:\s*\S+/im.test(body)
  };
}

export function evaluateRecord(issue = {}, options = {}) {
  const scope = selectScope(issue);
  const findings = [];
  const labels = labelNames(issue);
  const normalized = { ...issue, labels, body: issue.body || '' };

  if (scope.child) {
    const child = evaluateExecutableChildContract(normalized);
    if (!child.claimable) {
      findings.push({
        validator: 'executable-child',
        summary: child.status,
        details: child.errors
      });
    }
    if (child.claimable) {
      const claim = evaluateAtomicClaim({
        issue: normalized,
        requestingAgent: options.requestingAgent || 'unassigned',
        activeClaims: options.activeClaims || []
      });
      if (!claim.allowed) {
        findings.push({
          validator: 'claim-collision',
          summary: claim.status,
          details: claim.collisions.map((item) => item.classification)
        });
      }
    }
  }

  if (scope.candidate) {
    const intake = evaluateCandidateIntake({
      candidate: normalized,
      existingCandidates: options.existingCandidates || []
    });
    if (intake.status !== 'INTAKE-READY') {
      findings.push({
        validator: 'engineering-candidate',
        summary: intake.status,
        details: intake.errors
      });
    }
  }

  if (scope.approval) {
    const category = fieldValue(normalized.body, 'Gate category');
    const approval = evaluateDeterministicEligibility({
      category,
      evidence: options.evidence || {}
    });
    if (!approval.eligible) {
      findings.push({
        validator: 'deterministic-approval',
        summary: approval.reason,
        details: approval.missing
      });
    }
  }

  return {
    number: issue.number || null,
    inScope: scope.child || scope.candidate || scope.approval,
    findings
  };
}

export function renderReport(results = []) {
  const findings = results.flatMap((result) =>
    result.findings.map((finding) => ({ number: result.number, ...finding }))
  );
  if (!findings.length) return 'Contract validators (advisory): no in-scope findings.';
  const lines = ['Contract validators (advisory): findings.', ''];
  for (const finding of findings) {
    const where = finding.number ? `#${finding.number} ` : '';
    lines.push(`- ${where}${finding.validator}: ${finding.summary}`);
  }
  return lines.join('\n');
}

export function exitCodeFor(mode, results = []) {
  const findings = results.some((result) => result.findings.length > 0);
  if (mode === 'schedule') return findings ? 1 : 0;
  return 0;
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function main() {
  const args = process.argv.slice(2);
  const mode = args.includes('--mode') ? args[args.indexOf('--mode') + 1] : 'pr';
  const issuePath = args.includes('--issue-json') ? args[args.indexOf('--issue-json') + 1] : '';
  const issuesPath = args.includes('--issues-json') ? args[args.indexOf('--issues-json') + 1] : '';
  const records = issuesPath ? readJson(issuesPath) : issuePath ? [readJson(issuePath)] : [];
  const activeClaims = records
    .filter((issue) => labelNames(issue).includes('pmo:task'))
    .map((issue) => ({ id: issue.number, filePaths: fieldValue(issue.body, 'Writable files/actions').split(',').map((item) => item.trim()).filter(Boolean) }));
  const results = records.map((issue) =>
    evaluateRecord(issue, {
      requestingAgent: process.env.VALIDATOR_ACTOR || 'advisory',
      activeClaims: activeClaims.filter((claim) => claim.id !== issue.number)
    })
  );
  const report = renderReport(results);
  process.stdout.write(`${report}\n`);
  process.exitCode = exitCodeFor(mode, results);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
