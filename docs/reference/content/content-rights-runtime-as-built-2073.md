---
Doc Type: Reference
Audience: Bill, ChatGPT, Cursor, LGFC operators, and implementation agents
Authority Level: Controlled
Owns: As-built reconciliation of the content/rights runtime that predates #2073, and what #2073's later work packages (2-6) can reuse vs. must build new
Does Not Own: Product/legal decisions for #2073's own acquisition/custody/donation model (owned by #4059); column-by-column schema (owned by /docs/reference/content-pipeline-rights-data-dictionary.md and the member-submission/content-pipeline-storage-model docs below); the #3551 pipeline's own operational detail (owned by /docs/ops/as-built/gehrig-content-collection-rights-pipeline-as-built-3826.md)
Canonical Reference: /docs/ops/as-built/gehrig-content-collection-rights-pipeline-as-built-3826.md
Related Issues: #2073, #3551, #3552, #3553, #3597, #3598, #3827, #4058, #4059, #4060, #4061, #4062, #4063
Last Reviewed: 2026-09-02
---

# Content/rights runtime as-built (#2073 Work Package item 1)

## Purpose

#2073 ("Advanced Gehrig content collection and media/archive acquisition") is a program-level issue that inherits the content-collection/rights foundation #3551 already built, rather than starting from nothing. Before #2073's later work packages design new schema or behavior, this reconciles what exists today across all three of the repository's content-tracking systems, how they relate (or explicitly don't), and which parts are safe to reuse vs. genuinely new ground for #2073's physical-archive/donation/loan scope.

This is documentation only. It makes no product or policy decision — those are #4059's job.

## The three systems, and how they actually relate

### 1. `content_items` / `rights_evidence` / `media_assets` / `sources` — the #3551/#3552 pipeline

Fully covered by `/docs/ops/as-built/gehrig-content-collection-rights-pipeline-as-built-3826.md` (as-built, current). Summary for #2073's purposes: this is LGFC's own **web-sourced discovery** pipeline — six allowlisted sources, metadata-only discovery, human-recorded channel-scoped rights conclusions, approved-only B2 ingestion. It has no concept of a donor, a physical object, custody, or a loan. `content_items.source_type`/`source_url` assume a URL-addressable web source; there is no field for "arrived in the mail" or "dropped off at a meeting."

**As of this writing**, #3551 and its child issues (#3552, #3826, #3837, #3827) are all closed or complete: 15 of 15 original acceptance criteria have direct evidence (see #3551's 2026-09-01/09-02 comment lineage), and #3827 (curator hold-queue admin UI) is implemented via PR #4057 at `src/app/admin/rights-review` (merged once that PR lands on `main`).

### 2. The legacy `photos` table and Weekly Matchup

`photos` (migration 0003, extended through 0007/0053/0056/0064) is a separate, older table that has always driven the homepage Weekly Photo Matchup (`weekly_matchups`, migration 0018) directly — `weekly_matchups.photo_a_id`/`photo_b_id` are plain integer FKs into `photos`, predating `content_items` (migration 0042) entirely. **The two were never wired together as a matter of original design** — they are independently-evolved systems that happen to often describe the same underlying B2 objects.

They are bridged, one-directionally, by a real, tested, currently-running mechanism:

- `functions/_lib/photos-rights-reconcile.ts`'s `RECONCILE_PHOTOS_RIGHTS_FROM_MEDIA_ASSETS_SQL`, run by `scripts/ops/reconcile-photos-rights-from-media-assets.mjs` (#3552/#3553/#3597/#3598), wired into the daily B2→D1 sync (`b2-d1-daily-sync.yml`). It matches `media_assets.b2_key = photos.photo_id` and, when `media_assets` is rights-cleared, copies that clearance onto the matching `photos` row (`rights_hold`, `publication_eligible`, `rights_status`, `reviewed_by`, `reviewed_at`, `rights_hold_reason`) — and, as of 2026-09-02, also `is_matchup_eligible` (previously the one field this bridge didn't touch, which was the entire reason Weekly Matchup showed "No matchup available this week" despite real, recorded rights clearances already existing).
- This is idempotent and one-directional: it never invents a decision, only copies one already recorded via `rights_evidence` onto the legacy row that the public-facing matchup code actually reads.

**For #2073**: if archive-acquisition photos need to ever appear in Weekly Matchup or any other `photos`-table-driven surface, this bridge is the existing, working mechanism — extend it (as 2026-09-02's fix did) rather than building a second one. Any new `photos`-adjacent table introduced by #2073 should be designed to flow through the same B2-key-matching reconciliation, not a parallel sync job.

### 3. Member submissions — #2270's separate rights model

