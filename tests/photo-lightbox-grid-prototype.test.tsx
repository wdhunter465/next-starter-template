import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import PhotoLightboxGrid, { photoDisplayText, type PhotoLightboxItem } from '@/components/fanclub/PhotoLightboxGrid';

const ITEMS: PhotoLightboxItem[] = [
  { id: 1, url: 'https://example.com/one-full.jpg', thumbnail_url: 'https://example.com/one-thumb.jpg', title: 'Gehrig at bat', description: null },
  { id: 2, url: 'https://example.com/two-full.jpg', thumbnail_url: 'https://example.com/two-thumb.jpg', title: null, description: 'Team photo, 1927' },
  { id: 3, url: 'https://example.com/three-full.jpg', thumbnail_url: 'https://example.com/three-thumb.jpg', title: null, description: null },
];

describe('photoDisplayText', () => {
  it('prefers title, then description, then a stable placeholder — matching the real gallery page', () => {
    expect(photoDisplayText(ITEMS[0])).toBe('Gehrig at bat');
    expect(photoDisplayText(ITEMS[1])).toBe('Team photo, 1927');
    expect(photoDisplayText(ITEMS[2])).toBe('Photo #3');
  });
});

describe('PhotoLightboxGrid', () => {
  it('renders one focusable thumbnail trigger per item and no lightbox dialog initially', () => {
    render(<PhotoLightboxGrid items={ITEMS} />);
    const grid = screen.getByTestId('photo-thumbnail-grid');
    expect(within(grid).getAllByRole('button')).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument();
  });

  it('opens the lightbox on the correct slide when a thumbnail is clicked', async () => {
    const user = userEvent.setup();
    render(<PhotoLightboxGrid items={ITEMS} />);

    await user.click(screen.getByRole('button', { name: 'Open Team photo, 1927' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument());
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByAltText('Team photo, 1927')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the thumbnail that opened it', async () => {
    const user = userEvent.setup();
    render(<PhotoLightboxGrid items={ITEMS} />);

    const trigger = screen.getByRole('button', { name: 'Open Gehrig at bat' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument());

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('closes via the Close button and returns focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<PhotoLightboxGrid items={ITEMS} />);

    const trigger = screen.getByRole('button', { name: 'Open Photo #3' });
    await user.click(trigger);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument());
    expect(document.activeElement).toBe(trigger);
  });

  it('navigates to the next slide with the Next control', async () => {
    const user = userEvent.setup();
    render(<PhotoLightboxGrid items={ITEMS} />);

    await user.click(screen.getByRole('button', { name: 'Open Gehrig at bat' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Gehrig at bat')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Team photo, 1927')).toBeInTheDocument());
  });

  it('navigates to the previous slide with the Previous control', async () => {
    const user = userEvent.setup();
    render(<PhotoLightboxGrid items={ITEMS} />);

    await user.click(screen.getByRole('button', { name: 'Open Team photo, 1927' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Team photo, 1927')).toBeInTheDocument());

    await user.click(screen.getByRole('button', { name: 'Previous' }));

    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Gehrig at bat')).toBeInTheDocument());
  });

  it('navigates slides with the ArrowRight and ArrowLeft keys', async () => {
    const user = userEvent.setup();
    render(<PhotoLightboxGrid items={ITEMS} />);

    await user.click(screen.getByRole('button', { name: 'Open Gehrig at bat' }));
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Gehrig at bat')).toBeInTheDocument());

    await user.keyboard('{ArrowRight}');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Team photo, 1927')).toBeInTheDocument());

    await user.keyboard('{ArrowLeft}');
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByAltText('Gehrig at bat')).toBeInTheDocument());
  });

  it('falls back to the full-resolution URL for thumbnails when no thumbnail_url is present', () => {
    const items: PhotoLightboxItem[] = [{ id: 9, url: 'https://example.com/full-only.jpg', title: 'Full only' }];
    render(<PhotoLightboxGrid items={items} />);
    expect(screen.getByAltText('Full only')).toHaveAttribute('src', 'https://example.com/full-only.jpg');
  });

  it('shows an unavailable placeholder when neither url nor thumbnail_url is present', () => {
    const items: PhotoLightboxItem[] = [{ id: 9, title: 'No media' }];
    render(<PhotoLightboxGrid items={items} />);
    expect(screen.getByText('Photo media unavailable')).toBeInTheDocument();
  });

  it('renders nothing to open when the item list is empty', () => {
    render(<PhotoLightboxGrid items={[]} />);
    const grid = screen.getByTestId('photo-thumbnail-grid');
    expect(within(grid).queryAllByRole('button')).toHaveLength(0);
  });
});
