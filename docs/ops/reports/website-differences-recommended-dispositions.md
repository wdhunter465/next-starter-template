---
Doc Type: Operations
Audience: Human + AI
Authority Level: Supporting (recommendation record; not design authority)
Owns: Recommended dispositions for the 84 differences and the six design conflicts in the #4409 register, for Product Authority review
Does Not Own: Any decision (Product Authority decides), locked design specifications under docs/reference/design/**, or application code
Canonical Reference: /docs/governance/PRODUCT-AND-DESIGN.md
Related Issues: #4409, #4420, #4411, #4431, #4442
Last Reviewed: 2026-10-08
---

# Recommended dispositions for the website design differences

## Status

`_DRAFT` recommendation. The register (`website-differences-register.md`) leaves the decision columns empty on purpose. This file proposes an answer for every row so the review can be done by exception: accept all, or name the rows to change. Nothing here changes a spec or the site.

Codes: **A** change the build to match the design · **B** change the design (update the owning spec first) · **C** accept as a recorded deviation · **D** defer.

## Summary

| Disposition | Rows | High | Med | Low |
| --- | --- | --- | --- | --- |
| A | 35 | 4 | 19 | 12 |
| B | 17 | 1 | 12 | 4 |
| C | 23 | 0 | 4 | 19 |
| D | 9 | 0 | 1 | 8 |
| Total | 84 | 5 | 36 | 43 |

How I chose: a difference that makes the site look broken, hurts accessibility, or hits the brand colour is **A**. Where the build is deliberate, shipped and better than the written spec, the spec is **B**. Cosmetic drift with no visitor impact is **C**. Polish that does not matter for launch is **D**.

## The five High differences

| ID | Difference | Recommendation | Why |
| --- | --- | --- | --- |
| D-001 | Brand blue renders `#002868`, not `#0033cc` | A | Stylesheet load order; one fix recolors the hero, headings, links, buttons and menu |
| D-017 | Join and Login render as plain white text; Vote buttons are grey native buttons | A | Visible on the homepage banner today |
| D-028 | `.card`, `.grid`, `.btn` and `.link` are used but defined nowhere | A | Several blocks render with no border or layout |
| D-039 | Discussions teaser is not publicly viewable | B | Discussions are private; update the spec, not the build |
| D-076 | Membership card images return 404 on Production | A | Supply the two images (or hide the section until you do) |

## Rulings on the six design conflicts

| # | Conflict | Recommended ruling |
| --- | --- | --- |
| C-1 | Floating logo size and behavior | The design lock version is built; mark the production-standards value superseded |
| C-2 | Club Home design | Newspaper layout is built; retire the older design |
| C-3 | FanClub drawer (7 vs 12 items) | Twelve items match the shipped member features; update the spec |
| C-4 | Member header name | `FanClubHeader` is the real name; update the design lock |
| C-5 | Header height | The built 96px (80px mobile) stays; update the spec |
| C-6 | Contact mailbox | **Your call:** confirm whether `Support@` or `Contact@` is the live mailbox; I recommend `Support@` only if it is monitored |

## Fix themes for the A rows (child Issues under #4420, one theme per PR)

- **Color and tokens** (6): D-001, D-002, D-003, D-005, D-072, D-081
- **Typography** (4): D-010, D-011, D-013, D-014
- **Buttons, links and forms** (4): D-016, D-017, D-018, D-046
- **Cards, layout and spacing** (4): D-024, D-027, D-028, D-068
- **Header, footer and logo** (2): D-031, D-033
- **Home page content** (3): D-040, D-042, D-044
- **Search and text pages** (7): D-048, D-049, D-053, D-055, D-057, D-058, D-061
- **Member, admin and auth** (4): D-065, D-074, D-076, D-077
- **Platform and documents** (1): D-062

The five High items go first (color, then buttons and card classes, then the membership card images). D-040 and D-061 are verify-and-close.

## All 84 rows

| ID | Area | Sev. | Rec. | Theme | Rationale |
| --- | --- | --- | --- | --- | --- |
| D-001 | Colour | High | **A** | Color and tokens | Brand blue is the first thing a visitor sees; fix the stylesheet load order so the design token wins |
| D-002 | Colour | Med | **A** | Color and tokens | Same token fix; hover should darken |
| D-003 | Colour | Med | **A** | Color and tokens | One-line token fix with D-001 |
| D-004 | Colour | Low | **C** | Color and tokens | Barely visible; keep |
| D-005 | Colour | Med | **A** | Color and tokens | Replace hard-coded blue with the token so D-001 fixes every use |
| D-006 | Colour | Low | **D** | Color and tokens | Unused token; remove later |
| D-007 | Typography | Med | **C** | Typography | Serif titles are deliberate on Club Home and About; record as a deviation (revisit admin pages later) |
| D-008 | Typography | Med | **B** | Typography | Built hero size is larger and tested on devices; update the spec to 48/64/72 |
| D-009 | Typography | Low | **D** | Typography | Cosmetic; decide with D-008 |
| D-010 | Typography | Med | **A** | Typography | Page titles should be one size; remove the inline overrides |
| D-011 | Typography | Med | **A** | Typography | Section headings should hold the 22px mobile minimum |
| D-012 | Typography | Low | **C** | Typography | 16px body on mobile is easier to read; accept |
| D-013 | Typography | Med | **A** | Typography | Shared meta text class should be 14px |
| D-014 | Typography | Med | **A** | Typography | No text under 13px (accessibility) |
| D-015 | Typography | Low | **C** | Typography | Small drift; accept |
| D-016 | Buttons | Med | **A** | Buttons, links and forms | One primary button style removes most of the button drift |
| D-017 | Buttons | High | **A** | Buttons, links and forms | Join, Login and Vote look broken today; visible on the homepage banner |
| D-018 | Buttons | Med | **A** | Buttons, links and forms | Keyboard focus ring on all controls (accessibility) |
| D-019 | Buttons | Low | **C** | Buttons, links and forms | Secondary button variants are acceptable |
| D-020 | Buttons | Low | **D** | Buttons, links and forms | Spinner is polish; defer |
| D-021 | Buttons | Low | **C** | Buttons, links and forms | Accept mixed disabled look |
| D-022 | Links | Low | **C** | Buttons, links and forms | Underlined links are required for accessibility; update the spec if wanted |
| D-023 | Links | Low | **C** | Buttons, links and forms | Accept |
| D-024 | Spacing | Med | **A** | Cards, layout and spacing | Use the 48/32/20 rhythm tokens on the home page |
| D-025 | Spacing | Low | **C** | Cards, layout and spacing | Accept |
| D-026 | Layout | Med | **B** | Cards, layout and spacing | Page widths are deliberate by page type; document them in the spec |
| D-027 | Radius | Med | **A** | Cards, layout and spacing | Banner radius should come from one token (the second rule overrides it) |
| D-028 | Cards | High | **A** | Cards, layout and spacing | Several blocks use card and grid classes that no stylesheet defines; define them |
| D-029 | Header | Med | **B** | Header, footer and logo | 96px header is built and in use; update the spec |
| D-030 | Header | Med | **B** | Header, footer and logo | Twelve drawer items match the shipped member features |
| D-031 | Header | Med | **A** | Header, footer and logo | Header buttons wrap to two lines on desktop |
| D-032 | Header | Low | **B** | Header, footer and logo | Rename in the design to FanClubHeader |
| D-033 | Header | Low | **A** | Header, footer and logo | Members briefly see Join and Login while the session loads |
| D-034 | Footer | Med | **B** | Header, footer and logo | Accessibility link in the footer is wanted; update the spec |
| D-035 | Footer | Low | **C** | Header, footer and logo | Accept |
| D-036 | Logo | Med | **B** | Header, footer and logo | The design lock version is what is built; mark the other spec superseded (conflict C-1) |
| D-037 | Logo | Low | **C** | Header, footer and logo | Matches; nothing to do |
| D-038 | Home | Low | **B** | Home page content | Fundraiser teaser is needed for the fundraiser; add it to the locked order |
| D-039 | Home | High | **B** | Home page content | Discussions stay private; privacy-safe. Update the spec, not the build |
| D-040 | Home | Med | **A** | Home page content | Placeholder milestone row; already removed by #4411, verify and close |
| D-041 | Home | Low | **C** | Home page content | Friends list differs by content, not design; owner decides the list |
| D-042 | Home | Low | **A** | Home page content | Weekly Matchup photo frame and captions need fixing |
| D-043 | Home | Low | **C** | Home page content | Data driven; matches |
| D-044 | Home | Low | **A** | Home page content | Loading line and fallback should not both show |
| D-045 | Search | Med | **B** | Search and text pages | Search width is deliberate |
| D-046 | Search | Med | **A** | Buttons, links and forms | Same focus fix as D-018 |
| D-047 | Search | Low | **C** | Search and text pages | Wording is clearer as built |
| D-048 | Search | Low | **A** | Search and text pages | Result count at 14px with D-013 |
| D-049 | Search | Med | **A** | Search and text pages | Result title and excerpt sizes follow the type scale |
| D-050 | Search | Low | **C** | Search and text pages | Badges reflect real content types |
| D-051 | Search | Low | **D** | Search and text pages | Previous and Next buttons are polish |
| D-052 | Search | Low | **C** | Search and text pages | Archive entries in search are intended |
| D-053 | Search | Low | **A** | Search and text pages | Search button follows the primary button |
| D-054 | Text pages | Med | **B** | Search and text pages | 900px reads well; update the spec |
| D-055 | Text pages | Low | **A** | Search and text pages | Text page headings follow one style |
| D-056 | Text pages | Low | **C** | Search and text pages | Accept |
| D-057 | Text pages | Med | **A** | Search and text pages | Text page heading spacing follows one style |
| D-058 | Text pages | Med | **A** | Search and text pages | About should share the layout of the other text pages |
| D-059 | Text pages | Med | **B** | Search and text pages | Support mailbox is the live one; update the spec (conflict C-6) after you confirm the address |
| D-060 | Text pages | Low | **B** | Search and text pages | Accessibility page exists and is wanted |
| D-061 | Text pages | Low | **A** | Search and text pages | Verify and close; copy is already live |
| D-062 | Ask / FAQ | Low | **A** | Platform and documents | Remove /faq and /login from the sitemap |
| D-063 | Ask / FAQ | Low | **D** | Search and text pages | Test-style FAQ entries are content cleanup for editors |
| D-064 | Join | Med | **C** | Member, admin and auth | Full name and opt-in are product choices; record as deviation |
| D-065 | Join | Low | **A** | Member, admin and auth | Selected tab needs a visible state |
| D-066 | Auth | Med | **C** | Member, admin and auth | Client-side protection is how the static site works; accepted limitation |
| D-067 | Auth | Low | **C** | Member, admin and auth | Matches |
| D-068 | 404 | Med | **A** | Cards, layout and spacing | 404 page needs layout CSS |
| D-069 | Member | Med | **B** | Member, admin and auth | Newspaper Club Home is built; retire the older design (conflict C-2) |
| D-070 | Member | Low | **B** | Member, admin and auth | Grid layout is built; update the spec |
| D-071 | Member | Low | **C** | Member, admin and auth | Responsive sub-pages are better than desktop-only |
| D-072 | Member | Low | **A** | Color and tokens | Use the brand token for tag pills |
| D-073 | Member | Low | **D** | Member, admin and auth | Photo search in the URL is polish |
| D-074 | Member | Med | **A** | Member, admin and auth | Dark-theme styles on a light page; inputs look broken |
| D-075 | Member | Med | **C** | Member, admin and auth | Email read-only is a deliberate safety choice |
| D-076 | Member | High | **A** | Member, admin and auth | Membership card images 404 on Production; supply the images or hide the section until you do |
| D-077 | Member | Low | **A** | Member, admin and auth | Replace seed copy in the membership card section |
| D-078 | Admin | Med | **B** | Member, admin and auth | Entry is /admin; update the spec |
| D-079 | Admin | Med | **D** | Member, admin and auth | Admin shell redesign is not launch-critical |
| D-080 | Admin | Med | **B** | Member, admin and auth | Eighteen built tools are the real admin; update the spec |
| D-081 | Campaign | Low | **A** | Color and tokens | Campaign spotlight should use the tokens |
| D-082 | Campaign | Low | **D** | Platform and documents | Fundraiser spotlight is reconfigured by P-18 (#4431) |
| D-083 | Platform | Low | **C** | Platform and documents | The extra report-only policy is stricter and harmless |
| D-084 | Docs | Low | **D** | Platform and documents | Docs refresh is tracked under P-30 (#4442) |

## How to decide

Reply on #4409 with "accept all", or list the IDs to change with the new code. After that: the dispositions are copied into the register, B rows update the owning specs first, and #4420 opens one child Issue per theme above.

## Rollback

One documentation file. Rollback is reverting the merge commit.
