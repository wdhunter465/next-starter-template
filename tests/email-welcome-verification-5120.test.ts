// #5120: the one email a new member gets at join: welcome text, with the verification link inside it.

import { afterEach, describe, expect, it, vi } from 'vitest';

import { sendWelcomeVerificationEmail } from '../functions/_lib/email';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const env = {
  MAILCHANNELS_ENABLED: '1',
  MAILCHANNELS_API_KEY: 'test-key',
  MAIL_FROM: 'Lou Gehrig Fan Club <admin@lougehrigfanclub.com>',
  MAIL_REPLY_TO: 'admin@lougehrigfanclub.com',
};

const LINK = `https://www.lougehrigfanclub.com/join/verified/?token=${'a'.repeat(64)}`;

async function send(options: { emailOptIn: boolean; introMd?: string }) {
  const fetchMock = vi.fn(async () => new Response('', { status: 202 }));
  vi.stubGlobal('fetch', fetchMock);
  const result = await sendWelcomeVerificationEmail({ env, toEmail: 'm@example.com', toName: 'Pat', link: LINK, ...options });
  const calls = fetchMock.mock.calls as unknown as [string, { body: string }][];
  expect(calls).toHaveLength(1);
  const body = JSON.parse(calls[0][1].body);
  return { result, body, text: body.content[0].value as string, html: body.content[1].value as string };
}

describe('welcome email with the verification link (#5120)', () => {
  it('is one email whose link is the verification link, with no homepage link', async () => {
    const { result, body, text, html } = await send({ emailOptIn: true });
    expect(result.sent).toBe(true);
    expect(body.subject).toBe('Welcome to the Lou Gehrig Fan Club: please verify your email');
    expect(text).toContain(LINK);
    expect(html).toContain(`href="${LINK}"`);
    expect(html).toContain('Verify my email address');
    const links = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    expect(links).toEqual([LINK]);
    expect(text).not.toMatch(/Visit:/);
    expect(text.match(/https?:\/\/\S+/g)).toEqual([LINK]);
  });

  it('opted-in members get the welcome intro, or the posted copy when there is one', async () => {
    const plain = await send({ emailOptIn: true });
    expect(plain.text).toContain('Hi Pat,');
    expect(plain.text).toContain("Welcome to the Lou Gehrig Fan Club, a fan-run community honoring Lou Gehrig's legacy");
    const posted = await send({ emailOptIn: true, introMd: 'Posted intro for members.' });
    expect(posted.text).toContain('Posted intro for members.');
  });

  it('members who did not opt in get the transactional wording and never the promotional intro (#2919)', async () => {
    const { text, html } = await send({ emailOptIn: false, introMd: 'Promotional posted copy.' });
    expect(text).toContain('You did not opt in to periodic email updates');
    expect(text).not.toContain('Promotional posted copy.');
    expect(text).not.toContain('fan-run community');
    expect(html).not.toContain('Promotional posted copy.');
    expect(text).toContain(LINK);
  });

  it('escapes the name and the link in the html', async () => {
    const fetchMock = vi.fn(async () => new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);
    await sendWelcomeVerificationEmail({ env, toEmail: 'm@example.com', toName: '<b>Pat</b>', link: `${LINK}&x="y"`, emailOptIn: true });
    const body = JSON.parse((fetchMock.mock.calls as unknown as [string, { body: string }][])[0][1].body);
    const html = body.content[1].value as string;
    expect(html).not.toContain('<b>Pat</b>');
    expect(html).toContain('&lt;b&gt;Pat&lt;/b&gt;');
    expect(html).toContain('&quot;y&quot;');
  });

  it('does nothing when email is disabled', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const result = await sendWelcomeVerificationEmail({ env: {}, toEmail: 'm@example.com', link: LINK, emailOptIn: true });
    expect(result).toEqual({ sent: false, provider: 'disabled' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
