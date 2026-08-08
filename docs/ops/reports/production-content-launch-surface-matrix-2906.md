---
Doc Type: Report
Audience: Human + AI
Authority Level: Program Evidence
Status: Draft — #2906 matrix delivery
source issue: #2906
Parent Project: #2859
Owns: Authoritative launch-surface and content/data matrix for public, Fan Club, and administrative routes
Does Not Own: Runtime implementation, Production D1/B2 population, rights clearance, editorial approval, publication
Canonical Reference: /docs/ops/reports/website-public-launch-gap-inventory.md
related issues: #2859, #2907, #2908, #2909, #2858, #2039, #2041, #2042, #2045, #1685, #1700
Last Reviewed: 2026-08-08
Executor: Grok (Lane 3) — Product Authority reassigned from Codex after Codex unavailability
---

# Production Content Launch Surface & Content/Data Matrix (#2906)

## Purpose

Authoritative inventory of every launch-required public, Fan Club, and administrative route/component/state with required copy, records/data, media/assets, links/dates, attribution, rights/privacy conditions, fallbacks/empty states, accountable owner, evidence source, and current disposition.

## Scope

- Repository routes under `src/app/**` present on bound base `component/production-content-readiness` @ `00e1608adb8ff27b24eae2fa995372e79c2ab8eb` (aligned with live `main` inventory inspection @ `c114d8bd250f4db4af3b0f18aeeba416724ef79b` for route parity).
- Launch readiness contract: `scripts/launch-readiness/manifest.json`.
- Evidence from prior Program #2039 / #1259 / #1685 reports (read-only).
- **Does not** assert Production population counts, rights clearance, or editorial approval where evidence is absent.
- **Does not** implement #2907–#2909 work units.

## Current known truth

