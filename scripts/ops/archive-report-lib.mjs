// #5084 -- the read-only archive report: every B2 picture with its rights state, subject verdict,
// skip reason, and whether it may be used today. Pure functions (SQL text, row classification, CSV
// and Markdown rendering); the CLI in archive-report.mjs runs the SQL. Nothing here writes.

/** One row per B2 picture, joined the way the quality gate joins (b2:// key or media_uid:). */
export const REPORT_SQL = `
SELECT ma.id AS media_id,
       ma.b2_key,
       ma.rights_hold AS media_rights_hold,
       ma.rights_hold_reason,
       ci.id AS content_item_id,
       ci.candidate_id,
       ci.title,
       ci.source_domain,
       ci.source_url,
       ci.origin_permission,
       ci.cmg_permission,
       ci.mlb_permission,
       ci.yankees_permission,
       ci.privacy_status,
       ci.rights_status,
       ci.final_status,
       ci.gate_decision,
       ci.gate_relevance,
       ci.gate_reasons,
       ci.gate_manual_keep,
       ci.released_for_editions_at,
       p.id AS photo_id,
       p.publication_eligible AS photo_publication_eligible,
       p.rights_hold AS photo_rights_hold
  FROM media_assets ma
  LEFT JOIN content_items ci
         ON (ci.media_asset_id = 'b2://' || ma.b2_key OR ci.media_asset_id = 'media_uid:' || ma.media_uid)
        AND ci.deleted_at IS NULL AND ci.superseded_at IS NULL
  LEFT JOIN photos p ON instr(p.url, ma.b2_key) > 0
 ORDER BY ma.id, ci.id, p.id`;

/** Website pictures (photos rows) that match no B2 media row. */
export const PHOTOS_WITHOUT_MEDIA_SQL = `
SELECT p.id AS photo_id, p.url, p.publication_eligible, p.rights_hold, p.rights_status
  FROM photos p
 WHERE NOT EXISTS (SELECT 1 FROM media_assets ma WHERE instr(p.url, ma.b2_key) > 0)
 ORDER BY p.id`;

/** Live content records with a picture link that matches no B2 media row. */
export const CONTENT_WITHOUT_MEDIA_SQL = `
SELECT ci.id AS content_item_id, ci.candidate_id, ci.media_asset_id
  FROM content_items ci
 WHERE ci.deleted_at IS NULL AND ci.superseded_at IS NULL AND ci.media_asset_id IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM media_assets ma
                    WHERE ci.media_asset_id = 'b2://' || ma.b2_key OR ci.media_asset_id = 'media_uid:' || ma.media_uid)
 ORDER BY ci.id`;

/** The report only ever reads. */
export function assertSelectOnly(sql) {
  const text = String(sql).replace(/\s+/g, ' ').trim();
  if (!/^SELECT\b/i.test(text) || /;\s*\S/.test(text) || /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|PRAGMA|ATTACH)\b/i.test(text)) {
    throw new Error(`Report SQL must be a single SELECT: ${text.slice(0, 80)}`);
  }
  return sql;
}

/**
 * Adds the derived columns. `permitted_for_website_today` follows what the site does today: a
 * picture is shown when its media row is off rights hold. `permitted_for_social_today` is the same
 * answer until the shared permission view (#5086) exists.
 */
export function classifyRow(row) {
  const permitted = Number(row.media_rights_hold) === 0;
  const subject = row.gate_decision ?? 'no_verdict';
  let skipReason = '';
  if (row.content_item_id === null || row.content_item_id === undefined) skipReason = 'no_content_record';
  else if (row.gate_decision === null || row.gate_decision === undefined) skipReason = 'no_subject_verdict_recorded';
  return {
    ...row,
    rights_state: permitted ? 'released' : row.final_status ?? 'no_content_record',
    subject_state: subject,
    skip_reason: skipReason,
    permitted_for_website_today: permitted ? 'yes' : 'no',
    permitted_for_social_today: permitted ? 'yes' : 'no',
  };
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows, columns) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  return [cols.join(','), ...rows.map((row) => cols.map((c) => csvCell(row[c])).join(','))].join('\n') + '\n';
}

/** Counts by rights state, by subject state, and the cross-tab of the two. */
export function summarize(classifiedRows) {
  const crossTab = {};
  const rights = {};
  const subject = {};
  const skip = {};
  for (const row of classifiedRows) {
    const key = `${row.rights_state} | ${row.subject_state}`;
    crossTab[key] = (crossTab[key] ?? 0) + 1;
    rights[row.rights_state] = (rights[row.rights_state] ?? 0) + 1;
    subject[row.subject_state] = (subject[row.subject_state] ?? 0) + 1;
    if (row.skip_reason) skip[row.skip_reason] = (skip[row.skip_reason] ?? 0) + 1;
  }
  const mediaIds = new Set(classifiedRows.map((r) => r.media_id));
  return {
    pictures: mediaIds.size,
    rows: classifiedRows.length,
    permittedToday: new Set(classifiedRows.filter((r) => r.permitted_for_website_today === 'yes').map((r) => r.media_id)).size,
    rights,
    subject,
    crossTab,
    skip,
  };
}

function table(obj, headA, headB) {
  const lines = [`| ${headA} | ${headB} |`, '| --- | ---: |'];
  for (const [k, v] of Object.entries(obj).sort((a, b) => b[1] - a[1])) lines.push(`| ${k} | ${v} |`);
  return lines.join('\n');
}

export function renderMarkdown(summary, extras, generatedAt) {
  return [
    `# Archive report`,
    ``,
    `Generated ${generatedAt}. Read-only: nothing was written to D1 or B2 (#5084).`,
    ``,
    `- B2 pictures (media rows): **${summary.pictures}**`,
    `- Permitted for the website today (off rights hold): **${summary.permittedToday}**`,
    `- Report rows (a picture with several content or photo rows repeats): ${summary.rows}`,
    `- Website pictures with no matching B2 media row: **${extras.photosWithoutMedia.length}**`,
    `- Live content records whose picture link matches no B2 media row: **${extras.contentWithoutMedia.length}**`,
    ``,
    `## Rights state`,
    table(summary.rights, 'Rights state', 'Rows'),
    ``,
    `## Subject verdict`,
    table(summary.subject, 'Verdict', 'Rows'),
    ``,
    `## Rights state by subject verdict`,
    table(summary.crossTab, 'Rights state | subject verdict', 'Rows'),
    ``,
    `## Why a picture has no verdict or no content record`,
    table(summary.skip, 'Reason', 'Rows'),
    ``,
    `"Permitted today" follows what the site does now: a picture shows when its media row is off rights hold. The shared permission view in #5086 replaces this.`,
    ``,
  ].join('\n');
}
