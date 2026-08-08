'use client';

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import FaqBrowse from '@/components/FaqBrowse';
import { apiGet, apiPost } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

const mockedApiGet = vi.mocked(apiGet);
const mockedApiPost = vi.mocked(apiPost);

const SAMPLE_ITEMS = [
  {
    id: 1,
    question: 'How do I join?',
    answer: 'Visit the Join page.',
    view_count: 2,
    pinned: 1,
    updated_at: '2026-05-01T00:00:00Z',
  },
  {
    id: 2,
    question: 'Where are events posted?',
    answer: 'Check the Events page.',
    view_count: 5,
    pinned: 0,
    updated_at: '2026-05-02T00:00:00Z',
  },
];

describe('FaqBrowse (canonical /ask FAQ surface)', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
    mockedApiPost.mockReset();
    mockedApiPost.mockResolvedValue({ ok: true } as never);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads approved FAQ entries from the API', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: SAMPLE_ITEMS } as never);

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
    });

    expect(mockedApiGet).toHaveBeenCalledWith('/api/faq/list?limit=50');
    expect(screen.getByText(/Where are events posted\?/)).toBeInTheDocument();
  });

  it('filters loaded entries with client-side search', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: SAMPLE_ITEMS } as never);

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
    });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search questions' }), 'events');

    expect(screen.queryByText(/How do I join\?/)).not.toBeInTheDocument();
    expect(screen.getByText(/Where are events posted\?/)).toBeInTheDocument();
  });

  it('shows pinned entries before unpinned entries', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: SAMPLE_ITEMS } as never);

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
    });

    const questions = screen.getAllByText(/How do I join\?|Where are events posted\?/);
    expect(questions[0]).toHaveTextContent(/How do I join\?/);
  });

  it('orders unpinned entries by updated_at descending', async () => {
    mockedApiGet.mockResolvedValue({
      ok: true,
      items: [
        {
          id: 1,
          question: 'Older entry',
          answer: 'Older answer.',
          view_count: 100,
          pinned: 0,
          updated_at: '2026-05-01T00:00:00Z',
        },
        {
          id: 2,
          question: 'Newer entry',
          answer: 'Newer answer.',
          view_count: 1,
          pinned: 0,
          updated_at: '2026-05-10T00:00:00Z',
        },
      ],
    } as never);

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/Newer entry/)).toBeInTheDocument();
    });

    const questions = screen.getAllByText(/Older entry|Newer entry/);
    expect(questions[0]).toHaveTextContent(/Newer entry/);
  });

  it('allows multiple FAQ entries to stay expanded at once', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: SAMPLE_ITEMS } as never);

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/How do I join\?/));
    await userEvent.click(screen.getByText(/Where are events posted\?/));

    expect(screen.getByText('Visit the Join page.')).toBeInTheDocument();
    expect(screen.getByText('Check the Events page.')).toBeInTheDocument();
  });

  it('increments view count and posts to the view API when an entry expands', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: SAMPLE_ITEMS } as never);

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText(/How do I join\?/));

    expect(screen.getByText('Views: 3')).toBeInTheDocument();
    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/api/faq/view', { id: 1 });
    });
  });

  it('shows a fail-closed empty search state with Ask link', async () => {
    mockedApiGet.mockResolvedValue({ ok: true, items: SAMPLE_ITEMS } as never);

    render(<FaqBrowse askFormHref="#ask-form" />);

    await waitFor(() => {
      expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
    });

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search questions' }), 'zzzz');

    expect(screen.getByText(/No questions match your search/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask a Question' })).toHaveAttribute('href', '#ask-form');
  });

  it('shows an error message when FAQ loading fails', async () => {
    mockedApiGet.mockRejectedValue(new Error('api_error_500'));

    render(<FaqBrowse />);

    await waitFor(() => {
      expect(screen.getByText(/Unable to load FAQ entries right now/i)).toBeInTheDocument();
    });
  });

  it('clears timeout error when a delayed FAQ fetch eventually succeeds', async () => {
    vi.useFakeTimers();

    let resolveFaq: (value: { ok: boolean; items: typeof SAMPLE_ITEMS }) => void = () => {};
    mockedApiGet.mockReturnValue(
      new Promise((resolve) => {
        resolveFaq = resolve;
      }) as never,
    );

    render(<FaqBrowse />);

    await act(async () => {
      vi.advanceTimersByTime(10000);
    });

    expect(screen.getByText(/Unable to load FAQ entries right now/i)).toBeInTheDocument();

    await act(async () => {
      resolveFaq({ ok: true, items: SAMPLE_ITEMS });
      await Promise.resolve();
    });

    expect(screen.queryByText(/Unable to load FAQ entries right now/i)).not.toBeInTheDocument();
    expect(screen.getByText(/How do I join\?/)).toBeInTheDocument();
  });
});
