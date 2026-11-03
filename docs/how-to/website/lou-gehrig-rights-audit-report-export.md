---
Doc Type: How-To
Audience: Product Authority and LGFC content operators
Authority Level: Procedure
Owns: How to export the rights audit report and what it does and does not contain
Does Not Own: The rights policy, the permission layers, or what may be shared with a rights holder
Canonical Reference: /docs/reference/website/lou-gehrig-content-record-d1-design.md
Related issues: #5059, #4368, #4550, #4523, #4526
Last Reviewed: 2026-11-03
---

# Rights audit report export

## Purpose

A rights holder may ask for the permission log. This export produces it from D1 as a CSV or JSON file, filtered by source and date. It is read-only: it never writes to D1, sends email or changes a record.

## Who can run it

An authenticated admin member session. Unauthenticated requests get 401, non-admin members 403, and a missing D1 binding 503.

## How to run it

Signed in as an admin on the site, open one of these in the browser. The file downloads.

| Need | Address |
| --- | --- |
| Everything, as of now | `/api/admin/rights-audit-report` |
| One source | `/api/admin/rights-audit-report?domain=loc.gov` |
| As of a date | `/api/admin/rights-audit-report?as_of=2026-11-03` |
| JSON instead of CSV | `/api/admin/rights-audit-report?format=json` |

Parameters:

- `domain`: an exact source domain, lowercase (for example `loc.gov`). `www.loc.gov` and `loc.gov` are different values; use the one stored on the records. Omit it for every source.
- `as_of`: `YYYY-MM-DD` (covers that whole day, UTC) or a UTC timestamp ending in `Z`. Omit it for now.
- `format`: `csv` (default) or `json`.

The file is named `rights-audit-<domain or all-sources>-<as-of date>.csv`.

## What each row is

One row per record that existed on the as-of date. If a newer record for the same origin URL existed by then, only the newer one is listed, so a replaced record is not listed twice.

| Column | Meaning |
| --- | --- |
| `candidate_id` | Stable record reference |
| `date_collected` | When the record was created (UTC) |
| `title`, `content_type` | What the item is |
| `source_name`, `source_domain`, `source_url` | Where it came from |
| `credit_line` | The credit we display |
| `origin_permission` | The source's own permission |
| `cmg_permission`, `mlb_permission`, `yankees_permission` | The party layers |
| `privacy_status` | Privacy layer |
| `outcome_basis` | Why the record has its outcome |
| `origin_statement` | The source's own rights wording, as captured |
| `statement_captured_at` | When that wording was captured |
| `final_status` | `permitted`, `not_permitted` or `for_admin_review` |

## Read this before sharing

- **Layer values are current, not historical.** The as-of date chooses which records existed. It does not reconstruct what the layers said on that date.
- **`final_status` is `permitted` only when every layer is cleared.** Until CMG, MLB and the Yankees each confirm, their layers stay `for_admin_review` and every record shows `not_permitted`. A recipient will see that.
- **Share-safe by design.** The column list is fixed in code. The report never includes admin notes, reviewer names, contact details, permission message bodies or email addresses, and a test asserts this.
- **Titles and statements come from outside sources.** In the CSV, a cell that starts with `=`, `+`, `-` or `@` gets a leading apostrophe so a spreadsheet will not run it as a formula.
- **Large reports are capped at 5,000 rows.** If the cap is hit, the response header `X-Report-Truncated` is `true` and the JSON has `"truncated": true`. Narrow it with `domain` or `as_of`.
- **A person decides what goes out.** Review the file before sending it, and send it from the permission mailbox. The export is not a statement that anything is permitted.

## Not built

PDF rendering, an admin page button, and a view of the permission exchanges (who was asked, when, and the outcome). The exchange archive is in D1 (#4526) but is deliberately not part of this report.
