type MailChannelsAddress = { email: string; name?: string };

function parseFrom(from: string): MailChannelsAddress {
	// Supports: "Name <email@domain>" or "email@domain"
	const m = from.match(/^\s*(.*?)\s*<\s*([^>]+)\s*>\s*$/);
	if (m) return { name: m[1] || undefined, email: m[2] };
	return { email: from.trim() };
}

// #4751: website email is sent from the club domain's admin or support address only.
const FROM_DISPLAY_NAME = 'Lou Gehrig Fan Club';
const ALLOWED_FROM_ADDRESSES = ['admin@lougehrigfanclub.com', 'support@lougehrigfanclub.com'];
const DEFAULT_FROM_ADDRESS = ALLOWED_FROM_ADDRESSES[0];

export function resolveFromAddress(fromRaw: string): MailChannelsAddress {
	const parsed = parseFrom(fromRaw);
	const email = String(parsed.email || '').trim().toLowerCase();
	if (ALLOWED_FROM_ADDRESSES.includes(email)) {
		return { email, name: parsed.name || FROM_DISPLAY_NAME };
	}
	console.warn('MAIL_FROM is not an allowed sender address; using the default club address.');
	return { email: DEFAULT_FROM_ADDRESS, name: FROM_DISPLAY_NAME };
}

const DEFAULT_SITE_URL = 'https://www.lougehrigfanclub.com';

type MailSendResult = { sent: boolean; provider: string; statusCode?: number; error?: string; skipped?: boolean };

function requiredEnv(opts: { env: any; key: string; hint?: string }): string {
	const v = String(opts.env?.[opts.key] || '').trim();
	if (!v) {
		// Do NOT log secrets; only log missing key names.
		throw new Error(`Missing required env var: ${opts.key}${opts.hint ? ` (${opts.hint})` : ''}`);
	}
	return v;
}

async function sendMailChannels(opts: {
	env: any;
	to: MailChannelsAddress[];
	subject: string;
	text: string;
	html: string;
	senderOverride?: string; // still restricted to the allowed club addresses
}): Promise<MailSendResult> {
	const enabled = String(opts.env?.MAILCHANNELS_ENABLED || '0') === '1';
	if (!enabled) return { sent: false, provider: 'disabled' };

	const apiKey = String(opts.env?.MAILCHANNELS_API_KEY || '').trim();
	if (!apiKey) return { sent: false, provider: 'mailchannels', error: 'Missing MAILCHANNELS_API_KEY' };

	const fromRaw = String(opts.env?.MAIL_FROM || '').trim();
	if (!fromRaw) return { sent: false, provider: 'mailchannels', error: 'MAIL_FROM not configured' };

	const replyToRaw = String(opts.env?.MAIL_REPLY_TO || '').trim();
	const from = resolveFromAddress(opts.senderOverride || fromRaw);

	const payload: any = {
		personalizations: [{ to: opts.to }],
		from,
		subject: opts.subject,
		content: [
			{ type: 'text/plain', value: opts.text },
			{ type: 'text/html', value: opts.html },
		],
	};
	if (replyToRaw) payload.reply_to = parseFrom(replyToRaw);

	try {
		const res = await fetch('https://api.mailchannels.net/tx/v1/send', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Api-Key': apiKey,
			},
			body: JSON.stringify(payload),
		});

		const status = res.status;
		const body = await res.text();
		const truncatedBody = body.slice(0, 2048);

		if (status === 202) return { sent: true, provider: 'mailchannels', statusCode: status };

		const errorMsg = `MailChannels status ${status}: ${truncatedBody}`.slice(0, 600);
		return { sent: false, provider: 'mailchannels', statusCode: status, error: errorMsg };
	} catch (e: any) {
		const errorMsg = String(e?.message || e);
		return { sent: false, provider: 'mailchannels', error: errorMsg };
	}
}

export function assertEmailEnvOrThrow(env: any): void {
	const enabled = String(env?.MAILCHANNELS_ENABLED || '0') === '1';
	if (!enabled) return;

	requiredEnv({ env, key: 'MAILCHANNELS_API_KEY' });
	requiredEnv({ env, key: 'MAIL_FROM' });
	// Optional: MAIL_REPLY_TO, NEXT_PUBLIC_SITE_URL, MAIL_ADMIN_TO
}

function mdToPlain(md: string): string {
	return String(md || '')
		.replace(/^#+\s+/gm, '')
		.replace(/\*\*(.*?)\*\*/g, '$1')
		.replace(/\*(.*?)\*/g, '$1')
		.replace(/`([^`]*)`/g, '$1')
		.trim();
}

function mdToBasicHtml(md: string): string {
	const plain = mdToPlain(md);
	const parts = plain.split(/\n\s*\n/g).map((s) => s.trim()).filter(Boolean);
	return parts.map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br/>')}</p>`).join('\n');
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

