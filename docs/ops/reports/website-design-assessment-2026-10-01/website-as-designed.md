---
Doc Type: Operations
Audience: Human + AI
Authority Level: Supporting (assessment record; not design authority)
Owns: The as-designed requirements inventory compiled from the repository design documents as of 2026-10-01
Does Not Own: Product design intent, locked design specifications under docs/reference/design/**, remediation decisions, or application code
Canonical Reference: /docs/governance/PRODUCT-AND-DESIGN.md
Related issues: #4409
Last Reviewed: 2026-10-01
---

# As-Designed: Lou Gehrig Fan Club website

**What this is.** The website as the club's own design documents say it should be. It is compiled only from the repository's design authority; nothing here comes from observing the running site. The companion document `website-as-built.md` records what is actually deployed and lists every difference, citing the requirement IDs below (for example `AD-STYLE-04`).

**Sources (all in `wdhunter465/next-starter-template`):**
| Code | File | Authority |
| --- | --- | --- |
| `PDS` | `docs/reference/design/LGFC-Production-Design-and-Standards.md` | Primary production-behaviour hub (last reviewed 2026-08-08) |
| `STY` | `docs/reference/design/style-guide.md` | Style tokens and visual language (2026-02-20) |
| `LOCK` | `docs/reference/design/locks/header-memberheader-logo-banner-design-lock.md` | Header / logo / banner "do not regress" lock |
| `HOME` | `home.md`, `home-friends.md`, `home-milestones.md`, `home-calendar.md`, `home-discussions.md`, `home-temporary-campaign-section.md`, `als-fundraiser-2026-campaign-spotlight.md`, `logo-homepage-behavior.md` | Homepage specs |
| `AUTH` | `auth-model.md`, `auth-and-logout.md`, `join-login.md` | Auth specs (auth-model is canonical) |
| `FAN` | `fanclub.md`, `fanclub-home.md`, `fanclub-subpages.md` | Member-area specs |
| `PAGE` | `search.md`, `text-pages.md`, `faq-and-ask.md`, `error-404.md`, `health.md`, `weeklyvote-results.md` | Public page specs |
| `ADM` | `dashboard.md` | Admin spec (marked INCOMPLETE) |
| `RAT` | `docs/explanation/lgfc-design-evolution.md`, `docs/governance/PRODUCT-AND-DESIGN.md` | Rationale and governance (non-binding for visuals) |

Authority order inside the repo: Product Authority decisions → `PRODUCT-AND-DESIGN.md` → `PDS` → topic specs (`HOME`, `AUTH`, `FAN`, `STY`, …) → issue allowlists → rationale. Where two documents disagree, section "Conflicts inside the design documents" at the end records it.

---

## AD-PLAT — Platform
- **AD-PLAT-01** Production runtime is Cloudflare Pages plus Pages Functions: Next.js builds static routes/assets; read/write APIs are `functions/api/**`. The site is not purely static (auth, join/login, CMS reads, footer quote and member flows need the APIs). *(PDS)*
- **AD-PLAT-02** Primary datastore is Cloudflare D1. Day-1 tables: `members`, `member_sessions`, `join_requests`, `photos`, `library_entries`, `content_inventory`, `submission_queue`, `membership_card_content`. Memorabilia is **not** a table: it is a tagged view of `photos`. `content_inventory` is the editorial archive/library authority; `library_entries` is legacy and must not be orphaned. The membership card is **not** a page: instructions text plus front/back card images shown on `/fanclub/myprofile`. *(PDS)*
- **AD-PLAT-03** Three zones with distinct feel: **Public** (classic, clear, dignified, story-first), **Fan Club member area** (member-centred, editorial, simple, protected), **Admin** (functional, protected, evidence-driven, tool-based). The member home is a curated club newspaper, not a generic dashboard. Admin controls never leak into public navigation. *(RAT)*

## AD-ROUTE — Routes and redirects
- **AD-ROUTE-01** Public active routes: `/`, `/about`, `/contact`, `/terms`, `/privacy`, `/search`, `/join`, `/logout`, `/ask`, `/health`. *(PDS)*
- **AD-ROUTE-02** Legacy compatibility routes: `/login` → redirect to `/`; `/auth` → redirect to `/join`; `/faq` → redirect to `/ask/` preserving the query string. *(PDS, AUTH, PAGE)*
- **AD-ROUTE-03** FanClub (auth required): `/fanclub`, `/fanclub/myprofile`, `/fanclub/photo`, `/fanclub/library`, `/fanclub/memorabilia`. Admin: `/admin/**`. Store: external Bonfire link only (no `/store` route). Public `/photo`, `/photos`, `/library`, `/memorabilia` must **not** exist. *(PDS, FAN)*
- **AD-ROUTE-04** Unauthenticated access to `/fanclub` or `/fanclub/**` redirects to `/`; any failed session validation redirects to `/`; `/logout` (even when already logged out) ends at `/`. *(AUTH)*
- **AD-ROUTE-05** `/weeklyvote` (results page) is a **planned** hidden route, not required; results currently reveal inline on the home page. *(PAGE)*
- **AD-ROUTE-06** Admin main entry is `/admin/dashboard`. *(ADM)*

## AD-AUTH — Authentication
- **AD-AUTH-01** Cookie-backed server session: cookie `lgfc_session`, D1 `member_sessions`, lookup `/api/session/me`, identity/role from D1 `members`. Login creates session+cookie then goes to `/fanclub`. Closing the browser does not log out. *(AUTH)*
- **AD-AUTH-02** Prohibited: localStorage as auth source, external auth providers, magic links, `ADMIN_EMAILS` as primary gate, hybrid narratives. *(AUTH)*
- **AD-AUTH-03** `/join` is the single canonical Join/Login page with in-page tabs (Join default; Login via `/join?mode=login`); switching tabs does not reload; no separate standalone Join/Login pages. *(AUTH join-login)*
- **AD-AUTH-04** Join form required fields: **Screen Name (Alias)** and **Email**; screen name required, valid email format, alias/email conflicts return an inline error. Login form required field: **Email** (valid format, must match an existing member). *(join-login)*
- **AD-AUTH-05** Logout: clears cookie, invalidates `member_sessions` record, redirects to `/`; header returns to visitor state. *(AUTH)*

## AD-NAV — Header, hamburger, footer
- **AD-NAV-01** Public header, not logged in, desktop/tablet: **Join, Search, Store (external), Login**. Logged in: **Club Home, Search, Store, Logout** (Club Home replaces Join; Logout replaces Login). Store is a visible button wherever the header appears. *(PDS)*
- **AD-NAV-02** FanClub header has one variant: **Club Home, My Profile, Search, Store, Logout**, in that order. The logo always links to `/`. *(PDS, FAN)*
- **AD-NAV-03** Button mapping: Join → `/join`; Login → `/join?mode=login`; Club Home → `/fanclub`; Search → `/search`; Store → external Bonfire; Logout → `/logout`. *(PDS)*
- **AD-NAV-04** Mobile has **no visible top menu**; all navigation is in one hamburger drawer. Guest drawer: Join, Search, Store, Login, About, Contact. Member public drawer: Club Home, Search, Store, Logout, About, Contact. **FanClub drawer (7 items): Club Home, My Profile, Search, Store, Logout, About, Contact.** No Support, Admin, Members or separate "Home" item. *(PDS)*
- **AD-NAV-05** Header lock: sticky bar (`position:sticky; top:0; z-index:50`), inner `max-width:1120px`, **height 64px or 72px, identical on all headers**; buttons are bordered, padded, rounded, readable; nav buttons **and** hamburger are grouped and page-centred (`left:50%; top:50%; translate(-50%,-50%)`); hamburger wrapper `position:relative` so the dropdown anchors under it; the logo container uses `pointer-events:none`, the link `pointer-events:auto`; no inline logo sizing. *(LOCK)*
- **AD-NAV-06** Footer: **left** D1-backed rotating quote + dynamic-year copyright; **centre** LG logo as a scroll-to-top affordance (not navigation); **right** two rows — Row 1 Privacy `/privacy`, Terms `/terms`; Row 2 Contact `/contact`. No `mailto:` footer link, no Admin link, no extra footer links beyond this set; contact emails belong on `/contact`. *(PDS)*

## AD-LOGO — Floating logo (two documents, see conflicts)
- **AD-LOGO-01** Floating logo appears only on `/` and `/fanclub`; the standard header logo is hidden there so it never renders twice; all other routes use the small inline header logo. Click → `/`. Not part of the header. *(PDS, logo-homepage-behavior, LOCK)*
- **AD-LOGO-02 (PDS version)** `position:fixed; top:0; left:0; padding:8px; height:clamp(120px,28vw,180px); width:auto; max-width:none; object-fit:contain; border-radius:12px; z-index:60`; visible on load, hidden after **~320px** scroll, reappears at top. *(PDS)*
- **AD-LOGO-03 (LOCK version)** `position:fixed; left:16px; top:6px; z-index:80`; **height 92px (86–98px range), max-width 160px**; shown while `scrollY < ~12px`, hidden beyond; container `pointer-events:none`, link `pointer-events:auto`; may overlap the hero slightly. *(LOCK)*
- **AD-LOGO-04** Header logo (when shown): hard-constrained width (example 72px), `overflow:hidden`, no inline sizing. Logo must be large enough to read its text. *(LOCK)*

## AD-HOME — Public home page
- **AD-HOME-01** Locked section order: 1 HEADER · 2 BANNER · 3 SPOTLIGHT (hidden by default; slot preserved) · 4 WEEKLY MATCHUP · 5 JOIN · 6 ABOUT · 7 SOCIAL · 8 DISCUSSIONS · 9 FRIENDS · 10 MILESTONES · 11 CALENDAR · 12 FAQ/ASK · 13 FOOTER. *(PDS, HOME)*
- **AD-HOME-02 Section → component:** floating logo `FloatingLogo`; hero inline in `page.tsx`; spotlight `CampaignSpotlightSlot`; matchup `WeeklyMatchup`; join `JoinCTA`; about inline; social `SocialWall`; discussions `RecentDiscussionsTeaser` (`#recent-club-discussions`); friends `FriendsOfFanClub` (`#friends-of-the-club`); milestones `MilestonesSection` (`#milestones`); calendar `CalendarSection` (`#calendar`); FAQ `FAQSection`. *(HOME)*
- **AD-HOME-03 Weekly Photo Matchup:** section #4; two images labelled Photo A / Photo B; buttons "Vote A" and "Vote B"; a "Current Voting" anchor/label; results panel revealed **after the current user votes**; current-week totals after voting; last closed week totals and winner may show after voting; content rotates weekly via D1 auto-rotation. Design term WeeklyMatchup = as-built label "Weekly Photo Matchup" = homepage section (not a route). *(PDS)*
- **AD-HOME-04 Friends:** section title fixed "Friends of the Fan Club"; reads posted `friends` from `/api/friends/list?surface=homepage`; homepage omits LouGehrig.com and places The Lou Gehrig Society in that slot; deterministic loading/empty fallback matching the replacement; cards scannable and consistent with homepage spacing rhythm; public, no auth. *(home-friends)*
- **AD-HOME-05 Milestones:** reads `/api/milestones/list` filtered to `visibility='public'` (headline life/career events only); never exposes member-tier rows or `detail_body`/`source_url`; loading and no-data fallback copy; concise date/event presentation; order locked relative to Friends and Calendar. *(home-milestones)*
- **AD-HOME-06 Calendar:** previews near-term events; calendar grid + detail panel stable on desktop/mobile; renders an empty calendar with a status notice when live data is unavailable; communicates loading/error/empty without collapsing layout; public. *(home-calendar)*
- **AD-HOME-07 Recent discussions teaser:** public-home teaser that previews **recent club discussions** and drives members to authenticated flows; **publicly viewable teaser content**; deterministic loading and failure-safe copy; summary style only; preserve hierarchy vs deeper FanClub discussion UI. *(home-discussions)*
- **AD-HOME-08 Temporary campaign spotlight:** slot hidden unless campaign config exists, required data responds and preview validation completed; stable typography/spacing/layout/heading structure/CTA placement across campaigns (only content changes); developed first in `/admin/fundraiser-preview`. *(home-temporary-campaign-section)*
- **AD-HOME-09 ALS Fundraiser 2026 (content):** campaign `givebutter.com/LouGehrigFanClub2026`, auction `…/c/LouGehrigFanClub2026/auction`, live feed `live.givebutter.com/c/LouGehrigFanClub2026`; timeline March–June 2026 (live May 1, auction May 26, closes June 2, standings lock June 3); leaderboard Points = Funds × Supporters; winner order Points → Supporters → Funds; tie → earliest registration. *(als-fundraiser)*
- **AD-HOME-10** Hero/Banner: H1 white on blue background, line-height 1.2; (see AD-STYLE-06 for sizes).

## AD-STYLE — Style guide (`STY`)
- **AD-STYLE-01 Font stack:** one stack site-wide: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Helvetica Neue", Arial, sans-serif`.
- **AD-STYLE-02 Colour:** LGFC Blue **`#0033cc`** (primary: buttons, key headings, CTAs, links; hover `#0028a3`, "slightly darker"); Deep Navy `#001a66` (optional emphasis); Body text `#333333`; Muted `#666666`; Light muted `#999999` (placeholders); Page background **`#f5f7fb`**; Card background `#ffffff`; Subtle background `#f8f9ff`; Border soft `#dde3f5`; Border light `#e8ecf5`.
- **AD-STYLE-03 Headings:** H1 page title 32px (36px tablet), 700, blue, line-height 1.2; section H2 24px (mobile min 22px), 700, blue, 1.3; H3 / card title 18px, 600, `#333`, 1.4.
- **AD-STYLE-04 Body:** 16px (mobile 15px), 400, `#333`, 1.6. **Small/meta** 14px, 400, `#666`, 1.5. **Fine print** 13px, `#666`, 1.4.
- **AD-STYLE-05 Accessibility:** WCAG AA — normal text ≥4.5:1, large text (18px+ or 14px+ bold) ≥3:1; every interactive element has a visible focus indicator; sizes scale smoothly; **no body text smaller than 13px**.
- **AD-STYLE-06 Hero H1:** 40px (2.5rem) base, **56px at ≥768px**, **64px at ≥1024px**; 700; white on blue; line-height 1.2. Hero example CSS: `background:#0033cc; font-size:clamp(2.5rem,5vw,4rem); font-weight:700`.
- **AD-STYLE-07 Primary button:** `background:#0033cc; color:#fff; padding:10px 16px; border-radius:12px; border:none; font-size:14px; font-weight:600; cursor:pointer; transition:background-color .2s ease`; hover `#0028a3`; focus `outline:2px solid #0033cc; outline-offset:2px`. Used for the most important actions (Join, Login, Vote).
- **AD-STYLE-08 Secondary button:** white background, `#0033cc` text, `padding:10px 16px; radius 12px; border:1px solid rgba(0,51,204,.3); 14px/600`; hover `opacity:.9`. States: disabled `opacity:.5; cursor:not-allowed`; loading shows a spinner and keeps dimensions.
- **AD-STYLE-09 Links:** in-content links `#0033cc`, no underline, underline on hover (`.15s`), visited keeps the same colour. Navigation links `#0033cc`, no underline, 14px/500, hover `opacity:.8` or underline.
- **AD-STYLE-10 Spacing:** large gap 48px between major sections; medium 32px between related subsections; small 20px between closely related elements. Container `max-width:1200px`, padding **20px desktop / 16px mobile**, centred.
- **AD-STYLE-11 Radius:** large cards 18px (hero sections, main banners); standard cards 14px (content cards, tiles); small elements 12px (buttons, inputs); pills 999px.
- **AD-STYLE-12 Card container (example):** `background:#fff; border:1px solid #dde3f5; border-radius:14px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.08)`. Section heading example: blue, 1.5rem, 700, centred, `margin-bottom:20px`.

## AD-WK — Search, text pages, FAQ & Ask, 404, health
- **AD-SRCH-01** `/search`, public, visitor or member header. Container 1200px / 20px padding; H1 "Search"; one prominent full-width input, placeholder "Search the Lou Gehrig Fan Club…", button "Search" (primary style), input height **48px**, border `1px solid #dde3f5`, radius 12px, **focus ring `2px solid #0033cc; offset 2px`**; minimum 2 characters (submit disabled below); URL `?q=`; executes on explicit submit only; no autocomplete.
- **AD-SRCH-02** Empty state text below the bar: "Enter a keyword to search the fan club." No redirect when `q` is absent. Result count line: `X results for "keyword"` / `No results for "keyword"`, **14px, `#666`**.
- **AD-SRCH-03** Result card: type badge (small pill, uppercase, **12px**, background `#f8f9ff`, text `#0033cc`, radius 999px — examples FAQ / Event / Photo / Library), title H3 **18px/600 `#333`** as a link, excerpt **14px `#666` line-height 1.5**, truncated ~120 characters, link to destination. Card: white, `1px solid #dde3f5`, radius 14px, padding 20px, shadow `0 2px 8px rgba(0,0,0,.08)`, gap 16px.
- **AD-SRCH-04** Pagination above 20 results: **Previous / page numbers / Next**, current page highlighted blue; simple numeric, no infinite scroll. Ranking: title match above body match, then most-used. Visitor scope: FAQ, events, milestones, About/static content (if indexed), friends. Member scope adds photos, library, memorabilia, discussions. API `GET /api/search?q&page` → `{results,total,page,pages}` with `type,title,excerpt,url`. Desktop-only; mobile/tablet deferred.
- **AD-TXT-01** `/about`, `/contact`, `/privacy`, `/terms` share one prose layout inside the global container: H1 32px/700 blue, **margin below 32px**; body 16px/**1.6**/`#333`, **max content width 760px**, paragraph spacing **24px**; internal H2 24px/700 blue, **margin 40px above / 16px below**; no custom CSS modules; no sidebar, forms or interactive elements. Desktop-only.
- **AD-TXT-02** `/about` content "awaiting copy" (placeholder "About the Lou Gehrig Fan Club."). `/contact` must show admin email `admin@lougehrigfanclub.com` and contact email `Contact@LouGehrigFanClub.com`; no contact form; mailto links; consolidated contact+support. `/privacy` and `/terms` read D1 `page_content` with in-source fallback; Privacy must disclose Join/Login/Ask/member data and state magic links are not used.
- **AD-FAQ-01** `/ask` is the canonical public FAQ browse + Ask workflow; `/faq` redirects to `/ask/`. Page container ~900px; H1 "FAQ & Ask a Question"; intro; FAQ browse H2 with search and expandable list; Ask form (`#ask-form`) with submit and a contact mailto. Loads up to 50 approved answered entries; pinned first then `updated_at DESC`; client-side search of question+answer; initial query from `?q=`; expanding an item fires `POST /api/faq/view` (fire-and-forget); multiple items may stay expanded.
- **AD-FAQ-02** Ask fields: First name (req), Last name (req), Screen name (optional → null), Email (req, valid, ≤254), Question (req, ≥10 chars). `POST /api/ask`; success "Your question has been submitted. We'll reply by email."; error "Submission failed. Please try again."; mailto `mailto:Contact@LouGehrigFanClub.com?subject=Contact%20Needed%20ASK`. `/ask` never writes `faq_entries` directly. Homepage FAQ is a teaser linking into `/ask`.
- **AD-404-01** Not-found page: error code "404" and title "Page Not Found", supporting explanation, primary CTA to `/`; concise, non-technical; no internal diagnostics; styling uses existing LGFC colour tokens; public.
- **AD-HLTH-01** `/health`: static OK marker plus a server-rendered timestamp; plain/minimal; no auth; not in navigation.
- **AD-WV-01** `/weeklyvote` (planned): results shell, winning image card, vote-share summary, return CTA; deterministic empty state; not in persistent navigation.

