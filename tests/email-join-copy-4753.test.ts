import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendAdminJoinNotification, sendWelcomeEmail } from '../functions/_lib/email';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const env = {
  MAILCHANNELS_ENABLED: '1',
  MAILCHANNELS_API_KEY: 'test-key',
  MAIL_FROM: 'Lou Gehrig Fan Club <admin@lougehrigfanclub.com>',
  MAIL_REPLY_TO: 'admin@lougehrigfanclub.com',
  MAIL_ADMIN_TO: 'admin@lougehrigfanclub.com',
};

async function capture(send: () => Promise<unknown>) {
  const fetchMock = vi.fn(async () => new Response('', { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  await send();
  const calls = fetchMock.mock.calls as unknown as [string, { body: string }][];
  return JSON.parse(calls[0][1].body);
}

describe('join email copy and admin notice (#4753)', () => {
  it('sends the approved welcome copy when no copy is posted, with no working text', async () => {
    const body = await capture(() => sendWelcomeEmail({ env, toEmail: 'm@example.com', toName: 'Pat' }));
    const text = body.content[0].value as string;
    expect(text).toContain('Hi Pat,');
    expect(text).toContain("Welcome to the Lou Gehrig Fan Club, a fan-run community honoring Lou Gehrig's legacy and supporting ALS awareness. Membership is free.");
    expect(text).toContain('Questions? Just reply to this email.');
    expect(text).toContain('Visit: https://www.lougehrigfanclub.com');
    expect(text).not.toMatch(/top-half|WelcomeEmail|mailing list/);
  });

  it('keeps using posted welcome copy when one exists', async () => {
    const body = await capture(() => sendWelcomeEmail({ env, toEmail: 'm@example.com', introMd: 'Posted intro.' }));
    expect(body.content[0].value).toContain('Posted intro.');
  });

  it('sends the admin notice from support@ to the admin address with the approved subject', async () => {
    const body = await capture(() => sendAdminJoinNotification({ env, name: 'Pat Lee', email: 'pat@example.com', requestId: 'req_1' }));
    expect(body.from).toEqual({ email: 'support@lougehrigfanclub.com', name: 'Lou Gehrig Fan Club' });
    expect(body.personalizations[0].to).toEqual([{ email: 'admin@lougehrigfanclub.com' }]);
    expect(body.subject).toBe('New fan club member join request: Pat Lee');
    expect(JSON.stringify(body)).not.toContain('LGFC Lite');
  });

  it('escapes the member name in the admin notice and keeps the subject on one line', async () => {
    const body = await capture(() =>
      sendAdminJoinNotification({ env, name: 'A<script>x</script>\nBcc: evil@example.com', email: 'a@example.com', requestId: 'req_2' }),
    );
    expect(body.subject).not.toMatch(/[\r\n]/);
    const html = body.content[1].value as string;
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('sends no admin notice when no admin address is configured', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendAdminJoinNotification({ env: { ...env, MAIL_ADMIN_TO: '' }, name: 'Pat', email: 'p@example.com', requestId: 'r' });
    expect(result).toMatchObject({ sent: false, skipped: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
