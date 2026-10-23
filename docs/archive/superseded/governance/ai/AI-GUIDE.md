---
Doc Type: Archived Governance
Audience: Human + AI
Authority Level: Historical
Owns: Historical build prompt only
Does Not Own: Agent routing, design authority, or current implementation instructions
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Archived From: /docs/governance/ai/AI-GUIDE.md
Archived Reason: Last live file in the legacy governance/ai folder. Archived under #4138. Design standards named by Agent.md remain the authority.
Last Reviewed: 2026-10-23
---

> **ARCHIVED (#4138, 2026-10-23):** Historical build prompt. Not agent routing authority. Current authority: `Agent.md` → `docs/governance/REPOSITORY-AUTHORITY.md`.

MASTER BUILD PROMPT — LOU GEHRIG FAN CLUB PLATFORM

You are a senior full-stack engineer responsible for building a production-ready website and operations platform for the Lou Gehrig Fan Club (LGFC). This is a historical baseball community site centered on Lou Gehrig’s life, legacy, statistics, memorabilia, and fan engagement. The system must be stable, simple to operate, and designed for long-term continuity.

SOURCE OF TRUTH (NON-NEGOTIABLE)

• The repository’s locked design/route/navigation standards documents are the source of truth.
• Implement exactly as written. Do not invent or change navigation, routes, layouts, labels, or section order if it conflicts with the repo standards.
• If this prompt conflicts with repo standards, the repo standards win.

Your objective is to:

• Evaluate the existing repository
• Verify connectivity to:

Cloudflare Pages

Backblaze B2 public bucket
• Create an /archive folder at the repository root and move all unused files into it
• Then build a deployable, maintainable public website with a Fan Club area and admin tools

Follow these instructions exactly.

PRIMARY MISSION

Build a public fan community website that:

• Celebrates Lou Gehrig’s baseball career and life story
• Focuses on baseball history, stats, memorabilia, and storytelling
• Encourages fan participation and community engagement
• Avoids medical/ALS content except historical references to Gehrig himself
• Supports membership growth and long-term sustainability

This is NOT a blog.
This is a structured, interactive historical fan platform.

CORE ARCHITECTURE

Build using this stack:

Frontend
• Next.js (App Router)
• TypeScript
• Component-based layout
• Clean, responsive design

Hosting
• Cloudflare Pages (public site)

Data
• Cloudflare D1 database

Media Storage
• Backblaze B2 (images, memorabilia, historical photos)

Authentication (Day 1 / implementation-aligned)
• Email-based join/login flow that results in an authenticated “member state” used to gate Fan Club pages
• All /fanclub/** routes require authentication
• Unauthenticated users must be redirected to the Join/Login experience

Repository
• GitHub public repository
• CI/CD deployment via Cloudflare

SITE STRUCTURE

Create the following main sections:

Public Pages:
• Home
• About Lou Gehrig Fan Club (Fan Club history / purpose)
• Join + Login experience (may be one combined page)
• Contact / Support (may be one combined page)
• Legal (Terms / Privacy)
• FAQ

Fan Club Pages (Authentication Required):
• Fan Club Home
• Member Profile page with Membership Card display

Admin Area:
• Content moderation
• FAQ management
• Photo upload/tagging
• Event creation
• Member submission management
• Data visibility dashboards

Store:
External link to:
https://www.bonfire.com/store/lou-gehrig-fan-club/

HOMEPAGE STRUCTURE

The homepage must include:

• Hero banner introducing the club
• Weekly Photo Matchup Voting section
• Join the Club section
• About Lou Gehrig section (Gehrig-focused content belongs on Home)
• Social Wall
• Weekly Article section
• Friends of the Fan Club section
• Events Calendar section
• FAQ preview (top viewed questions)
• Footer with legal + navigation

This page must feel like an active community hub.

PUBLIC SITE CORE FEATURES

A) Weekly Photo Matchup
• Two historical photos displayed
• Visitors vote (members and non-members allowed)
• Enforce one vote per person per week using the current hash model:

hash(week_start + ip + user_agent) stored as source_hash

unique constraint on (week_start, source_hash)
• If abuse becomes a problem, evolve later (no redesign now)

B) Join the Club
• Encourages visitors to join the fan club
• Button linking to the Join/Login experience

C) About Lou Gehrig (Homepage section)
• Admin-managed content
• Images supported

D) Social Wall
• Elfsight widget integration

E) Weekly Article
• Article #1 displayed from Library

F) Friends of the Fan Club
• Six tiles displayed with links to external URLs

G) Events Calendar
• Display next ten events from current date

H) FAQ System
• Searchable
• Admin-approved answers
• View count tracking
• Ability to pin important questions
• Ability to ask a question (collect email + question text)

FAN CLUB HOMEPAGE STRUCTURE

The Fan Club homepage must include:

• Member Chat submission section
• Member Chat display section
• Article display section
• Member Article submission section
• Photo library access section
• Memorabilia library section
• Book Library section

FAN CLUB CORE FEATURES

A) Member Chat
• Text entry field
• Submit / Cancel buttons
• Blog-style display
• Newest entries shown first
• Posts are auto-approved and visible immediately
• Members can report posts (Day 1 requirement)
• Admin can hide/remove posts
• Maintain audit trail of hidden/removed posts and reports

B) Daily Article
• Article #2 displayed from Library
• Member article submission (file attachments allowed)
• Store associated authenticated member email

C) Photo Gallery
• Historical photos
• Tagged by year, event, location
• Categorized and searchable
• Members can report incorrect tags/content (Day 1 requirement)

D) Memorabilia Archive
• Images stored in B2
• Tagging + descriptions stored in D1
• Categorized and searchable
• Descriptions can be long and must display below image

E) Library
• Catalog of written material about Gehrig or where Gehrig is referenced
• Tagged by Year, Event, Location, Author
• Categorized and searchable

MEMBER PROFILE STRUCTURE

The Member Profile page must include:

• Member Identity
• Membership Card
• Member Uploads

A) Member Identity
• First name, last name, email
• Preferred screen name
• Profile picture
• Short bio

B) Membership Card
• Instructions on how to obtain the free membership card

C) Member Uploads
• Upload articles (store in Library)
• Upload photos to Gallery
• Upload memorabilia images + descriptions
• Store B2 URL in D1 plus metadata (tags/description/status)

Content Rights (must align to current Terms)
• Do NOT claim ownership transfer in UI copy.
• Use Terms-consistent language: users grant permission/license for the site to store and display submitted content.

ROLES & AUTHORIZATION (implementation-aligned)

Role-based access stored in database.

Roles (Day 1):
• member
• admin

Admin Access Control (Day 1):
• Admin APIs are protected by an admin token (header-based).
• DB role remains the source-of-truth for who is an admin.
• (If both are used, fail closed: token required; DB role required.)

FILE UPLOAD STANDARDS (SECURITY BEST PRACTICES)

Enforce strict allowlist validation, server-side size limits, and type checking.
Never trust client-provided metadata.

Profile Pictures:
• Types: JPEG, PNG, WebP
• Max size: 2 MB

Photo Gallery Images:
• Types: JPEG, PNG, WebP
• Max size: 10 MB

Memorabilia Images:
• Types: JPEG, PNG, WebP
• Max size: 15 MB

Article Attachments:
• Allowed type: PDF only
• Max size: 10 MB

Global Protections:
• Limit uploads per member per day
• Generate new filenames server-side
• Store all media in Backblaze B2
• Serve files with correct MIME type and headers

DESIGN PRINCIPLES

• Clean, respectful, historical tone
• Blue primary color theme
• Baseball-heritage aesthetic
• Mobile-first layout
• Fast load times
• Minimal technical complexity

COLOR PALETTE

Primary Brand Color
LGFC Blue: #0033cc
(Used for header, primary buttons, links, accents, dividers)

Support Colors:
• White: #ffffff
• Light Gray: #f5f7fb
• Dark Text: #111111 to #222222
• Medium Gray: #666666
• Success: #1f7a1f
• Warning: #cc9900
• Error: #cc3333

DATA MODEL REQUIREMENTS

Create D1 tables for:

• members (role-based)
• matchups, weekly_votes
• faq_entries (+ view count, pinned)
• events
• library_items (articles)
• photo_assets (+ tags)
• memorabilia_assets (+ tags + descriptions)
• member_chat_posts
• reports (unified: posts/photos/tags)
• admin audit / flags

ACCEPTANCE CRITERIA

The project is considered complete when:

• Public site loads and navigates cleanly
• Weekly voting works end-to-end
• FAQ search + pinning works
• Join/Login works and Fan Club area is gated
• Member Chat is live + reportable Day 1
• Photo/tag corrections are reportable Day 1
• Media loads from B2
• D1 persists all data correctly
• Site deploys automatically via CI/CD

DELIVERY EXPECTATION

Provide:

• Full repo structure
• All pages implemented
• D1 schema/migrations
• Environment configuration
• Deployment instructions
• Operational documentation

Build as if another engineer must maintain it for 20+ years.
