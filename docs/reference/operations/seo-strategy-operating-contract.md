---
Doc Type: Reference
Audience: Product Authority, PMO, editors, and implementation agents
Authority Level: Controlled
Owns: SEO strategy operating contract for #2291 — positioning, pillars, activation control, and launch-packet boundaries
Does Not Own: Public metadata rewrites, sitemap or robots changes, archive restructuring, schema markup implementation, or automatic indexing
Canonical Reference: /docs/reference/content/lgfc-content-candidate-model.md
Related Issues: #2291, #2292, #2270, #2039, #1738, #2040
Last Reviewed: 2026-09-24
---

# SEO strategy operating contract

## Purpose

Freeze the approved operating contract for LGFC SEO strategy and PMO activation control (#2291). This document is the Launch Packet for strategy-to-implementation sequencing. It does not authorize public content changes, metadata rewrites, sitemap edits, archive restructuring, or automation.

## Scope

In scope: authority-first positioning; content pillars; page-level intent; technical SEO evaluation checklist; URL and image-field boundaries; sequencing after #2292 approved asset metadata; activation control; identified later children.

Out of scope: competing as a generic ALS medical site, Yankees news site, MLB history site, or AI-generated trivia farm; indexing `/admin/`, `/fanclub/`, `/api/`, or `/_ai-review/`; using unreviewed AI tags from #2292; automatic publication (#2040).

## Current known truth

- Product Authority 2026-09-24 placed #2291 Active at `pmo:priority:4` with Cursor as implementation owner (due 2026-10-31). Claude ownership is withdrawn.
- Design Ready evidence already lives on #2291. Sandbox Testing is not required for this documentation packet.
- Live public crawl control today: `src/app/robots.ts` allows `/` and disallows `/admin/`, `/fanclub/`, `/api/`, `/_ai-review/`; `src/app/sitemap.ts` emits `PUBLIC_SITEMAP_ROUTES` only. This packet does not change those files.
- Image/asset SEO fields (filename, alt text, caption, credit, tags) consume the approved metadata set in `docs/reference/operations/ai-assisted-tagging-operating-contract.md` (#2292). Unreviewed candidate tags are not SEO-eligible.
- Runtime SEO implementation remains No-Go until Product records an explicit later Go on a file-allowlisted child Issue.

## Intended final state

The public website is the clearest public web authority for Lou Gehrig fan history, memorabilia, photos, milestones, community activity, and ALS-supportive fan engagement. Search surfaces consume reviewed public inventory only. Private member and admin surfaces stay out of the sitemap.

## Positioning

Primary identity: Lou Gehrig Fan Club.

Search identity terms recorded on #2291: Lou Gehrig Fan Club; photos; memorabilia; history; milestones; quotes; timeline; ALS awareness; community; Lou Gehrig Day; baseball legacy.

Positioning statement recorded on #2291: a fan-led historical and community archive celebrating Lou Gehrig’s life, baseball legacy, character, and continuing connection to ALS awareness.

## Content pillars

| Pillar | Purpose |
| --- | --- |
| Lou Gehrig Legacy | Biography, milestones, quotes, career moments |
| Archive & Memorabilia | Photos, documents, cards, clippings, collectibles |
| Fan Community | Weekly Matchup, discussions, member activity, social wall |
| ALS Support & Awareness | Charities, Lou Gehrig Day, fundraising, partner links |

Charities/ALS copy supports awareness and partners. It does not become a medical explanation site.

## Page-level intent (activation checklist, not a route rewrite)

| Surface | Intent |
| --- | --- |
| Homepage `/` | Brand authority and routing; H1 Lou Gehrig Fan Club when Product Go authorizes metadata work |
| Milestones (home section and any later dedicated public route) | Evergreen historical search with date, event, short explanation, provenance |
| Weekly Matchup | Recurring engagement and image SEO; descriptive alt text; stable archive URLs when Product Go authorizes |
| Gallery / Archive | Long-tail asset SEO after approved metadata exists |
| Join | Public conversion entry; does not depend on private social-platform discoverability |

Strategy URLs listed on #2291 (`/milestones`, `/weekly-matchup`, `/archive/...`) are activation targets. They are not authorized new public routes from this packet.

## Technical SEO evaluation list (when a later child is Go)

Clean page titles; unique meta descriptions; Open Graph/social cards; XML sitemap; `robots.txt`; canonical URLs; one H1 per public page; descriptive image alt text; fast static pages; mobile-first layout; no broken internal links; no private/admin/staging/AI-review routes indexed; public routes only in the sitemap; stable slugs for public content.

## Image SEO fields (approved metadata only)

Filename (search-readable); alt text; caption; credit; tags. Opaque camera filenames are not publication filenames. Promotion of these fields requires #2292 approved metadata, not AI candidate columns.

## Sequencing

| Order | Work | Owner |
| --- | --- | --- |
| 1 | Reviewed digital-asset metadata | #2292 |
| 2 | SEO activation against approved public inventory | #2291 |
| Parallel hold | Automatic publication | #2040 remains paused unless Product Go |

## Identified later children (not opened by this packet)

| Slice | Work |
| --- | --- |
| #2291-001 | This operating contract (this PR) |
| #2291-002 | Public title/description/H1 inventory vs live routes (docs then bounded metadata PR) |
| #2291-003 | Confirm sitemap/robots allowlist vs live `PUBLIC_SITEMAP_ROUTES` (no private leak) |
| #2291-004 | Image alt/credit application on already-public inventory after #2292 approved fields exist |

Do not start slices 002–004 without an exact file-touch allowlist on a live child Issue and Product Go for that slice.

## Validation

This packet is valid when positioning and pillars match #2291; private-route exclusion is explicit; #2292 approved-metadata dependency is explicit; no sitemap, robots, or public copy change is in the same PR.

## Rollback

Revert the documentation commit. No crawl or public-copy state is created by this packet.

## Operations handoff

Operators do not submit private routes to search consoles. Member Club Home (`/fanclub`) remains disallowed. There is no new on-call component from this packet.

## Project Go / No-Go

| Decision | Status |
| --- | --- |
| Documentation Launch Packet (this file) | Product 2026-09-24 Active assignment is the Go for this docs packet |
| Public metadata, sitemap, robots, archive routes, schema markup | No-Go until a later child Issue records Product Go |

## Protected stops

Stop for: treating this file as authorization to change public HTML/metadata; indexing member/admin surfaces; SEO from unreviewed AI tags; mixing #2292 schema/runtime into this PR.