export async function sendWelcomeEmail(opts: {
	env: any;
	toEmail: string;
	toName?: string;
	siteUrl?: string;
	introMd?: string; // optional: admin-managed welcome email top-half copy
}): Promise<MailSendResult> {
	const siteUrl = (opts.siteUrl || String(opts.env?.NEXT_PUBLIC_SITE_URL || '') || DEFAULT_SITE_URL).trim();
	const to: MailChannelsAddress = { email: opts.toEmail, name: opts.toName || undefined };

	const subject = 'Welcome to the Lou Gehrig Fan Club';

	const introMd = String(opts.introMd || '').trim();
	const defaultIntroText = `Welcome to the Lou Gehrig Fan Club, a fan-run community honoring Lou Gehrig's legacy and supporting ALS awareness. Membership is free.

Questions? Just reply to this email.`;
	const introText = introMd ? mdToPlain(introMd) : defaultIntroText;

	const text = `Hi${opts.toName ? ` ${opts.toName}` : ''},

${introText}

${siteUrl ? `Visit: ${siteUrl}
` : ''}— Lou Gehrig Fan Club`;

	const defaultIntroHtml = `<p>Welcome to the <strong>Lou Gehrig Fan Club</strong>, a fan-run community honoring Lou Gehrig's legacy and supporting ALS awareness. Membership is free.</p>
<p>Questions? Just reply to this email.</p>`;
	const introHtml = introMd ? mdToBasicHtml(introMd) : defaultIntroHtml;

	const html = `<p>Hi${opts.toName ? ` ${escapeHtml(opts.toName)}` : ''},</p>
${introHtml}
${siteUrl ? `<p>Visit: <a href="${siteUrl}">${siteUrl}</a></p>` : ''}
<p>— Lou Gehrig Fan Club</p>`;

	return sendMailChannels({ env: opts.env, to: [to], subject, text, html });
}

// #2919: strictly-transactional join confirmation for members who did not
// opt in to promotional/periodic-update email. Confirms the account action
// only — no "periodic updates" or other promotional copy.
export async function sendTransactionalJoinConfirmation(opts: {
	env: any;
	toEmail: string;
	toName?: string;
}): Promise<MailSendResult> {
	const to: MailChannelsAddress = { email: opts.toEmail, name: opts.toName || undefined };
	const subject = 'Your Lou Gehrig Fan Club account is confirmed';

	const text = `Hi${opts.toName ? ` ${opts.toName}` : ''},

This confirms your Lou Gehrig Fan Club account was created successfully.

You did not opt in to periodic email updates, so this is the only message you will receive unless you take further action on the site.

— Lou Gehrig Fan Club`;

	const html = `<p>Hi${opts.toName ? ` ${escapeHtml(opts.toName)}` : ''},</p>
<p>This confirms your <strong>Lou Gehrig Fan Club</strong> account was created successfully.</p>
<p>You did not opt in to periodic email updates, so this is the only message you will receive unless you take further action on the site.</p>
<p>— Lou Gehrig Fan Club</p>`;

	return sendMailChannels({ env: opts.env, to: [to], subject, text, html });
}

export async function sendAdminJoinNotification(opts: {
	env: any;
	name: string;
	email: string;
	requestId: string;
	siteUrl?: string;
}): Promise<MailSendResult> {
	const enabled = String(opts.env?.MAILCHANNELS_ENABLED || '0') === '1';
	if (!enabled) return { sent: false, provider: 'disabled' };

	const adminToRaw = String(opts.env?.MAIL_ADMIN_TO || '').trim();
	if (!adminToRaw) return { sent: false, provider: 'mailchannels', error: 'MAIL_ADMIN_TO not configured', skipped: true };

	const siteUrl = (opts.siteUrl || String(opts.env?.NEXT_PUBLIC_SITE_URL || '') || DEFAULT_SITE_URL).trim();

	const recipients = adminToRaw
		.split(',')
		.map((s: string) => s.trim())
		.filter(Boolean)
		.map((email: string) => ({ email } as MailChannelsAddress));

	// The member's name is typed by the member: keep it on one line and short in the subject.
	const subjectName = String(opts.name || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 100);
	const subject = `New fan club member join request: ${subjectName}`;
	const when = new Date().toISOString();

	const text = `New fan club member join request

Name: ${opts.name}
Email: ${opts.email}
When (UTC): ${when}
Request ID: ${opts.requestId}
Site: ${siteUrl}`;

	const html = `<h3>New fan club member join request</h3>
<ul>
<li><strong>Name:</strong> ${escapeHtml(opts.name)}</li>
<li><strong>Email:</strong> ${escapeHtml(opts.email)}</li>
<li><strong>When (UTC):</strong> ${when}</li>
<li><strong>Request ID:</strong> ${escapeHtml(opts.requestId)}</li>
<li><strong>Site:</strong> <a href="${escapeHtml(siteUrl)}">${escapeHtml(siteUrl)}</a></li>
</ul>`;

	// Sent from support@ so the notice is never from and to the same address (admin@).
	return sendMailChannels({ env: opts.env, to: recipients, subject, text, html, senderOverride: 'Lou Gehrig Fan Club <support@lougehrigfanclub.com>' });
}
