---
Doc Type: Archive
Audience: Human + AI
Authority Level: Historical Record
Owns: Historical planning notes for future design and development
Does Not Own: Active operational authority, design, or implementation instructions
Canonical Reference: /docs/ops/pmo/diataxis-legacy-retirement-policy.md
Last Reviewed: 2026-08-06
---

# LGFC Strategic Design & Development Notes

> ARCHIVED 2026-10-26. Historical and non-authoritative. Replacement: none. Source: #4896.

This document captures planning discussions for future implementation.
It is not a build instruction set. It is a reference for when the
appropriate time arrives to expand, refine, and evolve the Lou Gehrig
Fan Club platform.

------------------------------------------------------------------------

## 1) Layout & Experience Design Direction (Future Phase)

### Public Homepage

**Purpose:** Entry point, emotional impact, conversion, and
storytelling.

**Direction:** - Maintain hero banner as the "cover" of the digital
magazine. - Under the hero, present headline-style teaser tiles. -
Teasers scroll to sections on the same page instead of routing away. -
Only route off-page for true workflows: - Join - Login - Search - FAQ -
Fundraiser campaign (external)

**Editorial tone:** - Magazine-style reading flow - Discovery via
scrolling - Large headlines + short teaser summaries - Clean hierarchy

### Fan Club Homepage (Member Area)

**Shift from greeting → Masthead concept.**

**Top area becomes:** - Static masthead title - Dynamic rotating
subtitle/headline (weekly/monthly theme)

Examples: - "This Week in the Archive" - "Member Contributions
Spotlight" - "Collector Notes"

**Content Structure:** 1. Masthead (issue-style header) 2. Top teaser
tiles (headline cards) 3. Member Contributions spotlight (central
section) 4. Deeper sections below for continued reading

**Member Contributions:** - Visually prominent - Featured
stories/photos/articles - "See more" links route to filtered search
results

### Gallery Pages

Remain separate for scale and browsing: - Library - Photos - Memorabilia

These pages support: - Large galleries - Deep browsing - Archive
exploration

### Background Styling (Post-Fundraiser Phase)

-   Archival paper texture
-   Subtle sepia tone layers
-   Faint angled scorecard overlay
-   Soft grain/noise
-   Gentle vignette edges

Design intent: - Evoke early 1900--1940 baseball era - Maintain
readability - Avoid visual clutter

------------------------------------------------------------------------

## 2) Development Environment Strategy (Dev vs Production)

### Deployment Model

-   One GitHub repository
-   One Cloudflare Pages project

Branch routing: - `main` → Production\
- www.lougehrigfanclub.com - `dev` → Staging\
- dev.lougehrigfanclub.com

### Promotion Flow

-   Work is developed on `dev`
-   When approved:
    -   Merge `dev → main`
    -   Production auto-deploys

### Dev Environment Rules

Dev is **permanently read-only**.

Dev will: - Never write to D1 - Never upload to B2 - Never modify data -
Only display layouts, features, and new page concepts

### Safeguards (Critical)

Write operations must be blocked when: - Host =
dev.lougehrigfanclub.com - Environment = Preview deployment

Blocked HTTP methods: - POST - PUT - PATCH - DELETE

Allowed: - GET - HEAD

This ensures: - Dev cannot corrupt production data - UI testing remains
realistic - No configuration drift between dev and prod

### Data Model

-   Dev reads from production D1
-   Dev reads from production B2
-   Admin and uploads occur only in production

Optional: - Add a dev/test user account to prod D1 for viewing
restricted areas

------------------------------------------------------------------------

## 3) Future Fan Club Expansion (Second Site Pattern)

Example future expansions: - Roberto Clemente Fan Club - Additional
legacy player communities

### Architecture Pattern

Each new fan club should have:

-   Separate Cloudflare Pages project
-   Separate GitHub repository (recommended)
-   Separate D1 database
-   Separate B2 bucket

Structure replicated from LGFC: - www domain - dev subdomain - main
branch → production - dev branch → staging

### Reuse Strategy

-   Base design system can be reused
-   Layout concepts ported
-   Branding + content customized

### Benefits

-   Clean data separation
-   Independent scaling
-   Easier long-term maintenance
-   Avoids cross-project risk

------------------------------------------------------------------------

## 4) Fundraiser Integration Design

### Timeline Context

-   April: Announcement phase
-   May 1: Fundraiser launch
-   June 2: Lou Gehrig Day
-   June 4: Fundraiser ends
-   June 5: Winners announced

### Campaign Placement

Homepage structure: 1. Hero banner (Welcome) 2. Campaign banner (large,
prominent) 3. Weekly vote section 4. Editorial content

Campaign area should: - Embed MLB Lou Gehrig Day page initially - Later
swap to GiveButter campaign page - Be large and visually dominant -
Provide multiple discovery paths

### Purpose

-   Maximize visibility
-   Drive donations
-   Reinforce mission
-   Tie legacy + ALS awareness

### Prize Concept Support

-   Donor participation incentives
-   Member-exclusive rewards
-   Collector engagement

### Post-Fundraiser

After June 5: - Visual redesign phase begins - Background styling
improvements - Editorial homepage enhancements - Fan club layout
evolution

------------------------------------------------------------------------

## 5) Search-Driven Content Architecture (Future Phase)

### Role of Search

Search becomes a central navigation engine, not just a utility.

It can power: - Member contributions discovery - Photo browsing -
Memorabilia exploration - Library article reading - Story collections -
Filtered category views

### Functional Model

Search results pages should support: - Filtering by content type: -
Articles (Library) - Photos - Memorabilia - Stories - Weekly features -
Sorting: - Newest → Oldest (default) - Most viewed (future) - Most
engaged (future)

### Homepage Integration

Homepage sections use search as their backend:

Examples: - "See more contributions" → search filtered to all member
content - "Keep reading" → search filtered to that category - "View
archive" → search filtered to full historical content

This avoids creating many separate static pages.

### Benefits

-   One system powers multiple experiences
-   Infinite scalability
-   Less maintenance
-   Consistent layout patterns

### Long-Term Vision

Search becomes the universal content viewer: - Dynamic result pages
replace rigid section pages - Users browse the archive fluidly - New
content types can be added without redesign

------------------------------------------------------------------------

## Additional Notes

Key guiding principle: - Production stability first - Fundraiser
visibility prioritized - Design upgrades staged after campaign success

This document is intended to preserve strategic decisions and future
direction for implementation at the appropriate time.
