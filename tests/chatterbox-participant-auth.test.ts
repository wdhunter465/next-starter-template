// #3794 JULES-1 regression test: a participant's credential must
// authenticate as exactly that participant — it must not be possible to
// assert a different participant_key and be honored, the way the old
// shared-ADMIN_TOKEN model allowed.

import { describe, expect, it } from 'vitest';

import {
  hashCredential,
  requireChatterboxCaller,
  resolveActingParticipant,
  requireRelay,
} from '../functions/_lib/chatterbox-auth';
import type { Db } from '../functions/_lib/chatterbox';

type FakeParticipant = {
  id: number;
  participant_key: string;
  display_name: string;
  role_class: string;
  credential_hash: string | null;
  revoked_at: string | null;
};

function makeFakeDb(participants: FakeParticipant[]): Db {
  return {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async first() {
              if (/credential_hash = \?/.test(sql)) {
                const [hash] = args as [string];
                return participants.find((p) => p.credential_hash === hash && !p.revoked_at) ?? null;
              }
              if (/participant_key = \?/.test(sql)) {
                const [key] = args as [string];
                return participants.find((p) => p.participant_key === key && !p.revoked_at) ?? null;
              }
              return null;
            },
            async all() {
              return { results: participants };
            },
            async run() {
              return {};
            },
          };
        },
      };
    },
  };
}

function request(bearer?: string): Request {
  const headers: Record<string, string> = {};
  if (bearer) headers.Authorization = `Bearer ${bearer}`;
  return new Request('https://example.test/api/chatterbox/check-in', { method: 'POST', headers });
}

describe('hashCredential', () => {
  it('is deterministic and distinguishes different inputs', async () => {
    const a1 = await hashCredential('agent-secret-token-alpha');
    const a2 = await hashCredential('agent-secret-token-alpha');
    const b = await hashCredential('agent-secret-token-beta');
    expect(a1).toBe(a2);
    expect(a1).not.toBe(b);
    expect(a1).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('requireChatterboxCaller', () => {
  it('rejects a request with no bearer token', async () => {
    const db = makeFakeDb([]);
    const result = await requireChatterboxCaller(request(), {}, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('rejects an unrecognized credential', async () => {
    const db = makeFakeDb([]);
    const result = await requireChatterboxCaller(request('not-a-real-token'), {}, db);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('authenticates the bridge relay token as kind "relay"', async () => {
    const db = makeFakeDb([]);
    const result = await requireChatterboxCaller(request('bridge-secret'), { CHATTERBOX_BRIDGE_TOKEN: 'bridge-secret' }, db);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.caller.kind).toBe('relay');
  });

  it('authenticates a per-participant credential as exactly that participant', async () => {
    const hash = await hashCredential('alice-secret-token-0001');
    const db = makeFakeDb([
      { id: 1, participant_key: 'alice', display_name: 'Alice', role_class: 'implementation_agent', credential_hash: hash, revoked_at: null },
    ]);
    const result = await requireChatterboxCaller(request('alice-secret-token-0001'), {}, db);
    expect(result.ok).toBe(true);
    if (result.ok && result.caller.kind === 'participant') {
      expect(result.caller.participant.participant_key).toBe('alice');
    }
  });
});

describe('resolveActingParticipant — the JULES-1 fix', () => {
  const alice = { id: 1, participant_key: 'alice', display_name: 'Alice', role_class: 'implementation_agent', credential_hash: 'h1', revoked_at: null };
  const bob = { id: 2, participant_key: 'bob', display_name: 'Bob', role_class: 'implementation_agent', credential_hash: 'h2', revoked_at: null };

  it('rejects an authenticated participant asserting a different participant_key', async () => {
    const db = makeFakeDb([alice, bob]);
    const result = await resolveActingParticipant(db, { kind: 'participant', participant: alice }, 'bob');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(403);
  });

  it('allows an authenticated participant to act as itself, asserted or not', async () => {
    const db = makeFakeDb([alice, bob]);
    const implicit = await resolveActingParticipant(db, { kind: 'participant', participant: alice }, null);
    expect(implicit.ok).toBe(true);
    if (implicit.ok) expect(implicit.participant.participant_key).toBe('alice');

    const explicit = await resolveActingParticipant(db, { kind: 'participant', participant: alice }, 'alice');
    expect(explicit.ok).toBe(true);
    if (explicit.ok) expect(explicit.participant.participant_key).toBe('alice');
  });

  it('requires the relay caller to name a participant_key explicitly (unchanged bridge model)', async () => {
    const db = makeFakeDb([alice, bob]);
    const result = await resolveActingParticipant(db, { kind: 'relay' }, null);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });

  it('resolves the relay caller as the named participant when found', async () => {
    const db = makeFakeDb([alice, bob]);
    const result = await resolveActingParticipant(db, { kind: 'relay' }, 'bob');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.participant.participant_key).toBe('bob');
  });

  it('404s when the relay names a participant_key that does not exist', async () => {
    const db = makeFakeDb([alice, bob]);
    const result = await resolveActingParticipant(db, { kind: 'relay' }, 'nobody');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(404);
  });
});

describe('requireRelay', () => {
  it('permits the relay caller', () => {
    expect(requireRelay({ kind: 'relay' })).toBeNull();
  });

  it('rejects an authenticated participant caller', () => {
    const denial = requireRelay({ kind: 'participant', participant: { participant_key: 'alice' } });
    expect(denial).not.toBeNull();
    expect(denial?.status).toBe(403);
  });
});
