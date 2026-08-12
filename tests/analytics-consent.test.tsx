import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/components/GoogleAnalytics', () => ({
  default: function MockGoogleAnalytics() {
    return <div data-testid="google-analytics-mock" />;
  },
}));

import AnalyticsConsent from '@/components/AnalyticsConsent';

const STORAGE_KEY = 'lgfc_analytics_consent';

describe('AnalyticsConsent', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEY);
  });

  it('shows banner by default and does not load GA until Accept', async () => {
    render(<AnalyticsConsent />);

    expect(await screen.findByRole('dialog', { name: 'Analytics preference' })).toBeInTheDocument();
    expect(screen.queryByTestId('google-analytics-mock')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }));

    await waitFor(() => {
      expect(screen.getByTestId('google-analytics-mock')).toBeInTheDocument();
    });
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('granted');
    expect(screen.queryByRole('dialog', { name: 'Analytics preference' })).not.toBeInTheDocument();
  });

  it('Decline persists denied and never loads GA', async () => {
    render(<AnalyticsConsent />);

    fireEvent.click(await screen.findByRole('button', { name: 'Decline' }));

    await waitFor(() => {
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe('denied');
    });
    expect(screen.queryByTestId('google-analytics-mock')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Analytics preference' })).not.toBeInTheDocument();
  });

  it('honors a previously granted preference without showing the banner', async () => {
    window.localStorage.setItem(STORAGE_KEY, 'granted');

    render(<AnalyticsConsent />);

    await waitFor(() => {
      expect(screen.getByTestId('google-analytics-mock')).toBeInTheDocument();
    });
    expect(screen.queryByRole('dialog', { name: 'Analytics preference' })).not.toBeInTheDocument();
  });
});
