#!/usr/bin/env node
/**
 * Adapts `wrangler d1 execute --json --command` to the D1 binding interface
 * (`db.prepare(sql).bind(...args).run()/.first()/.all()`, `db.batch(stmts)`)
 * this repo's functions/_lib repository modules already expect, so CI
 * scripts can call those exact, already-reviewed functions unmodified
 * instead of hand-duplicating their SQL and risking drift.
 *
 * wrangler's `--command` runs one statement per invocation with no separate
 * bind-parameter argument, so bound values are inlined into the SQL text
 * here (matching the sqlString()-style escaping already used by
 * import-seed-candidates.mjs / record-batch-rights-approval.mjs) rather than
 * passed as real parameters. db.batch() runs statements sequentially, not
 * atomically -- callers relying on this adapter must use idempotent writes
 * (INSERT OR IGNORE / UPDATE ... WHERE <natural key>) so a partial batch is
 * always safe to retry.
 */

import { execFileSync } from 'node:child_process';

function inlineValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function makeWranglerD1({ database, target, cwd }) {
  function execJson(sql) {
    const args = ['wrangler', 'd1', 'execute', database];
    if (database === 'lgfc-litedev') args.push('--env', 'preview');
    args.push(target === 'local' ? '--local' : '--remote');
    args.push('--json', '--command', sql);

    const out = execFileSync('npx', args, {
      cwd,
      env: process.env,
      maxBuffer: 16 * 1024 * 1024,
    }).toString('utf8');

    // wrangler sometimes prints non-JSON status lines (e.g. a proxy notice)
    // to stdout before the JSON payload -- parse from the first '[' onward
    // rather than assuming stdout is JSON-only.
    const jsonStart = out.indexOf('[');
    if (jsonStart === -1) {
      throw new Error(`wrangler d1 execute produced no JSON output:\n${out}`);
    }
    const parsed = JSON.parse(out.slice(jsonStart));
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  function bindStatement(sql, boundArgs) {
    let index = 0;
    const inlined = sql.replace(/\?/g, () => inlineValue(boundArgs[index++]));

    return {
      async run() {
        // wrangler's own `meta.changes`/`meta.last_row_id` aren't reliably
        // populated for --local --json output, so pull them explicitly via
        // a trailing statement using standard SQLite functions instead --
        // this works identically against --local and --remote.
        const results = execJson(`${inlined}; SELECT changes() AS changes, last_insert_rowid() AS last_row_id;`);
        const writeResult = results[0];
        const countsRow = results[results.length - 1]?.results?.[0] ?? {};
        return {
          success: writeResult?.success ?? false,
          meta: {
            changes: Number(countsRow.changes ?? 0),
            last_row_id: Number(countsRow.last_row_id ?? 0),
          },
        };
      },
      async first() {
        const result = execJson(inlined)[0];
        const rows = result?.results ?? [];
        return rows.length > 0 ? rows[0] : null;
      },
      async all() {
        const result = execJson(inlined)[0];
        return { results: result?.results ?? [] };
      },
    };
  }

  function prepare(sql) {
    return {
      bind(...boundArgs) {
        return bindStatement(sql, boundArgs);
      },
      // Some call sites call .run()/.first()/.all() without .bind() first.
      run: () => bindStatement(sql, []).run(),
      first: () => bindStatement(sql, []).first(),
      all: () => bindStatement(sql, []).all(),
    };
  }

  async function batch(statements) {
    const results = [];
    for (const statement of statements) {
      results.push(await statement.run());
    }
    return results;
  }

  return { prepare, batch };
}
