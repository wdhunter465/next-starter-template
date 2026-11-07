// #5124: bulk soft delete (and restore) of members by id. The three writes mirror the admin endpoint
// POST /api/admin/member-operations/delete (#2919) exactly, so a removal made here matches one made in
// the admin screen. Nothing is hard-deleted. The repository and its Actions logs are public, so
// everything this module prints is by id with a masked address.

export const MAX_MEMBERS_PER_RUN = 50;

/** First letter and the domain only, for example "b***@gmail.com". */
export function maskEmail(email) {
  const text = String(email ?? '').trim();
  const at = text.lastIndexOf('@');
  if (at < 1) return '***';
  return `${text[0]}***${text.slice(at)}`;
}

/** Parses "4, 5,6" into unique positive integers; throws on anything else. */
export function parseMemberIds(value) {
  const parts = String(value ?? '')
    .split(/[\s,]+/)
    .filter(Boolean);
  if (!parts.length) throw new Error('member ids are required');
  const ids = [];
  for (const part of parts) {
    if (!/^\d+$/.test(part)) throw new Error(`"${part}" is not a member id`);
    const id = Number(part);
    if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`"${part}" is not a member id`);
    if (!ids.includes(id)) ids.push(id);
  }
  if (ids.length > MAX_MEMBERS_PER_RUN) throw new Error(`at most ${MAX_MEMBERS_PER_RUN} members per run (got ${ids.length})`);
  return ids;
}

export function parseArgs(argv) {
  const options = { restore: false, promote: false, purge: false, allowAdmin: false, apply: false, database: 'lgfc_lite', target: 'remote', issue: '', reason: '', ids: [], expect: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = () => argv[++i];
    if (arg === '--ids') options.ids = parseMemberIds(next());
    else if (arg === '--issue') options.issue = String(next() ?? '').replace(/^#/, '');
    else if (arg === '--reason') options.reason = String(next() ?? '').trim();
    else if (arg === '--expect') options.expect = Number(next());
    else if (arg === '--database') options.database = String(next() ?? '');
    else if (arg === '--local') options.target = 'local';
    else if (arg === '--remote') options.target = 'remote';
    else if (arg === '--restore') options.restore = true;
    else if (arg === '--promote') options.promote = true;
    else if (arg === '--purge') options.purge = true;
    else if (arg === '--allow-admin') options.allowAdmin = true;
    else if (arg === '--apply') options.apply = true;
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!options.ids.length) throw new Error('--ids is required');
  if (options.promote && (options.restore || options.allowAdmin)) throw new Error('--promote cannot be combined with --restore or --allow-admin');
  if (options.purge && (options.restore || options.promote || options.allowAdmin)) throw new Error('--purge cannot be combined with --restore, --promote or --allow-admin');
  if (!/^\d+$/.test(options.issue)) throw new Error('--issue must be an issue number');
  if (options.reason.length < 10) throw new Error('--reason must be at least 10 characters');
  if (!Number.isInteger(options.expect) || options.expect < 0) throw new Error('--expect must be the number of members you intend to change');
  return options;
}

/**
 * Decides what a run will do. `rows` are the members found for the ids. Returns
 * { targets, skipped } or throws, so a bad list stops before any write.
 */
export function planRun(rows, ids, { restore = false, promote = false, purge = false, allowAdmin = false, expect, activeAdminCount = 0 }) {
  const byId = new Map(rows.map((row) => [Number(row.id), row]));
  const missing = ids.filter((id) => !byId.has(id));
  if (missing.length) throw new Error(`no member with id ${missing.join(', ')}; nothing was changed`);
  const isDeleted = (row) => row.deleted_at != null && row.deleted_at !== '';
  const isAdmin = (row) => String(row.role) === 'admin';

  const targets = [];
  const skipped = [];
  if (purge) {
    const active = ids.filter((id) => !isDeleted(byId.get(id)));
    if (active.length) throw new Error(`id ${active.join(', ')} is not soft-deleted; only soft-deleted members are purged; nothing was changed`);
    targets.push(...ids.map((id) => byId.get(id)));
  } else if (promote) {
    for (const id of ids) {
      const row = byId.get(id);
      if (isDeleted(row)) throw new Error(`id ${id} is soft-deleted and cannot be made an admin; nothing was changed`);
      if (isAdmin(row)) skipped.push({ id, why: 'is already an admin' });
      else targets.push(row);
    }
  } else {
    const admins = ids.filter((id) => isAdmin(byId.get(id)));
    if (admins.length && !allowAdmin) throw new Error(`id ${admins.join(', ')} is an admin and is never removed here without allow-admin; nothing was changed`);
    for (const id of ids) {
      const row = byId.get(id);
      if (restore ? isDeleted(row) : !isDeleted(row)) targets.push(row);
      else skipped.push({ id, why: restore ? 'is not soft-deleted' : 'is already soft-deleted' });
    }
    const removedAdmins = restore ? 0 : targets.filter(isAdmin).length;
    if (removedAdmins && activeAdminCount - removedAdmins < 1) {
      throw new Error('this would leave no active admin; nothing was changed');
    }
  }
  if (targets.length !== expect) {
    throw new Error(`expected to change ${expect} member(s) but ${targets.length} match; nothing was changed`);
  }
  return { targets, skipped };
}

/** The writes for one member, in the order the admin endpoint runs them. */
/** Tables holding a member's sign-up leftovers, by email column. Members goes last. Discussions and the send log are kept. */
export const PURGE_TABLES = [
  { table: 'member_sessions', column: 'email' },
  { table: 'email_verification_tokens', column: 'email' },
  { table: 'join_verifications', column: 'email' },
  { table: 'login_attempts', column: 'email' },
  { table: 'join_requests', column: 'email' },
  { table: 'members', column: 'email' },
];

export function buildStatements(email, { now, reason, deletedBy, restore = false, promote = false, purge = false }) {
  const key = String(email).trim().toLowerCase();
  if (purge) {
    return PURGE_TABLES.map(({ table, column }) => ({
      sql: `DELETE FROM ${table} WHERE lower(${column}) = ?${table === 'members' ? ' AND deleted_at IS NOT NULL' : ''}`,
      params: [key],
    }));
  }
  if (promote) {
    return [{ sql: "UPDATE members SET role = 'admin', updated_at = ? WHERE lower(email) = ? AND deleted_at IS NULL", params: [now, key] }];
  }
  if (restore) {
    return [
      { sql: 'UPDATE members SET deleted_at = NULL, deletion_reason = NULL, deleted_by = NULL, updated_at = ? WHERE lower(email) = ?', params: [now, key] },
      { sql: 'UPDATE join_requests SET deleted_at = NULL WHERE lower(email) = ?', params: [key] },
    ];
  }
  return [
    { sql: 'UPDATE members SET deleted_at = ?, deletion_reason = ?, deleted_by = ?, updated_at = ? WHERE lower(email) = ?', params: [now, reason, deletedBy, now, key] },
    { sql: 'UPDATE join_requests SET deleted_at = ? WHERE lower(email) = ?', params: [now, key] },
    { sql: 'DELETE FROM member_sessions WHERE lower(email) = lower(?)', params: [key] },
  ];
}

/** One line per member, safe for a public log. */
export function describeMember(row) {
  return `#${row.id}  ${String(row.role).padEnd(6)}  joined ${String(row.created_at ?? '').slice(0, 10)}  ${maskEmail(row.email)}`;
}
