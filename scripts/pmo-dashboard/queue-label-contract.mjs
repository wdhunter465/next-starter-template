const TEAM_LABELS = new Set([
  'team:operations',
  'team:governance',
  'team:pmo',
  'team:engineering'
]);
const PMO_ACTIVE_PRIORITY_RE = /^pmo:priority:([1-9]\d*)$/;
const PMO_PIPELINE_PRIORITY_RE = /^pmo:pipeline-priority:([1-9]\d*)$/;
const ENGINEERING_PRIORITIES = new Set([
  'eng:priority:1',
  'eng:priority:2',
  'eng:priority:3',
  'eng:priority:4',
  'eng:priority:idea'
]);
const OPERATIONS_STATES = new Set([
  'ops:priority:1',
  'ops:priority:2',
  'ops:priority:3',
  'ops:priority:4',
  'ops:monitoring',
  'ops:hold'
]);
const GOVERNANCE_STATES = new Set([
  'gov:priority:1',
  'gov:priority:2',
  'gov:priority:3',
  'gov:priority:4',
  'gov:review',
  'gov:hold'
]);

function normalizeLabels(input) {
  return (input || [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

export function isPmoActivePriorityLabel(label) {
  return typeof label === 'string' && PMO_ACTIVE_PRIORITY_RE.test(label);
}

export function isPmoPipelinePriorityLabel(label) {
  return typeof label === 'string' && PMO_PIPELINE_PRIORITY_RE.test(label);
}

function priorityDisplay(label) {
  if (!label) return null;
  if (label === 'eng:priority:idea') return 'Idea';
  const active = label.match(PMO_ACTIVE_PRIORITY_RE);
  if (active) return active[1];
  const pipeline = label.match(PMO_PIPELINE_PRIORITY_RE);
  if (pipeline) return pipeline[1];
  const match = label.match(/:(\d+)$/);
  return match ? match[1] : null;
}

function addError(errors, remediation, error, fix) {
  errors.push(error);
  if (fix) remediation.push(fix);
}

export function analyzeQueueLabels({ labels: input, lifecycle, role = 'portfolio' }) {
  const labels = normalizeLabels(input);
  const teams = labels.filter((label) => TEAM_LABELS.has(label) || label.startsWith('team:'));
  const pmoPriorities = labels.filter((label) => label.startsWith('pmo:priority:'));
  const pipelinePriorities = labels.filter((label) => label.startsWith('pmo:pipeline-priority:'));
  const engineeringPriorities = labels.filter((label) => label.startsWith('eng:priority:'));
  const operationsStates = labels.filter((label) => label.startsWith('ops:'));
  const governanceStates = labels.filter((label) => label.startsWith('gov:'));
  const errors = [];
  const remediation = [];

  if (teams.length > 1) {
    addError(
      errors,
      remediation,
      `multiple team owners: ${teams.join(', ')}`,
      'Keep at most one approved team:* label'
    );
  }

  if (role === 'task') {
    if (teams.length) {
      addError(
        errors,
        remediation,
        `project child carries team label(s): ${teams.join(', ')}`,
        'Remove all team:* labels from project children'
      );
    }
    if (
      pmoPriorities.length ||
      pipelinePriorities.length ||
      engineeringPriorities.length ||
      operationsStates.length ||
      governanceStates.length
    ) {
      const prohibited = [
        ...pmoPriorities,
        ...pipelinePriorities,
        ...engineeringPriorities,
        ...operationsStates,
        ...governanceStates
      ];
      addError(
        errors,
        remediation,
        `project child carries prohibited queue priority/state label(s): ${prohibited.join(', ')}`,
        'Remove team:*, ops:*, gov:*, pmo:priority:*, pmo:pipeline-priority:*, and eng:priority:* labels from project children'
      );
    }
    return {
      teamLabel: null,
      priorityLabel: null,
      priorityDisplay: null,
      errors: [...new Set(errors)],
      remediation: [...new Set(remediation)]
    };
  }

  if (lifecycle === 'active') {
    if (teams.length !== 1 || teams[0] !== 'team:pmo') {
      addError(
        errors,
        remediation,
        'active portfolio parent requires exactly team:pmo',
        'Keep exactly team:pmo'
      );
    }
    const accepted = pmoPriorities.filter((label) => isPmoActivePriorityLabel(label));
    const unsupported = pmoPriorities.filter((label) => !isPmoActivePriorityLabel(label));
    if (unsupported.length) {
      addError(
        errors,
        remediation,
        `unsupported Active PMO priority label(s): ${unsupported.join(', ')}`,
        'Use exactly one pmo:priority:<n> where n is a positive integer with no 1-4 cap'
      );
    }
    if (accepted.length !== 1 || pmoPriorities.length !== 1) {
      addError(
        errors,
        remediation,
        'active portfolio parent requires exactly one PMO priority',
        'Keep exactly one pmo:priority:<n> ordered Active queue position'
      );
    }
    if (
      pipelinePriorities.length ||
      engineeringPriorities.length ||
      operationsStates.length ||
      governanceStates.length
    ) {
      addError(
        errors,
        remediation,
        `active portfolio parent carries cross-namespace label(s): ${[
          ...pipelinePriorities,
          ...engineeringPriorities,
          ...operationsStates,
          ...governanceStates
        ].join(', ')}`,
        'Remove Pipeline priority and Engineering/Operations/Governance labels from Active PMO parents'
      );
    }
    const priorityLabel = accepted.length === 1 && pmoPriorities.length === 1 ? accepted[0] : null;
    return {
      teamLabel: teams.length === 1 && teams[0] === 'team:pmo' ? teams[0] : null,
      priorityLabel,
      priorityDisplay: priorityDisplay(priorityLabel),
      errors: [...new Set(errors)],
      remediation: [...new Set(remediation)]
    };
  }

  if (lifecycle === 'pipeline') {
    if (teams.length !== 1 || teams[0] !== 'team:pmo') {
      addError(
        errors,
        remediation,
        'Pipeline portfolio parent requires exactly team:pmo',
        'Keep exactly team:pmo; team:engineering is only for pre-Pipeline Engineering qualification'
      );
    }
    const accepted = pipelinePriorities.filter((label) => isPmoPipelinePriorityLabel(label));
    const unsupported = pipelinePriorities.filter((label) => !isPmoPipelinePriorityLabel(label));
    if (unsupported.length) {
      addError(
        errors,
        remediation,
        `unsupported Pipeline priority label(s): ${unsupported.join(', ')}`,
        'Use exactly one pmo:pipeline-priority:<n> where n is a positive integer with no 1-4 cap'
      );
    }
    if (accepted.length !== 1 || pipelinePriorities.length !== 1) {
      addError(
        errors,
        remediation,
        'Pipeline portfolio parent requires exactly one Pipeline priority',
        'Keep exactly one pmo:pipeline-priority:<n> ordered Pipeline queue position'
      );
    }
    if (
      pmoPriorities.length ||
      engineeringPriorities.length ||
      operationsStates.length ||
      governanceStates.length
    ) {
      addError(
        errors,
        remediation,
        `Pipeline portfolio parent carries cross-namespace label(s): ${[
          ...pmoPriorities,
          ...engineeringPriorities,
          ...operationsStates,
          ...governanceStates
        ].join(', ')}`,
        'Remove Active pmo:priority:*, eng:priority:*, and Operations/Governance labels from Pipeline parents'
      );
    }
    const priorityLabel =
      accepted.length === 1 && pipelinePriorities.length === 1 ? accepted[0] : null;
    return {
      teamLabel: teams.length === 1 && teams[0] === 'team:pmo' ? teams[0] : null,
      priorityLabel,
      priorityDisplay: priorityDisplay(priorityLabel),
      errors: [...new Set(errors)],
      remediation: [...new Set(remediation)]
    };
  }

  if (lifecycle === 'closed') {
    if (teams.length === 1 && teams[0] === 'team:operations') {
      addError(
        errors,
        remediation,
        'closed PMO portfolio row cannot be owned by team:operations',
        'Remove team:operations from PMO portfolio records'
      );
    }
    if (pmoPriorities.length > 1 || pipelinePriorities.length > 1 || engineeringPriorities.length > 1) {
      addError(
        errors,
        remediation,
        'closed portfolio row carries conflicting priority labels',
        'Keep at most one historical matching priority label'
      );
    }
    const namespaceCount = [
      pmoPriorities.length > 0,
      pipelinePriorities.length > 0,
      engineeringPriorities.length > 0
    ].filter(Boolean).length;
    if (namespaceCount > 1) {
      addError(
        errors,
        remediation,
        'closed portfolio row carries cross-namespace priorities',
        'Keep at most one historical priority namespace'
      );
    }
    if (teams[0] === 'team:pmo' && engineeringPriorities.length) {
      addError(
        errors,
        remediation,
        'closed team:pmo row carries Engineering priority',
        'Remove Engineering priority or correct the historical team owner'
      );
    }
    if (teams[0] === 'team:engineering' && (pmoPriorities.length || pipelinePriorities.length)) {
      addError(
        errors,
        remediation,
        'closed team:engineering row carries PMO priority',
        'Remove PMO priority or correct the historical team owner'
      );
    }
    const priorityLabel =
      pmoPriorities.length === 1
        ? pmoPriorities[0]
        : pipelinePriorities.length === 1
          ? pipelinePriorities[0]
          : engineeringPriorities.length === 1
            ? engineeringPriorities[0]
            : null;
    return {
      teamLabel: teams.length === 1 && TEAM_LABELS.has(teams[0]) ? teams[0] : null,
      priorityLabel,
      priorityDisplay: priorityDisplay(priorityLabel),
      errors: [...new Set(errors)],
      remediation: [...new Set(remediation)]
    };
  }

  return {
    teamLabel: teams.length === 1 && TEAM_LABELS.has(teams[0]) ? teams[0] : null,
    priorityLabel: null,
    priorityDisplay: null,
    errors: [...new Set(errors)],
    remediation: [...new Set(remediation)]
  };
}

function carriesPmoLifecycleOrTask(labels) {
  return labels.some(
    (label) => label === 'pmo:task' || label === 'pmo:active' || label === 'pmo:pipeline' || label === 'pmo:closed'
  );
}

function carriesConflictingQueueNamespace(labels, allowedTeam) {
  return labels.some(
    (label) =>
      (label.startsWith('team:') && label !== allowedTeam) ||
      label.startsWith('pmo:priority:') ||
      label.startsWith('pmo:pipeline-priority:') ||
      label.startsWith('pmo:stage:') ||
      label.startsWith('eng:priority:') ||
      (allowedTeam !== 'team:operations' && label.startsWith('ops:')) ||
      (allowedTeam !== 'team:governance' && label.startsWith('gov:'))
  );
}

export function isStandaloneOperationsIssue(issue) {
  const labels = normalizeLabels(issue?.labels);
  return (
    labels.includes('team:operations') &&
    !carriesPmoLifecycleOrTask(labels) &&
    !carriesConflictingQueueNamespace(labels, 'team:operations')
  );
}

export function isStandaloneGovernanceIssue(issue) {
  const labels = normalizeLabels(issue?.labels);
  return (
    labels.includes('team:governance') &&
    !carriesPmoLifecycleOrTask(labels) &&
    !carriesConflictingQueueNamespace(labels, 'team:governance')
  );
}

export function isPeerEngineeringPreparation(issue) {
  const labels = normalizeLabels(issue?.labels);
  if (
    !labels.includes('team:engineering') ||
    carriesPmoLifecycleOrTask(labels) ||
    carriesConflictingQueueNamespace(labels, 'team:engineering')
  ) {
    return false;
  }
  const body = issue?.body || '';
  return /^\s*(?:Related Pipeline Project|Graduation Target)\s*:\s*#?\d+\b/im.test(body)
    && !/^\s*Parent(?:\s+(?:program|project|issue))?\s*:/im.test(body);
}

const PMO_PRIORITIES = {
  has: isPmoActivePriorityLabel
};

export {
  ENGINEERING_PRIORITIES,
  GOVERNANCE_STATES,
  OPERATIONS_STATES,
  PMO_ACTIVE_PRIORITY_RE,
  PMO_PIPELINE_PRIORITY_RE,
  PMO_PRIORITIES,
  TEAM_LABELS
};
