#!/usr/bin/env node
/**
 * Proposes a rights-cleared picture for each story from the story's own content (#5253).
 * Read-only: reads a JSON file of stories and cleared pictures, writes a proposed mapping. It never
 * touches D1 or B2. Product Authority, 2026-11-14: a story about Gehrig in 1934 gets a picture of
 * Gehrig from 1934; with no match, a default cleared picture is used and the story is flagged.
 *
 * Input: { "stories": [{id, tag, title, text, event_date}], "pictures": [{id, title, year, era, people, teams, tags,
 *          publication_eligible, rights_hold}] }
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const STOP = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'his', 'her', 'was', 'were', 'from', 'lou', 'gehrig', 'a', 'of', 'in', 'to', 'on', 'at', 'by', 'an', 'as', 'is', 'it']);

/** Cleared means publication-eligible and off rights hold, the test the site uses. */
export const isCleared = (p) => Number(p.publication_eligible) === 1 && Number(p.rights_hold) === 0;

const words = (s) => new Set(String(s ?? '').toLowerCase().match(/[a-z0-9]{3,}/g)?.filter((w) => !STOP.has(w)) ?? []);

/** The years a story is about: its event_date year first, then four-digit years in the title and text. */
export function storyYears(story) {
  const years = [];
  const fromDate = String(story.event_date ?? '').match(/^(\d{4})/);
  if (fromDate) years.push(Number(fromDate[1]));
  for (const m of `${story.title ?? ''} ${story.text ?? ''}`.matchAll(/\b(19[0-4]\d)\b/g)) years.push(Number(m[1]));
  return [...new Set(years)];
}

function score(story, years, storyWords, pic) {
  let s = 0;
  let yearDistance = null;
  if (Number.isFinite(Number(pic.year)) && years.length > 0) {
    yearDistance = Math.min(...years.map((y) => Math.abs(y - Number(pic.year))));
    s += yearDistance === 0 ? 100 : yearDistance <= 1 ? 60 : yearDistance <= 3 ? 30 : 0;
  }
  const picWords = words([pic.title, pic.era, pic.people, pic.teams, pic.tags].join(' '));
  let overlap = 0;
  for (const w of picWords) if (storyWords.has(w)) overlap += 1;
  s += Math.min(overlap, 5) * 5;
  return { score: s, yearDistance, overlap };
}

/**
 * Returns [{story_id, tag, picture_id, reason, flagged}] for every story. Deterministic: ties go to the
 * picture used by fewer stories so far, then to the lowest id.
 */
export function matchPictures(stories, pictures) {
  const cleared = pictures.filter(isCleared).sort((a, b) => a.id - b.id);
  if (cleared.length === 0) throw new Error('no rights-cleared pictures to match against');
  const used = new Map(cleared.map((p) => [p.id, 0]));
  const out = [];
  for (const story of [...stories].sort((a, b) => a.id - b.id)) {
    const years = storyYears(story);
    const sw = words(`${story.title ?? ''} ${story.text ?? ''} ${story.tag ?? ''}`);
    const ranked = cleared
      .map((p) => ({ p, ...score(story, years, sw, p) }))
      .sort((a, b) => b.score - a.score || used.get(a.p.id) - used.get(b.p.id) || a.p.id - b.p.id);
    const best = ranked[0];
    const matched = best.score > 0;
    const pick = matched ? best.p : [...cleared].sort((a, b) => used.get(a.id) - used.get(b.id) || a.id - b.id)[0];
    used.set(pick.id, used.get(pick.id) + 1);
    out.push({
      story_id: story.id,
      tag: story.tag,
      picture_id: pick.id,
      reason: matched
        ? best.yearDistance === 0 ? `same year (${pick.year})` : best.yearDistance !== null && best.yearDistance <= 3 ? `near year (${pick.year})` : 'subject words'
        : 'default: least-used cleared picture',
      flagged: !matched,
    });
  }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const [input, output] = process.argv.slice(2);
  if (!input) {
    console.error('usage: match-story-pictures.mjs <input.json> [proposal.json]');
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(input, 'utf8'));
  const proposal = matchPictures(data.stories ?? [], data.pictures ?? []);
  const text = JSON.stringify(proposal, null, 2) + '\n';
  if (output) writeFileSync(output, text);
  else process.stdout.write(text);
  console.error(`${proposal.length} stories, ${proposal.filter((p) => p.flagged).length} flagged for a better match`);
}
