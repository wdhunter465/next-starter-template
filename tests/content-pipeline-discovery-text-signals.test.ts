import { describe, expect, it } from 'vitest';

import { extractDateOrPeriod, extractPeopleTags } from '../functions/_lib/content-pipeline-discovery-text-signals';

describe('extractPeopleTags (#3552)', () => {
  it('always includes Lou Gehrig even with no other matches', () => {
    expect(extractPeopleTags('Lou Gehrig in 1923')).toEqual(['Lou Gehrig']);
  });

  it('matches a known related person case-insensitively', () => {
    expect(extractPeopleTags('babe RUTH and Lou Gehrig 1928 barnstorming tour')).toEqual(['Lou Gehrig', 'Babe Ruth']);
  });

  it('matches multiple known related people in one title, preserving KNOWN_RELATED_PEOPLE order', () => {
    expect(extractPeopleTags('Jimmie Foxx, Babe Ruth, Lou Gehrig, Al Simmons')).toEqual([
      'Lou Gehrig',
      'Babe Ruth',
      'Jimmie Foxx',
      'Al Simmons',
    ]);
  });

  it('handles null/undefined/empty text without throwing', () => {
    expect(extractPeopleTags(null)).toEqual(['Lou Gehrig']);
    expect(extractPeopleTags(undefined)).toEqual(['Lou Gehrig']);
    expect(extractPeopleTags('')).toEqual(['Lou Gehrig']);
  });

  it('does not match an unrelated substring', () => {
    expect(extractPeopleTags('Lou Gehrig Fan Club newsletter archive')).toEqual(['Lou Gehrig']);
  });
});

describe('extractDateOrPeriod (#3552)', () => {
  it('extracts a full month/day/year date', () => {
    expect(extractDateOrPeriod('Lou Gehrig beating ball, Aug 27, 1928.jpg')).toBe('Aug 27, 1928');
  });

  it('extracts a full date with an abbreviated period-terminated month', () => {
    expect(extractDateOrPeriod('Lou Gehrig congratulating Babe Ruth with a kick, Oct. 9, 1928.jpg')).toBe(
      'Oct. 9, 1928',
    );
  });

  it('falls back to a bare year when no full date is present', () => {
    expect(extractDateOrPeriod('Lou Gehrig in 1923.jpg')).toBe('1923');
  });

  it('prefers the full date over a bare year when both are present', () => {
    expect(extractDateOrPeriod('Ruth-Gehrig barnstorming tour 1927, photographed Sep 3, 1927')).toBe('Sep 3, 1927');
  });

  it('returns undefined when nothing date-like is found', () => {
    expect(extractDateOrPeriod('File:GehrigCU.jpg')).toBeUndefined();
  });

  it('handles null/undefined/empty text without throwing', () => {
    expect(extractDateOrPeriod(null)).toBeUndefined();
    expect(extractDateOrPeriod(undefined)).toBeUndefined();
    expect(extractDateOrPeriod('')).toBeUndefined();
  });
});
