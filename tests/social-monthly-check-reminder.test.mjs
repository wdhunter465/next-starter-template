import { describe, expect, it } from 'vitest';
import { reminderBody, reminderTitle } from '../scripts/ops/social-monthly-check-reminder.mjs';

describe('social monthly check reminder', () => {
  it('puts the month in the title so one Issue exists per month', () => {
    expect(reminderTitle(new Date('2026-12-01T14:00:00Z'))).toBe('Social posting monthly check (2026-12)');
    expect(reminderTitle(new Date('2026-12-01T14:00:00Z'))).not.toBe(reminderTitle(new Date('2027-01-01T14:00:00Z')));
  });

  it('lists the Zapier task count and the Meta token and sets no paid plan', () => {
    const body = reminderBody(new Date('2026-12-01T14:00:00Z'));
    expect(body).toContain('Zapier tasks');
    expect(body).toContain('Meta token');
    expect(body).toContain('100 tasks a month');
    expect(body).toContain('no paid plan is approved');
  });
});
