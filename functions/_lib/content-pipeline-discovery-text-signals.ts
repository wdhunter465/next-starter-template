// Best-effort text-matching signals for scheduled-discovery candidates
// (scripts/content-pipeline/collect-gehrig-external-sources.mjs). These are
// metadata-quality hints for a human reviewer -- never a rights or identity
// determination. A missing or wrong match here is a data-quality issue to
// fix in review, not a safety issue.

export const KNOWN_RELATED_PEOPLE = [
  "Babe Ruth",
  "Jimmie Foxx",
  "Al Simmons",
  "Miller Huggins",
  "Joe McCarthy",
  "Tony Lazzeri",
  "Bill Dickey",
  "Earle Combs",
  "Eleanor Gehrig",
] as const;

/** Case-insensitive best-effort co-appearance match against KNOWN_RELATED_PEOPLE. Always includes "Lou Gehrig" first. */
export function extractPeopleTags(text: string | null | undefined): string[] {
  const haystack = String(text ?? "").toLowerCase();
  const found = KNOWN_RELATED_PEOPLE.filter((name) => haystack.includes(name.toLowerCase()));
  return ["Lou Gehrig", ...found];
}

// Restricted to 18xx/19xx (Gehrig's lifetime and playing career are entirely
// pre-1950) so an unrelated modern year in Commons boilerplate -- an upload
// timestamp, a "reviewed on" note, a category year -- can't be mistaken for
// the historical photo date. Word-bounded so e.g. "21928" doesn't match.
const MONTH_DATE_RE = /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\b1[89]\d{2}\b/i;
const YEAR_RE = /\b1[89]\d{2}\b/;

/** Extracts a human-readable date/period from free text (e.g. a Commons filename). Returns undefined if nothing date-like is found. */
export function extractDateOrPeriod(text: string | null | undefined): string | undefined {
  const haystack = String(text ?? "");
  const monthMatch = MONTH_DATE_RE.exec(haystack);
  if (monthMatch) return monthMatch[0];
  const yearMatch = YEAR_RE.exec(haystack);
  return yearMatch ? yearMatch[0] : undefined;
}
