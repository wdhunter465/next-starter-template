---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Routes, navigation invariants, UI/UX contracts, page content contracts
Does Not Own: How-to procedures; operational runbooks; governance policies
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Related Issues: #3149
Last Reviewed: 2026-08-08
---

# Text Page Specifications — LGFC

## Scope

This document covers four public pages that share the same structure:
`/about`, `/contact`, `/privacy`, `/terms`.

Each page is a **text content page**. All inherit the global header, footer,
and standard page container. Layout is not customised per page — only the
content differs.

Desktop only. Mobile/tablet implementation is deferred.

this document Covers /about, /contact, /privacy, /terms. 
Defines the shared prose page layout and container once, then notes per-page specifics. 
Contact is flagged as the consolidated contact+support destination with the two email addresses that must appear on it. 
Copy is marked “awaiting” for all four.
-----

## Shared Page Layout

### Structure

```
[Global Header]
[Page Container]
  [Page Title — H1]
  [Body Content — prose]
[Global Footer]
```

### Container

Inherits the global container from the style guide:

- Max width: `1200px`
- Horizontal padding: `20px`
- Center aligned: `margin: 0 auto`
- Page background: `#f5f7fb`

### Page Title (H1)

- Font size: `32px` (2rem)
- Font weight: `700`
- Color: LGFC Blue `#0033cc`
- Margin below title: `32px`

### Body Content

- Font size: `16px`
- Line height: `1.6`
- Color: `#333333`
- Max content width: `760px` (narrower than container for comfortable reading)
- Paragraphs separated by `24px` spacing

### Internal headings (H2, if needed within page)

- Font size: `24px`
- Font weight: `700`
- Color: LGFC Blue `#0033cc`
- Margin above: `40px`, below: `16px`

-----

## `/about`

**Route:** `/about`
**Access:** Public
**Header state:** Visitor header (public)
**Purpose:** Fan club history and mission statement.

**Content:** Awaiting copy. Placeholder: “About the Lou Gehrig Fan Club.”

**Notes:**

- Static prose. No interactive elements.
- No sidebar, no forms.

-----

## `/contact`

**Route:** `/contact`
**Access:** Public
**Header state:** Visitor header (public)
**Purpose:** Contact and support guidance for visitors and members.

This page consolidates both contact and support destinations.

**Content:** Awaiting copy.

**Required content elements (must appear regardless of copy):**

- Admin contact email displayed on page: `admin@lougehrigfanclub.com`
- Contact email reference: `Contact@LouGehrigFanClub.com`
- Note: footer does not display email addresses directly; this page is the
  canonical location for contact details.

**Notes:**

- No contact form in current phase. Email-based contact only.
- Static prose with email links (`mailto:`).

-----

## `/privacy`

**Route:** `/privacy`
**Access:** Public
**Header state:** Visitor header (public)
**Purpose:** Privacy policy.

**Content:** Public disclosure of current Join/Login/Ask/member data handling (#3149). Source fallback in `src/app/privacy/page.tsx` and D1 `page_content` (migration `0045_privacy_join_ask_disclosure.sql`) must stay materially aligned. Does not claim magic-link collection; Day-1 auth is cookie session per `auth-model.md`.

**Notes:**

- Prefer D1 `page_content` when live; fallback must not understate Join/Ask fields.
- Linked from footer: Privacy → `/privacy`

-----

## `/terms`

**Route:** `/terms`
**Access:** Public
**Header state:** Visitor header (public)
**Purpose:** Terms of service.

**Content:** Current fallback covers respectful use, submissions, copyright/attribution, no-warranty, and contact. #3149 reviewed Join/Login/Ask/member session facts against Terms and recorded **no Terms rewrite** (no concrete factual inconsistency).

**Notes:**

- Linked from footer: Terms → `/terms`

-----

## Implementation Notes

All four pages are implemented as Next.js static pages (App Router).
No API calls, no database access, no authentication required.

Component pattern:

```tsx
export default function PageName() {
  return (
    <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#0033cc', marginBottom: '32px' }}>
        Page Title
      </h1>
      <div style={{ maxWidth: '760px', fontSize: '1rem', lineHeight: 1.6, color: '#333' }}>
        {/* prose content */}
      </div>
    </main>
  );
}
```

CSS variables apply via global stylesheet. No page-specific CSS modules required.
