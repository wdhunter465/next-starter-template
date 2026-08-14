---
Doc Type: Operations
Audience: Bill (Product Authority), WORK, Grok, Cursor, Claude Code, LGFC maintainers
Authority Level: Controlled
Owns: Draft public accessibility statement text for Product Decision Record item 6 / F7 under #2920 — review package only
Does Not Own: Live route publication, legal conclusions, WCAG certification claims, or Production promotion
Canonical Reference: /docs/reference/design/style-guide.md
Related Issues: #2784, #2919, #2920
Last Reviewed: 2026-08-12
---

# Accessibility Statement — Draft for Product Review (#2920)

## Purpose

Provide exact public-facing wording for a dedicated accessibility statement, per Product Decision Record item 6 (APPROVED 2026-08-04: dedicated public page; #2920 publishes only after Bill approves the exact text).

**This file is not a live route.** No `/accessibility` page is created by this document. Publication requires explicit Product approval of the draft below (or an edited successor).

## Scope

In scope: proposed statement text, contact path, alignment with the internal WCAG AA build standard in `docs/reference/design/style-guide.md`, and notes for implementers. Out of scope: claiming third-party audit certification, inventing legal guarantees, shipping a public route without approval, and resolving separate tooling findings (e.g. #3172).

## Current known truth

- Internal design standard targets WCAG AA contrast and focus indicators (`style-guide.md` Accessibility Guidelines).
- Public accessibility statement route does not exist today.
- Contact path for accessibility issues should use existing club email channels (`admin@lougehrigfanclub.com` and/or Support), consistent with `/contact` and `/privacy`.
- Automated scan prototype work (#3165) and related findings are operational quality work; they do not substitute for this public statement.

## Intended final state (after approval + separate publish PR)

- Bill approves (or edits) the **Proposed public statement** section.
- A later #2920 implementation PR adds `src/app/accessibility/page.tsx` (or equivalent), links it from footer/sitemap as Product directs, and uses the approved text only.
- Recurring review continues to spot-check the published page.

---

## Proposed public statement (for Bill approval)

> **Accessibility**
>
> The Lou Gehrig Fan Club website is a fan-run site. We aim to make public pages usable by as many people as possible, including people who use assistive technologies.
>
> **Our approach**
>
> We design and build toward the Web Content Accessibility Guidelines (WCAG) 2.x Level AA as our internal standard. In practice that includes:
>
> - Text and interactive controls intended to meet AA contrast targets
> - Visible focus indicators for keyboard navigation where we control the UI
> - Readable typography and layout that adapts across common screen sizes
> - Semantic structure (headings, labels, and links) on pages we author
>
> Some content is historical, member-submitted, or embedded from third parties. Those areas may not always meet the same standard. We improve issues as we find them and as capacity allows.
>
> **How to report a problem**
>
> If you have trouble using any part of this site, please email **admin@lougehrigfanclub.com** with:
>
> - The page URL
> - A short description of the problem
> - The browser, device, or assistive technology you were using (if you know it)
>
> We will do our best to respond and to address barriers that are within our control.
>
> **Limitations**
>
> This statement describes our intent and process. It is not a formal accessibility certification or a warranty that every page is free of barriers at all times.

---

## Product decision checklist

Please mark or reply on #2920:

- [ ] Approve the proposed text as written
- [ ] Approve with edits (paste revised text on #2920 or in a follow-up commit instruction)
- [ ] Reject / rewrite direction (state constraints)

Optional Product choices (defaults if silent):

| Choice | Default if not specified |
| --- | --- |
| Route path | `/accessibility/` |
| Footer link | Add “Accessibility” next to Privacy / Terms when published |
| Sitemap | Include in `PUBLIC_SITEMAP_ROUTES` when published |
| Primary contact | `admin@lougehrigfanclub.com` (as in draft) |

## Implementation notes (after approval only)

- New page should follow the same layout pattern as `/privacy` and `/contact` (simple main, clear headings).
- Do not gate the statement behind CMS `page_content` alone without a hardcoded approved fallback, so the disclosure cannot disappear if D1 rows are missing.
- Do not claim “fully WCAG AA compliant” or audit certification unless Product later authorizes stronger language after evidence.

## Parallel GA reminder (not resolved by this draft)

Production GA is active (`G-BRV48J1VE`). Product Decision item 2 still prefers **disable in Production until consent control exists**. This accessibility draft does not change that path.

## Rollback

Remove or revise this draft document only — no runtime impact until a separate publish PR exists.
