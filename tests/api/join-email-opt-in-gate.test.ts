import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';

const sendWelcomeEmail = vi.fn().mockResolvedValue({ sent: false, provider: 'disabled' });
const sendTransactionalJoinConfirmation = vi.fn().mockResolvedValue({ sent: false, provider: 'disabled' });
const sendAdminJoinNotification = vi.fn().mockResolvedValue({ sent: false, provider: 'disabled' });

vi.mock('../../functions/_lib/email', () => ({
  assertEmailEnvOrThrow: vi.fn(),
  sendWelcomeEmail: (...args: unknown[]) => sendWelcomeEmail(...args),
  sendTransactionalJoinConfirmation: (...args: unknown[]) => sendTransactionalJoinConfirmation(...args),
  sendAdminJoinNotification: (...args: unknown[]) => sendAdminJoinNotification(...args),
}));

// Imported after the mock so the handler picks up the mocked module.
const { onRequestPost } = await import('../../functions/api/join');

function applyRepoMigrations(db: DatabaseSync) {
  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    db.exec(fs.readFileSync(path.join(migrationsDir, file), 'utf8'));
  }
}

function wrapSqliteAsD1(sqlite: DatabaseSync) {
  return {
    async exec(sql: string) {
      sqlite.exec(sql);
    },
    prepare(sql: string) {
      const stmt = sqlite.prepare(sql);
      const bound = (...args: SQLInputValue[]) => ({
        async first() {
          return stmt.get(...args) ?? null;
        },
        async all() {
          return { results: stmt.all(...args) };
        },
        async run() {
          const info = stmt.run(...args);
          return { success: true, meta: { changes: info.changes } };
        },
      });

      return {
        bind: bound,
        async first() {
          return stmt.get() ?? null;
        },
        async all() {
          return { results: stmt.all() };
        },
        async run() {
          const info = stmt.run();
          return { success: true, meta: { changes: info.changes } };
        },
      };
    },
  };
}

function joinRequest(body: unknown): Request {
  return new Request('https://www.lougehrigfanclub.com/api/join', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/join email_opt_in send-gate (#2919)', () => {
  afterEach(() => {
    sendWelcomeEmail.mockClear();
    sendTransactionalJoinConfirmation.mockClear();
  });

  it('sends the full welcome message when email_opt_in is true', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: joinRequest({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'opted-in@example.com',
        email_opt_in: true,
      }),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(200);
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(sendTransactionalJoinConfirmation).not.toHaveBeenCalled();
  });

  it('sends only the strictly-transactional confirmation when email_opt_in is false', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: joinRequest({
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'opted-out@example.com',
        email_opt_in: false,
      }),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(200);
    expect(sendTransactionalJoinConfirmation).toHaveBeenCalledTimes(1);
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
  });

  it('defaults to opted-in (full welcome message) when email_opt_in is omitted', async () => {
    const sqlite = new DatabaseSync(':memory:');
    applyRepoMigrations(sqlite);
    const db = wrapSqliteAsD1(sqlite);

    const res = await onRequestPost({
      request: joinRequest({ first_name: 'Jane', last_name: 'Doe', email: 'default@example.com' }),
      env: { DB: db },
    } as any);
    expect(res.status).toBe(200);
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
  });
});
