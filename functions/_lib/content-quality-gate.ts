// Quality gate for collected content (#5038, slice 1 of #5037). A pure function: it reads one
// item's facts and returns a verdict with reasons. It reads no database, calls no network and
// changes no gate constant; wiring it into archive ingest and recording the result in D1 are
// separate steps that need Product Authority's Go.
//
// Rules are Product Authority's, recorded on #5038 (2026-11-02):
//   1. The LGFC website is about Lou Gehrig. A record that does not name Gehrig is dropped, unless
//      Product Authority marked it a manual keep. Other people, teams and events stay only when
//      the record names Gehrig (for example Jeter passing his career hits record).
//   2. ALS is kept only as Gehrig's own experience (diagnosis, Mayo Clinic, return and retirement,
//      life with Eleanor, his New York doctors, funeral coverage). Content about the disease
//      itself is excluded, tiered so the common name "Lou Gehrig's disease" does not let it in:
//        a. disease wording and no Gehrig-experience wording  -> not good
//        b. disease wording and Gehrig-experience wording     -> needs review (a person decides)
//        c. no disease wording and Gehrig named               -> keep
//   3. Fee-required items are never released; duplicates are not good.
//   4. Picture size: 1080px long side qualifies for social, 1500px also for the website hero;
//      printed newspaper pictures keep an 800px floor and are never hero or social-link sized.

export const SOCIAL_MIN_LONG_SIDE_PX = 1080;
export const HERO_MIN_LONG_SIDE_PX = 1500;
export const NEWSPAPER_MIN_LONG_SIDE_PX = 800;

export type QualityDecision = 'good' | 'needs_review' | 'not_good';
export type RelevanceTag = 'gehrig-primary' | 'gehrig-linked' | 'manual-keep' | 'excluded';

export type QualityGateInput = {
  /** Title, caption, description, tags and similar text from the record. */
  title?: string | null;
  text?: Array<string | null | undefined>;
  widthPx?: number | null;
  heightPx?: number | null;
  kind?: 'photograph' | 'newspaper';
  feeRequired?: boolean;
  isDuplicate?: boolean;
  /** Product Authority said to keep this item although its text does not name Gehrig. */
  manualKeep?: boolean;
};

export type QualityVerdict = {
  decision: QualityDecision;
  relevance: RelevanceTag;
  /** Short machine-readable reasons, safe to store in admin notes. */
  reasons: string[];
  /** Which size tiers the picture meets, whatever the decision. */
  sizes: { social: boolean; hero: boolean };
};

/** The disease by name, including the common name that also contains "Gehrig". */
const DISEASE_PATTERN =
  /\b(?:lou\s+)?gehrig['’]?s?\s+disease\b|\bamyotrophic\b|\bals\b|\bmotor\s+neuron\b|\bice\s+bucket\b|\bals\s+(?:patients?|awareness|association|research)\b/gi;

/** Medical or awareness subjects that are not Gehrig's own story. */
const MEDICAL_PATTERN =
  /\b(?:patients?|awareness|cure|clinical\s+trials?|therapy|treatments?|fundrais\w+|caregivers?|diagnosed\s+with\s+als)\b/i;

/** Wording that marks Gehrig's own experience of the illness: allowed, in small numbers. */
const GEHRIG_EXPERIENCE_PATTERN =
  /\b(?:mayo\s+clinic|1939|diagnos\w+|retire\w*|farewell|luckiest\s+man|appreciation\s+day|eleanor|funeral|doctors?|physicians?|dr\.)\b/i;

const GEHRIG_PATTERN = /\bgehrig\b/i;

function joinText(input: QualityGateInput): string {
  return [input.title, ...(input.text ?? [])].filter(Boolean).join(' \n ');
}

function longSide(input: QualityGateInput): number {
  const w = Number(input.widthPx);
  const h = Number(input.heightPx);
  return Math.max(Number.isFinite(w) ? w : 0, Number.isFinite(h) ? h : 0);
}

function sizesFor(input: QualityGateInput): { social: boolean; hero: boolean } {
  if (input.kind === 'newspaper') return { social: false, hero: false };
  const side = longSide(input);
  return { social: side >= SOCIAL_MIN_LONG_SIDE_PX, hero: side >= HERO_MIN_LONG_SIDE_PX };
}

/** True when the text names the disease or a medical subject. */
export function mentionsDiseaseSubject(text: string): boolean {
  DISEASE_PATTERN.lastIndex = 0;
  return DISEASE_PATTERN.test(text) || MEDICAL_PATTERN.test(text);
}

/** The text with the disease's common name removed, so "Gehrig" in "Lou Gehrig's disease" does not count. */
export function withoutDiseaseNames(text: string): string {
  return text.replace(DISEASE_PATTERN, ' ');
}

export function evaluateQuality(input: QualityGateInput): QualityVerdict {
  const sizes = sizesFor(input);
  const text = joinText(input);
  const verdict = (decision: QualityDecision, relevance: RelevanceTag, reasons: string[]): QualityVerdict => ({
    decision,
    relevance,
    reasons,
    sizes,
  });

  if (input.feeRequired) return verdict('not_good', 'excluded', ['fee_required']);
  if (input.isDuplicate) return verdict('not_good', 'excluded', ['duplicate']);

  const side = longSide(input);
  const floor = input.kind === 'newspaper' ? NEWSPAPER_MIN_LONG_SIDE_PX : SOCIAL_MIN_LONG_SIDE_PX;
  if (side === 0) return verdict('not_good', 'excluded', ['picture_size_unreadable']);
  if (side < floor) return verdict('not_good', 'excluded', [`picture_under_${floor}px`]);

  if (mentionsDiseaseSubject(text)) {
    if (GEHRIG_EXPERIENCE_PATTERN.test(text) && GEHRIG_PATTERN.test(withoutDiseaseNames(text))) {
      return verdict('needs_review', 'excluded', ['disease_wording_with_gehrig_experience']);
    }
    return verdict('not_good', 'excluded', ['als_or_medical_subject']);
  }

  if (!GEHRIG_PATTERN.test(text)) {
    if (input.manualKeep) return verdict('good', 'manual-keep', ['manual_keep']);
    return verdict('not_good', 'excluded', ['no_gehrig_reference']);
  }

  const inTitle = GEHRIG_PATTERN.test(String(input.title ?? ''));
  return verdict('good', inTitle ? 'gehrig-primary' : 'gehrig-linked', ['names_gehrig']);
}
