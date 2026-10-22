---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Not-found route UX and behavior contract
Does Not Own: Global error boundary behavior; logging/observability implementation
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-03-27
---

# 404 / Not Found Page Specification

## Purpose
Define the user experience for unmatched routes and broken/deep links.

## Route / Path
- Next.js not-found handler: `src/app/not-found.tsx`
- Triggered for unresolved routes.

## Section / Component Breakdown
- Primary error code/title block (`404`, “Page Not Found”)
- Supporting explanation text
- Primary recovery CTA linking to `/`

## Data Dependencies
- None.

## Auth / Access Expectations
- Publicly accessible regardless of authentication state.
- Must not expose internal routing diagnostics.

## Key UX / Behavior Notes
- Message tone is concise and non-technical.
- Recovery path to home is always present.
- Visual styling uses existing LGFC color tokens.