- Parent project #2859 is active; child #2906 is the matrix increment only.
- Structural public and Fan Club routes from Program #1685 remain on `main` and are present under the component base SHA above.
- Launch readiness manifest (`scripts/launch-readiness/manifest.json`) enumerates required public, Fan Club, admin, and ai-review routes.
- Prior evidence exists for gap inventory (#2041), copy reconciliation (#2042), fundraiser boundary (#2045), and QA route/content validation (#1259 lineage).
- Campaign/fundraiser public surfaces remain fail-closed (`enabled: false` / deferred modules).
- Production D1/B2 population counts were **not** queried in this increment; data-backed surfaces default to `missing-actionable` unless repository evidence proves static or fail-closed behavior.
- #2858 responsive-contract acceptance is a non-blocking predecessor for this matrix; it gates final consumption only.

## Intended final state

- One authoritative matrix report merged on `component/production-content-readiness` that successors #2907–#2909 can consume without re-inventorying routes.
- Every launch-required surface has a disposition and accountable owner; protected Product/editorial/rights decisions are explicit rather than inferred.
- No claim of Production launch readiness from this document alone.

## Disposition vocabulary (required)

| Code | Meaning |
| --- | --- |
| `approved-present` | Evidence shows required artifact present and previously accepted for launch-prep use |
| `missing-actionable` | Required for launch; successor task must supply |
| `intentionally-empty-approved` | Empty/absent by design with recorded boundary |
| `deferred-safe-fallback` | Launch-safe empty/fallback behavior; full content deferred |
| `protected-pending-decision` | Product/editorial/rights/privacy decision required before asserting readiness |

## Evidence classes (kept distinct)

1. **Repository** — page/component source, static copy, fixtures, migrations, manifests.
2. **D1** — structured records (FAQ, milestones, events, matchup, CMS, content_inventory, members).
3. **B2** — media objects / photo URLs referenced by D1 or components.
4. **Configuration** — env, CMS `enabled` flags, external vendor URLs (Bonfire, Elfsight, Givebutter).
5. **Prior report** — ops reports under `docs/ops/reports/` (gap inventory, copy reconciliation, QA validation, fundraiser boundary).

## Bound base & collision check (2026-08-08)

| Check | Result |
| --- | --- |
| Component branch | `component/production-content-readiness` @ `00e1608adb8ff27b24eae2fa995372e79c2ab8eb` |
| Working branch | `grok/2859-001-launch-surface-matrix` (Grok takeover; prior empty `codex/2859-001-launch-surface-matrix` left untouched) |
| Open PR for #2906 | Delivery PR opened after matrix authoring (see PR targeting this report); none existed at branch-creation collision check |
| Allowlisted write path | `docs/ops/reports/production-content-launch-surface-matrix-2906.md` only |
| `main` drift note | `main` advanced to `c114d8bd…`; route inventory inspected on `main` for completeness; matrix remains valid for component base unless material route deletion occurs |

<!-- gate-rerun: 2026-08-08T16:05Z -->

---

## 1. Public core surfaces

| ID | Route / component / state | Required copy / content | D1 / data | B2 / media | Links / dates / config | Attribution / rights / privacy | Fallback / empty | Owner | Evidence | Disposition | Successor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | `/` homepage hero | H1 + 2027 relaunch subtitle | None (static) | None | — | Historical facts; no private data | Static always renders | Product (Bill) | `src/app/page.tsx`; #2042 copy report | `approved-present` | — |
| P-02 | `/` `CampaignSpotlightSlot` | Campaign headline/body only if enabled | CMS campaign config | Optional campaign image | `enabled: true` gate | No false live-fundraiser claim | Hidden when disabled | Product / #1700 | `CampaignSpotlightSlot.tsx`; fundraiser-boundary report | `intentionally-empty-approved` | #2908 if go-live authorized |
| P-03 | `/` `WeeklyMatchup` | Pair titles/descriptions; vote UI | matchup + photos tables | Photo URLs (B2/CDN) | `week_start` | Photo rights for public vote pair | Empty pair / loading state | Ops editorial | `WeeklyMatchup.tsx`; APIs | `missing-actionable` | #2907/#2908 population |
| P-04 | `/` `JoinCTA` | Public vs member benefit copy | None | None | `/join` | No PII | Static | Product | `JoinCTA.tsx`; #2042 | `approved-present` | — |
| P-05 | `/` About Lou Gehrig section | Biography static copy | None | None | Historical dates | Public-domain historical narrative; no rights claim beyond club voice | Static | Product | `src/app/page.tsx` | `approved-present` | Editorial polish → #2907 if needed |
| P-06 | `/` `SocialWall` | Third-party embed | None | Elfsight / external | Vendor config | Third-party privacy; no member PII in embed | Fail-soft if vendor down | Ops | `SocialWall.tsx`; social-reliability report | `deferred-safe-fallback` | #2908 reliability |
| P-07 | `/` `RecentDiscussionsTeaser` | Teaser titles for guests | Discussions / D1 | — | — | No private member content to guests | Empty teaser OK | Product | page.tsx; #2042 remediation | `deferred-safe-fallback` | #2908 if live feed required |
| P-08 | `/` `FriendsOfFanClub` | Partner names/blurbs | friends/partners data or static | Logos optional | External partner links | Partner permission for logos/names | Empty list OK | Product | `FriendsOfFanClub.tsx` | `missing-actionable` | #2907 content batch |
| P-09 | `/` `MilestonesSection` | Milestone titles/dates | `milestones` table | Optional `photo_url` | Chronology | Photo rights if images | Empty section | Editorial | `MilestonesSection.tsx` | `missing-actionable` | #2907/#2908 |
| P-10 | `/` `CalendarSection` | Upcoming events teaser | events table | — | Event dates | Public events only | Empty calendar | Editorial | `CalendarSection.tsx` | `missing-actionable` | #2907 |
| P-11 | `/` `FAQSection` | Q&A cards | FAQ table | — | — | Club-reviewed answers | Empty + link to `/faq` | Editorial | `FAQSection.tsx` | `missing-actionable` | #2907 |
| P-12 | `/about` | Club purpose; public/member boundary; no live fundraiser claim | Optional CMS override | — | — | No false campaign claims | Static fallback | Product | `src/app/about/page.tsx`; #2042 | `approved-present` | Legal polish if requested |
| P-13 | `/contact` | Support routing; non-campaign disclaimer | CMS contact rows (migration 0040) | — | — | No PII in page body | Static/CMS | Product / content ops | `contact/page.tsx`; migration 0040 | `approved-present` | CMS body review → Product |
| P-14 | `/faq` | Full FAQ list | FAQ D1 | — | — | Approved answers only | Empty state + Ask CTA | Editorial | `faq/page.tsx` | `missing-actionable` | #2907 seed |
| P-15 | `/ask` | Submission form copy; moderator review disclosure | Ask/moderation queues | — | Email welcome behavior | Submitter PII in API only; not rendered publicly | Form always; success/error states | Product | `ask/page.tsx`; #2042 | `approved-present` | Privacy review if policy changes |
| P-16 | `/events` | Calendar preview copy | events D1 | — | Event dates | Public events | Empty calendar + launch-prep copy | Product (IA open) | `events/page.tsx`; #2042 | `protected-pending-decision` | Bill/ChatGPT: retain in nav? |
| P-17 | `/search` | Idle helper; result labels | search index (FAQ, events, milestones, friends, inventory) | — | Query params | No private member fields in public results | Idle + zero-results copy | Product | `search/page.tsx`; content-inventory validation | `approved-present` (shell); data `missing-actionable` | #2907 index population |
| P-18 | `/join` | Join/auth modes | members / join-requests | — | Auth flows | Account PII server-side only | AuthClient UI | Product | `join/page.tsx` → AuthClient | `approved-present` | — |
| P-19 | `/login` | Login copy | session | — | — | Credentials never in page | Form | Product | `login/page.tsx` | `approved-present` | — |
| P-20 | `/logout` | Logout flow | session clear | — | POST `/api/logout` | — | Redirect | Ops | `logout/page.tsx` | `approved-present` | — |
| P-21 | `/auth` | Legacy redirect to `/join` | — | — | Redirect | — | Redirect only | Ops | manifest + route | `intentionally-empty-approved` | — |
| P-22 | `/privacy` | Privacy policy body | — | — | Effective dates | Legal | Static | Product / legal | `privacy/page.tsx`; #2042 deferred legal rewrite | `protected-pending-decision` | Attorney review |
| P-23 | `/terms` | Terms body | — | — | Effective dates | Legal | Static | Product / legal | `terms/page.tsx` | `protected-pending-decision` | Attorney review |
| P-24 | `/health` | Probe marker `OK: health` | — | — | — | No content | Minimal shell | Ops | `health/page.tsx` | `approved-present` | Exclude from public content QA |
| P-25 | Footer Privacy/Terms/Contact | Labels + targets | Optional footer quote D1 | — | Manifest footerLinks | — | Always | Ops | `Footer.tsx`; manifest | `approved-present` | — |
| P-26 | Public header / hamburger | Nav labels; Join/Search/Store | — | — | Bonfire store URL | External store | Always | Product (IA) | `Header.tsx`; SiteHeader | `protected-pending-decision` (FAQ/Ask/Events in hamburger) | Bill/ChatGPT IA |
| P-27 | `robots.ts` / `sitemap.ts` | Crawl rules; URL list | — | — | Public route list | — | Generated | Ops | `src/app/robots.ts`, `sitemap.ts` | `approved-present` | SEO depth → prior #2046 lineage |
| P-28 | Global error / not-found | Error + 404 copy | — | — | — | — | Always | Ops | `error.tsx`, `not-found.tsx` | `approved-present` | — |

### Justified exclusions (public)

| Route | Reason |
| --- | --- |
| `/store` | Forbidden in manifest; external Bonfire only |
| `/ai-review/*` | Internal review snapshots; not public launch content |
| `/_ai-review/*` | Same class as above |

---

## 2. Fan Club (member) surfaces

All member routes require authenticated session (`useMemberSession`); unauthenticated users redirect to `/`.

| ID | Route / component / state | Required copy / content | D1 / data | B2 / media | Links / dates / config | Attribution / rights / privacy | Fallback / empty | Owner | Evidence | Disposition | Successor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | `/fanclub` masthead | Welcome + relaunch prep | session email | — | — | Email display to self only | Auth gate | Product | `ClubHomeMasthead`; #2042 | `approved-present` | — |
| F-02 | `/fanclub` lead story + story rail | Headlines, summaries, credits | Club home content API/D1 | Optional media | Source names | Credit required when present | Empty modules OK | Editorial | `useClubHomeContent`; ClubHome* | `missing-actionable` | #2907/#2908 |
| F-03 | `/fanclub` ArchivesTiles | Archive entry points | archive/inventory | — | Internal links | Member-only | Empty tiles | Editorial | `ArchivesTiles.tsx` | `missing-actionable` | #2907 |
| F-04 | `/fanclub` media feature | Featured media | media records | B2 | — | Rights for display | Empty | Editorial | `ClubHomeMediaFeature` | `missing-actionable` | #2908 B2 |
| F-05 | `/fanclub` campaign module | Fail-closed reason string | — | — | No live campaign | No false live claim | Deferred module copy | Product / #1700 | `ClubHomeDeferredModule`; fundraiser boundary | `intentionally-empty-approved` | #1700 |
| F-06 | `/fanclub` events callout | Deferred reason | — | — | — | — | Deferred module | Product | same | `deferred-safe-fallback` | Wire when calendar connected |
| F-07 | `/fanclub` recognition tile | Deferred reason | — | — | — | Partner rights later | Deferred module | Product | same | `deferred-safe-fallback` | — |
| F-08 | `/fanclub` submission CTA | Submit prompt | — | — | `/fanclub/submit` | — | Static CTA | Product | `ClubHomeSubmissionCta` | `approved-present` | — |
| F-09 | `/fanclub/photo` gallery | Titles, tags, filters | photos table | B2 URLs | Tag filters | Uploader privacy; member-only | Empty gallery + message | Editorial / members | `fanclub/photo/page.tsx` | `missing-actionable` | #2908 media batch |
| F-10 | `/fanclub/submit` | Upload/submission UX | pending submissions | Upload target | — | Member PII; moderation | Validation errors | Product | `fanclub/submit/page.tsx` | `approved-present` (UX); queue data ops | #2909 moderation |
| F-11 | `/fanclub/library` | Titles, authors, years | library / content_inventory `library` | — | `?q=` | Member-only; attribution | Empty + search | Editorial | `library/page.tsx`; inventory validation | `missing-actionable` | #2907 |
| F-12 | `/fanclub/memorabilia` | Cards + related library | memorabilia + related | Thumbnails B2 | Tags | Rights for images | Empty grid | Editorial | `memorabilia/page.tsx` | `missing-actionable` | #2907/#2908 |
| F-13 | `/fanclub/membercard` | Member card fields | member profile | Optional avatar | — | Self PII only | Placeholder card | Product | `membercard/page.tsx` | `approved-present` (shell) | Profile completeness |
| F-14 | `/fanclub/myprofile` | Profile edit copy | member record | — | — | Self PII | Form states | Product | `myprofile/page.tsx` | `approved-present` | — |
| F-15 | `/fanclub/chat` | Chat UI copy | chat messages | — | — | Member communications privacy | Empty thread | Product | `chat/page.tsx` | `deferred-safe-fallback` | Ops policy if launch-critical |
| F-16 | Fan Club header | Member nav | session | — | Member routes | — | Auth-aware | Product | SiteHeader fanclub variant | `approved-present` | — |

---

## 3. Administrative / operator surfaces (launch-adjacent)

Admin surfaces are **not** public content but are required for launch operations and content readiness. Matrix tracks preview/moderation only.

| ID | Route | Role in launch content | Data / media | Privacy | Fallback | Owner | Evidence | Disposition | Successor |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | `/admin` dashboard | Operator entry | — | Admin auth | — | Ops | `admin/page.tsx` | `approved-present` | — |
| A-02 | `/admin/clubstaging` | Stage club content cards; non-public | Staging samples | Admin only | Empty staging | Ops / #2043 | route present in manifest | `approved-present` (route) | Content samples → #2907 |
| A-03 | `/admin/fundraiser-preview` | Campaign config preview | CMS fundraiser | Admin only | Disabled by default | Ops / #1700 | fundraiser-boundary report | `intentionally-empty-approved` | Enable only with authorization |
| A-04 | `/admin/matchup` | Weekly pair management | matchup + photos | Admin | Conditional route | Editorial | manifest conditionalRoutes | `missing-actionable` (pairs) | #2908 |
| A-05 | `/admin/faq` | FAQ moderation | FAQ | Admin | — | Editorial | admin/faq | `missing-actionable` | #2907 |
| A-06 | `/admin/events` | Event CRUD | events | Admin | — | Editorial | admin/events | `missing-actionable` | #2907 |
| A-07 | `/admin/editorial` | content_inventory sections | inventory | Admin | — | Editorial | editorial page; inventory validation | `approved-present` (UI); records `missing-actionable` | #2907 |
| A-08 | `/admin/cms` | CMS pages (contact, campaign) | CMS rows | Admin | — | Content ops | admin/cms | `approved-present` (tooling) | — |
| A-09 | `/admin/media-assets` | Media registry | B2 refs | Admin | — | Ops | media-assets | `missing-actionable` | #2908 |
| A-10 | `/admin/moderation` | Ask/submissions review | queues | Admin + submitter PII | Empty queue | Ops | moderation page | `deferred-safe-fallback` | #2909 |
| A-11 | `/admin/join-requests` | Membership intake | join requests | PII | Empty | Ops | join-requests | `deferred-safe-fallback` | Ops process |
| A-12 | `/admin/member-operations` | Member admin | members | PII | — | Ops | member-operations | `approved-present` (tooling) | — |
| A-13 | `/admin/content` / `worklist` / `audit` | Content ops / audit | various | Admin | — | Ops | admin routes | `approved-present` | — |
| A-14 | `/admin/d1-test` | Diagnostics | — | Admin | — | Ops | d1-test | `intentionally-empty-approved` | Not a launch content surface |

---

## 4. Cross-cutting content systems

| ID | System | Surfaces | Required state for launch | Evidence | Disposition | Successor |
| --- | --- | --- | --- | --- | --- | --- |
| X-01 | content_inventory | search, library; homepage_* reserved unwired | Published rows for `search` + `library` | content-inventory public surface validation report | `missing-actionable` (counts unknown without D1 read) | #2907 |
| X-02 | CMS (`/api/cms/get`) | contact, campaign spotlight | Contact launch copy present; campaign `enabled: false` | migration 0040; CampaignSpotlightSlot | contact `approved-present`; campaign `intentionally-empty-approved` | — |
| X-03 | Weekly matchup APIs | homepage weekly | Current week pair + vote endpoints | WeeklyMatchup.tsx | `missing-actionable` | #2908 |
| X-04 | Fan club photo APIs | photo, memorabilia, submit | List/tags/upload paths | fanclub photo pages | `missing-actionable` | #2908 |
| X-05 | Elfsight social wall | homepage | Vendor account live or fail-soft | SocialWall; social-reliability report | `deferred-safe-fallback` | Ops vendor |
| X-06 | Bonfire store link | header Store | External URL stable | Header.tsx; manifest | `approved-present` | — |
| X-07 | Auth/session | join/login/logout/fanclub/* | Session cookie flows | useMemberSession | `approved-present` | — |
| X-08 | Launch readiness manifest | CI / e2e contract | requiredRoutes + markers | `scripts/launch-readiness/manifest.json` | `approved-present` | Update only if routes change |
| X-09 | SEO / social cards | public pages | Per-route metadata | seo-analytics-readiness report | `deferred-safe-fallback` | Prior #2046 lineage / #2909 QA |
| X-10 | Accessibility / responsive | all public + fanclub | Contract evidence | #2858 gate (non-blocking for this matrix) | `protected-pending-decision` for final consumption | #2858 ACCEPT before final launch claim |

---

## 5. Privacy-safe reconciliation notes

- This matrix **does not** contain credentials, member emails, or private message bodies.
- Production D1/B2 **counts were not queried** under #2906 (no Production read credentials in this increment; cost boundary zero). Dispositions for data-backed surfaces default to `missing-actionable` unless repository evidence proves static/`enabled: false`/fail-closed behavior.
- Local/fixture evidence available in-repo: `data/mock-*.json`, `data/fundraiser.json`, `data/b2/inventory.json`, research candidates under `data/research/` — treated as **non-Production** seeds only.
- Member PII surfaces (profile, chat, join-requests, ask submissions) must remain non-public; matrix does not authorize any public rendering of those fields.

---

## 6. Unresolved protected decisions (Product / editorial / rights / privacy)

| Decision | Why blocked | Accountable owner | Blocks |
| --- | --- | --- | --- |
| `/events` in primary navigation / hamburger | Route exists; absent from canonical IA | Bill / ChatGPT | Final nav claim |
| FAQ / Ask / Events hamburger inclusion | Discoverability vs IA | Bill / ChatGPT | Header finalization |
| Final 2027 relaunch date messaging | Only preparatory copy today | Bill / ChatGPT | Homepage hero final wording |
| Privacy & Terms attorney review | No legal rewrite in #2042 | Legal / Bill | Legal page `approved-present` |
| Live fundraiser / Givebutter enablement | Fail-closed by design | Bill / #1700 | Campaign spotlight enable |
| Photo / memorabilia public-rights subset | Member gallery is member-only; any future public reuse needs rights | Editorial / rights | Any public media promotion |
| Production population authorization | Separate from matrix | Product Authority | #2908 execution |
| #2858 responsive-contract ACCEPT | Entry gate for final consumption | Cursor Local / WORK | Final launch packaging only |

---

## 7. Coverage summary

| Class | Matrix entries | Primary dispositions |
| --- | --- | --- |
| Public core | P-01…P-28 | Mix: static `approved-present`; data-driven `missing-actionable`; legal/IA `protected-pending-decision`; fundraiser/social `intentionally-empty` / `deferred-safe-fallback` |
| Fan Club | F-01…F-16 | Shells `approved-present`; content/media `missing-actionable`; campaign fail-closed `intentionally-empty-approved` |
| Admin launch-adjacent | A-01…A-14 | Tooling present; operational data batches pending |
| Cross-cutting | X-01…X-10 | Inventory/matchup/media population pending |

**Launch-required route coverage:** Every `requiredRoutes` entry in `scripts/launch-readiness/manifest.json` is mapped or explicitly excluded (`/store` forbidden; `/ai-review/*` internal).

**Homepage sections:** hero, campaign slot, weekly matchup, join CTA, about Lou, social wall, discussions teaser, friends, milestones, calendar, FAQ — all mapped (P-01…P-11).

**Fan Club required:** home modules, photo, submit, library, memorabilia, membercard, myprofile, chat — all mapped.

---

## 8. Findings routed to successors (not implemented under #2906)

| Finding | Target child |
| --- | --- |
| D1 seed/population for FAQ, milestones, events, friends, library, matchup pairs | #2907 / #2908 |
| B2 media upload + URL binding for photos/memorabilia/matchup | #2908 |
| Controlled publication batches + pre/post counts | #2908 |
| Cross-route link/attribution/search/fallback/a11y QA | #2909 |
| Editorial approval of final copy strings still marked protected | Product Authority (outside code) |
| #2858 responsive evidence consumption | After #2858 ACCEPT |

---

## 9. Verification record (#2906)

| Check | Result |
| --- | --- |
| Writable path | Only `docs/ops/reports/production-content-launch-surface-matrix-2906.md` |
| Route inventory method | GitHub recursive tree of `src/app/**/page.tsx`; launch manifest; prior QA route-nav report |
| Evidence paths validated as existing on `main` | Gap inventory, copy reconciliation, fundraiser boundary, content-inventory validation, route-nav validation, homepage/fanclub sources, manifest |
| Privacy review | No credentials or private member payloads in this report |
| Production mutation | None |
| Paid dependency | None |
| git changed-path intent | Single allowlisted report |

---

## 10. Rollback

Revert or replace this report via normal reviewed PR path. No Production data rollback applies.

## 11. Handoff implications

- **#2907** may begin repository/fixture corrections and missing-content sourcing plans using this matrix as the authoritative surface list.
- **#2908** must not populate Production without separate protected authorization and backup evidence.
- **#2909** QA should walk every `missing-actionable` and `protected-pending-decision` row.
- Matrix does **not** claim Production launch readiness.

---

*End of #2906 matrix.*
