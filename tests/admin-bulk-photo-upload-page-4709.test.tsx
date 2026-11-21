/** @vitest-environment jsdom */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  usePathname: () => '/admin/bulk-photo-upload',
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

import AdminBulkPhotoUploadPage from '../src/app/admin/bulk-photo-upload/page';
import AdminNav from '../src/components/admin/AdminNav';

describe('admin bulk photo upload page (#4709 slice 2)', () => {
  it('renders admin shell title and rights-hold notice', () => {
    render(<AdminBulkPhotoUploadPage />);
    expect(screen.getByRole('heading', { name: /Bulk Photo Upload/i })).toBeTruthy();
    expect(screen.getAllByText(/unpublished/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/rights hold/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/LGFC-owned/i)).toBeTruthy();
    expect(screen.getByText(/Drop JPEG, PNG, or WebP/i)).toBeTruthy();
  });

  it('AdminNav includes Bulk Photo Upload entry', () => {
    render(<AdminNav />);
    const link = screen.getByRole('link', { name: 'Bulk Photo Upload' });
    expect(link.getAttribute('href')).toBe('/admin/bulk-photo-upload');
  });
});
