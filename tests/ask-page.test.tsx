import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import AskPage from '@/app/ask/page';
import { apiGet, apiPost } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

const mockedApiGet = vi.mocked(apiGet);
const mockedApiPost = vi.mocked(apiPost);

async function fillValidForm() {
  await userEvent.type(screen.getByLabelText(/First name/i), 'Lou');
  await userEvent.type(screen.getByLabelText(/Last name/i), 'Gehrig');
  await userEvent.type(screen.getByLabelText(/^Email/i), 'fan@example.com');
  await userEvent.type(
    screen.getByLabelText(/Your question/i),
    'How do I join the fan club online?',
  );
}

describe('Ask page (consolidated FAQ & Ask)', () => {
  beforeEach(() => {
    mockedApiGet.mockReset();
    mockedApiPost.mockReset();
    mockedApiGet.mockResolvedValue({ ok: true, items: [] } as never);
    mockedApiPost.mockResolvedValue({ ok: true } as never);
  });

  it('disables submit until required fields are valid', () => {
    render(<AskPage />);
    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('posts full payload to POST /api/ask on submit', async () => {
    render(<AskPage />);
    await fillValidForm();

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith('/api/ask', {
        first_name: 'Lou',
        last_name: 'Gehrig',
        screen_name: undefined,
        email: 'fan@example.com',
        question: 'How do I join the fan club online?',
      });
    });

    expect(
      screen.getByText(/Your question has been submitted/i),
    ).toBeInTheDocument();
  });

  it('includes optional screen name when provided', async () => {
    render(<AskPage />);
    await fillValidForm();
    await userEvent.type(screen.getByLabelText(/Screen name/i), 'IronHorse');

    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(mockedApiPost).toHaveBeenCalledWith(
        '/api/ask',
        expect.objectContaining({ screen_name: 'IronHorse' }),
      );
    });
  });

  it('shows spec error message when submission fails', async () => {
    mockedApiPost.mockRejectedValue(new Error('api_error_500'));

    render(<AskPage />);
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText('Submission failed. Please try again.')).toBeInTheDocument();
    });
  });

  it('renders consolidated FAQ browse and contact mailto', async () => {
    render(<AskPage />);

    expect(screen.getByRole('heading', { name: /FAQ & Ask a Question/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Frequently Asked Questions/i })).toBeInTheDocument();
    expect(document.getElementById('ask-form')).not.toBeNull();
    expect(screen.getByRole('link', { name: /Contact us directly/i })).toHaveAttribute(
      'href',
      'mailto:Contact@LouGehrigFanClub.com?subject=Contact%20Needed%20ASK',
    );

    await waitFor(() => {
      expect(mockedApiGet).toHaveBeenCalledWith('/api/faq/list?limit=50');
    });
  });
});
