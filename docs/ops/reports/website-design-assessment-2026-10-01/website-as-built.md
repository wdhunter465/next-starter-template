---
Doc Type: Operations
Audience: Human + AI
Authority Level: Supporting (assessment record; not design authority)
Owns: The as-built measurements of production on 2026-10-01 and the difference register against the as-designed inventory
Does Not Own: Product design intent, locked design specifications under docs/reference/design/**, remediation decisions, or application code
Canonical Reference: /docs/governance/PRODUCT-AND-DESIGN.md
Related issues: #4409
Last Reviewed: 2026-10-01
---

# As-Built: Lou Gehrig Fan Club website (with differences from as-designed)

**What this is.** The website as it actually exists, measured on 1 October 2026, with **every difference from `website-as-designed.md` listed in the Difference Register** (section 5). Requirement IDs (`AD-…`) refer to `website-as-designed.md`; difference IDs (`D-###`) are defined here. Detailed component and page specifications of the built system (exact CSS, copy, data shapes, component previews) are kept in the private claude.ai Design System artifact https://claude.ai/artifact/VvUNGRAqeSiF4HqhTuHoPM; this repository copy is the audit record.

## 1. How this was observed — evidence levels

| Tag | Meaning |
| --- | --- |
| **P** | **Production, observed live** at `https://www.lougehrigfanclub.com` on 2026-10-01: HTTP status/headers/redirects fetched with `curl` (TLS verified), pages rendered in headless Chromium at 390, 820, 1024 and 1280px wide with every network request fetched through `curl` so certificate checking was never disabled, computed CSS values read from the rendered DOM, and public API responses read. |
| **S** | **Source**: read from the repository (`main` in `wdhunter465/next-starter-template`) but not seen on production. |
| **M** | **Local mock**: the repository was built and run locally; pages that need a signed-in session (Club Home, member sub-pages, admin) were rendered with **invented API responses**, so layout and styling are real but content is not. |
| **P/M, S/M** | Production for the public part, source/mock for the gated part. |

**Cross-check.** The computed styles read from production (CSS variables, hero, headings, header buttons, Join banner, Friends cards, FAQ controls, footer) were compared with the local build: all values were identical (only content-driven heights and whitespace in minified variable strings differed). So the local build is a faithful stand-in for the gated pages, which no one without a member/admin account can see on production.

**Not observable:** anything behind login on production (Club Home, `/fanclub/*`, `/admin/*`, member discussions, the membership card contents), the Elfsight social widget (third-party script, blocked in the capture environment), analytics behaviour after Accept, the Campaign Spotlight with a real config (production returns none), voting (not exercised, to avoid altering vote totals), and behaviour at widths other than 390/820/1024/1280.

## 2. Platform facts (all **P**)

- **Hosting/headers:** Cloudflare (`server: cloudflare`); HTML served `cache-control: public, max-age=0, must-revalidate`; `x-content-type-options: nosniff`; `referrer-policy: strict-origin-when-cross-origin`; early-hint `Link` preloads for `/IMG_1946.png` and `/logo.svg`; Cloudflare `speculation-rules`.
- **CSP:** an enforced `content-security-policy` (script, frame, connect, img, style allow-lists for Elfsight, Facebook, Instagram, X, Google Analytics/Tag Manager, Backblaze B2) **and** a `content-security-policy-report-only` with `default-src 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `upgrade-insecure-requests`, `report-uri /api/csp-report`.
- **Redirects:** `/about` → `/about/` (308); `/ask` → `/ask/` (308); `/login`, `/login/` → `/` (302); `/auth`, `/auth/` → `/join/` (302); `/faq/` (200) is a client page that replaces to `/ask/` keeping the query.
- **Missing routes (404):** `/photo/`, `/photos/`, `/library/`, `/memorabilia/`, `/store/`, `/calendar/`, `/matchup/`, `/weekly/`, `/news/`, `/charities/`, `/milestones/`, `/weeklyvote/`.
- **Present (200):** `/`, `/about/`, `/accessibility/`, `/ask/`, `/contact/`, `/events/`, `/faq/`, `/fundraiser-details/`, `/health/`, `/join/`, `/logout/`, `/privacy/`, `/search/`, `/terms/`, and the shells `/fanclub/`, `/fanclub/photo/`, `/admin/`.
- **Assets:** `/logo.svg` (401 B), `/IMG_1946.png` (611,708 B) load. `/membercard-front.png` and `/charities/als-cure-project.svg` return 404.
- **`robots.txt`:** `Allow: /`; `Disallow: /admin/ /fanclub/ /api/ /_ai-review/`; sitemap `https://www.lougehrigfanclub.com/sitemap.xml` (12 URLs: `/`, `/about/`, `/accessibility/`, `/ask/`, `/contact/`, `/events/`, `/faq/`, `/join/`, `/login/`, `/privacy/`, `/search/`, `/terms/`).
- **API behaviour for visitors:** `/api/session/me`, `/api/discussions/list`, `/api/content/membercard` → HTTP 401 `{"ok":false,"error":"Not authenticated"}`; `/api/events/next`, `/api/faq/list`, `/api/friends/list`, `/api/milestones/list`, `/api/matchup/current`, `/api/footer-quote` → 200; `/api/cms/get?key=home.campaign_spotlight` → `{"ok":true,"block":null}`; `/api/fundraiser-details/list` → empty.

## 3. Live data on the public home page (**P**, 2026-10-01)

- **Weekly matchup** week starting 2026-09-28 (matchup id 16): two Backblaze B2 photos (`LGFC_sha256_f8206434…jpg`, 1291×876; `LGFC_sha256_610c674e…jpg`, 2339×3000), no titles, descriptions or credits.
- **Friends (7, in this order):** ALS Cure Project (charity), I AM ALS (charity), Live Like Lou Foundation (charity), The Lou Gehrig Society (charity), Luckiest Man: The Life and Death of Lou Gehrig (business, Jonathan Eig), Phi Delta Theta — Lou Gehrig Award (charity), They Played In Color (business). Club-home surface order: ALS Cure Project, The Lou Gehrig Society, I AM ALS, Live Like Lou Foundation, LouGehrig.com, Luckiest Man…, Phi Delta Theta…, They Played In Color.
- **Milestones (9, ascending):** 1903 Born in New York City · 1923 Major League debut with the New York Yankees · 1925 Begins the historic consecutive-games streak · 1927 AL MVP, anchors the "Murderers' Row" Yankees · 1934 Wins the Triple Crown · 1939 Voluntarily ends the 2,130-game streak · 1939 "Luckiest Man" farewell speech at Yankee Stadium · 1941 Dies in Riverdale, New York, at age 37 · **2026 Milestone placeholder** ("This is text content from milestones table.").
- **Calendar:** one event, Lou Gehrig Day, 2027-06-02 (no location/host/fees/description); the calendar opens on June 2027 with June 2 preselected. `/events` shows "No events posted for this month." for 2026-10 and lists the same event under "Upcoming events (next 10)".
- **FAQ (13 approved):** What is the Lou Gehrig Fan Club? · Can I contribute memorabilia or photos? · when is gehrig's birthday · Is the Store part of the website? · How do I contact the club? · Where can I see the Weekly Matchup? · when was Gehrig born? · How do I submit a question for the FAQ? · How do I become a member? · What is Lou Gehrig Day? · when did Gehrig die · Does the club focus on ALS topics? · Will my question appear immediately? None pinned. The home teaser shows the first five.
- **Footer quote:** "Today, I consider myself the luckiest man on the face of the earth." — Lou Gehrig.
- **Fundraiser details:** none. **Campaign Spotlight:** none (hidden). **Recent discussions:** login prompt only.
- **Search for "gehrig":** 37 results over 2 pages (Archive, Friend, FAQ, Event, Milestone badges).

## 4. As-built summary by area, and where it conforms

Detailed values for each area live in the sections named. Items below that **conform** to the design are listed here; **every deviation is in the register**.

- **Routes** (AD-ROUTE-03): designed — Public `/photo`, `/photos`, `/library`, `/memorabilia` must not exist. Built — Confirmed: HTTP 404 on production `[P]`
- **Admin** (AD-ADM-04): designed — Admin is utilitarian. Built — Matches: unbranded white cards and pills (note `#111` text, `rgba(0,0,0,.12)` borders) `[M]`
- **Weekly vote** (AD-WV-01): designed — `/weeklyvote` is planned, not required. Built — Not built (404) — consistent with the spec's "planned" status `[P]`
- **Platform** (AD-PLAT-01): designed — (not specified). Built — `robots.txt` disallows `/admin/`, `/fanclub/`, `/api/`, `/_ai-review/` and lists the sitemap; the sitemap includes 12 URLs `[P]`

**Conformance confirmed (no difference):**
- Homepage section order (AD-HOME-01), hidden spotlight slot, section ids.
- Public header buttons and order for visitors (Join, Search, Store↗, Login + hamburger), Store opens in a new tab, Login → `/join/?mode=login`; mobile shows only the hamburger (measured 0 visible buttons at 390px); guest drawer contents (Join, Search, Store, Login, About, Contact).
- Header is sticky, `z-index:50`, inner width 1120px, nav group centred; hamburger anchored to its button; floating logo does not duplicate the header logo; the floating logo is removed on scroll.
- Footer left quote + dynamic year, centre LG logo as a scroll-to-top button, right-hand legal links; no Admin link, no mailto.
- Redirect rules for `/login`, `/auth`, `/faq`, unauthenticated `/fanclub/**` and `/admin`; the retired public routes are 404.
- Container 1200px on the home page; `.section-title` matches the heading example (blue, 24px, 700, centred, 20px below); heading and body colours for H3 (`#333`, 18px, 600, 1.4); radius 12px for header/friend/consent buttons; Search result card values (border `#dde3f5`, radius 14px, padding 20px, shadow `0 2px 8px rgba(0,0,0,.08)`); type-chip values (12px uppercase, `#f8f9ff`, blue text, pill); Search input height 48px, min-length 2, `?q=` URL, "Search" button; result-count wording; Ask form fields/validation/messages/mailto; FAQ ordering, 50-item load, expand with view-count POST; `/health` OK + timestamp; 404 wording.
- Weekly matchup: Vote A/B, Current Voting anchor, results revealed after voting (per source).

## 5. Difference Register — as-designed vs as-built

**Totals: 84 differences — High 5, Med 36, Low 43.** By area: Typography 9 · Search 9 · Member 9 · Text pages 8 · Home 7 · Colour 6 · Buttons 6 · Header 5 · Admin 3 · Links 2 · Spacing 2 · Footer 2 · Logo 2 · Ask / FAQ 2 · Join 2 · Auth 2 · Campaign 2 · Layout 1 · Radius 1 · Cards 1 · 404 1 · Platform 1 · Docs 1.

Severity: **High** = broken or missing function/content, or a brand-level visual mismatch users see on every page; **Med** = visible layout, typography or structure mismatch, or behaviour that diverges from the spec; **Low** = minor value drift, data quality or documentation mismatch. "Designed" quotes `website-as-designed.md`; "Built" is what was measured or read. Where the design documents disagree with each other the row says which one the build follows.

| ID | Area | Ref | As-designed | As-built | Evid. | Sev. |
| --- | --- | --- | --- | --- | --- | --- |
| D-001 | Colour | AD-STYLE-02 | LGFC Blue `#0033cc` | `#002868` navy. `variables.css` loads after `globals.css` and overrides `--lgfc-blue`; every var() use (hero, H1/H2, links, buttons, hamburger bars) renders navy | P | High |
| D-002 | Colour | AD-STYLE-02 | Blue hover `#0028a3` is "slightly darker" than the base blue | Hover colour is a **brighter** blue than the navy base, so solid-navy buttons lighten on hover | P | Med |
| D-003 | Colour | AD-STYLE-02 | Page background `#f5f7fb` | `#f8f9fa` (`variables.css` `html,body`) | P | Med |
| D-004 | Colour | AD-STYLE-02 | Body text `#333333` | Inherited body text `#212529`; paragraphs and list items `#333333` via the `p, li` rule | P | Low |
| D-005 | Colour | AD-STYLE-02 | Brand blue is one value | A second blue survives: `#0033cc` hard-coded in Campaign Spotlight, analytics consent buttons and the admin nav active tint | S | Med |
| D-006 | Colour | AD-STYLE-02 | Deep Navy `#001a66` for emphasis headings | Declared, never used | S | Low |
| D-007 | Typography | AD-STYLE-01 | One font stack for the entire site | Also used: Georgia/Times serif (PageShell titles on About, Events, Fundraiser Details and all admin pages), Georgia/Palatino (Club Home newspaper), monospace (`/health`) | P/M | Med |
| D-008 | Typography | AD-STYLE-06 | Hero H1 40px base / 56px at ≥768px / 64px at ≥1024px | **48px** base / **64px** at ≥640px / **72px** at ≥1024px (measured 48, 64, 72 at 390/820/1280) | P | Med |
| D-009 | Typography | AD-STYLE-06 | Hero sets font size with `clamp(2.5rem,5vw,4rem)` | Fixed steps in a CSS module; `--lgfc-font-size-hero` (2.5rem) is declared but unused | P | Low |
| D-010 | Typography | AD-STYLE-03 | Page-title H1 32px, 36px at tablet | 32px at every width above 768px (no 36px tier); 24px at ≤768px. Several pages override with inline sizes: 34px (Ask, Privacy, Terms, Contact, Accessibility, Search `clamp` max 34px), 32.8px (PageShell) | P | Med |
| D-011 | Typography | AD-STYLE-03 | Section H2 24px, mobile minimum 22px | 24px desktop, **20px** at ≤768px; text-page H2s are 22px with different margins | P | Med |
| D-012 | Typography | AD-STYLE-04 | Body 16px, 15px on mobile | 16px at all widths (measured at 390px) | P | Low |
| D-013 | Typography | AD-STYLE-04 | Small/meta text 14px `#666` line-height 1.5 | The shared `.sub` meta class is 16px/1.6 `#666`; 14px appears only in specific components (calendar notes, footer 12px, chips 12px) | P | Med |
| D-014 | Typography | AD-STYLE-05 | No text smaller than 13px | Footer copyright and links are **12px**; type chips and several labels 11–12px; Club Home table text 11–12px | P | Med |
| D-015 | Typography | AD-STYLE-04 | Fine print 13px `#666` line-height 1.4 | Used as 13px in some components (matchup credit, calendar meta) but footer is 12px | P | Low |
| D-016 | Buttons | AD-STYLE-07 | Primary button: `#0033cc` fill, padding 10×16, radius 12, 14px/600, `.2s` background transition | No single primary button. Variants: Friends CTA (navy fill, padding .4rem 1.15rem, 15px/700, `.15s`), Search button (radius **10**, 700, no transition), memberpage pill (radius 999), FAQ pill (2px border), consent Accept. None match all of the spec values | P | Med |
| D-017 | Buttons | AD-STYLE-07 | Primary buttons for Join, Login and Vote | **Join and Login in the home Join banner render as bold white text with no fill or border** (modifier classes never applied). **Vote A/Vote B are native grey browser buttons** (`.btn` class undefined). Join/Login tabs on `/join` are native grey buttons with no selected state | P | High |
| D-018 | Buttons | AD-STYLE-07 | Focus: `outline:2px solid #0033cc; offset 2px` on every interactive element | Custom controls (Friends CTA, calendar, nav) have a 2px navy ring; native inputs/buttons (search input, Ask/Join fields, Vote, FAQ search/Clear, tabs, Profile Save/Cancel) use the browser default ring | S | Med |
| D-019 | Buttons | AD-STYLE-08 | Secondary button: white, blue text, `1px solid rgba(0,51,204,.3)`, 14px/600, hover opacity .9 | Only consent "Decline" matches. Header buttons use `rgba(0,0,0,.15)` border, 700 weight and a grey hover fill; FAQ outline pill uses a 2px blue border | P | Low |
| D-020 | Buttons | AD-STYLE-08 | Loading state shows a spinner and keeps dimensions | Text swap only ("Submitting…", "Working…", "Posting…"); no spinner | S | Low |
| D-021 | Buttons | AD-STYLE-08 | Disabled `opacity:.5; cursor:not-allowed` | Mixed: `.5`, `.6`, or native disabled look | S | Low |
| D-022 | Links | AD-STYLE-09 | Text links not underlined until hover | Links inside `.sub` text are always underlined (added for WCAG 1.4.1); consent Privacy link underlined | P | Low |
| D-023 | Links | AD-STYLE-09 | Navigation links 14px/500 | Header buttons 14px/**700**; footer links 12px/400 | P | Low |
| D-024 | Spacing | AD-STYLE-10 | Section gaps 48 / 32 / 20px | Home uses 40px (`section-gap`), 48px (`-tight`), 64px (`-moderate`) margins; `--rhythm-*` 48/32/20 tokens exist but are rarely used | P | Med |
| D-025 | Spacing | AD-STYLE-10 | Container padding 20px desktop, 16px mobile | `.container` is 20px at all widths (measured 20px at 390px); text pages 16px; Search 16px | P | Low |
| D-026 | Layout | AD-SRCH-01, AD-TXT-01 | Pages sit in the 1200px container (text pages narrower content column 760px) | Widths: Search 980px, Ask/Contact/Privacy/Terms/Accessibility 900px (content-box + 16px padding), Join 560px, Club Home 1200px, member sub-pages 980–1100px | P | Med |
| D-027 | Radius | AD-STYLE-11 | Large cards/banners 18px | Hero banner 0px; Join banner **14px** (a second `.joinBanner` rule overrides the 20px/18px values); Campaign Spotlight 24px; admin cards 16px | P | Med |
| D-028 | Cards | AD-STYLE-12 | Card: white, `1px solid #dde3f5`, radius 14px, padding 20px, shadow `0 2px 8px rgba(0,0,0,.08)` | There is no shared card. The global `.card` and `.grid` classes are used on Weekly Matchup, About, Milestones, Discussions and Ask but **defined in no stylesheet**, so those blocks render with no border, background or grid. Real cards are local: Friends (12px, tint), FAQ (12px, `0 6px 24px`), Search results (14px, matches spec), Calendar shell, etc. | P | High |
| D-029 | Header | AD-NAV-05 | Header height 64px or 72px, same on all headers | Rendered bar **96px** (72px content + 12px padding top and bottom, content-box) + 1px border = 97px desktop; 81px mobile (56px content); plus an 8px spacer under it | P | Med |
| D-030 | Header | AD-NAV-04 | FanClub drawer has 7 items | **12 items**: Club Home, My Profile, **Photo, Library, Memorabilia, Chat, Submit**, Search, Store, Logout, About, Contact | S | Med |
| D-031 | Header | AD-NAV-02 | FanClub header buttons are single-line, in order | Order correct, but at 1280px "Club Home" and "My Profile" wrap to two lines because the centred flex group shrinks | M | Med |
| D-032 | Header | AD-NAV-05 | Header files `Header.tsx`, `MemberHeader.tsx` + modules | Member header is named `FanClubHeader` (`FanClubHeader.tsx`/`.module.css`); `MemberHeader` does not exist | S | Low |
| D-033 | Header | AD-NAV-01 | Header shows logged-out set when not logged in, logged-in set when logged in | While the session fetch is in flight (state `unknown`) the visitor set renders, so members may briefly see Join/Login | S | Low |
| D-034 | Footer | AD-NAV-06 | Row 1: Privacy, Terms. Row 2: Contact. No extra footer links | Row 1 also contains **Accessibility** (`/accessibility/`): four links instead of three | P | Med |
| D-035 | Footer | AD-NAV-06 | Left: D1 rotating quote + copyright | Matches, but the quote renders at 16px (body size) while the © line is 12px; quote shows only the attribution in non-italic after an em dash | P | Low |
| D-036 | Logo | AD-LOGO-02 vs AD-LOGO-03 | PDS: `clamp(120px,28vw,180px)`, top/left 0, padding 8, z-index 60, hide after ~320px. LOCK: ~92px, top 6/left 16, z-index 80, hide after ~12px | Built to the **LOCK** version: 98px high (136.9×98 measured), top 6px, left 16px, z-index 80, removed from the DOM after scrolling (measured: gone at scrollY 400). Violates the PDS values | P | Med |
| D-037 | Logo | AD-LOGO-01 | Header logo hidden on `/` and `/fanclub` to avoid duplicates | Matches on `/` (no header image found). Not observable on `/fanclub` | P | Low |
| D-038 | Home | AD-HOME-01 | 13-section order with a hidden spotlight slot | Matches. Extra hidden section **Fundraiser Details teaser** (`#fundraiser-daily-details`) sits above the spotlight and is not in the locked order | S | Low |
| D-039 | Home | AD-HOME-07 | Discussions teaser is **publicly viewable** and previews recent discussions | Guests see only "Member discussions are private. Join or log in to read recent club posts."; posts load only for authenticated members (`/api/discussions/list` returns 401 to visitors) | P | High |
| D-040 | Home | AD-HOME-05 | Milestones: concise date/event presentation; public headline events | Rendered as unstyled `<strong>{year}: {title}</strong>` + description (no card/grid, images stretch full width). Live data includes a placeholder row: **"2026: Milestone placeholder — This is text content from milestones table."** | P | Med |
| D-041 | Home | AD-HOME-04 | Friends cards scannable; homepage omits LouGehrig.com; Society present | Live homepage lists **7** friends: ALS Cure Project, I AM ALS, Live Like Lou Foundation, The Lou Gehrig Society, Luckiest Man: The Life and Death of Lou Gehrig (book), Phi Delta Theta — Lou Gehrig Award, They Played In Color. The 7th card sits alone on the last row. Labels read CHARITY / BUSINESS. In-code defaults (6 entries labelled "Friend") differ from live data | P | Low |
| D-042 | Home | AD-HOME-03 | Photos labelled Photo A / Photo B with Vote buttons and Current Voting | Matches in structure; photos are contained in a fixed 440px frame (one live image is 2339×3000 portrait, letterboxed); captions fall back to "Photo A/B" because live photos have no title/credit; grid is 2-up at every width including 390px (167px columns) | P | Low |
| D-043 | Home | AD-HOME-06 | Calendar: grid + detail panel stable on desktop/mobile | Matches. Live data currently has one event (Lou Gehrig Day, 2027-06-02), so the calendar opens on June 2027 | P | Low |
| D-044 | Home | AD-HOME-02 | Social section | Elfsight widget needs third-party scripts; a loading line and the fallback panel can show at the same time | P | Low |
| D-045 | Search | AD-SRCH-01 | Container 1200px, 20px padding | 980px max width | P | Med |
| D-046 | Search | AD-SRCH-01 | Input focus ring `2px solid #0033cc`, offset 2px | No custom focus style; browser default ring | S | Med |
| D-047 | Search | AD-SRCH-02 | Empty-state text "Enter a keyword to search the fan club." | "Search approved FAQs, events, milestones, friends, and member-visible content where available." | P | Low |
| D-048 | Search | AD-SRCH-02 | Result count 14px `#666` | 16px `#666` (`.status`) | P | Low |
| D-049 | Search | AD-SRCH-03 | Result title 18px/**600**, excerpt **14px** `#666`/1.5 | Title 18px/**700**; excerpt **16px**/24px `#666` | P | Med |
| D-050 | Search | AD-SRCH-03 | Badge types FAQ / Event / Photo / Library | Live visitor results show **ARCHIVE, FRIEND, FAQ, EVENT, MILESTONE** badges (e.g. 37 results for "gehrig"); Photo/Library appear only for members | P | Low |
| D-051 | Search | AD-SRCH-04 | Pagination: Previous / numbers / Next | Numbers only (1, 2); active page filled navy | P | Low |
| D-052 | Search | AD-SRCH-04 | Visitor scope: FAQ, events, milestones, About, friends | Also returns archive/library-style entries (biography books) from the content inventory | P | Low |
| D-053 | Search | AD-SRCH-01 | Primary button: padding 10×16, radius 12 | Search button radius 10px, min-height 44px | P | Low |
| D-054 | Text pages | AD-TXT-01 | Content max-width 760px | 900px | P | Med |
| D-055 | Text pages | AD-TXT-01 | H1 32px, margin-bottom 32px | 34px, margin-bottom 12px | P | Low |
| D-056 | Text pages | AD-TXT-01 | Body line-height 1.6; paragraph spacing 24px | Line-height 1.7 (lead paragraph 18px/1.6); paragraph margin 14px | P | Low |
| D-057 | Text pages | AD-TXT-01 | H2 24px, margin 40px above / 16px below | 22px, margin 22px above / 10px below | P | Med |
| D-058 | Text pages | AD-TXT-01 | All four pages share the same layout, no custom CSS | `/about` uses PageShell: Georgia 32.8px charcoal title with subtitle; Contact/Privacy/Terms use the blue sans H1 | P | Med |
| D-059 | Text pages | AD-TXT-02 | Contact page shows `admin@lougehrigfanclub.com` and `Contact@LouGehrigFanClub.com` | Shows **Support@LouGehrigFanClub.com** and admin@lougehrigfanclub.com; `Contact@…` appears only in the Ask-form mailto | P | Med |
| D-060 | Text pages | AD-TXT-01 | Four text pages (about, contact, privacy, terms) | A fifth page, **/accessibility**, exists (hard-coded statement), is in the footer and sitemap | P | Low |
| D-061 | Text pages | AD-TXT-02 | About copy awaiting (placeholder) | Real copy is live | P | Low |
| D-062 | Ask / FAQ | AD-ROUTE-02 | `/faq` is a compatibility redirect, not a competing workflow | Redirect works (client-side, verified `/faq/?q=gehrig` → `/ask/?q=gehrig`), but `/faq/` and `/login/` are still listed in `sitemap.xml` | P | Low |
| D-063 | Ask / FAQ | AD-FAQ-01 | FAQ browse is of approved answered entries | Matches; live list contains test-style entries in lower case ("when is gehrig's birthday", "when was Gehrig born?", "when did Gehrig die") | P | Low |
| D-064 | Join | AD-AUTH-04 | Join requires Screen Name (Alias) and Email | Also requires **Full name** (split into first/last) and shows an opt-in checkbox (checked by default) | P | Med |
| D-065 | Join | AD-AUTH-03 | Tabs with in-page switching | Matches; the selected tab has no visual state (both tabs are default grey buttons, `aria-selected` only) | P | Low |
| D-066 | Auth | AD-ROUTE-04 | Unauthenticated `/fanclub/**` and `/admin` redirect to `/` | Redirect works (client-side). The server returns the HTML shell with HTTP 200 for `/fanclub/`, `/fanclub/photo/` and `/admin/`; protection is a JavaScript session check, and the page renders blank until it resolves | P | Med |
| D-067 | Auth | AD-ROUTE-02 | `/login` → `/`, `/auth` → `/join` | Matches. Implemented as server 302 redirects (`_redirects`) as well as a client page | P | Low |
| D-068 | 404 | AD-404-01 | Styling uses LGFC tokens; CTA to `/` | Text and CTA present, but the layout classes are Tailwind-style names with no CSS: the "Return Home" link has 0 padding (measured `0px`), no centring | P | Med |
| D-069 | Member | AD-FAN-01 vs AD-FAN-02 | Two incompatible Club Home designs in the docs | Built = newspaper design (AD-FAN-02). Welcome section, post creation and discussion feed exist as components but are not mounted | S/M | Med |
| D-070 | Member | AD-FAN-02 | Vertical numbered order incl. feature link cards at position 4 and submission CTA at 13 | Implemented as a 3-column grid (left / centre / right) plus a footer row; feature link cards ("Club Features") and the submission CTA are in the footer row, not mid-page | M | Low |
| D-071 | Member | AD-FAN-03 | Sub-pages are desktop only; container 1200px / 20px | Responsive at 520/600/900px; widths 980–1100px with 16px padding (28px/12px at ≤520px) | S/M | Low |
| D-072 | Member | AD-FAN-04 | Active tag pill uses LGFC Blue | `#1e3a8a` (a third blue) in Photo and Memorabilia | S | Low |
| D-073 | Member | AD-FAN-04 | Photo search reflected in URL `?q=` | Photo gallery keeps search/tags in component state (URL only carries `?id=` for the detail view); Library and Memorabilia do use `?q=` | S | Low |
| D-074 | Member | AD-FAN-04 | Photo/Chat/Submit follow the site's light visual language | Styled with `rgba(255,255,255,…)` borders and fills for a dark theme that does not exist: borders vanish and inputs render as grey bars on the light page | M | Med |
| D-075 | Member | AD-FAN-07 | Email address is an editable required field | Email is **disabled** (read-only); only first name, last name, screen name and opt-in are editable | S | Med |
| D-076 | Member | AD-FAN-07 | Membership card section shows front and back card images | `/membercard-front.png` and `/membercard-back.png` return **404 on production** (and are absent from the repo); the section renders broken images | P | High |
| D-077 | Member | AD-PLAT-02 | Membership card content on `/fanclub/myprofile` | Matches; seed copy is placeholder text ("This is the Membership Card instructions content…") in the migration | S | Low |
| D-078 | Admin | AD-ROUTE-06, AD-ADM-01 | Entry point `/admin/dashboard` | Entry is `/admin`; `/admin/dashboard` is not a route | S | Med |
| D-079 | Admin | AD-ADM-02 | Left sidebar + top bar with admin name/email and logout | PageShell title row + wrapping pill navigation + 2-column card grid; the standard public header carries Club Home/Search/Store/Logout; no admin identity bar | M | Med |
| D-080 | Admin | AD-ADM-03 | Areas: Reports, Posts, Media, Milestones, Events, Matchup, Users, System Health | 18 tools built: Dashboard, Moderation, Audit & Reporting, FAQ Queue, Page Content, CMS Blocks, Editorial Archive, Events, Matchup, Fundraiser Preview, Club Staging, Join Requests, Worklist, Member Operations, Media Assets, Rights Review, Archive Items, D1 Inspect. **No Posts manager, Milestones manager, Users manager or System Health view**; Reports live inside Moderation | S/M | Med |
| D-081 | Campaign | AD-HOME-08 | Spotlight keeps typography and spacing stable; brand tokens | Card hard-codes `#0033cc`, a 24px radius, a gradient and `0 18px 40px` shadow — the only gradient on the site | S | Low |
| D-082 | Campaign | AD-HOME-09 | ALS Fundraiser 2026 timeline (May–June 2026) | Not shown: the Spotlight is disabled in production (`/api/cms/get?key=home.campaign_spotlight` returns `block:null`); About copy says no live fundraiser; `/fundraiser-details` copy refers to a 2027 fundraiser; `/api/fundraiser-details/list` is empty | P | Low |
| D-083 | Platform | AD-PLAT-01 | Spec describes one CSP policy (in repo `_headers`) | Production sends **two** policies: the enforced CSP from `_headers` and an additional stricter `Content-Security-Policy-Report-Only` (`default-src 'self'`, `frame-ancestors 'none'`, reports to `/api/csp-report`) plus `Referrer-Policy: strict-origin-when-cross-origin` | P | Low |
| D-084 | Docs | AD-ADM / AD-FAN | Design docs describe the system | `dashboard.md` is marked INCOMPLETE and does not describe what was built; the 2026-08-11 repo as-built baseline predates current Production data | S | Low |