## AD-FAN — Member area
- **AD-FAN-01 (older spec, `fanclub.md`)** Club Home sections in order: Header, Welcome Section, Archives Tiles (Photo, Memorabilia, Library), Post Creation / Work Area, Member Discussion Feed, Gehrig Timeline, Admin Dashboard Link (admins only). Profile and member card are separate linked pages.
- **AD-FAN-02 (newer spec, `fanclub-home.md`, Program #1685 "newspaper")** Order: 1 Masthead `ClubHomeMasthead` · 2 Lead story `ClubHomeStaticStory` · 3 Secondary story rail `ClubHomeStoryRail` · 4 Feature link cards `ArchivesTiles` · 5 Photo/memorabilia feature `ClubHomeMediaFeature` · 6 Member prompt `ClubHomeMemberPrompt` (→ `/fanclub/chat`) · 7 Archive spotlight · 8–10 Campaign / Events / Recognition (`ClubHomeEventsModule`, `ClubHomeRecognitionModule`, `ClubHomeDeferredModule`, campaign fails closed) · 10a Gehrig timeline (left column below Events; member-only; not TimelineJS3) · 11 Box score (left margin, bottom) · 12 AL standings (right margin, bottom) · 13 Submission CTA (→ `/fanclub/submit`) · 14 Admin link (conditional). Inline posting and the discussion feed are **removed** from Club Home (→ `/fanclub/chat`). Dynamic modules fail closed to static copy. Floating logo present and links to `/`.
- **AD-FAN-03 Sub-pages** (photo, library, memorabilia, myprofile): login required, FanClub header, **desktop only (mobile/tablet deferred)**, shared layout **page container 1200px max, 20px padding**, H1, keyword search bar, content area. *(fanclub-subpages)*
- **AD-FAN-04 `/fanclub/photo`:** H1 "Photo Gallery"; search placeholder "Search photos…", executes on submit, URL `?q=`; tag filter bar of **pill buttons**, active pill **LGFC Blue background**, multi-select AND, "All" resets; grid **3 columns desktop**, thumbnail + caption (title or description); detail view modal or route; empty "No photos match your search."; below: "Have a photo to share? Submit a Photo →". Data `GET /api/fanclub/photos?q&tags&page`.
- **AD-FAN-05 `/fanclub/library`:** H1 "Gehrig Library"; placeholder "Search library…"; tabular/list view, title primary, tags, linkage to related photos; empty "No library entries match your search."; data from published `content_inventory` rows.
- **AD-FAN-06 `/fanclub/memorabilia`:** H1 "Memorabilia Archive"; placeholder "Search memorabilia…"; tag pills; 3-column grid of memorabilia-tagged photo records; detail may show larger image, full text, tags and related story; empty "No memorabilia items match your search."
- **AD-FAN-07 `/fanclub/myprofile`:** H1 "My Profile"; editable fields First name*, Last name*, Screen name, **Email address\* (editable)**, Email opt-in; **Save** and **Cancel** (Cancel discards); below: Membership Card section — instructions text, **card front image, card back image**. APIs `GET/POST /api/fanclub/profile`, `GET /api/content/membercard`. Day-1 exclusions: avatars, profile pictures.
- **AD-FAN-08** Admin link conditional on admin role; Floating logo present on `/fanclub`.

## AD-ADM — Admin (`dashboard.md`, status INCOMPLETE)
- **AD-ADM-01** Entry `/admin/dashboard`; only on the Cloudflare Pages site; requires a D1 member session resolving to an admin role. No Admin link in the public footer.
- **AD-ADM-02** Layout: **left sidebar** listing sections; main content area for tables/forms/detail panels; **top bar with the admin's name/email and a logout action**.
- **AD-ADM-03** Areas: Reports (moderation queue: type, snippet, reporter, count, status, created, actions), Posts (news + Q&A), Media (B2 assets: thumbnail, key, tags, owner, status; approve/reject/tag/delete), Milestones, Events, Weekly Matchup, Users, System Health. Moderation actions are logged in an `admin_actions`-style log.
- **AD-ADM-04** Admin pages may be utilitarian; they need clear queues and states, deterministic actions, safe empty/error states, protected access.

## AD-DATA — Content model intent
- **AD-DATA-01** Story-centric content inventory feeding many surfaces (homepage, member newspaper, milestones, archive/library, search, rotation); no one-off content silos. Recurring content collection, newspaper-style presentation and an admin operating cockpit are the three pillars. *(RAT)*
- **AD-DATA-02** The public homepage should answer: What is this club? Why does Lou Gehrig matter here? What is happening now? How do I join or participate? What stories, milestones, events, friends and discussions show the club is alive?

## Conflicts inside the design documents
1. **Floating logo** — `PDS` and `logo-homepage-behavior` (AD-LOGO-02: 120–180px, 320px hide, z-index 60, top/left 0) vs `LOCK` (AD-LOGO-03: ~92px, 12px hide, z-index 80, top 6/left 16).
2. **Club Home** — `fanclub.md` (AD-FAN-01: welcome/tiles/post creation/feed) vs `fanclub-home.md` (AD-FAN-02: newspaper, inline posting removed).
3. **FanClub drawer contents** — `PDS` lists 7 items (AD-NAV-04); `LOCK` says drawer membership is owned by `PDS`.
4. **Hamburger/member header naming** — `LOCK` says `MemberHeader`; other docs say FanClub header.
5. **Header height** — `LOCK` allows 64px **or** 72px.
6. **Contact address** — `text-pages` requires `Contact@LouGehrigFanClub.com`; `faq-and-ask` uses the same address only in the Ask mailto.
