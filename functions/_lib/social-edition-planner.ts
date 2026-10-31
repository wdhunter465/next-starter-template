// #5039 (slice 2 of #5037) -- places one content pool on a website calendar and a social
// calendar so the same item reaches each surface on a different day and each surface is varied
// every day. Pure: it reads what it is given and writes nothing. Staging tables, the actions
// that call it and the feeds a Zap reads are later slices.
//
// Text limits come from social-post-formatter.ts. Picture shapes are supplied by the caller
// (imageFit). A picture that cannot meet a platform's shape is skipped or dropped for that
// platform, never stretched.

import { formatSocialPosts, SOCIAL_LIMITS, truncateText, type SocialPostInput } from './social-post-formatter';

export type PlatformKey = 'facebook_page' | 'facebook_group' | 'instagram' | 'x' | 'pinterest';

export const ALL_PLATFORMS: PlatformKey[] = ['facebook_page', 'facebook_group', 'instagram', 'x', 'pinterest'];

// Zapier cannot post to a Facebook Group (its Groups app was removed in 2024), so the Group is a
// manual share and costs no task by default.
export const DEFAULT_ZAPIER_PLATFORMS: PlatformKey[] = ['facebook_page', 'instagram', 'x', 'pinterest'];

export type PoolItem = SocialPostInput & {
  id: string | number;
  usage_count?: number | null;
  last_featured?: string | null;
};

export type SkipReason = 'no_image' | 'picture_shape' | null;

export type PlannedVariant = {
  text: string;
  link: string | null;
  image_url: string | null;
  image_alt: string | null;
  skip: boolean;
  skip_reason: SkipReason;
  /** True when Zapier cannot post this platform and a person shares it. */
  manual: boolean;
};

export type WebsiteDay = { date: string; item_id: string | number | null };

export type SocialDay = {
  date: string;
  item_id: string | number | null;
  /** False when the monthly task budget leaves this day without a social edition. */
  active: boolean;
  reason: 'budget' | 'empty_pool' | null;
  platforms: Partial<Record<PlatformKey, PlannedVariant>>;
  tasks: number;
};

export type Shortfall = { date: string; surface: 'website' | 'social'; reason: 'pool_exhausted' | 'empty_pool' };

export type PlannerInput = {
  pool: PoolItem[];
  /** First and last day, inclusive, as YYYY-MM-DD. */
  startDate: string;
  endDate: string;
  platforms?: PlatformKey[];
  /** Platforms that cost one Zapier task per post. Defaults to DEFAULT_ZAPIER_PLATFORMS. */
  zapierPlatforms?: PlatformKey[];
  /** Tasks the plan may use in one calendar month. Default 90 of the 100 on the free plan. */
  monthlyTaskBudget?: number;
  /** The social sequence starts this many places into the pool order. Default 3. */
  socialShift?: number;
  /** Appended to each social post from `from` to `to` inclusive (the fundraiser message, #4434). */
  fundraiserMessage?: { text: string; from: string; to: string };
  /** Return false when the item's picture cannot meet this platform's shape. Default: true. */
  imageFit?: (item: PoolItem, platform: PlatformKey) => boolean;
};

export type PlannerSummary = {
  website_items_used: number;
  social_items_used: number;
  shortfalls: Shortfall[];
  tasks_by_month: Record<string, number>;
  social_days_by_month: Record<string, number>;
  budget_deferred_days: string[];
};

export type EditionPlan = { website: WebsiteDay[]; social: SocialDay[]; summary: PlannerSummary };

const DAY_MS = 86_400_000;
const SEPARATOR = '\n\n';

