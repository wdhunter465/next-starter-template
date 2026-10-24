import fs from 'node:fs';
import path from 'node:path';

const LIST_PATH = 'data/research/gehrig-watermark-source-lists.json';

export function loadCopyQualityLists(repoRoot) {
  const filePath = path.join(repoRoot, LIST_PATH);
  const lists = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!Array.isArray(lists.denylist) || !Number.isFinite(lists.minimum_long_side_px)) {
    throw new Error(`${LIST_PATH} must name a denylist and minimum_long_side_px`);
  }
  return lists;
}

export function imageHost(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return '';
  }
}

export function isDeniedImageHost(url, denylist) {
  const host = imageHost(url);
  if (!host) return false;
  return denylist.some((domain) => {
    const normalized = String(domain).replace(/^www\./, '').toLowerCase();
    return host === normalized || host.endsWith(`.${normalized}`);
  });
}

function longSide(candidate) {
  const width = Number(candidate.width_px);
  const height = Number(candidate.height_px);
  if (!Number.isFinite(width) && !Number.isFinite(height)) return 0;
  return Math.max(Number.isFinite(width) ? width : 0, Number.isFinite(height) ? height : 0);
}

function locKey(candidate) {
  const domain = String(candidate.source_domain || '');
  const record = candidate.source_metadata?.source_record_id;
  if (!record || !domain.includes('loc.gov')) return '';
  return `loc:${String(record).trim().toLowerCase()}`;
}

function commonsKey(candidate) {
  const url = candidate.original_file_url || '';
  const host = imageHost(url);
  if (host !== 'upload.wikimedia.org' && host !== 'commons.wikimedia.org') return '';
  const name = decodeURIComponent(url.split('/').pop() || '').trim().toLowerCase();
  return name ? `commons:${name}` : '';
}

function titleDateKey(candidate) {
  const title = String(candidate.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const date = String(candidate.date_or_period || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!title || !date) return '';
  return `title:${title}|${date}`;
}

function appendNote(existing, sentence) {
  const base = String(existing || '').trim();
  return base ? `${base} ${sentence}` : sentence;
}

/**
 * Marks watermark-denylist image URLs as pointers, groups the remaining
 * copies, and chooses one preferred copy per group. Does not decide rights.
 */
export function applyCopyQuality(candidates, lists) {
  const denylist = lists.denylist;
  const minimum = lists.minimum_long_side_px;
  const next = candidates.map((candidate) => ({ ...candidate }));

  for (const candidate of next) {
    const imageUrl = candidate.original_file_url || candidate.source_url || '';
    if (!isDeniedImageHost(imageUrl, denylist)) continue;
    candidate.copy_role = 'pointer';
    candidate.quality_flag = 'known_not_collected';
    candidate.provenance_notes = appendNote(
      candidate.provenance_notes,
      'Copy facts (#4816): image URL is on the watermark denylist. Kept as a pointer and not imported as a copy.',
    );
  }

  const copies = next.filter((candidate) => candidate.copy_role !== 'pointer');
  const parent = copies.map((_, index) => index);
  const find = (index) => {
    let cursor = index;
    while (parent[cursor] !== cursor) cursor = parent[cursor];
    return cursor;
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  const buckets = new Map();
  const link = (key, index) => {
    if (!key) return;
    if (buckets.has(key)) union(buckets.get(key), index);
    else buckets.set(key, index);
  };
  copies.forEach((candidate, index) => {
    link(locKey(candidate), index);
    link(commonsKey(candidate), index);
    link(titleDateKey(candidate), index);
  });

  const groups = new Map();
  copies.forEach((candidate, index) => {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(candidate);
    groups.set(root, group);
  });

  for (const group of groups.values()) {
    const sample = group[0];
    const groupKey = titleDateKey(sample) || locKey(sample) || commonsKey(sample) || sample.candidate_id;
    let best = group[0];
    for (const candidate of group) {
      if (longSide(candidate) > longSide(best)) best = candidate;
    }
    for (const candidate of group) {
      const side = longSide(candidate);
      candidate.copy_group_key = groupKey;
      candidate.copy_role = candidate === best ? 'preferred' : 'alternate';
      candidate.quality_flag = side > 0 && side < minimum ? 'low_resolution' : candidate.copy_role;
      const size = side > 0 ? `${candidate.width_px ?? '?'}x${candidate.height_px ?? '?'} px` : 'dimensions unknown';
      const bytes = Number.isFinite(Number(candidate.file_bytes)) ? `${candidate.file_bytes} bytes` : 'file size unknown';
      candidate.provenance_notes = appendNote(
        candidate.provenance_notes,
        `Copy facts (#4816): ${size}, ${bytes}, ${candidate.file_format || 'format unknown'}, original ${candidate.original_file_url || 'unknown'}, role ${candidate.copy_role}, flag ${candidate.quality_flag}, group ${groupKey}.`,
      );
    }
  }

  return next;
}
