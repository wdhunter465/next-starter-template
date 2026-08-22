import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import AdminCMSPage from '@/app/admin/cms/page';
import AdminContentPage from '@/app/admin/content/page';
import { onRequestGet as cmsListGet } from '../functions/api/admin/cms/list';
import { onRequestPost as cmsSavePost } from '../functions/api/admin/cms/save';
import { onRequestPost as cmsPublishPost } from '../functions/api/admin/cms/publish';
import { onRequestGet as contentListGet } from '../functions/api/admin/content/list';
import { onRequestPost as contentSavePost } from '../functions/api/admin/content/save';
import { onRequestPost as contentPublishPost } from '../functions/api/admin/content/publish';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/cms'));

vi.mock('next/navigation', () => ({
  usePathname: mockUsePathname,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function adminGetRequest(path: string, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = {};
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, { headers });
}

function adminPostRequest(path: string, body: unknown, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeCmsDb(options?: {
  existing?: { key: string; version: number; body_md: string } | null;
  now?: string;
}) {
  const now = options?.now ?? '2026-06-01T00:00:00Z';

  return {
    prepare: vi.fn((sql: string) => {
      const firstFn = async () => {
        if (sql.includes("SELECT datetime('now')")) return { now };
        if (sql.includes('FROM content_blocks')) return options?.existing ?? null;
        return null;
      };
      const allFn = async () => ({
        results: options?.existing
          ? [{ ...options.existing, page: 'home', section: 'hero', title: 'Hero', status: 'draft', published_body_md: null, updated_at: now, published_at: null, updated_by: 'admin' }]
          : [],
      });
      const runFn = async () => ({ meta: { changes: 1 } });

      return {
        first: firstFn,
        all: allFn,
        run: runFn,
        bind: (..._args: unknown[]) => ({ first: firstFn, all: allFn, run: runFn }),
      };
    }),
  };
}

function makeContentDb(options?: {
  rows?: Array<{ slug: string; section: string; status: string; content: string | null; asset_url: string | null; updated_at: string }>;
  hasDraft?: boolean;
}) {
  const rows = options?.rows ?? [];
  return {
    prepare: vi.fn((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        all: async () => ({ results: rows }),
        first: async () => {
          if (sql.includes("status='draft'")) return options?.hasDraft ? rows.find(r => r.status === 'draft') ?? null : null;
          return null;
        },
        run: async () => ({ meta: { changes: 1 } }),
      }),
    })),
  };
}

// ─── CMS page (admin/cms) ────────────────────────────────────────────────────

