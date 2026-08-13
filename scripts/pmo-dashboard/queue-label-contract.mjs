const TEAM_LABELS = new Set([
  'team:operations',
  'team:governance',
  'team:pmo',
  'team:engineering'
]);
const PMO_PRIORITIES = new Set([
  'pmo:priority:1',
  'pmo:priority:2',
  'pmo:priority:3',
  'pmo:priority:4'
]);
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

function priorityDisplay(label) {
  if (!label) return null;
  if (label === 'eng:priority:idea') return 'Idea';
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
      engineeringPriorities.length ||
      operationsStates.length ||
      governanceStates.length
    ) {
      const prohibited = [
        ...pmoPriorities,
        ...engineeringPriorities,
        ...operationsStates,
        ...governanceStates
      ];
      addError(
        errors,
        remediation,
        `project child carries prohibited queue priority/state label(s): ${prohibited.join(', ')}`,
        'Remove team:*, ops:*, gov:*, pmo:priority:*, and eng:priority:* labels from project children'
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
    const accepted = pmoPriorities.filter((label) => PMO_PRIORITIES.has(label));
    const unsupported = pmoPriorities.filter((label) => !PMO_PRIORITIES.has(label));
    if (unsupported.length) {
      addError(
        errors,
        remediation,
        `unsupported Active PMO priority label(s): ${unsupported.join(', ')}`,
        'Use exactly one pmo:priority:1 through pmo:priority:4'
      );
    }
    if (accepted.length !== 1 || pmoPriorities.length !== 1) {
      addError(
        errors,
        remediation,
        'active portfolio parent requires exactly one PMO priority',
        'Keep exactly one pmo:priority:1 through pmo:priority:4'
      );
    }
    if (engineeringPriorities.length || operationsStates.length || governanceStates.length) {
      addError(
        errors,
        remediation,
        `active portfolio parent carries cross-namespace label(s): ${[
          ...engineeringPriorities,
          ...operationsStates,
          ...governanceStates
        ].join(', ')}`,
        'Remove Engineering priority and Operations/Governance state labels from Active PMO parents'
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
    if (teams.length !== 1 || teams[0] !== 'team:engineering') {
      addError(
        errors,
        remediation,
        'Pipeline portfolio parent requires exactly team:engineering',
        'Keep exactly team:engineering'
      );
    }
    const accepted = engineeringPriorities.filter((label) => ENGINEERING_PRIORITIES.has(label));
    const unsupported = engineeringPriorities.filter((label) => !ENGINEERING_PRIORITIES.has(label));
    if (unsupported.length) {
      addError(
        errors,
        remediation,
        `unsupported Engineering priority label(s): ${unsupported.join(', ')}`,
        'Use exactly one eng:priority:1 through eng:priority:4 or eng:priority:idea'
      );
    }
    if (accepted.length !== 1 || engineeringPriorities.length !== 1) {
      addError(
        errors,
        remediation,
        'Pipeline portfolio parent requires exactly one Engineering priority',
        'Keep exactly one eng:priority:1 through eng:priority:4 or eng:priority:idea'
      );
    }
    if (pmoPriorities.length || operationsStates.length || governanceStates.length) {
      addError(
        errors,
        remediation,
        `Pipeline portfolio parent carries cross-namespace label(s): ${[
          ...pmoPriorities,
          ...operationsStates,
          ...governanceStates
        ].join(', ')}`,
        'Remove PMO priority and Operations/Governance state labels from Pipeline Engineering parents'
      );
    }
    const priorityLabel =
      accepted.length === 1 && engineeringPriorities.length === 1 ? accepted[0] : null;
    return {
      teamLabel:
        teams.length === 1 && teams[0] === 'team:engineering' ? teams[0] : null,
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
    if (pmoPriorities.length > 1 || engineeringPriorities.length > 1) {
      addError(
        errors,
        remediation,
        'closed portfolio row carries conflicting priority labels',
        'Keep at most one historical matching priority label'
      );
    }
    if (pmoPriorities.length && engineeringPriorities.length) {
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
    if (teams[0] === 'team:engineering' && pmoPriorities.length) {
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
      label.startsWith('pmo:stage:') ||
      label.startsWith('eng:priority:') ||
      // Native Operations state/priority labels (ops:*) are allowed on clean
      // team:operations peers and must not count as contradictions.
      (allowedTeam !== 'team:operations' && label.startsWith('ops:')) ||
      // Native Governance state/priority labels (gov:*) are allowed on clean
      // team:governance peers and must not count as contradictions.
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

export {
  ENGINEERING_PRIORITIES,
  GOVERNANCE_STATES,
  OPERATIONS_STATES,
  PMO_PRIORITIES,
  TEAM_LABELS
};
