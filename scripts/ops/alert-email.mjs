/**
 * alert-email.mjs (#4687, gap 7 of #4657)
 *
 * The one place an alert email is sent. Decision 3 of #4657 (Product Authority, 2026-10-19): only an outage
 * (the uptime probe failing twice) and a failed Production deploy also notify Bill and the Operations holder.
 * No other alert type sends: sendAlertEmail refuses any kind outside ALERT_KINDS, and the test suite fails if
 * any other script imports this module or any other workflow passes it a credential.
 *
 * Inert until configured. It sends only when all three are set; otherwise it reports "not configured" and the
 * caller carries on (the GitHub Issue is still the record):
 *   ALERT_EMAIL_TO       comma-separated recipient addresses (repository variable, set by Product Authority)
 *   ALERT_EMAIL_FROM     sender address on a domain MailChannels is allowed to send for (repository variable)
 *   ALERT_MAILCHANNELS_API_KEY   the send credential (repository secret, provided by Product Authority)
 * A send failure never fails the alert job: it returns { sent: false, reason }.
 */

export const ALERT_KINDS = Object.freeze(['outage', 'failed_deploy']);
export const MAILCHANNELS_URL = 'https://api.mailchannels.net/tx/v1/send';

export function parseRecipients(raw) {
  return String(raw || '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/.test(value));
}

export async function sendAlertEmail({ kind, subject, text, env = process.env, fetchImpl = fetch }) {
  if (!ALERT_KINDS.includes(kind)) throw new Error(`Alert email refused: "${kind}" is not an outage or a failed deploy.`);
  const to = parseRecipients(env.ALERT_EMAIL_TO);
  const from = String(env.ALERT_EMAIL_FROM || '').trim();
  const apiKey = String(env.ALERT_MAILCHANNELS_API_KEY || '').trim();
  if (!to.length || !from || !apiKey) return { sent: false, reason: 'not_configured' };

  try {
    const res = await fetchImpl(MAILCHANNELS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': apiKey },
      body: JSON.stringify({
        personalizations: [{ to: to.map((email) => ({ email })) }],
        from: { email: from, name: 'LGFC site alerts' },
        subject: String(subject).slice(0, 200),
        content: [{ type: 'text/plain', value: String(text).slice(0, 5000) }],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 202) return { sent: true, recipients: to.length };
    return { sent: false, reason: `mailchannels_${res.status}` };
  } catch (error) {
    return { sent: false, reason: error instanceof Error ? error.message.slice(0, 120) : 'send_failed' };
  }
}
