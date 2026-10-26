// Read-only certificate and redirect watch for the public site (#4688).
// Opens one Operations Issue when a certificate expires within 30 days or
// the apex stops redirecting to www. No DNS or Cloudflare change.

import tls from 'node:tls';
import dns from 'node:dns/promises';
import { pathToFileURL } from 'node:url';

export const WARN_WITHIN_DAYS = 30;
export const EXCEPTION_LABELS = ['team:operations', 'ops-exception'];
const MARKER = '<!-- ops-cert-dns-watch -->';
const DAY_MS = 24 * 60 * 60 * 1000;

export const HOSTS = [
  { name: 'www', host: 'www.lougehrigfanclub.com' },
  { name: 'apex', host: 'lougehrigfanclub.com' },
  { name: 'pages.dev', host: 'next-starter-template-6yr.pages.dev' },
];

export const APEX_REDIRECT = {
  url: 'https://lougehrigfanclub.com/',
  expectHost: 'www.lougehrigfanclub.com',
};

export function certificateFinding(host, notAfter, now = new Date(), withinDays = WARN_WITHIN_DAYS) {
  const expiry = notAfter instanceof Date ? notAfter : new Date(notAfter);
  if (Number.isNaN(expiry.getTime())) {
    return { host, ok: false, reason: 'certificate expiry is unreadable' };
  }
  const daysLeft = (expiry.getTime() - now.getTime()) / DAY_MS;
  if (daysLeft <= withinDays) {
    return { host, ok: false, reason: `certificate expires in ${Math.floor(daysLeft)} day(s) (${expiry.toISOString()})` };
  }
  return { host, ok: true, reason: '' };
}

export function redirectFinding(status, location, expectHost) {
  let host = '';
  try {
    host = location ? new URL(location, APEX_REDIRECT.url).host : '';
  } catch {
    host = '';
  }
  const redirected = status >= 300 && status < 400 && status !== 304 && host === expectHost;
  if (redirected) return { host: 'apex-redirect', ok: true, reason: '' };
  return {
    host: 'apex-redirect',
    ok: false,
    reason: `apex returned HTTP ${status} to ${location || 'no location'}; expected a redirect to ${expectHost}`,
  };
}

export function dnsFinding(host, addresses) {
  if (!addresses || addresses.length === 0) {
    return { host: `${host} dns`, ok: false, reason: `${host} returned no DNS answer` };
  }
  return { host: `${host} dns`, ok: true, reason: '' };
}

export function collectFindings({ certificates, dns, redirect }) {
  return [...certificates, ...(dns || []), redirect].filter((finding) => finding && !finding.ok);
}

export function renderIssueBody(findings) {
  const lines = findings.map((finding) => `- ${finding.host}: ${finding.reason}`);
  return [
    MARKER,
    '',
    '## Exception: certificate or apex redirect changed',
    '',
    ...lines,
    '',
    'Read-only check of www, the apex, and the pages.dev host (#4688). A certificate inside 30 days, or an apex response that is not a redirect to www, opens this Issue. A later failure comments here. Operations closes it once the cause is fixed or accepted.',
  ].join('\n');
}

export async function handleCertDnsWatch({ findings, api, repo }) {
  const failing = collectFindings(findings);
  if (failing.length === 0) return { action: 'quiet' };

  const open = await api(
    'GET',
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent('ops-exception')}&per_page=100`,
  );
  const existing = (open || []).find(
    (issue) => !issue.pull_request && typeof issue.body === 'string' && issue.body.includes(MARKER),
  );
  const body = renderIssueBody(failing);
  if (existing) {
    await api('POST', `/repos/${repo}/issues/${existing.number}/comments`, { body });
    return { action: 'commented', number: existing.number };
  }
  const created = await api('POST', `/repos/${repo}/issues`, {
    title: 'OPS EXCEPTION: certificate expiry or apex redirect changed',
    body,
    labels: EXCEPTION_LABELS,
  });
  return { action: 'created', number: created.number };
}

export function readCertificate(host, { tlsConnect = tls.connect, timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    const socket = tlsConnect({ host, port: 443, servername: host, timeout: timeoutMs }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      resolve(cert?.valid_to ? new Date(cert.valid_to) : null);
    });
    socket.on('error', reject);
  });
}

export async function readRedirect(url, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl(url, { redirect: 'manual' });
  return { status: response.status, location: response.headers.get('location') };
}

function makeApi(token) {
  return async function api(method, path, body) {
    const response = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`GitHub API ${method} ${path} failed: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
}

async function main() {
  const { GH_TOKEN, REPO } = process.env;
  if (!GH_TOKEN || !REPO) {
    console.error('Missing required environment: GH_TOKEN, REPO');
    process.exit(2);
  }
  const now = new Date();
  const certificates = [];
  const dnsFindings = [];
  for (const entry of HOSTS) {
    const notAfter = await readCertificate(entry.host);
    certificates.push(certificateFinding(entry.host, notAfter, now));
    let addresses = [];
    try {
      addresses = await dns.resolve4(entry.host);
    } catch {
      try {
        addresses = await dns.resolve6(entry.host);
      } catch {
        addresses = [];
      }
    }
    dnsFindings.push(dnsFinding(entry.host, addresses));
  }
  const redirect = await readRedirect(APEX_REDIRECT.url);
  const result = await handleCertDnsWatch({
    findings: {
      certificates,
      dns: dnsFindings,
      redirect: redirectFinding(redirect.status, redirect.location, APEX_REDIRECT.expectHost),
    },
    api: makeApi(GH_TOKEN),
    repo: REPO,
  });
  console.log(JSON.stringify(result));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
