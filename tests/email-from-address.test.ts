import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveFromAddress, sendWelcomeEmail } from '../functions/_lib/email';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function envWith(mailFrom: string, extra: Record<string, string> = {}) {
  return { MAILCHANNELS_ENABLED: '1', MAILCHANNELS_API_KEY: 'test-key', MAIL_FROM: mailFrom, ...extra };
}

async function sentPayload(env: Record<string, string>) {
  const fetchMock = vi.fn(async () => new Response('', { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  const result = await sendWelcomeEmail({ env, toEmail: 'member@example.com', toName: 'Member' });
  const calls = fetchMock.mock.calls as unknown as [string, { body: string }][];
  return { result, fetchMock, body: calls[0] ? JSON.parse(calls[0][1].body) : null };
}

describe('website email sender address (#4751)', () => {
  it('keeps the admin or support address, in any letter case, and names it for the club', () => {
    expect(resolveFromAddress('admin@lougehrigfanclub.com')).toEqual({ email: 'admin@lougehrigfanclub.com', name: 'Lou Gehrig Fan Club' });
    expect(resolveFromAddress('Custom Name <Support@LouGehrigFanClub.com>')).toEqual({ email: 'support@lougehrigfanclub.com', name: 'Custom Name' });
  });

  it('falls back to the admin address for any other sender and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of ['noreply@lougehrigfanclub.com', 'someone@gmail.com', 'Club <admin@elsewhere.org>', 'not an address', '']) {
      expect(resolveFromAddress(bad)).toEqual({ email: 'admin@lougehrigfanclub.com', name: 'Lou Gehrig Fan Club' });
    }
    expect(warn).toHaveBeenCalledTimes(5);
  });

  it('sends the join email from the support address when configured', async () => {
    const { result, body } = await sentPayload(envWith('Lou Gehrig Fan Club <support@lougehrigfanclub.com>', { MAIL_REPLY_TO: 'admin@lougehrigfanclub.com' }));
    expect(result.sent).toBe(true);
    expect(body.from).toEqual({ email: 'support@lougehrigfanclub.com', name: 'Lou Gehrig Fan Club' });
    expect(body.reply_to).toEqual({ email: 'admin@lougehrigfanclub.com' });
  });

  it('sends from the admin address when MAIL_FROM is a no-reply or personal address', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    for (const bad of ['Lou Gehrig Fan Club <noreply@lougehrigfanclub.com>', 'friend@gmail.com']) {
      const { body } = await sentPayload(envWith(bad));
      expect(body.from).toEqual({ email: 'admin@lougehrigfanclub.com', name: 'Lou Gehrig Fan Club' });
    }
  });

  it('still sends nothing when mail is off or no sender is configured', async () => {
    const off = await sentPayload({ ...envWith('admin@lougehrigfanclub.com'), MAILCHANNELS_ENABLED: '0' });
    expect(off.result).toMatchObject({ sent: false, provider: 'disabled' });
    expect(off.fetchMock).not.toHaveBeenCalled();

    const none = await sentPayload(envWith(''));
    expect(none.result.sent).toBe(false);
    expect(none.result.error).toContain('MAIL_FROM');
    expect(none.fetchMock).not.toHaveBeenCalled();
  });
});
