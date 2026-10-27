---
Doc Type: Design Reference
Audience: Human + AI
Authority Level: Planning Draft
Owns: Program 3 Club Home page design candidate, newspaper-style club homepage layout, Club Home feature links, section source mapping, backend source model, content rotation, and content reuse strategy
Does Not Own: Runtime implementation, D1 migrations, B2 bucket configuration, production secrets, final Program 3 prioritization, issue creation, or launch approval
Canonical Reference: /docs/ops/pmo/PMO-V2-OPERATING-MODEL.md
Related Issues: #1255, #1379, #1411, #4776
Last Reviewed: 2026-10-26
---

# Program 3 — Club Home Page Design

## Purpose

Define the Program 3 candidate design for the authenticated Fan Club home page.

The Club Home page should operate as a newspaper-style member landing page that reuses approved LGFC content from durable backend sources instead of creating one-off page copy.

This document is a Program 3 portfolio project candidate. It does not launch implementation or authorize issue creation.

## PMO v2 placement

Program 3 is a rotating portfolio planning/execution lane. The Club Home page design belongs in Program 3 because it is an approved portfolio-style project candidate that can build on Program 2 website/content infrastructure and Program 1 PMO execution controls.

This project should not be placed in Program 5 unless Product Authority decides it is not yet portfolio-ready.

## Existing production feature-link design authority

The Club Home feature links point to existing Fan Club feature pages that already have production design coverage in `docs/reference/design/fanclub-subpages.md`.

| Club Home feature link | Destination route | Existing design status | Existing source authority |
| --- | --- | --- | --- |
| Gallery | `/fanclub/photo` | Production destination-page design exists | `docs/reference/design/fanclub-subpages.md` |
| Library | `/fanclub/library` | Production destination-page design exists | `docs/reference/design/fanclub-subpages.md` |
| Memorabilia | `/fanclub/memorabilia` | Production destination-page design exists | `docs/reference/design/fanclub-subpages.md` |

Program 3 does not need to redesign those destination pages before using them as Club Home feature links. Program 3 does need to define the Club Home card/link presentation, source logic, ordering, rotation, and empty-state behavior.

## Intended user experience

The authenticated Club Home page should feel like a Fan Club newspaper front page:

- current lead story or feature;
- historical Lou Gehrig content;
- member/community prompts;
- photo, memorabilia, and archive highlights;
- recent or featured discussions;
- campaign/fundraiser modules when active;
- calendar or event callouts;
- recognition or partner modules when relevant.

The page should prioritize freshness, rotation, and reuse while preserving editorial control.

## Newspaper-style layout model

Recommended section order:

| Order | Section | Purpose |
| --- | --- | --- |
| 1 | Masthead / Club Home hero | Establish authenticated Fan Club context and current editorial focus. |
| 2 | Lead story | Primary current or historical feature selected from approved content inventory. |
| 3 | Secondary story rail | Smaller supporting stories from the same content inventory. |
| 4 | Feature link cards | Link members to Gallery, Library, and Memorabilia using existing production destination-page design authority. |
| 5 | Photo / memorabilia feature | Rotating media item with source, credit, and context. |
| 6 | Member prompt / discussion starter | Prompt members to participate, submit, or discuss. |
| 7 | Archive spotlight | Surface older Lou Gehrig content by date, tag, anniversary, or editorial priority. |
| 8 | Campaign / fundraiser module | Display only when an active campaign or charity operation is configured. |
| 9 | Events / calendar callout | Show upcoming LGFC or Lou Gehrig related events. |
| 10 | Recognition / partner tile | Optional module for honors, partner, donor, volunteer, or Friends of the Fan Club content. |
| 11 | Submission CTA | Invite members to submit photos, stories, memorabilia, or leads. |

## Club Home feature-link card model

| Card | Link target | Card source | Content behavior |
| --- | --- | --- | --- |
| Gallery | `/fanclub/photo` | Static route target plus optional D1 `photos` count or latest approved image | Shows a short label, thumbnail or count when available, and links to the existing Photo Gallery page. |
| Library | `/fanclub/library` | Static route target plus optional D1 `content_inventory` count or latest library story | Shows a short label, latest story title or count when available, and links to the existing Library page. |
| Memorabilia | `/fanclub/memorabilia` | Static route target plus optional D1 `photos` memorabilia-tagged count or latest item | Shows a short label, memorabilia image or count when available, and links to the existing Memorabilia page. |

Feature-link cards should degrade to static links if counts or thumbnails are unavailable. The feature-link section should not block Club Home rendering when D1/B2 data is missing.

## Backend source map

