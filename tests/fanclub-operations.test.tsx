import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FanclubChatPage from '@/app/fanclub/chat/page';
import FanclubPhotoGalleryPage from '@/app/fanclub/photo/page';
import FanclubSubmitPage from '@/app/fanclub/submit/page';
import LibraryPage from '@/app/fanclub/library/page';
import MemorabiliaPage from '@/app/fanclub/memorabilia/page';
import ClubHomeSubmissionCta from '@/components/fanclub/ClubHomeSubmissionCta';
import RecentDiscussionsTeaser from '@/components/RecentDiscussionsTeaser';
import { onRequestGet as listDiscussions } from '../functions/api/discussions/list';
import { onRequestGet as listLibrary } from '../functions/api/library/list';
import { onRequestPost as submitLibrary } from '../functions/api/library/submit';

const mockUseMemberSession = vi.hoisted(() => vi.fn());
const mockApiGet = vi.hoisted(() => vi.fn());

vi.mock('@/hooks/useMemberSession', () => ({
  useMemberSession: mockUseMemberSession,
}));

vi.mock('@/lib/api', () => ({
  apiGet: mockApiGet,
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockReplace = vi.hoisted(() => vi.fn());
const mockSearchParams = vi.hoisted(() => ({
  get: vi.fn<(key: string) => string | null>(() => null),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function resolveFetchUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (typeof input === 'object' && input !== null && 'url' in input) {
    return (input as Request).url;
  }
  return String(input);
}

function createRequest(path: string, cookie?: string): Request {
  return new Request(`https://www.lougehrigfanclub.com${path}`, {
    headers: cookie ? { Cookie: cookie } : undefined,
  });
}

function createMemberDb(options?: {
  email?: string;
  discussions?: Array<Record<string, unknown>>;
  library?: Array<Record<string, unknown>>;
}) {
  const email = options?.email ?? 'member@example.com';

  return {
    prepare: vi.fn((sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          if (sql.includes('FROM member_sessions')) return { email };
          return null;
        },
        run: async () => ({}),
        all: async () => {
          if (sql.includes('FROM discussions')) return { results: options?.discussions ?? [] };
          if (sql.includes('FROM library_entries')) return { results: options?.library ?? [] };
          return { results: [] };
        },
      }),
    })),
  };
}

describe('Fan Club member-only APIs', () => {
  it('rejects unauthenticated discussion reads', async () => {
    const response = await listDiscussions({
      env: { DB: createMemberDb() },
      request: createRequest('/api/discussions/list?limit=5'),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Not authenticated',
    });
  });

  it('returns discussions only for an authenticated member session', async () => {
    const response = await listDiscussions({
      env: {
        DB: createMemberDb({
          discussions: [{ id: 1, title: 'Club note', body: 'Member-only post', created_at: '2026-06-01T00:00:00Z' }],
        }),
      },
      request: createRequest('/api/discussions/list?limit=5', 'lgfc_session=session-1'),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      items: [{ title: 'Club note' }],
    });
  });

  it('rejects unauthenticated legacy library reads', async () => {
    const response = await listLibrary({
      env: { DB: createMemberDb() },
      request: createRequest('/api/library/list?limit=5'),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Not authenticated',
    });
  });

  it('rejects unauthenticated library submissions', async () => {
    const response = await submitLibrary({
      env: { DB: createMemberDb() },
      request: new Request('https://www.lougehrigfanclub.com/api/library/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Member',
          title: 'Story title',
          content: 'A long enough submission body for review.',
        }),
      }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Not authenticated',
    });
  });
});

