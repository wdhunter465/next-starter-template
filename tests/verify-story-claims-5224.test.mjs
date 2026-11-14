import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkClaim, matchTrusted, renderReport, verifyBatch } from '../scripts/content-pipeline/verify-story-claims.mjs';

const trusted = JSON.parse(readFileSync('data/stories/trusted-sources.json', 'utf8'));

const eig = (supports = 'agree', extra = {}) => ({ name: 'Luckiest Man', author: 'Jonathan Eig', page: '123', supports, ...extra });
const hof = (supports = 'agree', extra = {}) => ({ name: 'HOF', url: 'https://baseballhall.org/x', supports, ...extra });
const mlb = (supports = 'agree', extra = {}) => ({ name: 'MLB', url: 'https://www.mlb.com/y', supports, ...extra });
const bref = (supports = 'agree', extra = {}) => ({ name: 'BR', url: 'https://www.baseball-reference.com/z', supports, ...extra });

describe('trusted source matching (#5224)', () => {
  it('records Eig as a trusted book and the preferred tie-breaker', () => {
    const entry = trusted.sources.find((s) => s.id === 'eig-luckiest-man');
    expect(entry).toMatchObject({ type: 'book', author: 'Jonathan Eig', preferred_tiebreaker: true });
  });

  it('matches a book by title and author, and a web source by domain or subdomain', () => {
    expect(matchTrusted(eig(), trusted)?.id).toBe('eig-luckiest-man');
    expect(matchTrusted({ name: 'Luckiest Man', author: 'Someone Else' }, trusted)).toBeNull();
    expect(matchTrusted({ name: 'x', url: 'https://www.mlb.com/a' }, trusted)?.id).toBe('mlb');
    expect(matchTrusted({ name: 'x', url: 'https://chroniclingamerica.loc.gov/a' }, trusted)?.id).toBe('library-of-congress');
    expect(matchTrusted({ name: 'x', url: 'https://notmlb.com/a' }, trusted)).toBeNull();
    expect(matchTrusted({ name: 'x', url: 'https://mlb.com.evil.example/a' }, trusted)).toBeNull();
    expect(matchTrusted(null, trusted)).toBeNull();
  });
});

describe('claim check (#5224)', () => {
  it('verifies a claim with three distinct agreeing trusted sources', () => {
    expect(checkClaim({ claim: 'c', sources: [eig(), hof(), mlb()] }, trusted).status).toBe('verified');
  });

  it('cannot mark a claim ready with fewer than three sources', () => {
    const two = checkClaim({ claim: 'c', sources: [eig(), hof()] }, trusted);
    expect(two.status).toBe('insufficient');
    expect(two.reasons.join(' ')).toMatch(/2 of 3/);
    expect(checkClaim({ claim: 'c', sources: [] }, trusted).status).toBe('insufficient');
  });

  it('counts a source once however many of its pages are cited', () => {
    const sameSite = checkClaim({ claim: 'c', sources: [mlb(), { name: 'MLB 2', url: 'https://www.mlb.com/other', supports: 'agree' }, hof()] }, trusted);
    expect(sameSite.status).toBe('insufficient');
    expect(sameSite.agreeing.sort()).toEqual(['hall-of-fame', 'mlb']);
  });

  it('does not count sources that are not on the trusted list, and says so', () => {
    const r = checkClaim({ claim: 'c', sources: [eig(), hof(), { name: 'Random blog', url: 'https://example.com/b', supports: 'agree' }] }, trusted);
    expect(r.status).toBe('insufficient');
    expect(r.untrusted).toEqual(['Random blog']);
    expect(r.reasons.join(' ')).toContain('not on the trusted list');
  });

  it('flags a conflict with the sources that disagree', () => {
    const r = checkClaim({ claim: 'c', sources: [hof(), mlb(), bref('disagree', { says: 'June 3' })] }, trusted);
    expect(r.status).toBe('conflict');
    expect(r.disagreeing).toEqual([{ id: 'baseball-reference', says: 'June 3' }]);
    expect(r.reasons.join(' ')).toContain('baseball-reference');
  });

  it("verifies on Eig's tie-break when Eig is among three agreeing sources, and records the dissent", () => {
    const r = checkClaim({ claim: 'c', sources: [eig(), hof(), mlb(), bref('disagree', { says: 'x' })] }, trusted);
    expect(r.status).toBe('verified');
    expect(r.reasons.join(' ')).toMatch(/Eig's tie-break/);
  });

  it('does not use the tie-break when Eig disagrees or is not among the agreeing sources', () => {
    expect(checkClaim({ claim: 'c', sources: [eig('disagree'), hof(), mlb(), bref()] }, trusted).status).toBe('conflict');
    expect(checkClaim({ claim: 'c', sources: [hof(), mlb(), bref(), { name: 'SABR', url: 'https://sabr.org/a', supports: 'disagree' }] }, trusted).status).toBe('conflict');
  });

  it('treats a source with no agree or disagree as invalid, and a claim with no text as invalid', () => {
    expect(checkClaim({ claim: 'c', sources: [eig(), hof(), mlb(), { name: 'x', url: 'https://sabr.org/q' }] }, trusted).status).toBe('invalid');
    expect(checkClaim({ claim: '', sources: [eig(), hof(), mlb()] }, trusted).status).toBe('invalid');
  });
});

describe('batch check (#5224)', () => {
  const batch = {
    stories: [
      { tag: 'good-story', claims: [{ claim: 'a', sources: [eig(), hof(), mlb()] }, { claim: 'b', sources: [eig(), hof(), bref()] }] },
      { tag: 'one-weak-claim', claims: [{ claim: 'a', sources: [eig(), hof(), mlb()] }, { claim: 'b', sources: [eig()] }] },
      { tag: 'no-claims' },
    ],
  };

  it('marks a story ready only when every claim is verified', () => {
    const result = verifyBatch(batch, trusted);
    expect(result.stories.map((s) => [s.tag, s.status])).toEqual([
      ['good-story', 'verified_ready'],
      ['one-weak-claim', 'needs_work'],
      ['no-claims', 'needs_work'],
    ]);
    expect(result.readyCount).toBe(1);
    expect(result.needsWorkCount).toBe(2);
    expect(result.stories[2].flags.join(' ')).toMatch(/no claims recorded/);
  });

  it('reports each flagged claim and the counts', () => {
    const text = renderReport(verifyBatch(batch, trusted));
    expect(text).toContain('1 verified-ready, 2 need work');
    expect(text).toContain('WORK   one-weak-claim (1/2 claims verified)');
    expect(text).toContain('insufficient: b');
  });

  it('passes the example: one story ready, one flagged with the dissenting source', () => {
    const example = JSON.parse(readFileSync('data/stories/example-verification.json', 'utf8'));
    const result = verifyBatch(example, trusted);
    expect(result.stories[0].status).toBe('verified_ready');
    expect(result.stories[1].status).toBe('needs_work');
    expect(result.stories[1].flags.join(' ')).toMatch(/conflict/);
  });
});
