import { describe, expect, it } from 'vitest';
import { SOCIAL_LIMITS } from '../functions/_lib/social-post-formatter';
import { listDays, planEditions, type PoolItem } from '../functions/_lib/social-edition-planner';

function makePool(count: number, overrides: Partial<PoolItem> = {}): PoolItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `item-${String(i + 1).padStart(3, '0')}`,
    title: `Gehrig story ${i + 1}`,
    caption: `Caption for story ${i + 1}. `.repeat(3).trim(),
    post_url: `https://lougehrigfanclub.com/archive/${i + 1}`,
    image_url: `https://media.example/${i + 1}.jpg`,
    image_alt: `Photo ${i + 1}`,
    usage_count: 0,
    last_featured: null,
    ...overrides,
  }));
}

const WINDOW = { startDate: '2027-01-01', endDate: '2027-03-31' };
const FUNDRAISER = { text: 'Join the 2027 fundraiser.', from: '2027-02-01', to: '2027-03-31' };

describe('social-edition-planner (#5039)', () => {
  it('covers 2027-01-01 to 2027-03-31 on both calendars', () => {
    expect(listDays(WINDOW.startDate, WINDOW.endDate)).toHaveLength(90);
    const plan = planEditions({ ...WINDOW, pool: makePool(200) });
    expect(plan.website).toHaveLength(90);
    expect(plan.social).toHaveLength(90);
  });

  it('is deterministic for the same input', () => {
    const input = { ...WINDOW, pool: makePool(120), fundraiserMessage: FUNDRAISER };
    expect(planEditions(input)).toEqual(planEditions(input));
  });

  it('uses no item twice on a surface while unused items remain', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(200) });
    const website = plan.website.map((d) => d.item_id);
    const social = plan.social.filter((d) => d.active).map((d) => d.item_id);
    expect(new Set(website).size).toBe(website.length);
    expect(new Set(social).size).toBe(social.length);
    expect(plan.summary.shortfalls).toEqual([]);
  });

  it('never puts the same item on the website and on social on the same day', () => {
    for (const size of [2, 3, 4, 7, 40, 200]) {
      const plan = planEditions({ ...WINDOW, pool: makePool(size) });
      plan.social.forEach((day, i) => {
        if (day.active) expect(day.item_id).not.toBe(plan.website[i].item_id);
      });
    }
  });

  it('reports a dated shortfall when the pool is smaller than the window, and spaces repeats evenly', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(30) });
    const website = plan.summary.shortfalls.filter((s) => s.surface === 'website');
    expect(website[0]).toEqual({ date: '2027-01-31', surface: 'website', reason: 'pool_exhausted' });
    expect(website).toHaveLength(60);
    // A repeat is a full pool length after the item's first day, never the next day.
    expect(plan.website[30].item_id).toBe(plan.website[0].item_id);
    expect(plan.website[1].item_id).not.toBe(plan.website[0].item_id);
  });

  it('does not report a shortfall when the pool covers every active social day', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(90) });
    expect(plan.summary.shortfalls.filter((s) => s.surface === 'social')).toEqual([]);
  });

  it('keeps tasks inside the monthly budget and reports the deferred days', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(200), monthlyTaskBudget: 90 });
    for (const tasks of Object.values(plan.summary.tasks_by_month)) expect(tasks).toBeLessThanOrEqual(90);
    // Four Zapier platforms cost 4 tasks, so 22 editions fit 90: Jan has 31 days, 9 are deferred.
    expect(plan.summary.social_days_by_month['2027-01']).toBe(22);
    const january = plan.social.filter((d) => d.date.startsWith('2027-01') && d.reason === 'budget');
    expect(january).toHaveLength(9);
    expect(plan.summary.budget_deferred_days).toContain(january[0].date);
  });

  it('plans a daily edition when the budget allows', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(200), monthlyTaskBudget: 400 });
    expect(plan.social.every((d) => d.active)).toBe(true);
  });

  it('counts no task for the Facebook Group, which a person shares', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(100) });
    const day = plan.social.find((d) => d.active)!;
    expect(day.platforms.facebook_group).toMatchObject({ manual: true });
    expect(day.tasks).toBe(4);
  });

  it('appends the fundraiser message only inside its dates and keeps every platform within its limit', () => {
    const longCaption = 'A long caption about the Iron Horse. '.repeat(60);
    const pool = makePool(120, { caption: longCaption });
    const plan = planEditions({ ...WINDOW, pool, monthlyTaskBudget: 400, fundraiserMessage: FUNDRAISER });
    const before = plan.social.find((d) => d.date === '2027-01-31')!;
    const inside = plan.social.find((d) => d.date === '2027-02-01')!;
    expect(before.platforms.facebook_page!.text).not.toContain(FUNDRAISER.text);
    for (const platform of ['facebook_page', 'facebook_group', 'instagram', 'pinterest'] as const) {
      expect(inside.platforms[platform]!.text.endsWith(FUNDRAISER.text)).toBe(true);
    }
    expect(inside.platforms.instagram!.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.instagramCaption);
    expect(inside.platforms.pinterest!.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.pinterestDescription);
    for (const day of plan.social) {
      if (!day.active) continue;
      expect(day.platforms.x!.text.length).toBeLessThanOrEqual(SOCIAL_LIMITS.xText);
    }
  });

  it('skips Instagram and Pinterest, and costs no task for them, when an item has no picture', () => {
    const plan = planEditions({ ...WINDOW, pool: makePool(100, { image_url: null, image_alt: null }), monthlyTaskBudget: 400 });
    const day = plan.social.find((d) => d.active)!;
    expect(day.platforms.instagram).toMatchObject({ skip: true, skip_reason: 'no_image' });
    expect(day.platforms.pinterest).toMatchObject({ skip: true, skip_reason: 'no_image' });
    expect(day.platforms.x).toMatchObject({ skip: false });
    expect(day.tasks).toBe(2);
  });

  it('skips a platform whose picture shape is not met and drops the picture on X', () => {
    const imageFit = (_item: PoolItem, platform: string) => platform !== 'instagram' && platform !== 'x';
    const plan = planEditions({ ...WINDOW, pool: makePool(100), monthlyTaskBudget: 400, imageFit });
    const day = plan.social.find((d) => d.active)!;
    expect(day.platforms.instagram).toMatchObject({ skip: true, skip_reason: 'picture_shape' });
    expect(day.platforms.x).toMatchObject({ skip: false, image_url: null });
    expect(day.platforms.facebook_page!.image_url).not.toBeNull();
  });

  it('reports an empty pool as a shortfall on every day', () => {
    const plan = planEditions({ ...WINDOW, pool: [] });
    expect(plan.website.every((d) => d.item_id === null)).toBe(true);
    expect(plan.summary.shortfalls.filter((s) => s.reason === 'empty_pool')).toHaveLength(180);
  });

  it('prefers the least used and least recently featured items first', () => {
    const pool = [
      ...makePool(3),
    ].map((item, i) => ({ ...item, usage_count: [5, 0, 0][i], last_featured: [null, '2026-12-01', null][i] }));
    const plan = planEditions({ ...WINDOW, pool });
    expect(plan.website.slice(0, 3).map((d) => d.item_id)).toEqual(['item-003', 'item-002', 'item-001']);
  });

  it('rejects a malformed or reversed window', () => {
    expect(() => planEditions({ pool: [], startDate: '2027-1-1', endDate: '2027-03-31' })).toThrow();
    expect(() => planEditions({ pool: [], startDate: '2027-03-31', endDate: '2027-01-01' })).toThrow();
  });
});
