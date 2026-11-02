import { describe, expect, it } from 'vitest';
import { evaluateQuality, withoutDiseaseNames } from '../functions/_lib/content-quality-gate';

const GOOD_PICTURE = { widthPx: 2000, heightPx: 1400, kind: 'photograph' as const };

describe('content quality gate (#5038)', () => {
  it('keeps a picture that names Gehrig in its title and meets the hero size', () => {
    const v = evaluateQuality({ ...GOOD_PICTURE, title: 'Lou Gehrig scores head first in 4th inning' });
    expect(v.decision).toBe('good');
    expect(v.relevance).toBe('gehrig-primary');
    expect(v.sizes).toEqual({ social: true, hero: true });
  });

  it('marks a record that names Gehrig only in its description as linked', () => {
    const v = evaluateQuality({
      ...GOOD_PICTURE,
      title: 'Derek Jeter doubles for his 2,722nd hit',
      text: ['Jeter passed Lou Gehrig for the Yankees career hits record.'],
    });
    expect(v.decision).toBe('good');
    expect(v.relevance).toBe('gehrig-linked');
  });

  it('drops a record that does not name Gehrig', () => {
    const v = evaluateQuality({ ...GOOD_PICTURE, title: 'Babe Dahlgren traded to the Boston Braves' });
    expect(v).toMatchObject({ decision: 'not_good', relevance: 'excluded', reasons: ['no_gehrig_reference'] });
  });

  it('keeps a no-Gehrig record only when Product Authority marked it a manual keep', () => {
    const v = evaluateQuality({ ...GOOD_PICTURE, title: 'Derek Jeter batting', manualKeep: true });
    expect(v).toMatchObject({ decision: 'good', relevance: 'manual-keep' });
  });

  it('drops disease wording with no Gehrig-experience wording, even though the common name contains Gehrig', () => {
    const v = evaluateQuality({
      ...GOOD_PICTURE,
      title: "JB Charleston hosts runners, raises awareness for Lou Gehrig's Disease",
    });
    expect(v).toMatchObject({ decision: 'not_good', reasons: ['als_or_medical_subject'] });
  });

  it('drops ALS subjects that never mention Gehrig, such as a physicist', () => {
    const v = evaluateQuality({ ...GOOD_PICTURE, title: 'Physicist Stephen Hawking in Zero Gravity', text: ['ALS'] });
    expect(v.decision).toBe('not_good');
  });

  it('drops patient, awareness and fundraiser subjects', () => {
    for (const title of ['ALS patients gather at a Gehrig walk', 'Gehrig 5K fundraiser for a cure']) {
      expect(evaluateQuality({ ...GOOD_PICTURE, title }).decision).toBe('not_good');
    }
  });

  it('sends disease wording together with Gehrig-experience wording to review', () => {
    const v = evaluateQuality({
      ...GOOD_PICTURE,
      title: 'Lou Gehrig leaves the Mayo Clinic after his 1939 diagnosis',
      text: ["Doctors named the illness amyotrophic lateral sclerosis, now called Lou Gehrig's disease."],
    });
    expect(v).toMatchObject({ decision: 'needs_review', reasons: ['disease_wording_with_gehrig_experience'] });
  });

  it('keeps Gehrig-experience content that uses no disease wording', () => {
    for (const title of [
      'Lou Gehrig and Eleanor at home after he retired from baseball',
      'Lou Gehrig arrives at the Mayo Clinic, June 1939',
      'Lou Gehrig Appreciation Day farewell speech, July 4, 1939',
      'Funeral procession for Lou Gehrig, June 1941',
    ]) {
      const v = evaluateQuality({ ...GOOD_PICTURE, title });
      expect(v.decision, title).toBe('good');
    }
  });

  it('removes the disease name before looking for Gehrig', () => {
    expect(withoutDiseaseNames("Lou Gehrig's disease walk")).not.toMatch(/gehrig/i);
    expect(withoutDiseaseNames('Lou Gehrig at bat')).toMatch(/gehrig/i);
  });

  it('never releases a fee-required item, and drops duplicates', () => {
    expect(evaluateQuality({ ...GOOD_PICTURE, title: 'Lou Gehrig', feeRequired: true })).toMatchObject({
      decision: 'not_good',
      reasons: ['fee_required'],
    });
    expect(evaluateQuality({ ...GOOD_PICTURE, title: 'Lou Gehrig', isDuplicate: true }).reasons).toEqual(['duplicate']);
  });

  it('applies the 1080px social floor and the 1500px hero tier', () => {
    const base = { title: 'Lou Gehrig', kind: 'photograph' as const };
    expect(evaluateQuality({ ...base, widthPx: 1079, heightPx: 700 })).toMatchObject({ decision: 'not_good', reasons: ['picture_under_1080px'] });
    expect(evaluateQuality({ ...base, widthPx: 1200, heightPx: 900 })).toMatchObject({ decision: 'good', sizes: { social: true, hero: false } });
    expect(evaluateQuality({ ...base, widthPx: 1500, heightPx: 900 }).sizes).toEqual({ social: true, hero: true });
  });

  it('keeps the 800px newspaper floor and never offers a newspaper picture as social or hero', () => {
    const base = { title: 'Lou Gehrig homers, Daily News', kind: 'newspaper' as const };
    expect(evaluateQuality({ ...base, widthPx: 799, heightPx: 500 }).decision).toBe('not_good');
    expect(evaluateQuality({ ...base, widthPx: 900, heightPx: 600 })).toMatchObject({ decision: 'good', sizes: { social: false, hero: false } });
  });

  it('treats unreadable dimensions as not good', () => {
    expect(evaluateQuality({ title: 'Lou Gehrig' }).reasons).toEqual(['picture_size_unreadable']);
  });

  it('is deterministic', () => {
    const input = { ...GOOD_PICTURE, title: 'Lou Gehrig at bat' };
    expect(evaluateQuality(input)).toEqual(evaluateQuality(input));
  });
});
