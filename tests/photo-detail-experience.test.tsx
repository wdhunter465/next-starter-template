import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import PhotoDetailPanel, { photoDetailLabel } from '../src/components/fanclub/PhotoDetailPanel';
import { buildFanclubPhotoDetailHref } from '../src/lib/fanclubApi';

const items = [
  {
    id: 10,
    thumbnail_url: 'https://cdn.example/a.jpg',
    title: 'First',
    description: 'One',
    credit_line: 'Photo by A',
    tags: 'yankees',
  },
  {
    id: 11,
    thumbnail_url: 'https://cdn.example/b.jpg',
    title: 'Second',
    credit_line: 'Photo by B',
  },
] as const;

describe('#2900 photo detail experience', () => {
  it('builds stable deep-link hrefs', () => {
    expect(buildFanclubPhotoDetailHref(42)).toBe('/fanclub/photo?id=42');
    expect(photoDetailLabel(items[0])).toBe('First');
  });

  it('renders attribution and supports keyboard close/navigation', () => {
    const onClose = vi.fn();
    const onNavigate = vi.fn();
    render(
      <PhotoDetailPanel items={items} activeId={10} onClose={onClose} onNavigate={onNavigate} />,
    );

    expect(screen.getByTestId('photo-detail-panel')).toBeTruthy();
    expect(screen.getByText('Credit: Photo by A')).toBeTruthy();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNavigate).toHaveBeenCalledWith(11);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('restores focus to the opener, not an element inside the panel, after navigating and closing', () => {
    const opener = document.createElement('button');
    opener.textContent = 'Open photo';
    document.body.appendChild(opener);
    opener.focus();
    expect(document.activeElement).toBe(opener);

    const { rerender } = render(
      <PhotoDetailPanel items={items} activeId={null} onClose={() => undefined} onNavigate={() => undefined} />,
    );
    rerender(<PhotoDetailPanel items={items} activeId={10} onClose={() => undefined} onNavigate={() => undefined} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close photo detail' }));

    // Simulate prev/next navigation while the panel stays open - this used
    // to re-capture `document.activeElement` (by then the close button)
    // instead of preserving the original opener, so closing afterward would
    // restore focus to the close button rather than the opener.
    rerender(<PhotoDetailPanel items={items} activeId={11} onClose={() => undefined} onNavigate={() => undefined} />);

    rerender(<PhotoDetailPanel items={items} activeId={null} onClose={() => undefined} onNavigate={() => undefined} />);
    expect(document.activeElement).toBe(opener);

    opener.remove();
  });

  it('shows loading while waiting and unavailable only when flagged', () => {
    const { rerender } = render(
      <PhotoDetailPanel items={items} activeId={999} unavailable={false} onClose={() => undefined} onNavigate={() => undefined} />,
    );
    expect(screen.getByTestId('photo-detail-loading')).toBeTruthy();

    rerender(
      <PhotoDetailPanel items={items} activeId={999} unavailable onClose={() => undefined} onNavigate={() => undefined} />,
    );
    expect(screen.getByTestId('photo-detail-unavailable').textContent).toMatch(/unavailable/i);
  });
});
