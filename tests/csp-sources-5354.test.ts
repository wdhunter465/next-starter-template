// @vitest-environment node
// #5354: both Content Security Policies (the enforced one in public/_headers, the report-only one in
// functions/_middleware.ts) carry no invalid host source, keep every previously valid image source,
// and allow the Cloudflare Web Analytics beacon.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();

function enforcedPolicy(): string {
  const text = fs.readFileSync(path.join(ROOT, 'public/_headers'), 'utf8');
  const line = text.split('\n').find((l) => l.trim().startsWith('Content-Security-Policy:'));
  if (!line) throw new Error('no Content-Security-Policy line in public/_headers');
  return line.trim().slice('Content-Security-Policy:'.length).trim();
}

function reportOnlyPolicy(): string {
  const text = fs.readFileSync(path.join(ROOT, 'functions/_middleware.ts'), 'utf8');
  const start = text.indexOf('const directives = [');
  const end = text.indexOf('];', start);
  if (start < 0 || end < 0) throw new Error('directive list not found in functions/_middleware.ts');
  const literals = [...text.slice(start, end).matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]);
  return literals.join('; ');
}

function directive(policy: string, name: string): string[] {
  const part = policy.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${name} `));
  if (!part) throw new Error(`no ${name} directive`);
  return part.split(/\s+/).slice(1);
}

const POLICIES: Array<[string, () => string]> = [
  ['enforced (public/_headers)', enforcedPolicy],
  ['report-only (functions/_middleware.ts)', reportOnlyPolicy],
];

// A CSP host source may use a wildcard only as the whole first label (https://*.example.com).
function invalidHostSources(sources: string[]): string[] {
  return sources.filter((s) => {
    if (!s.startsWith('https://') && !s.startsWith('http://')) return false;
    const host = s.replace(/^https?:\/\//, '').split('/')[0];
    if (!host.includes('*')) return false;
    return !/^\*\.[^*]+$/.test(host);
  });
}

describe.each(POLICIES)('CSP sources (#5354): %s', (_name, load) => {
  const policy = load();
  const directives = ['img-src', 'script-src', 'connect-src', 'frame-src', 'style-src'];

  it('has no host source with a wildcard anywhere but the whole first label', () => {
    for (const d of directives) {
      expect(invalidHostSources(directive(policy, d)), d).toEqual([]);
    }
  });

  it('no longer lists the two removed invalid image sources', () => {
    const img = directive(policy, 'img-src');
    expect(img).not.toContain('https://scontent-*.cdninstagram.com');
    expect(img).not.toContain('https://instagram.*.fbcdn.net');
  });

  it('keeps the valid Instagram and Facebook image sources it had', () => {
    const img = directive(policy, 'img-src');
    expect(img).toContain('https://scontent.cdninstagram.com');
    expect(img).toContain('https://platform-lookaside.fbsbx.com');
  });

  it('allows the Cloudflare Web Analytics beacon in script-src and connect-src', () => {
    expect(directive(policy, 'script-src')).toContain('https://static.cloudflareinsights.com');
    expect(directive(policy, 'connect-src')).toContain('https://cloudflareinsights.com');
  });
});

describe('CSP sources (#5354): enforced policy keeps its wider valid wildcards', () => {
  it('still allows every Instagram and Facebook image CDN subdomain through the valid wildcards', () => {
    const img = directive(enforcedPolicy(), 'img-src');
    expect(img).toContain('https://*.cdninstagram.com');
    expect(img).toContain('https://*.fbcdn.net');
  });
});
