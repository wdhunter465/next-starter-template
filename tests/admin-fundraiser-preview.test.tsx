import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FundraiserPreviewPage from '@/app/admin/fundraiser-preview/page';
import {
  CAMPAIGN_SPOTLIGHT_KEY,
  CAMPAIGN_SPOTLIGHT_PAGE,
  defaultCampaignSpotlightConfig,
  serializeCampaignSpotlightConfig,
} from '@/lib/campaignSpotlight';
import { onRequestGet as cmsListGet } from '../functions/api/admin/cms/list';
import { onRequestPost as cmsSavePost } from '../functions/api/admin/cms/save';
import { onRequestPost as cmsPublishPost } from '../functions/api/admin/cms/publish';
import { ADMIN_SESSION_COOKIE, withAdminSession } from './helpers/adminSession';

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/admin/fundraiser-preview'));

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

function adminPostRequest(path: string, body: unknown = {}, cookie: string | null = ADMIN_SESSION_COOKIE): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers.Cookie = cookie;
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function validCampaignBody() {
  return serializeCampaignSpotlightConfig({
    ...defaultCampaignSpotlightConfig,
    enabled: false,
    title: 'ALS Fundraiser 2026',
    description: 'Validate before publish.',
    note: 'Admin-only preview lane.',
  });
}

describe('admin fundraiser preview page', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUsePathname.mockReturnValue('/admin/fundraiser-preview');
  });

  it('renders admin navigation and fundraiser validation state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        blocks: [
          {
            key: CAMPAIGN_SPOTLIGHT_KEY,
            body_md: validCampaignBody(),
            published_body_md: null,
            version: 1,
            status: 'draft',
            updated_at: '2026-06-03T12:00:00Z',
            published_at: null,
            updated_by: 'admin-fundraiser-preview',
          },
        ],
      }),
    );

    render(<FundraiserPreviewPage />);

    expect(screen.getByRole('link', { name: 'Fundraiser Preview' })).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Fundraiser source is valid/i)).toBeInTheDocument();
    });
  });

  it('announces CMS list errors via AdminStatusText alert', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      if (String(input).startsWith('/api/admin/cms/list')) {
        return Promise.resolve(jsonResponse({ ok: false, error: 'Database unavailable' }, 503));
      }
      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    render(<FundraiserPreviewPage />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error: Database unavailable');
    });
  });

  it('loads campaign spotlight CMS data on mount', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      expect(String(input)).toBe(`/api/admin/cms/list?page=${encodeURIComponent(CAMPAIGN_SPOTLIGHT_PAGE)}`);

      return Promise.resolve(
        jsonResponse({
          ok: true,
          blocks: [
            {
              key: CAMPAIGN_SPOTLIGHT_KEY,
              body_md: validCampaignBody(),
              published_body_md: null,
              version: 2,
              status: 'draft',
              updated_at: '2026-06-03T12:00:00Z',
              published_at: null,
              updated_by: 'admin-fundraiser-preview',
            },
          ],
        }),
      );
    });

    render(<FundraiserPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Campaign spotlight block loaded.')).toBeInTheDocument();
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('blocks publish when draft has not been saved', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const path = String(input);

      if (path.startsWith('/api/admin/cms/list')) {
        return Promise.resolve(
          jsonResponse({
            ok: true,
            blocks: [
              {
                key: CAMPAIGN_SPOTLIGHT_KEY,
                body_md: validCampaignBody(),
                published_body_md: null,
                version: 1,
                status: 'draft',
                updated_at: '2026-06-03T12:00:00Z',
                published_at: null,
                updated_by: 'admin-fundraiser-preview',
              },
            ],
          }),
        );
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<FundraiserPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText('Campaign spotlight block loaded.')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Changed Without Save' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));

    await waitFor(() => {
      expect(
        screen.getByText('Publish blocked. Save Draft first so the published version matches the current preview.'),
      ).toBeInTheDocument();
    });
  });

  it('shows campaign validation errors when enabled without leaderboard data', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        blocks: [],
      }),
    );

    render(<FundraiserPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/No campaign spotlight block exists yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Enabled for homepage rendering after publish'));

    await waitFor(() => {
      expect(screen.getByText(/Campaign validation errors/i)).toBeInTheDocument();
    });
  });

  it('sends save draft request to admin CMS save API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      const path = String(input);

      if (path.startsWith('/api/admin/cms/list')) {
        return Promise.resolve(jsonResponse({ ok: true, blocks: [] }));
      }

      if (path === '/api/admin/cms/save') {
        expect(init?.method).toBe('POST');
        return Promise.resolve(jsonResponse({ ok: true, version: 3 }));
      }

      return Promise.reject(new Error(`Unexpected fetch: ${path}`));
    });

    render(<FundraiserPreviewPage />);

    await waitFor(() => {
      expect(screen.getByText(/No campaign spotlight block exists yet/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => {
      expect(screen.getByText('Draft saved. Version 3.')).toBeInTheDocument();
    });

    expect(fetchMock.mock.calls.some(([path]) => path === '/api/admin/cms/save')).toBe(true);
  });
});

describe('fundraiser admin CMS APIs', () => {
  it('rejects unauthenticated CMS list requests', async () => {
    const response = await cmsListGet({
      request: adminGetRequest('/api/admin/cms/list?page=home', null),
      env: { DB: { prepare: vi.fn() } },
    });

    expect(response.status).toBe(401);
  });

  it('returns campaign blocks for fundraiser preview list requests', async () => {
    const db = {
      prepare: vi.fn(() => ({
        bind: () => ({
          all: async () => ({
            results: [
              {
                key: CAMPAIGN_SPOTLIGHT_KEY,
                page: 'home',
                section: 'campaign-spotlight',
                title: 'Homepage Campaign Spotlight',
                body_md: validCampaignBody(),
                status: 'draft',
                published_body_md: null,
                version: 1,
                updated_at: '2026-06-03T12:00:00Z',
                published_at: null,
                updated_by: 'admin-fundraiser-preview',
              },
            ],
          }),
        }),
      })),
    };

    const response = await cmsListGet({
      request: adminGetRequest('/api/admin/cms/list?page=home'),
      env: { DB: withAdminSession(db) },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      blocks: [{ key: CAMPAIGN_SPOTLIGHT_KEY }],
    });
  });

  it('rejects CMS save without an admin session', async () => {
    const response = await cmsSavePost({
      request: adminPostRequest('/api/admin/cms/save', { key: CAMPAIGN_SPOTLIGHT_KEY }, null),
      env: { DB: { prepare: vi.fn() } },
    });

    expect(response.status).toBe(401);
  });

  it('rejects CMS publish without an admin session', async () => {
    const response = await cmsPublishPost({
      request: adminPostRequest('/api/admin/cms/publish', { key: CAMPAIGN_SPOTLIGHT_KEY }, null),
      env: { DB: { prepare: vi.fn() } },
    });

    expect(response.status).toBe(401);
  });
});