function parseDay(value: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid date ${value}; expected YYYY-MM-DD`);
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function formatDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function listDays(startDate: string, endDate: string): string[] {
  const start = parseDay(startDate);
  const end = parseDay(endDate);
  if (end < start) throw new Error('endDate is before startDate');
  const days: string[] = [];
  for (let t = start; t <= end; t += DAY_MS) days.push(formatDay(t));
  return days;
}

/** Least used first, then least recently featured (never featured first), then by id. */
function poolOrder(pool: PoolItem[]): PoolItem[] {
  return [...pool].sort((a, b) => {
    const usage = (a.usage_count ?? 0) - (b.usage_count ?? 0);
    if (usage !== 0) return usage;
    const aLast = a.last_featured ?? '';
    const bLast = b.last_featured ?? '';
    if (aLast !== bLast) return aLast < bLast ? -1 : 1;
    const aId = String(a.id);
    const bId = String(b.id);
    return aId < bId ? -1 : aId > bId ? 1 : 0;
  });
}

function appendMessage(base: string, message: string, max: number | null, reserve = 0): string {
  const room = max === null ? null : max - SEPARATOR.length - message.length - reserve;
  // A message that cannot fit with at least some of the caption is left off that platform.
  if (room !== null && room < 20) return base;
  const body = room === null ? base : truncateText(base, room);
  return `${body}${SEPARATOR}${message}`;
}

function variantsFor(
  item: PoolItem,
  platforms: PlatformKey[],
  zapier: PlatformKey[],
  message: string | null,
  imageFit: (item: PoolItem, platform: PlatformKey) => boolean,
): Partial<Record<PlatformKey, PlannedVariant>> {
  const posts = formatSocialPosts(item);
  const caption = (item.caption || '').trim() || (item.title || '').trim();
  const link = item.post_url || null;
  const out: Partial<Record<PlatformKey, PlannedVariant>> = {};

  for (const platform of platforms) {
    const manual = !zapier.includes(platform);
    const fits = !item.image_url || imageFit(item, platform);
    let text = '';
    let imageUrl: string | null = item.image_url || null;
    let imageAlt: string | null = imageUrl ? item.image_alt || null : null;
    let skip = false;
    let skipReason: SkipReason = null;

    if (platform === 'facebook_page' || platform === 'facebook_group') {
      text = message ? appendMessage(posts.facebook_page.text, message, null) : posts.facebook_page.text;
    } else if (platform === 'instagram') {
      text = message ? appendMessage(caption, message, SOCIAL_LIMITS.instagramCaption) : posts.instagram.caption;
      skip = posts.instagram.skip;
      skipReason = posts.instagram.skip_reason;
    } else if (platform === 'x') {
      const linkCost = link ? link.length + 1 : 0;
      if (message) {
        const room = SOCIAL_LIMITS.xText - linkCost;
        const body = appendMessage(caption, message, room);
        text = link ? `${body} ${link}` : body;
        if (body === caption) text = posts.x.text;
      } else {
        text = posts.x.text;
      }
    } else {
      text = message
        ? appendMessage(caption, message, SOCIAL_LIMITS.pinterestDescription)
        : posts.pinterest.description;
      skip = posts.pinterest.skip;
      skipReason = posts.pinterest.skip_reason;
    }

    if (!fits && imageUrl) {
      if (platform === 'instagram' || platform === 'pinterest') {
        skip = true;
        skipReason = 'picture_shape';
      } else if (platform === 'x') {
        // A text-only post is better than a stretched picture.
        imageUrl = null;
        imageAlt = null;
      }
    }

    out[platform] = {
      text,
      link: platform === 'instagram' ? null : link,
      image_url: imageUrl,
      image_alt: imageAlt,
      skip,
      skip_reason: skipReason,
      manual,
    };
  }
  return out;
}

/** The pool order starting `shift` places in, so the social sequence differs from the website's. */
function rotated(order: PoolItem[], shift: number): PoolItem[] {
  if (!order.length) return [];
  const start = ((shift % order.length) + order.length) % order.length;
  return [...order.slice(start), ...order.slice(0, start)];
}

/** Evenly spreads `count` active days across `total` days; deterministic. */
function isActiveDay(index: number, total: number, count: number): boolean {
  return Math.floor(((index + 1) * count) / total) > Math.floor((index * count) / total);
}

export function planEditions(input: PlannerInput): EditionPlan {
  const days = listDays(input.startDate, input.endDate);
  const platforms = input.platforms ?? ALL_PLATFORMS;
  const zapier = (input.zapierPlatforms ?? DEFAULT_ZAPIER_PLATFORMS).filter((p) => platforms.includes(p));
  const budget = input.monthlyTaskBudget ?? 90;
  const shift = input.socialShift ?? 3;
  const imageFit = input.imageFit ?? (() => true);
  const order = poolOrder(input.pool);
  const size = order.length;
  const message = input.fundraiserMessage?.text?.trim() || null;

  const shortfalls: Shortfall[] = [];
  const website: WebsiteDay[] = [];
  const social: SocialDay[] = [];

  // Website: one item a day, cycling the pool order, so repeats are as far apart as the pool allows.
  days.forEach((date, i) => {
    if (!size) {
      website.push({ date, item_id: null });
      shortfalls.push({ date, surface: 'website', reason: 'empty_pool' });
      return;
    }
    if (i >= size) shortfalls.push({ date, surface: 'website', reason: 'pool_exhausted' });
    website.push({ date, item_id: order[i % size].id });
  });

  // Social: a month's task budget decides how many days carry an edition.
  const perEdition = zapier.length;
  const monthDays = new Map<string, string[]>();
  for (const date of days) {
    const key = date.slice(0, 7);
    monthDays.set(key, [...(monthDays.get(key) ?? []), date]);
  }

  const tasksByMonth: Record<string, number> = {};
  const socialDaysByMonth: Record<string, number> = {};
  const deferred: string[] = [];
  let sequence = 0;
  let queue: PoolItem[] = rotated(order, shift);

  for (const [month, list] of monthDays) {
    const capacity = perEdition === 0 ? list.length : Math.min(list.length, Math.floor(budget / perEdition));
    tasksByMonth[month] = 0;
    socialDaysByMonth[month] = 0;

    list.forEach((date, index) => {
      const dayIndex = days.indexOf(date);
      if (!size) {
        social.push({ date, item_id: null, active: false, reason: 'empty_pool', platforms: {}, tasks: 0 });
        shortfalls.push({ date, surface: 'social', reason: 'empty_pool' });
        return;
      }
      if (!isActiveDay(index, list.length, capacity)) {
        social.push({ date, item_id: null, active: false, reason: 'budget', platforms: {}, tasks: 0 });
        deferred.push(date);
        return;
      }

      if (!queue.length) queue = rotated(order, shift);
      // Never the same item as the website on the same day. An item skipped for that reason
      // stays at the front of the queue and is used on the next active day, so nothing repeats.
      let pick = queue.findIndex((candidate) => candidate.id !== website[dayIndex].item_id);
      if (pick === -1 && size > 1) {
        // Only the colliding item is left: start the next cycle behind it. This happens only
        // when the pool is already used up, and sequence >= size then reports the shortfall.
        queue = [...queue, ...rotated(order, shift)];
        pick = queue.findIndex((candidate) => candidate.id !== website[dayIndex].item_id);
      }
      if (pick === -1) pick = 0; // a single-item pool cannot avoid the website's item
      const [item] = queue.splice(pick, 1);
      if (sequence >= size) shortfalls.push({ date, surface: 'social', reason: 'pool_exhausted' });
      sequence += 1;

      const inFundraiser =
        input.fundraiserMessage && date >= input.fundraiserMessage.from && date <= input.fundraiserMessage.to;
      const variants = variantsFor(item, platforms, zapier, inFundraiser ? message : null, imageFit);
      const tasks = zapier.filter((p) => variants[p] && !variants[p]!.skip).length;
      tasksByMonth[month] += tasks;
      socialDaysByMonth[month] += 1;
      social.push({ date, item_id: item.id, active: true, reason: null, platforms: variants, tasks });
    });
  }

  return {
    website,
    social,
    summary: {
      website_items_used: new Set(website.map((d) => d.item_id).filter((id) => id !== null)).size,
      social_items_used: new Set(social.map((d) => d.item_id).filter((id) => id !== null)).size,
      shortfalls,
      tasks_by_month: tasksByMonth,
      social_days_by_month: socialDaysByMonth,
      budget_deferred_days: deferred,
    },
  };
}
