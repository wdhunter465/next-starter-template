#!/usr/bin/env node
/**
 * Queue-aware dispatch and collaboration routing (#2726).
 *
 * Pure decision API over issue label/state snapshots. Does not mutate GitHub.
 * Authority: .github/queue-label-registry.json + #2724 routing matrix.
 * Cross-queue precedence (#3629 decision, #3642 implementation): Operations(1) ->
 * PMO Active(2) -> PMO Pipeline(3) -> Engineering(4) -> Governance(5); Operations
 * and Governance interval/hold states are non-blocking and ranked last (6).
 */

const OPS_NUMBERED = new Set([
  'ops:priority:1',
  'ops:priority:2',
  'ops:priority:3',
  'ops:priority:4'
]);
const OPS_INTERVAL = new Set(['ops:monitoring', 'ops:hold']);
const PMO_ACTIVE_PRIORITY_RE = /^pmo:priority:[1-9]\d*$/;
const PMO_PIPELINE_PRIORITY_RE = /^pmo:pipeline-priority:[1-9]\d*$/;
const ENG_PRIORITIES = new Set([
  'eng:priority:1',
  'eng:priority:2',
  'eng:priority:3',
  'eng:priority:4',
  'eng:priority:idea'
]);
const GOV_NUMBERED = new Set([
  'gov:priority:1',
  'gov:priority:2',
  'gov:priority:3',
  'gov:priority:4'
]);
const GOV_INTERVAL = new Set(['gov:review', 'gov:hold']);
const TEAM_LABELS = new Set([
  'team:operations',
  'team:pmo',
  'team:engineering',
  'team:governance'
]);

