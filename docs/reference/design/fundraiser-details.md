---
Doc Type: Reference
Audience: Human + AI
Authority Level: Canonical Design Specification
Owns: `/fundraiser-details` page contract, its data source and its states
Does Not Own: Fundraiser program rules; prize and giveaway policy; the homepage teaser; content publishing workflow
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related issues: #4824, #4822, #4409
Last Reviewed: 2026-10-23
---

# Page Spec — Fundraiser Details (`/fundraiser-details`)

## Purpose
Public page listing the daily prize, giveaway and contest updates for the 2027 Lou Gehrig Day fundraiser, newest first. The homepage carries a hidden teaser for the same feed (`#fundraiser-daily-details`, accepted 2026-10-14, #4409, D-038); see `home.md`.

## Route / Path
- Route: `/fundraiser-details` (trailing-slash canonical path `/fundraiser-details/`)
- Page: `src/app/fundraiser-details/page.tsx`
- Metadata: `src/app/fundraiser-details/layout.tsx` (canonical metadata for `/fundraiser-details/`)

## Section / Component Breakdown
- Shell: `src/components/PageShell.tsx`, title "Fundraiser Details", subtitle "Daily prize, giveaway, and contest updates for the 2027 Lou Gehrig Day fundraiser — newest post first"
- Feed: `src/components/fundraiser/FundraiserDailyDetailsFeed.tsx`, rendered with `limit={100}` and no heading
- Homepage teaser (separate contract): `src/components/home/FundraiserDailyDetailsTeaser.tsx`

## Data Dependencies
- `GET /api/fundraiser-details/list?limit=N` (`functions/api/fundraiser-details/list.ts`).
- Reads `content_blocks` rows with `page='home'`, `section='fundraiser-daily-details'` and `status='published'`, ordered by `published_at` descending.
- Limit defaults to 30 and is clamped to 100. An invalid value falls back to the default.
- Fields used: `title`, `published_body_md`, `image_url`, `image_alt`, `published_at`.
- The feed fetches with `cache: 'no-store'`.

## Auth / Access Expectations
- Publicly visible. No member authentication required.

## States
- Loading: "Loading fundraiser updates…"
- Empty: "No fundraiser updates posted yet — check back soon."
- Fetch failure: "Error loading fundraiser updates."

## Key UX / Behavior Notes
- Only published posts appear. Newest post first.
- The page is not in the locked homepage order; it is a standalone public route.