### 5.1 Differences that need a decision (not just a fix)
1. **Brand blue — D-001, D-002, D-005, D-006.** The style guide says `#0033cc`; production is `#002868` navy because of stylesheet order. Decide which is the brand, then fix the stylesheet or the guide.
2. **Undefined `.card`, `.grid`, `.btn` and the Join-banner buttons — D-028, D-017.** These look unfinished rather than chosen; the legacy v6 mock-up defines them. Decide between styling them as designed or updating the design to what ships.
3. **Design documents that disagree with each other — D-036, D-069, D-030** (floating logo values, Club Home layout, FanClub drawer). The build follows the header lock for the logo and the newer newspaper spec for Club Home. Pick one canonical statement for each.
4. **Membership card images — D-076** are a missing asset on production (High).
5. **Recent discussions teaser — D-039.** The spec says public teaser content; the build shows nothing to visitors. Decide whether to expose a public teaser or change the spec.
6. **Client-side-only route protection — D-066.** The auth spec requires a redirect; the shell is served with HTTP 200 and protected by a JavaScript check.

### 5.2 Where this register may be incomplete
Rows marked **S** or **M** are based on source and a mock render; production may differ for member and admin pages. Admin tools beyond the dashboard were compared only at the level of navigation, titles and form fields. The register compares the written design documents; it does not cover content decisions that no document specifies (for example live FAQ wording).