describe('admin CMS page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/cms');
  });

  it('renders AdminNav with CMS Blocks link active', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, page: null, pages: [], blocks: [] }),
    );

    render(<AdminCMSPage />);

    expect(screen.getByRole('link', { name: 'CMS Blocks' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
  });

  it('loads CMS blocks on mount and renders them', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/admin/cms/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            page: null,
            pages: ['home'],
            blocks: [
              {
                key: 'home.hero.main',
                page: 'home',
                section: 'hero',
                title: 'Hero Block',
                body_md: '# Welcome',
                status: 'draft',
                published_body_md: null,
                version: 1,
                updated_at: '2026-06-01T00:00:00Z',
                published_at: null,
                updated_by: 'admin',
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminCMSPage />);

    await waitFor(() => {
      expect(screen.getByText('Hero Block')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/cms/list',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('shows empty state when no blocks are returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, page: null, pages: [], blocks: [] }),
    );

    render(<AdminCMSPage />);

    await waitFor(() => {
      expect(screen.getByText('No blocks found.')).toBeInTheDocument();
    });
  });

  it('announces CMS list API failures to assistive technology', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: false, error: 'Unauthorized.' }, 401) as never,
    );

    render(<AdminCMSPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/error: unauthorized/i);
  });

  it('populates CMS editor fields when a block is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/admin/cms/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            page: null,
            pages: ['home'],
            blocks: [
              {
                key: 'home.hero.main',
                page: 'home',
                section: 'hero',
                title: 'Hero Block',
                body_md: '# Welcome',
                status: 'draft',
                published_body_md: null,
                version: 1,
                updated_at: '2026-06-01T00:00:00Z',
                published_at: null,
                updated_by: 'admin',
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminCMSPage />);

    await waitFor(() => {
      expect(screen.getByText('Hero Block')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Hero Block'));

    expect(screen.getByLabelText('Key')).toHaveValue('home.hero.main');
    expect(screen.getByLabelText('Title')).toHaveValue('Hero Block');
  });
});

// ─── Content page (admin/content) ────────────────────────────────────────────

describe('admin content page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/content');
  });

  it('renders AdminNav with Page Content link active', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, slugs: [], grouped: {} }),
    );

    render(<AdminContentPage />);

    expect(screen.getByRole('link', { name: 'Page Content' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
  });

  it('loads page sections from /api/admin/content/list on mount', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/content/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            slugs: ['/'],
            grouped: {
              '/': {
                hero: {
                  live: { slug: '/', section: 'hero', status: 'live', content: 'Welcome text', asset_url: null, updated_at: '2026-06-01T00:00:00Z' },
                },
                lead: {
                  live: { slug: '/', section: 'lead', status: 'live', content: 'Lead copy', asset_url: null, updated_at: '2026-06-01T00:00:00Z' },
                  draft: { slug: '/', section: 'lead', status: 'draft', content: 'Updated lead copy', asset_url: null, updated_at: '2026-06-02T00:00:00Z' },
                },
              },
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminContentPage />);

    await waitFor(() => {
      expect(screen.getByText('hero')).toBeInTheDocument();
      expect(screen.getByText('lead')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/content/list?slug=%2F',
      expect.objectContaining({ cache: 'no-store' }),
    );
  });

  it('shows empty state when no sections are returned', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: true, slugs: [], grouped: {} }),
    );

    render(<AdminContentPage />);

    await waitFor(() => {
      expect(screen.getByText(/No sections returned/)).toBeInTheDocument();
    });
  });

  it('loads a different slug when Load is clicked', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.includes('slug=%2Fabout')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            slugs: ['/about'],
            grouped: {
              '/about': {
                intro: {
                  live: {
                    slug: '/about',
                    section: 'intro',
                    status: 'live',
                    content: 'About copy',
                    asset_url: null,
                    updated_at: '2026-06-01T00:00:00Z',
                  },
                },
              },
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true, slugs: [], grouped: {} }));
    });

    render(<AdminContentPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/content/list?slug=%2F', expect.anything());
    });

    fireEvent.change(screen.getByPlaceholderText('/'), { target: { value: '/about' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(screen.getByText('intro')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/admin/content/list?slug=%2Fabout', expect.anything());
    expect(screen.getByPlaceholderText('/')).toHaveValue('/about');
  });

  it('disables save and publish while displayed sections belong to a different slug', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.includes('slug=%2Fabout')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            slugs: ['/about'],
            grouped: {
              '/about': {
                intro: {
                  live: {
                    slug: '/about',
                    section: 'intro',
                    status: 'live',
                    content: 'About copy',
                    asset_url: null,
                    updated_at: '2026-06-01T00:00:00Z',
                  },
                },
              },
            },
          }),
        );
      }
      if (path.startsWith('/api/admin/content/list')) {
        return Promise.resolve(jsonResponse({ ok: true, slugs: [], grouped: {} }));
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminContentPage />);

    await waitFor(() => {
      expect(screen.getByText(/No sections returned/)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('/'), { target: { value: '/about' } });
    fireEvent.click(screen.getByRole('button', { name: 'Load' }));

    await waitFor(() => {
      expect(screen.getByText('intro')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('/'), { target: { value: '/contact' } });

    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Publish' })).toBeDisabled();
    expect(screen.getByText(/Loaded content is for "\/about"/)).toBeInTheDocument();
  });

  it('announces content list API failures to assistive technology', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: false, error: 'Unauthorized.' }, 401) as never,
    );

    render(<AdminContentPage />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/error: unauthorized/i);
  });

  it('sends save draft request to /api/admin/content/save', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/admin/content/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            slugs: ['/'],
            grouped: {
              '/': {
                hero: {
                  live: { slug: '/', section: 'hero', status: 'live', content: 'Old content', asset_url: null, updated_at: '2026-06-01T00:00:00Z' },
                },
              },
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminContentPage />);

    await waitFor(() => {
      expect(screen.getByText('hero')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/content/save',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const saveCall = fetchMock.mock.calls.find(([path]) => String(path) === '/api/admin/content/save');
    expect(saveCall).toBeDefined();
    const saveBody = JSON.parse(String(saveCall?.[1]?.body));
    expect(saveBody).toMatchObject({ slug: '/', section: 'hero' });
  });

  it('sends publish request to /api/admin/content/publish', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);
      if (path.startsWith('/api/admin/content/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            slugs: ['/'],
            grouped: {
              '/': {
                hero: {
                  draft: { slug: '/', section: 'hero', status: 'draft', content: 'Draft content', asset_url: null, updated_at: '2026-06-02T00:00:00Z' },
                },
              },
            },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ ok: true }));
    });

    render(<AdminContentPage />);

    await waitFor(() => {
      expect(screen.getByText('hero')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/admin/content/publish',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const publishCall = fetchMock.mock.calls.find(([path]) => String(path) === '/api/admin/content/publish');
    expect(publishCall).toBeDefined();
    const publishBody = JSON.parse(String(publishCall?.[1]?.body));
    expect(publishBody).toMatchObject({ slug: '/', section: 'hero' });
  });
});