export function normalizeLabels(input) {
  return (input || [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

function labelsOf(issue) {
  return normalizeLabels(issue?.labels);
}

function teamLabels(labels) {
  return labels.filter((label) => TEAM_LABELS.has(label) || label.startsWith('team:'));
}

function firstMatch(labels, set) {
  return labels.find((label) => set.has(label)) || null;
}

function firstActivePriority(labels) {
  return labels.find((label) => PMO_ACTIVE_PRIORITY_RE.test(label)) || null;
}

function firstPipelinePriority(labels) {
  return labels.find((label) => PMO_PIPELINE_PRIORITY_RE.test(label)) || null;
}

function parentRef(body) {
  const text = String(body || '');
  const match = text.match(/^\s*Parent(?:\s+(?:program|project|issue))?\s*:\s*#?(\d+)\b/im);
  return match ? Number(match[1]) : null;
}

function failClosed(partial = {}) {
  return {
    eligible: false,
    failClosed: true,
    action: partial.action || 'fail_closed',
    lane: partial.lane || null,
    precedenceRank: null,
    blocksNormalWork: false,
    authorizesActiveImplementation: false,
    reasons: partial.reasons || ['fail_closed'],
    ...partial
  };
}

/**
 * Classify one issue for queue-aware dispatch.
 * @param {object} issue
 * @param {object} [context]
 */
export function classifyQueueCandidate(issue, context = {}) {
  if (context.readFailure) {
    return failClosed({
      action: 'fail_closed',
      reasons: [`read_failure:${context.readFailure}`]
    });
  }
  if (context.staleSnapshot || context.headShaChanged) {
    return failClosed({
      action: 'reevaluate',
      reasons: ['stale_snapshot_or_changed_head']
    });
  }
  if (context.claimActive) {
    return failClosed({
      action: 'no_duplicate_launch',
      reasons: ['active_claim']
    });
  }
  if (context.handoffConsumed) {
    return failClosed({
      action: 'no_duplicate_launch',
      reasons: ['handoff_consumed']
    });
  }

  if (!issue || issue.state === 'closed') {
    return failClosed({ reasons: ['issue_closed_or_missing'] });
  }

  const labels = labelsOf(issue);
  const teams = teamLabels(labels);
  if (teams.length > 1) {
    return failClosed({ reasons: [`multiple_team_owners:${teams.join(',')}`] });
  }

  const opsStates = labels.filter(
    (label) => OPS_NUMBERED.has(label) || OPS_INTERVAL.has(label) || label.startsWith('ops:')
  );
  const pmoPriorities = labels.filter((label) => label.startsWith('pmo:priority:'));
  const pipelinePriorities = labels.filter((label) => label.startsWith('pmo:pipeline-priority:'));
  const engPriorities = labels.filter((label) => label.startsWith('eng:priority:'));

  // Cross-namespace priority / ownership conflicts fail closed.
  const namespacesPresent = [
    opsStates.length > 0,
    pmoPriorities.length > 0,
    pipelinePriorities.length > 0,
    engPriorities.length > 0
  ].filter(Boolean).length;
  if (namespacesPresent > 1) {
    return failClosed({ reasons: ['cross_namespace_priority'] });
  }

  const isTask = labels.includes('pmo:task');
  if (
    isTask &&
    (teams.length > 0 ||
      pmoPriorities.length ||
      pipelinePriorities.length ||
      engPriorities.length ||
      opsStates.length)
  ) {
    return failClosed({
      lane: 'pmo_active',
      reasons: ['pmo_child_carries_team_or_priority']
    });
  }

  // Operations lane
  if (teams[0] === 'team:operations' || (opsStates.length && teams.length === 0)) {
    if (teams[0] && teams[0] !== 'team:operations') {
      return failClosed({ reasons: ['ops_state_without_operations_owner'] });
    }
    if (teams[0] !== 'team:operations') {
      return failClosed({ reasons: ['ops_requires_team_operations'] });
    }
    const numbered = firstMatch(labels, OPS_NUMBERED);
    const interval = firstMatch(labels, OPS_INTERVAL);
    if (numbered && interval) {
      return failClosed({ reasons: ['ops_numbered_and_interval_conflict'] });
    }
    if (numbered) {
      return {
        eligible: true,
        failClosed: false,
        lane: 'operations',
        action: 'dispatch',
        precedenceRank: 1,
        blocksNormalWork: true,
        authorizesActiveImplementation: false,
        priorityLabel: numbered,
        reasons: ['numbered_operations_interrupt']
      };
    }
    if (interval) {
      return {
        eligible: false,
        failClosed: false,
        lane: 'operations',
        action: 'interval_update',
        precedenceRank: 6,
        blocksNormalWork: false,
        authorizesActiveImplementation: false,
        priorityLabel: interval,
        reasons: ['operations_interval_non_blocking']
      };
    }
    return failClosed({ lane: 'operations', reasons: ['operations_missing_state'] });
  }

  // PMO Active child / parent
  if (labels.includes('pmo:active') || isTask) {
    if (isTask) {
      const parentNumber = parentRef(issue.body);
      const parent = context.parent || null;
      if (!parentNumber || !parent || Number(parent.number) !== parentNumber) {
        return failClosed({
          lane: 'pmo_active',
          reasons: ['missing_or_mismatched_parent']
        });
      }
      const parentLabels = labelsOf(parent);
      if (
        !parentLabels.includes('team:pmo') ||
        !parentLabels.includes('pmo:active') ||
        !firstActivePriority(parentLabels)
      ) {
        return failClosed({
          lane: 'pmo_active',
          reasons: ['parent_not_valid_active_pmo']
        });
      }
      if (!context.implementationAuthorized || !context.childSequenceReady) {
        return failClosed({
          lane: 'pmo_active',
          reasons: ['implementation_or_sequence_not_ready']
        });
      }
      return {
        eligible: true,
        failClosed: false,
        lane: 'pmo_active',
        action: 'dispatch',
        precedenceRank: 2,
        blocksNormalWork: false,
        authorizesActiveImplementation: true,
        priorityLabel: firstActivePriority(parentLabels),
        reasons: ['pmo_active_executable_child']
      };
    }

    // Active portfolio parent itself is selection context, not a leaf dispatch by default.
    if (teams[0] === 'team:pmo' && firstActivePriority(labels)) {
      return {
        eligible: false,
        failClosed: false,
        lane: 'pmo_active',
        action: 'select_parent',
        precedenceRank: 2,
        blocksNormalWork: false,
        authorizesActiveImplementation: false,
        priorityLabel: firstActivePriority(labels),
        reasons: ['pmo_active_parent_selection_only']
      };
    }
    return failClosed({ lane: 'pmo_active', reasons: ['active_shape_invalid'] });
  }

  // Engineering qualification (pre-Pipeline only)
  if (teams[0] === 'team:engineering' && !labels.includes('pmo:pipeline')) {
    if (pmoPriorities.length || pipelinePriorities.length) {
      return failClosed({
        lane: 'engineering_qualification',
        reasons: ['qualification_cross_namespace_pmo_priority']
      });
    }
    return {
      eligible: true,
      failClosed: false,
      lane: 'engineering_qualification',
      action: 'qualification',
      precedenceRank: 4,
      blocksNormalWork: false,
      authorizesActiveImplementation: false,
      priorityLabel: firstMatch(labels, ENG_PRIORITIES),
      reasons: ['engineering_qualification_only']
    };
  }

  // PMO Pipeline preparation
  if (labels.includes('pmo:pipeline')) {
    if (teams[0] !== 'team:pmo') {
      return failClosed({
        lane: 'pmo_pipeline',
        reasons: ['pipeline_requires_team_pmo']
      });
    }
    const pipelinePriority = firstPipelinePriority(labels);
    if (!pipelinePriority) {
      return failClosed({
        lane: 'pmo_pipeline',
        reasons: ['pipeline_missing_pipeline_priority']
      });
    }
    if (pmoPriorities.length || engPriorities.length) {
      return failClosed({
        lane: 'pmo_pipeline',
        reasons: ['pipeline_cross_namespace_priority']
      });
    }
    const graduationCandidate = labels.includes('pmo:stage:graduation-candidate');
    return {
      eligible: true,
      failClosed: false,
      lane: 'pmo_pipeline',
      action: 'preparation',
      precedenceRank: 3,
      blocksNormalWork: false,
      authorizesActiveImplementation: false,
      priorityLabel: pipelinePriority,
      reasons: graduationCandidate
        ? ['pipeline_graduation_candidate_until_graduation']
        : ['pmo_pipeline_preparation_only']
    };
  }

  // Governance stewardship (#3629: last in normal-work precedence; never an
  // automatic interrupt -- the registry has no "blocking Governance matter" label,
  // so that preemption per #3629's decision requires explicit Product Authority
  // escalation outside this pure label classifier, not something inferred here).
  if (teams[0] === 'team:governance') {
    const numbered = firstMatch(labels, GOV_NUMBERED);
    const interval = firstMatch(labels, GOV_INTERVAL);
    if (numbered && interval) {
      return failClosed({
        lane: 'governance',
        reasons: ['gov_priority_and_interval_conflict']
      });
    }
    if (numbered) {
      return {
        eligible: true,
        failClosed: false,
        lane: 'governance',
        action: 'dispatch',
        precedenceRank: 5,
        blocksNormalWork: false,
        authorizesActiveImplementation: false,
        priorityLabel: numbered,
        reasons: ['governance_stewardship_normal_queue']
      };
    }
    if (interval) {
      return {
        eligible: false,
        failClosed: false,
        lane: 'governance',
        action: 'interval_update',
        precedenceRank: 6,
        blocksNormalWork: false,
        authorizesActiveImplementation: false,
        priorityLabel: interval,
        reasons: ['governance_interval_non_blocking']
      };
    }
    return failClosed({ lane: 'governance', reasons: ['governance_missing_state'] });
  }

  return failClosed({ reasons: ['unclassified_or_ambiguous'] });
}

/**
 * Collaboration must never transfer queue ownership or authority.
 */
export function evaluateCollaborationBoundary(sourceIssue, collaboration = {}) {
  const labels = labelsOf(sourceIssue);
  const owner = teamLabels(labels)[0] || collaboration.sourceOwner || null;
  const priority =
    firstMatch(labels, OPS_NUMBERED) ||
    firstActivePriority(labels) ||
    firstPipelinePriority(labels) ||
    firstMatch(labels, ENG_PRIORITIES) ||
    collaboration.sourcePriority ||
    null;

  return {
    ownershipTransferred: false,
    priorityTransferred: false,
    executionAuthorityTransferred: false,
    approvalAuthorityTransferred: false,
    productionAuthorityTransferred: false,
    retainedOwner: owner,
    retainedPriority: priority,
    requestedAgent: collaboration.requestedAgent || null,
    reasons: ['collaboration_adds_participant_only']
  };
}

function prioritySortKey(classification) {
  const label = classification.priorityLabel || '';
  const numbered = label.match(/:(\d+)$/);
  if (numbered) return Number(numbered[1]);
  if (label.endsWith(':idea')) return 50;
  if (label === 'ops:monitoring') return 90;
  if (label === 'ops:hold') return 91;
  return 99;
}

/**
 * Select the next dispatch candidate using required routing order.
 */
export function selectNextDispatch(candidates = [], sharedContext = {}) {
  const classified = candidates.map((candidate) => {
    const issue = candidate.issue || candidate;
    const context = { ...sharedContext, ...(candidate.context || {}) };
    const classification = classifyQueueCandidate(issue, context);
    return {
      issueNumber: Number(issue.number),
      issue,
      classification
    };
  });

  const intervalOnly = classified
    .filter((entry) => entry.classification.action === 'interval_update')
    .map((entry) => entry.issueNumber);

  const dispatchable = classified
    .filter((entry) => entry.classification.eligible)
    .sort((a, b) => {
      const rankA = a.classification.precedenceRank ?? 99;
      const rankB = b.classification.precedenceRank ?? 99;
      if (rankA !== rankB) return rankA - rankB;
      const prio = prioritySortKey(a.classification) - prioritySortKey(b.classification);
      if (prio !== 0) return prio;
      return a.issueNumber - b.issueNumber;
    });

  const selected = dispatchable[0] || null;
  return {
    selectedIssueNumber: selected ? selected.issueNumber : null,
    selected,
    intervalOnly,
    classified
  };
}

export {
  OPS_NUMBERED,
  OPS_INTERVAL,
  PMO_ACTIVE_PRIORITY_RE,
  PMO_PIPELINE_PRIORITY_RE,
  ENG_PRIORITIES,
  GOV_NUMBERED,
  GOV_INTERVAL,
  TEAM_LABELS,
  parentRef
};