`input_stream = 'member_submission'` (candidate/`photos` rows submitted by fan-club members, not LGFC-discovered) has its own rights model, fully documented at `/docs/reference/content/member-submission-content-model.md`. Key distinction from #3551: a member's `rights_choice` (`member_owns_full_grant` vs `external_source_needs_evaluation`) is the member's own attestation, made at submission time, not a channel-scoped conclusion an LGFC reviewer records after independent verification. `recordRightsEvidence` (the low-level, ungoverned primitive) is what member-submission writers call; `recordGovernedRightsEvidence` (which enforces the channel-when-conclusion rule) is reserved for #3551's own governed/external-source callers and must not be used for member submissions.

**For #2073**: a donation or loan is neither of these. It is not LGFC discovering already-published web material (#3551's model), and it is not a member asserting ownership of something they're uploading themselves (#2270's model) — it's a third party transferring custody of a physical item to LGFC, which needs its own consent/evidence model. #4059 exists specifically to decide whether that model extends `rights_evidence`'s existing vocabulary (new `evidence_type` values, e.g. a `donor_agreement` type) or needs a structurally new mechanism (e.g. a signed-document reference plus a custody-chain table `rights_evidence` has no equivalent of today).

## Admin surfaces inventory

| Route | Covers | Does NOT cover |
| --- | --- | --- |
| `/admin/content` | Site copy/CMS sections (`content_blocks`-style), unrelated to the content-collection pipeline despite the similar name | rights review, candidates, media assets |
| `/admin/media-assets` | Read-only B2 object inventory list + manual B2→D1 sync trigger | rights evidence, candidate review, any write to rights state |
| `/admin/editorial` | Member story/editorial submissions and the curated inventory that powers homepage/library sections | content-pipeline candidates, rights_evidence |
| `/admin/moderation` | Abuse reports, "Ask a question" queue, FAQ moderation | content-pipeline anything |
| `/admin/worklist` | Generic ops task tracker | content-pipeline anything |
| `/admin/rights-review` (new, #3827, PR #4057) | Curator queue for `rights_evidence` rows on `usage_decision = 'hold'`; records permit/deny (+ optional full conclusion) as new append-only rows | candidate review beyond rights (relevance, privacy, editorial fit — see `/api/admin/content-pipeline/candidates/review.ts`, no dedicated UI yet either) |

**For #2073**: none of these are archive-acquisition/custody/donation surfaces. Work package item 5 building a new admin route is genuinely new UI, not an extension of an existing one — but it should follow `/admin/rights-review`'s just-established pattern (a read-only queue endpoint + an append-only action endpoint, `requireAdmin`-gated, registered in both `AdminNav.tsx` and `scripts/launch-readiness/manifest.json`) rather than inventing a new admin-UI convention.

## What #2073's work packages 3-6 can reuse vs. must build new

**Reuse as-is:**
- `requireAdmin` auth gate for any new admin route.
- The append-only evidence-row convention (never mutate a prior determination, record a new one) — matches `rights_evidence`'s own design and should extend to any new custody/consent table.
- The `/admin/rights-review` queue-UI pattern (read-only list endpoint, separate action endpoint, no raw CRUD).
- The daily B2→D1 reconciliation bridge, if archive-acquisition media ever needs to reach a `photos`-table-driven surface.

**Extend, pending #4059's decisions:**
- `rights_evidence`'s `evidence_type`/`conclusion` vocabulary — may gain new values for donor/loan evidence, or may not, depending on #4059 question 3.
- `content_items` — may gain new `source_type`/`input_stream` values for physical acquisition, or #2073 may need a dedicated table, depending on #4059 questions 1-2 and Work package item 3's schema design.

**New ground, not covered by anything that exists today:**
- Any concept of physical custody state (offered/received/cataloged/stored/returned/deaccessioned).
- Any concept of a donor/lender identity, contact record, or agreement distinct from a `rights_evidence` reviewer's own conclusion.
- Acquisition outreach tracking (contacting a potential donor, following up, declining).
- Physical storage/preservation-partner relationship tracking, if #4059 decides this needs to be more than D1 metadata.

## #2073 Work Package issue chain

For navigation -- each item links to and is blocked on the one before it:

1. #4058 (this doc) -- as-built reconciliation. Ready to implement; not blocked.
2. #4059 -- acquisition/custody/donation operating-model decisions. Blocked on Bill/Product Authority answering its six open questions.
3. #4060 -- archive artifact metadata schema, candidate states, publication-eligibility rules, retention boundaries. Blocked on #4059.
4. #4061 -- intake/validation domain behavior, migration(s), fixtures, tests. Blocked on #4060.
5. #4062 -- admin/staging preview integration, audit/accessibility/security evidence. Blocked on #4061.
6. #4063 -- operator runbooks, rollback/recovery, acceptance exercise, promotion-candidate qualification. Blocked on #4062.

## Non-goals

This document does not authorize any #2073 implementation beyond itself (Work package item 1). It does not decide #2073's acquisition/custody/donation operating model — that is #4059. It is a snapshot as of the "Last Reviewed" date; re-verify against `main` before relying on it for anything time-sensitive, per this repository's own as-built-doc convention.
