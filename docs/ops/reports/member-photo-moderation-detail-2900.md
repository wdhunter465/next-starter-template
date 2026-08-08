---
Doc Type: Operations Report
Audience: Bill, Day-2 Operations, Implementation/Operations, PMO/Engineering
Authority Level: Controlled
Owns: #2900 evidence — moderation + photo-detail implementation on component/member-photo-experience
Does Not Own: Production activation, member upload UI on /fanclub/submit, #2901 qualification
Canonical Reference: /docs/ops/reports/member-photo-moderation-detail-2900.md
Related Issues: #2857, #2898, #2899, #2900, #2901, #3119
Last Reviewed: 2026-08-08
---

# Member photo moderation and detail (#2900)

## Purpose

Record the #2900 bounded implementation that connects pending member photos to
authorized admin moderation and delivers a linkable, keyboard-accessible photo
detail experience with attribution.

## Scope

In scope on `component/member-photo-experience`:

- admin pending list + approve/reject APIs and `/admin/photos` queue UI;
- published-only hardening for tags/memorabilia/public get/list;
- gallery deep-link detail panel with credit/attribution and unavailable state.

Out of scope: Production activation, `/fanclub/submit` binary upload UI,
lightbox vendor dependency (native detail panel used instead).

## Current known truth

- Upload/quarantine + published-only gallery list filters landed via #2899/#3123/#3218.
- #2900 adds moderation review transitions (`pending` → `published`/`rejected`)
  with `reviewed_*` metadata and optional B2 promote (tests use
  `skip_object_promote`).
- Gallery thumbnails open `/fanclub/photo?id=` detail panel with Prev/Next/Escape.

## Intended final state

Only approved photos are visible on member/public read paths covered by this
task; operators can moderate pending rows without Production mutation; members
can open attribution-aware detail views accessibly. #2901 owns candidate
qualification / rollback rehearsal / Production handoff.

## Rollback

Revert the #2900 child PR. Migration `0045` columns remain inert for unpublished
rows; quarantine objects stay non-public; staff `published` gallery behavior
remains. Disable `/admin/photos` review path if needed without touching schema.

## Validation

- `npx vitest run tests/member-photo-moderation.test.ts tests/photo-detail-experience.test.tsx tests/member-photo-read-visibility.test.ts`
- `npx tsc --noEmit -p tsconfig.json`
- `git diff --check`
