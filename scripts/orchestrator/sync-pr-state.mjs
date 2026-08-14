#!/usr/bin/env node

import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

import { linkedIssueNumber, resolveSourceIssueFromPr } from '../ci/issue_accounting.mjs';
import {
  buildFailureCloseoutComment,
  buildSourceIssueCloseoutComment,
  isUmbrellaSourceIssue,
  planActiveSourceIssueRelabel,
  planFailureSourceIssueRelabel,
  planTerminalLabelReconciliation,
  postMergeVerificationResult,
  shouldCloseSourceIssue,
  shouldKeepActiveSourceIssueOpen,
  shouldPreserveSourceIssueOpen,
  shouldReopenActiveSourceIssue,
  shouldReopenUmbrellaSourceIssue,
} from '../ci/post_merge_source_issue_closeout.mjs';

const repo = process.env.GITHUB_REPOSITORY;
const prNumber = process.env.PR_NUMBER;
const action = process.env.SYNC_ACTION;

function runGh(args) {
  return execFileSync('gh', args, { encoding: 'utf8' }).trim();
}

let repoLabels;
function repoLabelNames() {
  if (!repoLabels) {
    const labelsJson = runGh(['label', 'list', '--repo', repo, '--json', 'name', '--limit', '1000']);
    const labels = JSON.parse(labelsJson);
    repoLabels = new Set((labels || []).map((label) => label.name));
  }
  return repoLabels;
}

function issueLabelNames(issueNumber) {
  const issueJson = runGh(['issue', 'view', issueNumber, '--repo', repo, '--json', 'labels']);
  const issue = JSON.parse(issueJson);
  return new Set((issue.labels || []).map((label) => label.name));
}

