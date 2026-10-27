---
Doc Type: How-To
Audience: Human + AI
Authority Level: Procedure
Owns: Program #2039 production smoke-test procedure
Does Not Own: Automated CI replacement for operator sign-off
Canonical Reference: /docs/how-to/website/website-public-launch-checklist.md
Related issues: #2039, #2047
Last Reviewed: 2026-07-01
---

# Website Production Smoke Test

## Purpose

Executable smoke coverage for public relaunch verification.

## Steps

1. Load each public route listed below and confirm HTTP 200 with expected content.
2. Verify guest and admin boundary behavior.
3. Verify launch-readiness surfaces (social fallback, campaign boundary, SEO artifacts).
4. Record pass/fail in the launch evidence template.

## Public routes

- [ ] `/`, `/about/`, `/contact/`, `/faq/`, `/ask/`, `/search/`, `/join/`, `/events/`
- [ ] `/privacy/`, `/terms/`
- [ ] `/login/`, `/auth/`, `/logout/`

## Member and admin boundaries

- [ ] Guest visiting `/fanclub/` is redirected/denied
- [ ] Admin routes require admin session
- [ ] `/admin/clubstaging/` shows staging boundary banner only

## Launch readiness surfaces

- [ ] Social wall shows widget or fallback platform links
- [ ] Campaign spotlight hidden when CMS config disabled
- [ ] `/sitemap.xml` and `/robots.txt` reachable
- [ ] Core pages expose expected metadata in HTML head
