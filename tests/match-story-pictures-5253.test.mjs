import { describe, expect, it } from 'vitest';
import { isCleared, matchPictures, storyYears } from '../scripts/content-pipeline/match-story-pictures.mjs';

const pic = (id, year, extra = {}) => ({ id, year, title: '', publication_eligible: 1, rights_hold: 0, ...extra });
const story = (id, extra = {}) => ({ id, tag: `s${id}`, title: 'A story', text: '', event_date: null, ...extra });

describe('story picture matching (#5253)', () => {
  it('picks a 1934 cleared picture for a 1934 story', () => {
    const out = matchPictures([story(1, { event_date: '1934-06-01', title: 'The 1934 Triple Crown season' })], [pic(10, 1927), pic(11, 1934), pic(12, 1939)]);
    expect(out[0].picture_id).toBe(11);
    expect(out[0].flagged).toBe(false);
    expect(out[0].reason).toBe('same year (1934)');
  });

  it('reads the year from the title or text when there is no event date', () => {
    expect(storyYears(story(1, { title: 'Streak ends in 1939' }))).toEqual([1939]);
    expect(storyYears(story(1, { event_date: '1925-06-01', text: 'In 1927 he' }))).toEqual([1925, 1927]);
  });

  it('uses subject words when no year matches', () => {
    const out = matchPictures([story(1, { title: 'Yankees barnstorming tour' })], [pic(10, null, { title: 'Portrait' }), pic(11, null, { teams: 'Yankees barnstorming' })]);
    expect(out[0].picture_id).toBe(11);
    expect(out[0].reason).toBe('subject words');
  });

  it('falls back to the least-used cleared picture and flags the story', () => {
    const out = matchPictures([story(1), story(2), story(3)], [pic(10, 1930), pic(11, 1931)]);
    expect(out.map((o) => o.picture_id)).toEqual([10, 11, 10]);
    expect(out.every((o) => o.flagged)).toBe(true);
  });

  it('never proposes a picture that is not cleared', () => {
    const out = matchPictures([story(1, { event_date: '1934-01-01' })], [pic(10, 1934, { rights_hold: 1 }), pic(11, 1934, { publication_eligible: 0 }), pic(12, 1920)]);
    expect(out[0].picture_id).toBe(12);
    expect(isCleared(pic(1, 1, { rights_hold: 1 }))).toBe(false);
  });

  it('refuses to run with no cleared pictures', () => {
    expect(() => matchPictures([story(1)], [pic(10, 1934, { rights_hold: 1 })])).toThrow(/no rights-cleared/);
  });

  it('is deterministic and spreads equal matches across pictures', () => {
    const stories = [story(1, { event_date: '1934-01-01' }), story(2, { event_date: '1934-02-01' })];
    const pics = [pic(10, 1934), pic(11, 1934)];
    const a = matchPictures(stories, pics);
    expect(matchPictures(stories, pics)).toEqual(a);
    expect(a.map((o) => o.picture_id)).toEqual([10, 11]);
  });
});