describe('Fan Club operational pages', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockSearchParams.get.mockReturnValue(null);
    mockReplace.mockReset();
    mockUseMemberSession.mockReturnValue({
      isLoading: false,
      isAuthenticated: true,
      email: 'member@example.com',
      role: 'member',
    });
  });

  it('renders member photos from thumbnail_url values returned by the Fan Club API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveFetchUrl(input);
      if (url.includes('/api/fanclub/photos/tags')) {
        return jsonResponse({ ok: true, tags: ['history'] }) as never;
      }
      return jsonResponse({
        ok: true,
        items: [
          {
            id: 7,
            thumbnail_url: 'https://cdn.example.com/lgfc/photos/farewell.jpg',
            title: 'Farewell address',
            tags: 'lou,history',
            uploaded_by: 'archive',
          },
        ],
      }) as never;
    });

    render(<FanclubPhotoGalleryPage />);

    const image = await screen.findByRole('img', { name: 'Farewell address' });
    expect(image).toHaveAttribute('src', 'https://cdn.example.com/lgfc/photos/farewell.jpg');
    expect(fetchMock).toHaveBeenCalledWith('/api/fanclub/photos', { credentials: 'include', cache: 'no-store' });
    expect(screen.getByRole('link', { name: /Submit a Photo/ })).toHaveAttribute('href', '/fanclub/submit');
    expect(screen.getByRole('button', { name: 'history' })).toBeInTheDocument();
  });

  it('shows an empty-state message when the photo gallery has no items', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveFetchUrl(input);
      if (url.includes('/api/fanclub/photos/tags')) {
        return jsonResponse({ ok: true, tags: [] }) as never;
      }
      return jsonResponse({ ok: true, items: [] }) as never;
    });

    render(<FanclubPhotoGalleryPage />);

    expect(await screen.findByText(/no photos match your search/i)).toBeInTheDocument();
  });

  it('shows a load error when the photo gallery API fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveFetchUrl(input);
      if (url.includes('/api/fanclub/photos/tags')) {
        return jsonResponse({ ok: true, tags: [] }) as never;
      }
      return jsonResponse({ ok: false, error: 'list_failed' }, 500) as never;
    });

    render(<FanclubPhotoGalleryPage />);

    expect(await screen.findByText(/unable to load member photos right now/i)).toBeInTheDocument();
  });

  it('loads library entries through the member-gated Fan Club library API', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({
        ok: true,
        items: [
          {
            id: 3,
            title: 'Luckiest Man',
            author: 'Lou Gehrig',
            year: 1939,
            content: 'Today I consider myself the luckiest man on the face of the earth.',
          },
        ],
      }) as never,
    );

    render(<LibraryPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Luckiest Man' })).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/fanclub/library?page=1', { credentials: 'include', cache: 'no-store' });
    expect(screen.getByRole('heading', { level: 1, name: 'Gehrig Library' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Submit an Article' })).toHaveAttribute('href', '/fanclub/submit');
    expect(screen.getByText(/published editorial inventory stories/i)).toBeInTheDocument();
    expect(screen.getByText(/source and credit attribution/i)).toBeInTheDocument();
    expect(screen.getByText(/Credit: Lou Gehrig/)).toBeInTheDocument();
  });

  it('exposes the approved member submission path from Club Home CTA without changing header navigation', () => {
    render(<ClubHomeSubmissionCta />);

    expect(screen.getByRole('link', { name: 'Submit a story or note' })).toHaveAttribute('href', '/fanclub/submit');
  });

  it('submits library articles with the member session cookie and surfaces API errors', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse({ ok: false, error: 'Not authenticated' }, 401) as never,
    );

    render(<FanclubSubmitPage />);

    fireEvent.change(screen.getByPlaceholderText('Your name'), { target: { value: 'Casey Member' } });
    fireEvent.change(screen.getByPlaceholderText('Article title'), { target: { value: 'Club memory' } });
    fireEvent.change(screen.getByPlaceholderText('Paste your article text here…'), {
      target: { value: 'This is a long enough member submission for review.' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Ownership:/), { target: { value: 'I wrote this myself.' } });
    fireEvent.change(screen.getByPlaceholderText(/Permission:/), {
      target: { value: 'LGFC may use this submission.' },
    });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'public_credit' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText(/error: not authenticated/i)).toBeInTheDocument();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/library/submit',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('renders chat empty and error states for member workflows', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ ok: true, items: [] }) as never);

    render(<FanclubChatPage />);

    expect(await screen.findByText('No posts yet.')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/discussions/list?limit=20', {
      credentials: 'include',
      cache: 'no-store',
    });

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: 'list_failed' }, 500) as never);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(await screen.findByText(/error: list_failed/i)).toBeInTheDocument();
  });

  it('surfaces chat post failures instead of failing silently', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse({ ok: true, items: [] }) as never)
      .mockResolvedValueOnce(jsonResponse({ ok: false, error: 'create_failed' }, 500) as never);

    render(<FanclubChatPage />);
    await screen.findByText('No posts yet.');

    fireEvent.change(screen.getByPlaceholderText('Title'), { target: { value: 'Hello club' } });
    fireEvent.change(screen.getByPlaceholderText('Write your message…'), { target: { value: 'Checking in today' } });
    fireEvent.click(screen.getByRole('button', { name: 'Post' }));

    expect(await screen.findByText(/error: create_failed/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith(
      '/api/discussions/create',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    );
  });

  it('shows memorabilia empty state when the archive returns no items', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveFetchUrl(input);
      if (url.includes('/api/fanclub/memorabilia/tags')) {
        return jsonResponse({ ok: true, tags: [] }) as never;
      }
      return jsonResponse({ ok: true, items: [], related_library_entries: [] }) as never;
    });

    render(<MemorabiliaPage />);

    expect(await screen.findByRole('heading', { level: 1, name: 'Memorabilia Archive' })).toBeInTheDocument();
    expect(await screen.findByText(/no memorabilia items found/i)).toBeInTheDocument();
  });

  it('passes library search queries to the member-gated Fan Club library API', async () => {
    mockSearchParams.get.mockImplementation((key: string) => (key === 'q' ? 'luckiest' : null));
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: true, items: [] }) as never);

    render(<LibraryPage />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/fanclub/library?page=1&q=luckiest', {
        credentials: 'include',
        cache: 'no-store',
      });
    });
  });

  it('renders related library stories returned by the memorabilia API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = resolveFetchUrl(input);
      if (url.includes('/api/fanclub/memorabilia/tags')) {
        return jsonResponse({ ok: true, tags: ['signed'] }) as never;
      }
      return jsonResponse({
        ok: true,
        items: [{ id: 1, title: 'Signed bat', thumbnail_url: null }],
        related_library_entries: [{ id: 9, title: 'Yankee Stadium farewell', author: 'Club archive', summary: 'Context for the item.' }],
      }) as never;
    });

    render(<MemorabiliaPage />);

    expect(await screen.findByRole('button', { name: 'signed' })).toBeInTheDocument();

    expect(await screen.findByText('Related stories')).toBeInTheDocument();
    expect(screen.getByText('Yankee Stadium farewell')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Gehrig Library' })).toHaveAttribute('href', '/fanclub/library');
  });
});

describe('Homepage discussion teaser privacy', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockApiGet.mockReset();
  });

  it('does not call the member-only discussions API for logged-out homepage visitors', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse({ ok: false }, 401) as never);

    render(<RecentDiscussionsTeaser />);

    await waitFor(() => {
      expect(screen.getByText(/member discussions are private/i)).toBeInTheDocument();
    });
    expect(mockApiGet).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Join or log in' })).toHaveAttribute('href', '/join');
  });
});
