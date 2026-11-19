export const SCHEMA = "social_post_evidence/1";
export const PLATFORMS = ["x", "facebook", "instagram", "pinterest"] as const;
export const STATUSES = ["handed_off", "confirmed", "failed", "missing", "not_eligible"] as const;
export const ORIGINS = ["queue", "ad_hoc"] as const;
export const OUTCOMES = ["ok", "error", "handed_off"] as const;
export const RIGHTS_VERDICTS = ["cleared", "not_cleared"] as const;

export const AD_HOC_ID_RE = /^adhoc-\d{4}-\d{2}-\d{2}-\d+$/;

const UTC_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const OFFSET_ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[+-]\d{2}:\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const SHA256 = /^[0-9a-f]{64}$/;

const isObject = (v: unknown): v is Record<string, any> => v !== null && typeof v === "object" && !Array.isArray(v);
const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const isPositiveInt = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v > 0;

export async function sha256Hex(text: unknown): Promise<string> {
  const encoded = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function nyParts(ms: number): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(ms));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}:${get("second")}`,
  };
}

export function toNewYorkIso(iso: string): string {
  const ms = Date.parse(iso);
  const { date, time } = nyParts(ms);
  const wallAsUtc = Date.parse(`${date}T${time}Z`);
  const offsetMin = Math.round((wallAsUtc - Math.floor(ms / 1000) * 1000) / 60000);
  const sign = offsetMin < 0 ? "-" : "+";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${date}T${time}${sign}${hh}:${mm}`;
}

export async function validateEvidenceRecord(record: unknown): Promise<string[]> {
  const problems: string[] = [];
  if (!isObject(record)) return ["record is not an object"];

  if (record.schema !== SCHEMA) problems.push(`schema must be ${SCHEMA}`);
  if (!isNonEmptyString(record.post_id)) problems.push("post_id is required");
  if (!PLATFORMS.includes(record.platform)) problems.push(`platform must be one of ${PLATFORMS.join(", ")}`);
  if (!isPositiveInt(record.version)) problems.push("version must be a positive integer");
  if (!STATUSES.includes(record.status)) problems.push(`status must be one of ${STATUSES.join(", ")}`);
  if (!ORIGINS.includes(record.origin ?? "queue")) problems.push(`origin must be one of ${ORIGINS.join(", ")}`);

  if (isPositiveInt(record.version) && record.version > 1 && record.supersedes !== record.version - 1) {
    problems.push("a version above 1 must set supersedes to the previous version");
  }

  const origin = record.origin ?? "queue";
  if (isNonEmptyString(record.post_id)) {
    if (origin === "ad_hoc") {
      if (!AD_HOC_ID_RE.test(record.post_id)) problems.push("an ad hoc post_id must look like adhoc-YYYY-MM-DD-<n>");
      if (!isNonEmptyString(record.note)) problems.push("an ad hoc post needs a note saying who asked for it and why");
    } else if (record.post_id.startsWith("adhoc-")) {
      problems.push("a post_id starting with adhoc- must have origin ad_hoc");
    }
  }

  if (!OFFSET_ISO.test(String(record.scheduled_for ?? ""))) {
    problems.push("scheduled_for must be an ISO time with an offset");
  }

  if (!isNonEmptyString(record.text)) {
    problems.push("text is required");
  } else if (record.text_sha256 !== (await sha256Hex(record.text))) {
    problems.push("text_sha256 does not match text");
  }

  const photo = record.photo;
  if (!isObject(photo)) {
    problems.push("photo is required");
  } else {
    if (photo.photo_id === undefined || photo.photo_id === null) problems.push("photo.photo_id is required");
    if (!isNonEmptyString(photo.variant)) problems.push("photo.variant is required");
    if (!SHA256.test(String(photo.image_sha256 ?? ""))) problems.push("photo.image_sha256 must be a SHA-256 hex digest");
    if (!isPositiveInt(photo.width) || !isPositiveInt(photo.height)) problems.push("photo.width and photo.height must be positive integers");
    if (typeof photo.alt_text !== "string") problems.push("photo.alt_text is required");
    if (photo.rights_check !== undefined) {
      const rc = photo.rights_check;
      if (!isObject(rc)) problems.push("photo.rights_check must be an object");
      else {
        if (!RIGHTS_VERDICTS.includes(rc.verdict)) problems.push(`photo.rights_check.verdict must be one of ${RIGHTS_VERDICTS.join(", ")}`);
        if (!isNonEmptyString(rc.source)) problems.push("photo.rights_check.source is required");
        if (!OFFSET_ISO.test(String(rc.checked_at_utc ?? ""))) problems.push("photo.rights_check.checked_at_utc must be an ISO time with an offset");
      }
    }
  }

  const attempts = record.attempts;
  if (!Array.isArray(attempts)) {
    problems.push("attempts must be an array");
  } else {
    attempts.forEach((a, i) => {
      if (!isObject(a)) {
        problems.push(`attempts[${i}] is not an object`);
        return;
      }
      if (!UTC_ISO.test(String(a.at_utc ?? ""))) problems.push(`attempts[${i}].at_utc must be a UTC ISO time ending in Z`);
      if (!isNonEmptyString(a.by)) problems.push(`attempts[${i}].by is required`);
      if (!OUTCOMES.includes(a.outcome)) problems.push(`attempts[${i}].outcome must be one of ${OUTCOMES.join(", ")}`);
      if (a.outcome === "error" && !isNonEmptyString(a.detail)) problems.push(`attempts[${i}] is an error and needs detail`);
    });
  }

  const hasAttempt = (outcome: string) => Array.isArray(attempts) && attempts.some((a) => a?.outcome === outcome);
  const platformRecord = record.platform_record;
  switch (record.status) {
    case "confirmed":
      if (!isObject(platformRecord) || !isNonEmptyString(platformRecord.post_id) || !UTC_ISO.test(String(platformRecord.created_at_utc ?? ""))) {
        problems.push("a confirmed record needs platform_record.post_id and platform_record.created_at_utc");
      }
      break;
    case "failed":
      if (!hasAttempt("error")) problems.push("a failed record needs at least one attempt with outcome error");
      break;
    case "missing":
      if (!hasAttempt("handed_off")) problems.push("a missing record needs a handed_off attempt");
      break;
    case "handed_off":
      if (!hasAttempt("handed_off")) problems.push("a handed_off record needs a handed_off attempt");
      break;
    case "not_eligible":
      if (!isNonEmptyString(record.note)) problems.push("a not_eligible record needs a note with the reason");
      break;
    default:
      break;
  }

  if (isObject(platformRecord) && platformRecord.created_at_utc) {
    if (!UTC_ISO.test(platformRecord.created_at_utc)) {
      problems.push("platform_record.created_at_utc must be a UTC ISO time ending in Z");
    } else if (platformRecord.created_at_new_york !== toNewYorkIso(platformRecord.created_at_utc)) {
      problems.push("platform_record.created_at_new_york does not match created_at_utc");
    }
  }

  const verified = record.verified;
  if (!isObject(verified) || !DATE_ONLY.test(String(verified.on ?? "")) || !isNonEmptyString(verified.by) || !isNonEmptyString(verified.method)) {
    problems.push("verified needs on (YYYY-MM-DD), by and method");
  }

  if (record.anomalies !== undefined && !Array.isArray(record.anomalies)) problems.push("anomalies must be an array");

  return problems;
}

