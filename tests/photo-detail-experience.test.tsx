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
