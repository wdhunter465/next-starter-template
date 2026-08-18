import { describe, expect, it, vi } from 'vitest';

import {
  askStatusesForFilter,
  isPublishedFaqStatus,
  normalizeFaqStatus,
  parsePinned,
  parsePositiveInt,
  parseStrictBoolean,
  validateFaqAnswer,
  validateFaqQuestion,
} from '../functions/_lib/faqModeration';

describe('faq moderation helpers', () => {
  it('parses strict boolean flags', () => {
    expect(parseStrictBoolean(true)).toBe(true);
    expect(parseStrictBoolean('false')).toBe(false);
    expect(parseStrictBoolean('falsey')).toBeNull();
  });

  it('parses positive integers fail-closed', () => {
    expect(parsePositiveInt(3)).toBe(3);
    expect(parsePositiveInt('4')).toBe(4);
    expect(parsePositiveInt(0)).toBeNull();
    expect(parsePositiveInt('abc')).toBeNull();
  });

  it('parses pinned values strictly', () => {
    expect(parsePinned(1)).toBe(1);
    expect(parsePinned(0)).toBe(0);
    expect(parsePinned(2)).toBeNull();
  });

  it('validates FAQ question and answer', () => {
    expect(validateFaqQuestion('  How do I join?  ')).toBeNull();
    expect(validateFaqQuestion('   ')).toMatch(/required/i);
    expect(validateFaqAnswer('Answer text', true)).toBeNull();
    expect(validateFaqAnswer('', true)).toMatch(/required/i);
    expect(validateFaqAnswer('', false)).toBeNull();
  });

  it('normalizes FAQ status values', () => {
    expect(normalizeFaqStatus('approved')).toBe('approved');
    expect(normalizeFaqStatus('PENDING')).toBe('pending');
    expect(normalizeFaqStatus('hidden')).toBeNull();
  });

  it('maps ask inbox filters to status sets', () => {
    expect(askStatusesForFilter('pending')).toEqual(['open', 'pending']);
    expect(askStatusesForFilter('approved')).toEqual(['approved']);
    expect(askStatusesForFilter('rejected')).toEqual(['rejected', 'hidden']);
    expect(askStatusesForFilter('archived')).toEqual(['archived']);
  });

  it('detects published FAQ status', () => {
    expect(isPublishedFaqStatus('approved')).toBe(true);
    expect(isPublishedFaqStatus('pending')).toBe(false);
  });
});

describe('admin auth fail-closed', () => {
  it('rejects missing or invalid admin token when no admin session is present', async () => {
    const { requireAdmin } = await import('../functions/_lib/auth');

    // No env.DB binding at all -- the session check short-circuits (requireD1
    // fails), so these exercise the static-token fallback path in isolation.
    const unconfigured = await requireAdmin(new Request('https://example.com'), { ADMIN_TOKEN: '' });
    expect(unconfigured?.status).toBe(503);

    const unauthorized = await requireAdmin(new Request('https://example.com'), { ADMIN_TOKEN: 'secret' });
    expect(unauthorized?.status).toBe(401);

    const ok = await requireAdmin(
      new Request('https://example.com', { headers: { 'x-admin-token': 'secret' } }),
      { ADMIN_TOKEN: 'secret' },
    );
    expect(ok).toBeNull();
  });

  it('accepts a signed-in admin member session with no token required', async () => {
    const { requireAdmin } = await import('../functions/_lib/auth');

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi
          .fn()
          .mockResolvedValue(
            sql.includes('member_sessions') ? { email: 'admin@example.com' } : { role: 'admin' },
          ),
        run: vi.fn().mockResolvedValue({}),
      })),
    };

    const request = new Request('https://example.com', {
      headers: { Cookie: 'lgfc_session=abc123' },
    });

    const result = await requireAdmin(request, { DB: db, ADMIN_TOKEN: '' });
    expect(result).toBeNull();
  });

  it('rejects a signed-in member session without the admin role, even with no token configured', async () => {
    const { requireAdmin } = await import('../functions/_lib/auth');

    const db = {
      prepare: vi.fn((sql: string) => ({
        bind: vi.fn().mockReturnThis(),
        first: vi
          .fn()
          .mockResolvedValue(
            sql.includes('member_sessions') ? { email: 'member@example.com' } : { role: 'member' },
          ),
        run: vi.fn().mockResolvedValue({}),
      })),
    };

    const request = new Request('https://example.com', {
      headers: { Cookie: 'lgfc_session=abc123' },
    });

    const result = await requireAdmin(request, { DB: db, ADMIN_TOKEN: '' });
    expect(result?.status).toBe(503);
  });
});