const KNOWN_EVIDENCE_KEYS = new Set([
  "schema",
  "post_id",
  "platform",
  "origin",
  "version",
  "supersedes",
  "scheduled_for",
  "text",
  "text_sha256",
  "photo",
  "photo_id",
  "variant",
  "image_url",
  "image_sha256",
  "image_bytes",
  "width",
  "height",
  "alt_text",
  "rights_check",
  "verdict",
  "source",
  "checked_at_utc",
  "status",
  "attempts",
  "at_utc",
  "by",
  "outcome",
  "detail",
  "handoff",
  "issue_number",
  "opened_at_utc",
  "platform_record",
  "url",
  "created_at_utc",
  "created_at_new_york",
  "anomalies",
  "kind",
  "platform_post_id",
  "verified",
  "on",
  "method",
  "content_item_id",
  "note",
]);

const CONTACT_FIELD = /(email|e-mail|phone|telephone|contact|address|street|postal|zip|member|donor|person|full_name|first_name|last_name)/i;
const EMAIL_VALUE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_VALUE = /(?:\+?\d[\d .()_-]{6,}\d)/;

export function contactLikeUnknownFieldProblems(value: unknown, path = "record"): string[] {
  const problems: string[] = [];
  if (Array.isArray(value)) {
    value.forEach((item, index) => problems.push(...contactLikeUnknownFieldProblems(item, `${path}[${index}]`)));
    return problems;
  }
  if (!isObject(value)) return problems;

  for (const [key, child] of Object.entries(value)) {
    const childPath = `${path}.${key}`;
    const known = KNOWN_EVIDENCE_KEYS.has(key);
    if (!known && CONTACT_FIELD.test(key)) {
      problems.push(`${childPath} looks like contact data and is not part of the evidence record`);
    }
    if (!known && typeof child === "string" && (EMAIL_VALUE.test(child) || PHONE_VALUE.test(child))) {
      problems.push(`${childPath} looks like contact data and is not part of the evidence record`);
    }
    problems.push(...contactLikeUnknownFieldProblems(child, childPath));
  }
  return problems;
}
