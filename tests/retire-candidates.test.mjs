import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_TARGETS, parseArgs, selectTargets } from '../scripts/content-pipeline/retire-candidates-lib.mjs';

const BASE = ['--issue', '5044', '--reason', 'Outside the club scope per Product Authority'];

const ROWS = [
  { candidate_id: 'c-1', title: 'Physicist Stephen Hawking in Zero Gravity NASA' },
  { candidate_id: 'c-2', title: 'JB Charleston hosts runners, raises awareness for Lou Gehrig\'s Disease' },
  { candidate_id: 'c-3', title: 'Lou Gehrig scores head first in 4th inning' },
  { candidate_id: 'c-4', title: 'Yankee Stadium 1923 World Series' },
];

describe('retire-candidates (#5044)', () => {
  it('defaults to a dry run on the local database', () => {
    const options = parseArgs([...BASE, '--candidate-id', 'c-1']);
    expect(options.apply).toBe(false);
    expect(options.target).toBe('local');
    expect(options.max).toBe(DEFAULT_MAX_TARGETS);
  });

  it('writes only when --apply is given', () => {
    expect(parseArgs([...BASE, '--candidate-id', 'c-1', '--apply']).apply).toBe(true);
  });

  it('requires an Issue number, a real reason, and something to retire', () => {
    expect(() => parseArgs(['--reason', 'Outside the club scope', '--candidate-id', 'c-1'])).toThrow(/--issue/);
    expect(() => parseArgs(['--issue', 'abc', '--reason', 'Outside the club scope', '--candidate-id', 'c-1'])).toThrow(/--issue/);
    expect(() => parseArgs(['--issue', '5044', '--reason', 'short', '--candidate-id', 'c-1'])).toThrow(/--reason/);
    expect(() => parseArgs(BASE)).toThrow(/Name what to retire/);
  });

  it('rejects unknown flags and an invalid pattern', () => {
    expect(() => parseArgs([...BASE, '--candidate-id', 'c-1', '--delete-everything'])).toThrow(/Unknown argument/);
    expect(() => parseArgs([...BASE, '--title-match', '(unclosed'])).toThrow(/not a valid pattern/);
    expect(() => parseArgs([...BASE, '--candidate-id', 'c-1', '--max', '0'])).toThrow(/--max/);
  });

  it('accepts several ids in one flag or repeated flags', () => {
    expect(parseArgs([...BASE, '--candidate-id', 'c-1, c-2', '--candidate-id', 'c-3']).candidateIds).toEqual(['c-1', 'c-2', 'c-3']);
  });

  it('selects by id', () => {
    const targets = selectTargets(ROWS, parseArgs([...BASE, '--candidate-id', 'c-1']));
    expect(targets.map((row) => row.candidate_id)).toEqual(['c-1']);
  });

  it('refuses an id that is not an active archived candidate', () => {
    expect(() => selectTargets(ROWS, parseArgs([...BASE, '--candidate-id', 'c-1,missing']))).toThrow(/missing/);
  });

  it('selects by title pattern, ignoring case, and does not touch other rows', () => {
    const targets = selectTargets(ROWS, parseArgs([...BASE, '--title-match', 'hawking|\\bdisease\\b']));
    expect(targets.map((row) => row.candidate_id)).toEqual(['c-1', 'c-2']);
  });

  it('does not list a row twice when an id and a pattern both match it', () => {
    const targets = selectTargets(ROWS, parseArgs([...BASE, '--candidate-id', 'c-1', '--title-match', 'hawking']));
    expect(targets).toHaveLength(1);
  });

  it('returns nothing when a pattern matches nothing', () => {
    expect(selectTargets(ROWS, parseArgs([...BASE, '--title-match', 'no such subject']))).toEqual([]);
  });

  it('refuses more matches than the cap, so a loose pattern cannot sweep the archive', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ candidate_id: `m-${i}`, title: 'Yankee Stadium' }));
    expect(() => selectTargets(many, parseArgs([...BASE, '--title-match', 'yankee']))).toThrow(/limit is 25/);
    expect(selectTargets(many, parseArgs([...BASE, '--title-match', 'yankee', '--max', '30']))).toHaveLength(30);
  });

  it('restore mode is off by default and turned on by --restore (#5051)', () => {
    expect(parseArgs([...BASE, '--candidate-id', 'c-1']).restore).toBe(false);
    const options = parseArgs([...BASE, '--candidate-id', 'c-1', '--restore']);
    expect(options.restore).toBe(true);
    expect(options.apply).toBe(false);
  });

  it('selects retired rows by id or pattern in restore mode and names the right state when one is missing (#5051)', () => {
    const retired = [{ candidate_id: 'r-1', title: 'Derek Jeter surpasses Gehrig hits record' }];
    expect(selectTargets(retired, parseArgs([...BASE, '--candidate-id', 'r-1', '--restore'])).map((row) => row.candidate_id)).toEqual(['r-1']);
    expect(selectTargets(retired, parseArgs([...BASE, '--title-match', 'jeter', '--restore']))).toHaveLength(1);
    expect(() => selectTargets(retired, parseArgs([...BASE, '--candidate-id', 'nope', '--restore']))).toThrow(/retired archived candidates: nope/);
    expect(() => selectTargets(ROWS, parseArgs([...BASE, '--candidate-id', 'nope']))).toThrow(/active archived candidates: nope/);
  });
});