// ─── CMS API functions ────────────────────────────────────────────────────────

describe('CMS API: list endpoint', () => {
  it('rejects requests missing admin token', async () => {
    const response = await cmsListGet({
      request: adminGetRequest('/api/admin/cms/list', ''),
      env: { DB: makeCmsDb() },
    });

    expect(response.status).toBe(401);
  });

  it('returns blocks for the requested page', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: (..._args: unknown[]) => ({
          all: async () => ({
            results: [
              {
                key: 'home.hero.main',
                page: 'home',
                section: 'hero',
                title: 'Hero Block',
                body_md: '# Welcome',
                status: 'published',
                published_body_md: '# Welcome',
                version: 2,
                updated_at: '2026-06-01T00:00:00Z',
                published_at: '2026-06-01T00:00:00Z',
                updated_by: 'admin',
              },
            ],
          }),
        }),
        all: async () => ({
          results: [
            {
              key: 'home.hero.main',
              page: 'home',
              section: 'hero',
              title: 'Hero Block',
              body_md: '# Welcome',
              status: 'published',
              published_body_md: '# Welcome',
              version: 2,
              updated_at: '2026-06-01T00:00:00Z',
              published_at: '2026-06-01T00:00:00Z',
              updated_by: 'admin',
            },
          ],
        }),
      })),
    };

    const response = await cmsListGet({
      request: adminGetRequest('/api/admin/cms/list?page=home'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.blocks).toHaveLength(1);
    expect(body.blocks[0].key).toBe('home.hero.main');
    expect(body.pages).toContain('home');
  });
});