| Page section | Primary source | Secondary source | Notes |
| --- | --- | --- | --- |
| Masthead / hero | D1 `page_content` or static page config | D1 `content_inventory` | Hero copy should remain editorially controlled. |
| Lead story | D1 `content_inventory` | B2 media referenced by content record | Must use published, approved inventory records only. |
| Secondary story rail | D1 `content_inventory` | Search/index metadata | Should reuse same story model as public homepage/library. |
| Feature link cards | Static route config | D1 `photos`, D1 `content_inventory`, B2 thumbnails | Links to existing production pages: `/fanclub/photo`, `/fanclub/library`, `/fanclub/memorabilia`. |
| Photo / memorabilia feature | D1 `photos` or `content_inventory` media associations | B2 media assets | Should include source, credit, caption, and related story link where available. |
| Member prompt | D1 `page_content` or discussion seed table if created | Manual admin content | Should be manually curated until discussion automation is explicitly designed. |
| Archive spotlight | D1 `content_inventory` | D1 milestone/event metadata | Uses event date, year, tags, rotation group, and last featured metadata. |
| Campaign / fundraiser module | D1 campaign config or static JSON campaign data | Givebutter links / manually entered snapshots | Must not store donor PII. Display only approved campaign summary data. |
| Events / calendar callout | D1 `events` | External event reference URLs when approved | Should fail closed if no approved event exists. |
| Recognition / partner tile | D1 `page_content`, partner/friend records, or future recognition table | B2 logo/image assets | Requires display rules before donor/partner recognition is automated. |
| Submission CTA | Static route/config plus D1 submission queue status | Auth/session state | Should route members to approved submission surfaces. |

## D1 source expectations

Likely D1 sources:

- `content_inventory` for story-first editorial content;
- `submission_queue` for member-submitted content before approval;
- `photos` for legacy or direct photo records where still active;
- `library_entries` where existing Fan Club library content remains separate;
- `media_assets` or equivalent B2 mapping table for reusable images/files;
- `page_content` for curated module copy;
- `events` for calendar callouts;
- future recognition/partner tables only if Program 3 approves that project.

## B2 source expectations

B2 should provide durable media storage for:

- story images;
- photo/memorabilia assets;
- thumbnails or derivative images;
- partner/friend logos where approved;
- downloadable or archival files where allowed.

The Club Home page should not hardcode B2 URLs directly in component markup where a D1 record can own the media association, caption, source, and credit.

## Other source expectations

Other sources may include:

- Givebutter campaign links and manually curated campaign snapshots;
- external source URLs for historical references;
- Elfsight or social embeds only if already approved by CSP and design authority;
- static JSON only as a temporary bridge when D1 authority is not ready.

External systems should not be treated as canonical LGFC content authority unless the PMO/program design explicitly says so.

## Content rotation strategy

The Club Home page should reuse approved content using objective metadata plus editorial control.

Recommended rotation inputs:

- `allowed_sections` includes `club_home` or equivalent;
- `priority` / `feature_weight`;
- `story_type`;
- `tags`;
- `event_date` / `event_year`;
- `rotation_group`;
- `last_featured`;
- canonical vs alternate-perspective status;
- publication status;
- source/credit completeness;
- media availability.

Rotation must not publish unapproved content. Automation may assist with selection but should not decide historical truth, editorial value, or publication status.

## Content reuse strategy

The Club Home page should reuse the same durable story and media records used by:

- public homepage sections;
- Fan Club library;
- search;
- memorabilia/photo pages;
- campaign/anniversary features;
- future recognition or event modules.

A story should not be duplicated simply because it appears in multiple sections. Placement should be controlled by metadata and section allowlists.

## Editorial rules

- Only approved/published content appears on the Club Home page.
- Source and credit fields must display where legally or editorially required.
- Member submissions must pass through review before publication.
- Canonical stories and alternate perspectives may appear together only when attribution and context are clear.
- Campaign/fundraiser content must avoid donor PII and use approved public metrics only.
- Recognition/partner content requires display rules before automation.

## Implementation boundaries

This design does not authorize implementation.

Future implementation issues must define:

- exact route/component files;
- D1 query utilities;
- B2 media mapping behavior;
- feature-link card behavior and fallbacks;
- fallback states;
- section-level acceptance criteria;
- tests for content selection and empty states;
- manual verification path for authenticated and unauthenticated access.

## Readiness status

| Area | Status |
| --- | --- |
| Newspaper layout concept | Drafted |
| Club Home feature links | Drafted; destination pages already have production design authority |
| Backend source map | Drafted |
| D1/B2/other source strategy | Drafted |
| Content rotation strategy | Drafted |
| Content reuse strategy | Drafted |
| Implementation issue(s) | Not created |
| Program 3 launch authority | Not granted |

## Open questions

1. Should Club Home be the top-priority Program 3 project?
2. Should Club Home reuse public homepage content directly or use a member-only section allowlist?
3. Should campaign/fundraiser content appear on Club Home only during active campaigns?
4. Should member discussion prompts be manual only at launch?
5. Should partner/recognition modules wait until their own Program 3 docs are complete?