export function readPostMergeResult(resultPath = process.env.POST_MERGE_RESULT_PATH || 'post-merge-result.json') {
  if (!resultPath || !fs.existsSync(resultPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  } catch {
    return null;
  }
}

export function issueMeta(issueNumber, { run = runGh } = {}) {
  const issueJson = run(['api', `repos/${repo}/issues/${issueNumber}`]);
  const issue = JSON.parse(issueJson);
  return {
    title: issue.title || '',
    labels: (issue.labels || []).map((label) => label.name),
    state: issue.state || '',
    state_reason: issue.state_reason || '',
  };
}

export { linkedIssueNumber };

export function setStatus(
  issueNumber,
  removeLabel,
  addLabel,
  comment,
  { getLabels = issueLabelNames, getRepoLabels = repoLabelNames, run = runGh, warn = console.warn } = {}
) {
  const labels = getLabels(issueNumber);
  const args = ['issue', 'edit', issueNumber, '--repo', repo];
  if (removeLabel && labels.has(removeLabel)) args.push('--remove-label', removeLabel);
  if (addLabel && !labels.has(addLabel)) {
    const availableLabels = getRepoLabels();
    if (availableLabels.has(addLabel)) {
      args.push('--add-label', addLabel);
    } else {
      warn(`Status label ${addLabel} does not exist; leaving issue #${issueNumber} without that label.`);
    }
  }
  if (args.length > 5) run(args);
  if (comment) run(['issue', 'comment', issueNumber, '--repo', repo, '--body', comment]);
}

export function reconcileTerminalLabels(issueNumber, plan, { run = runGh } = {}) {
  const args = ['issue', 'edit', issueNumber, '--repo', repo];
  for (const label of plan.removeLabels || []) {
    args.push('--remove-label', label);
  }
  if (plan.addLabel) args.push('--add-label', plan.addLabel);
  if (args.length > 5) run(args);
}

function validationSummary(postMergeResult) {
  const summary = postMergeResult?.evidence_summary;
  if (!summary) return '';
  return [
    `metadata=${summary.metadata_failures ?? 0}`,
    `implementation=${summary.implementation_failures ?? 0}`,
    `diataxis=${summary.diataxis_failures ?? 0}`,
    `late_review=${summary.late_reviewer_findings ?? 0}`,
    `workflow=${summary.workflow_failures ?? 0}`,
  ].join('; ');
}

export function syncPrState({
  pr,
  prNumber,
  action,
  setStatusFn = setStatus,
  reconcileTerminalLabelsFn = reconcileTerminalLabels,
  run = runGh,
  log = console.log,
  getIssueMeta = issueMeta,
  getRepoLabels = repoLabelNames,
  postMergeResult = readPostMergeResult(),
} = {}) {
  const sourceResolution = resolveSourceIssueFromPr(pr, { repository: repo });
  const issueNumber = sourceResolution.issueNumber;
  const isMerged = Boolean(pr.mergedAt) || pr.state === 'MERGED';

  if (!issueNumber) {
    log(`No linked orchestrator issue found for PR #${prNumber}.`);
    return 'skipped';
  }

  if (action === 'ready_for_review') {
    setStatusFn(issueNumber, 'status:implementation', 'status:review', `PR #${prNumber} is ready for review: ${pr.url}`);
    return 'review';
  }

  if (action === 'merged') {
    if (!isMerged) return 'skipped';
    setStatusFn(issueNumber, 'status:review', 'status:post-merge-verify', `PR #${prNumber} merged. Post-merge verification pending: ${pr.url}`);
    return 'post_merge_verify';
  }

  if (action === 'post_merge_success') {
    let meta = getIssueMeta(issueNumber, { run });
    const terminalLabelResult = postMergeResult?.terminal_label_result || planTerminalLabelReconciliation({
      issueLabels: meta.labels || [],
      repoLabels: getRepoLabels(),
    });
    const closeDecision = shouldCloseSourceIssue({
      action,
      issueNumber,
      isMerged,
      issueMeta: meta,
      postMergeResult,
      terminalLabelResult,
      prBody: pr.body || '',
      openExceptionIssues: postMergeResult?.open_exception_issues || [],
      originalSourceIssue: postMergeResult?.original_source_issue || null,
    });

    if (!closeDecision.close) {
      if (
        (closeDecision.reason === 'active_source_issue_remains_open' &&
          shouldKeepActiveSourceIssueOpen(pr.body || '')) ||
        (closeDecision.reason === 'umbrella_source_issue_remains_open' &&
          shouldPreserveSourceIssueOpen({
            body: pr.body || '',
            issueMeta: meta,
            issueNumber,
          }))
      ) {
        const shouldReopen =
          (closeDecision.reason === 'active_source_issue_remains_open' &&
            shouldReopenActiveSourceIssue(pr.body || '')) ||
          (closeDecision.reason === 'umbrella_source_issue_remains_open' &&
            shouldReopenUmbrellaSourceIssue({
              issueMeta: meta,
              prBody: pr.body || '',
              issueNumber,
            }));
        if (String(meta.state || '').toUpperCase() === 'CLOSED' && shouldReopen) {
          run(['issue', 'reopen', issueNumber, '--repo', repo]);
          meta = getIssueMeta(issueNumber, { run });
        }
        const relabelPlan = planActiveSourceIssueRelabel({ issueLabels: meta.labels || [] });
        reconcileTerminalLabelsFn(issueNumber, relabelPlan);
        const mergeSha = postMergeResult?.merge_sha || pr?.mergeCommit?.oid || '';
        const queueAdvancementStatus =
          closeDecision.reason === 'umbrella_source_issue_remains_open'
            ? 'no queue action; umbrella/child project source issue remains open pending explicit terminal closeout'
            : 'no queue action; Phase 3 planning complete; source issue remains active pending Phase 4 approval';
        const closeoutComment = buildSourceIssueCloseoutComment({
          prNumber,
          mergeSha,
          sourceIssueNumber: issueNumber,
          validatorStatus: postMergeResult?.status || 'pass',
          verificationResult: postMergeVerificationResult(postMergeResult),
          closeoutReason: closeDecision.reason,
          validationSummary: validationSummary(postMergeResult),
          terminalLabelResult: relabelPlan.summary,
          sourceIssueCloseoutMode: postMergeResult?.source_issue_closeout_mode,
          queueAdvancementStatus,
        });
        run(['issue', 'comment', issueNumber, '--repo', repo, '--body', closeoutComment]);
        return 'active_relabeled';
      }
      if (closeDecision.reason === 'remediation_issue') {
        const relabelPlan = terminalLabelResult?.ok
          ? terminalLabelResult
          : planTerminalLabelReconciliation({
              issueLabels: meta.labels || [],
              repoLabels: getRepoLabels(),
            });
        if (relabelPlan.ok) {
          reconcileTerminalLabelsFn(issueNumber, relabelPlan);
        }
        const mergeSha = postMergeResult?.merge_sha || pr?.mergeCommit?.oid || '';
        const closeoutComment = buildSourceIssueCloseoutComment({
          prNumber,
          mergeSha,
          sourceIssueNumber: issueNumber,
          validatorStatus: postMergeResult?.status || 'pass',
          verificationResult: postMergeVerificationResult(postMergeResult),
          closeoutReason: closeDecision.reason,
          validationSummary: validationSummary(postMergeResult),
          terminalLabelResult: relabelPlan.summary,
          sourceIssueCloseoutMode: postMergeResult?.source_issue_closeout_mode,
          queueAdvancementStatus:
            'remediation source issue closeout deferred; remediation issues for merged PR will be closed separately',
        });
        run(['issue', 'comment', issueNumber, '--repo', repo, '--body', closeoutComment]);
        return 'remediation_issue';
      }
      log(`Skipping source issue closeout for PR #${prNumber}: ${closeDecision.reason}.`);
      return closeDecision.reason;
    }

    reconcileTerminalLabelsFn(issueNumber, terminalLabelResult);

    const mergeSha = postMergeResult?.merge_sha || pr?.mergeCommit?.oid || '';
    const closeoutComment = buildSourceIssueCloseoutComment({
      prNumber,
      mergeSha,
      sourceIssueNumber: issueNumber,
      validatorStatus: postMergeResult?.status || 'pass',
      verificationResult: postMergeVerificationResult(postMergeResult),
      closeoutReason: closeDecision.reason,
      validationSummary: validationSummary(postMergeResult),
      terminalLabelResult: terminalLabelResult.summary,
      sourceIssueCloseoutMode: postMergeResult?.source_issue_closeout_mode,
      queueAdvancementStatus: postMergeResult?.queue_advancement_status,
    });

    run(['issue', 'comment', issueNumber, '--repo', repo, '--body', closeoutComment]);
    if (String(meta.state || '').toUpperCase() !== 'CLOSED') {
      run(['issue', 'close', issueNumber, '--repo', repo, '--reason', 'completed']);
    }
    return 'complete';
  }

  if (action === 'post_merge_remediation' || action === 'post_merge_failure') {
    const meta = getIssueMeta(issueNumber, { run });
    const failureLabelResult = planFailureSourceIssueRelabel({
      issueLabels: meta.labels || [],
      repoLabels: getRepoLabels(),
    });
    if (!failureLabelResult.ok) {
      log(
        `Post-merge closeout exception for PR #${prNumber}: failure-path relabel halted (${failureLabelResult.reason}); source issue labels unchanged.`,
      );
      return 'failure_relabel_halted';
    }
    reconcileTerminalLabelsFn(issueNumber, failureLabelResult);

    const mergeSha = postMergeResult?.merge_sha || pr?.mergeCommit?.oid || '';
    const failureComment = buildFailureCloseoutComment({
      prNumber,
      mergeSha,
      sourceIssueNumber: issueNumber,
      syncAction: action,
      validatorStatus: postMergeResult?.status || 'unknown',
      verificationResult: postMergeVerificationResult(postMergeResult),
      validationSummary: validationSummary(postMergeResult),
      terminalLabelResult: failureLabelResult.summary,
    });
    run(['issue', 'comment', issueNumber, '--repo', repo, '--body', failureComment]);

    const reason =
      action === 'post_merge_remediation'
        ? 'remediation remains required'
        : 'validation failed';
    log(`Post-merge closeout exception for PR #${prNumber}: ${reason}; source issue relabeled without closure.`);
    return action === 'post_merge_remediation' ? 'remediation_relabeled' : 'failure_relabeled';
  }

  if (action === 'closed') return 'skipped';

  throw new Error(`Unsupported SYNC_ACTION: ${action}`);
}

export function main() {
  if (!repo || !prNumber || !action) {
    console.error('GITHUB_REPOSITORY, PR_NUMBER, and SYNC_ACTION are required.');
    process.exit(1);
  }

  const prJson = runGh(['pr', 'view', prNumber, '--repo', repo, '--json', 'body,title,headRefName,url,mergedAt,state,mergeCommit']);
  const pr = JSON.parse(prJson);
  syncPrState({ pr, prNumber, action });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
