import { describe, expect, it, vi } from 'vitest';

import { onRequest } from '../functions/_middleware';

function run(url: string, method = 'GET') {
  const next = vi.fn(async () => new Response('page', { status: 200 }));
  return onRequest({ request: new Request(url, { method }), next }).then((response) => ({ response, next }));
}

describe('root pages.dev host redirect (#4698)', () => {
  it('redirects the root pages.dev address to www with the same path and query (301)', async () => {
    const { response, next } = await run('https://next-starter-template-6yr.pages.dev/about/?x=1');
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://www.lougehrigfanclub.com/about/?x=1');
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');
    expect(next).not.toHaveBeenCalled();
  });

  it('redirects the root address home page too', async () => {
    const { response } = await run('https://next-starter-template-6yr.pages.dev/');
    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://www.lougehrigfanclub.com/');
  });

  it('keeps the method for non-GET requests (308)', async () => {
    const { response } = await run('https://next-starter-template-6yr.pages.dev/api/join', 'POST');
    expect(response.status).toBe(308);
    expect(response.headers.get('Location')).toBe('https://www.lougehrigfanclub.com/api/join');
  });

  it('does not redirect branch or per-deployment preview hosts', async () => {
    for (const host of [
      'claude-4698-pages-dev-redirect.next-starter-template-6yr.pages.dev',
      'a1b2c3d4.next-starter-template-6yr.pages.dev',
    ]) {
      const { response, next } = await run(`https://${host}/about/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Location')).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    }
  });

  it('does not redirect www or the apex domain (no loop)', async () => {
    for (const host of ['www.lougehrigfanclub.com', 'lougehrigfanclub.com']) {
      const { response, next } = await run(`https://${host}/`);
      expect(response.status).toBe(200);
      expect(response.headers.get('Location')).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    }
  });
});
