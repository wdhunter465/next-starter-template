// #5044 -- argument parsing and target selection for retire-candidates.mjs. Kept free of any
// database or network access so it is unit-tested.

export const DEFAULT_MAX_TARGETS = 25;

function readValue(argv, index, flag) {
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
  return value;
}

/**
 * Parses the command line. Writing needs --apply; without it the tool only lists what it would
 * retire. An Issue number and a reason are required either way, so every retirement cites its
 * authority.
 */
export function parseArgs(argv) {
  const options = {
    database: 'lgfc_lite',
    target: 'local',
    apply: false,
    restore: false,
    actor: 'wdhunter465',
    max: DEFAULT_MAX_TARGETS,
    candidateIds: [],
    titleMatch: null,
    issue: null,
    reason: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--candidate-id') {
      options.candidateIds.push(...readValue(argv, index, arg).split(',').map((id) => id.trim()).filter(Boolean));
      index += 1;
    } else if (arg === '--title-match') {
      options.titleMatch = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--issue') {
      options.issue = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--reason') {
      options.reason = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--actor') {
      options.actor = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--database') {
      options.database = readValue(argv, index, arg);
      index += 1;
    } else if (arg === '--max') {
      const parsed = Number(readValue(argv, index, arg));
      if (!Number.isInteger(parsed) || parsed < 1) throw new Error('--max must be a positive integer');
      options.max = parsed;
      index += 1;
    } else if (arg === '--local') {
      options.target = 'local';
    } else if (arg === '--remote') {
      options.target = 'remote';
    } else if (arg === '--apply') {
      options.apply = true;
    } else if (arg === '--restore') {
      options.restore = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.issue || !/^\d+$/.test(options.issue)) throw new Error('--issue <number> is required.');
  if (!options.reason || options.reason.trim().length < 10) {
    throw new Error('--reason is required (at least 10 characters).');
  }
  if (!options.candidateIds.length && !options.titleMatch) {
    throw new Error('Name what to retire or restore: --candidate-id <id[,id]> and/or --title-match <pattern>.');
  }
  if (options.titleMatch) {
    try {
      new RegExp(options.titleMatch, 'i');
    } catch {
      throw new Error(`--title-match is not a valid pattern: ${options.titleMatch}`);
    }
  }
  return options;
}

/**
 * Picks the archived rows to retire (or, with --restore, to restore). `rows` are the archived
 * candidates in the matching state: active ones to retire, soft-deleted ones to restore
 * ({ candidate_id, title }). Named ids must all be present; a title pattern is matched
 * case-insensitively. More than `max` targets is refused so a loose pattern cannot sweep the
 * archive.
 */
export function selectTargets(rows, options) {
  const byId = new Map(rows.map((row) => [row.candidate_id, row]));
  const chosen = new Map();

  const missing = options.candidateIds.filter((id) => !byId.has(id));
  if (missing.length) {
    throw new Error(`Not found among ${options.restore ? 'retired' : 'active'} archived candidates: ${missing.join(', ')}`);
  }
  for (const id of options.candidateIds) chosen.set(id, byId.get(id));

  if (options.titleMatch) {
    const pattern = new RegExp(options.titleMatch, 'i');
    for (const row of rows) {
      if (pattern.test(String(row.title ?? ''))) chosen.set(row.candidate_id, row);
    }
  }

  const targets = [...chosen.values()];
  if (targets.length > options.max) {
    throw new Error(`${targets.length} candidates match; the limit is ${options.max}. Narrow the pattern or raise --max.`);
  }
  return targets;
}