describe('CMS API: save endpoint', () => {
  it('rejects unauthenticated save requests', async () => {
    const response = await cmsSavePost({
      request: adminPostRequest('/api/admin/cms/save', {}, ''),
      env: { DB: makeCmsDb() },
    });

    expect(response.status).toBe(401);
  });

  it('rejects saves with missing required fields', async () => {
    const response = await cmsSavePost({
      request: adminPostRequest('/api/admin/cms/save', { key: '', page: '', section: '', title: '' }),
      env: { DB: withAdminSession(makeCmsDb()) },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/Missing required fields/);
  });

  it('creates a new block at version 1', async () => {
    const runCalls: string[] = [];

    const db = {
      prepare: vi.fn((sql: string) => {
        const firstFn = async () => {
          if (sql.includes("SELECT datetime('now')")) return { now: '2026-06-01T00:00:00Z' };
          if (sql.includes('FROM content_blocks')) return null;
          return null;
        };
        return {
          first: firstFn,
          bind: (..._args: unknown[]) => ({
            first: firstFn,
            run: async () => {
              runCalls.push(sql);
              return { meta: { changes: 1 } };
            },
          }),
        };
      }),
    };

    const response = await cmsSavePost({
      request: adminPostRequest('/api/admin/cms/save', {
        key: 'home.hero.main',
        page: 'home',
        section: 'hero',
        title: 'Hero Block',
        body_md: '# Welcome to LGFC',
        updated_by: 'admin-ui',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(true);
    expect(body.version).toBe(1);
    expect(runCalls.some((s) => s.includes('INSERT INTO content_blocks'))).toBe(true);
    expect(runCalls.some((s) => s.includes('INSERT INTO content_revisions'))).toBe(true);
  });

  it('increments version when updating an existing block', async () => {
    let updatedVersion: number | null = null;

    const db = {
      prepare: vi.fn((sql: string) => {
        const firstFn = async () => {
          if (sql.includes("SELECT datetime('now')")) return { now: '2026-06-01T00:00:00Z' };
          if (sql.includes('FROM content_blocks')) return { key: 'home.hero.main', version: 3 };
          return null;
        };
        return {
          first: firstFn,
          bind: (...args: unknown[]) => ({
            first: firstFn,
            run: async () => {
              if (sql.includes('UPDATE content_blocks')) {
                updatedVersion = args[4] as number;
              }
              return { meta: { changes: 1 } };
            },
          }),
        };
      }),
    };

    const response = await cmsSavePost({
      request: adminPostRequest('/api/admin/cms/save', {
        key: 'home.hero.main',
        page: 'home',
        section: 'hero',
        title: 'Hero Block',
        body_md: '# Updated Welcome',
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.created).toBe(false);
    expect(body.version).toBe(4);
    expect(updatedVersion).toBe(4);
  });
});

describe('CMS API: publish endpoint', () => {
  it('rejects unauthenticated publish requests', async () => {
    const response = await cmsPublishPost({
      request: adminPostRequest('/api/admin/cms/publish', { key: 'home.hero.main' }, ''),
      env: { DB: makeCmsDb() },
    });

    expect(response.status).toBe(401);
  });

  it('returns 404 when the block does not exist', async () => {
    const db = {
      prepare: vi.fn((sql: string) => {
        const firstFn = async () => {
          if (sql.includes("SELECT datetime('now')")) return { now: '2026-06-01T00:00:00Z' };
          return null;
        };
        return {
          first: firstFn,
          bind: (..._args: unknown[]) => ({
            first: firstFn,
            run: async () => ({ meta: { changes: 0 } }),
          }),
        };
      }),
    };

    const response = await cmsPublishPost({
      request: adminPostRequest('/api/admin/cms/publish', { key: 'home.missing' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/not found/i);
  });

  it('promotes draft body_md to published_body_md and records a revision', async () => {
    const runCalls: string[] = [];

    const db = {
      prepare: vi.fn((sql: string) => {
        const firstFn = async () => {
          if (sql.includes("SELECT datetime('now')")) return { now: '2026-06-01T00:00:00Z' };
          if (sql.includes('FROM content_blocks')) return { key: 'home.hero.main', version: 2, body_md: '# Welcome' };
          return null;
        };
        return {
          first: firstFn,
          bind: (..._args: unknown[]) => ({
            first: firstFn,
            run: async () => {
              runCalls.push(sql);
              return { meta: { changes: 1 } };
            },
          }),
        };
      }),
    };

    const response = await cmsPublishPost({
      request: adminPostRequest('/api/admin/cms/publish', { key: 'home.hero.main', updated_by: 'admin-ui' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.version).toBe(3);
    expect(runCalls.some((s) => s.includes('UPDATE content_blocks'))).toBe(true);
    expect(runCalls.some((s) => s.includes('INSERT INTO content_revisions'))).toBe(true);
  });
});

// ─── Content API functions (page_content table) ──────────────────────────────

describe('content API: list endpoint', () => {
  it('rejects requests missing admin token', async () => {
    const response = await contentListGet({
      request: adminGetRequest('/api/admin/content/list', ''),
      env: { DB: makeContentDb() },
    });

    expect(response.status).toBe(401);
  });

  it('returns grouped live and draft sections for a slug', async () => {
    const rows = [
      { slug: '/', section: 'hero', status: 'live', content: 'Live hero', asset_url: null, updated_at: '2026-06-01T00:00:00Z' },
      { slug: '/', section: 'hero', status: 'draft', content: 'Draft hero', asset_url: null, updated_at: '2026-06-02T00:00:00Z' },
    ];

    const db = {
      prepare: vi.fn(() => ({
        bind: (..._args: unknown[]) => ({
          all: async () => ({ results: rows }),
        }),
      })),
    };

    const response = await contentListGet({
      request: adminGetRequest('/api/admin/content/list?slug=/'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.slugs).toContain('/');
    expect(body.grouped['/'].hero.live.content).toBe('Live hero');
    expect(body.grouped['/'].hero.draft.content).toBe('Draft hero');
  });
});

describe('content API: save endpoint', () => {
  it('rejects unauthenticated save requests', async () => {
    const response = await contentSavePost({
      request: adminPostRequest('/api/admin/content/save', {}, ''),
      env: { DB: makeContentDb() },
    });

    expect(response.status).toBe(401);
  });

  it('requires slug and section fields', async () => {
    const response = await contentSavePost({
      request: adminPostRequest('/api/admin/content/save', { slug: '', section: '' }),
      env: { DB: withAdminSession(makeContentDb()) },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it('upserts a draft row for the given slug and section', async () => {
    let upsertedContent: string | null = null;

    const db = {
      prepare: vi.fn(() => ({
        bind: (...args: unknown[]) => ({
          run: async () => {
            upsertedContent = args[2] as string | null;
            return { meta: { changes: 1 } };
          },
        }),
      })),
    };

    const response = await contentSavePost({
      request: adminPostRequest('/api/admin/content/save', {
        slug: '/',
        section: 'hero',
        content: 'New hero content',
        asset_url: null,
      }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(upsertedContent).toBe('New hero content');
  });
});

describe('content API: publish endpoint', () => {
  it('rejects unauthenticated publish requests', async () => {
    const response = await contentPublishPost({
      request: adminPostRequest('/api/admin/content/publish', {}, ''),
      env: { DB: makeContentDb() },
    });

    expect(response.status).toBe(401);
  });

  it('requires a slug field', async () => {
    const response = await contentPublishPost({
      request: adminPostRequest('/api/admin/content/publish', { slug: '' }),
      env: { DB: withAdminSession(makeContentDb()) },
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.ok).toBe(false);
  });

  it('returns 404 when no draft exists for the section', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: (..._args: unknown[]) => ({
          run: async () => ({ meta: { changes: 0 } }),
          first: async () => null,
        }),
      })),
    };

    const response = await contentPublishPost({
      request: adminPostRequest('/api/admin/content/publish', { slug: '/', section: 'hero' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error).toMatch(/No draft found/);
  });

  it('promotes draft to live for the given slug and section', async () => {
    const draftRow = { content: 'Published hero', asset_url: null };
    let promotedContent: string | null = null;

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (sql.includes("status='draft'")) return draftRow;
            return null;
          },
          run: async () => {
            if (sql.includes("VALUES (?, ?, 'live'")) {
              promotedContent = args[2] as string | null;
            }
            return { meta: { changes: 1 } };
          },
        }),
      })),
    };

    const response = await contentPublishPost({
      request: adminPostRequest('/api/admin/content/publish', { slug: '/', section: 'hero' }),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(promotedContent).toBe('Published hero');
  });
});
