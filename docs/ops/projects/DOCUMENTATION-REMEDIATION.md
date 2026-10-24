---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Documentation remediation project scope, workstream definitions, execution model
Does Not Own: Design authority; product specs; implementation sequencing outside this project
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
Related Issues: #4822, #4824, #4825, #4826, #4827
Last Reviewed: 2026-10-23
---

# LGFC — DOCUMENTATION REMEDIATION PROJECT (CRITICAL)

## 1. Objective
Stabilize documentation to match actual production architecture + implementation.

- Eliminate legacy external platform references
- Enforce single canonical design authority
- Close all missing specs blocking implementation
- Restore trust in docs as source of truth

## 2. Severity Assessment
Status: BLOCKER (launch impact)

- Architecture contradictions → high risk of wrong builds
- Missing specs → blocking implementation
- Auth inconsistency → breaks gating logic
- Homepage gaps → directly tied to failures

## 3. Root Cause
1. Legacy architecture not fully purged
2. Multiple “truths” allowed
3. No canonical enforcement
4. Incomplete specs

## 4. Execution Model
- Claude Code = documentation remediation (Engineering and PMO Admin)
- Cursor = Governance review and website implementation
- No overlap on a single Issue

## 5. Workstreams

### A — Architecture Purge
- Archive cms.md, dashboard.md
- Move to /docs/archive/legacy-architecture/
- Add banner: ARCHIVED
- Before any purge, update active stubs and internal references to current canonical sources
- If any active docs still point to archived paths, keep the archived files until those references are removed

### B — Canonical Authority Lock
- LGFC-Production-Design-and-Standards.md = source of truth
- Add canonical header to all docs

### C — Auth Model (LOCKED)
- Use D1-backed server sessions (`lgfc_session`)
- Remove external auth-provider and magic-link references

### D — Routing Fix
- Redirect target = /
- Document auth flow clearly

### E — Data Alignment
- /ask uses ask_inbox only
- Remove faq_entries references

### F — Homepage Order (LOCKED)
Hero → Spotlight → Weekly → Join → About → Social → Discussions → Friends → Milestones → Calendar → FAQ → Footer

### G — Missing Specs
Create:
- fanclub-home.md
- weeklyvote-results.md
- health.md
- home-friends.md
- home-milestones.md
- home-calendar.md
- home-discussions.md
- error-404.md

### H — Component Mapping
Map all homepage sections to components

### I — Route Cleanup
Remove orphan routes unless canonical

### J — Governance Hardening
- No doc defines architecture
- No contradictions allowed

## 6. PR Strategy
- One PR per workstream
- Sequential execution

## 7. Acceptance Criteria
- No legacy external-platform references
- Single auth model
- All routes + sections documented
- No contradictions

## 8. Start Order
A → B → C → D

## 9. Workstream Status (LIVE — AUTO-SYNC REQUIRED)

Section 4 was corrected on 2026-10-23 (#4827) so the execution model matches `docs/governance/AGENT-TEAM.md`. Copilot reviews pull requests only and is not the remediation owner.

Verified against the repository on 2026-10-23 (Issue #4822; updated for #4824, #4825 and #4826). Letters follow section 5. The ticket files under `/docs/ops/projects/documentation-remediation/tickets/` use a different lettering (A–L); those tickets all merged on 2026-03-26 (#703, #705, #707, #711, #715, #717, #721, #723, #727, #729, #731, #741) and are not repeated here.

### Completed
- B — Canonical Authority Lock: 695 of 701 docs carry a `Canonical Reference` header; the production design doc is the named source.
- C — Auth Model: `auth-model.md` is the single canonical auth source. Superseded wording: the model is D1-backed cookie sessions (`lgfc_session`), not localStorage `lgfc_member_email`. Remaining magic-link mentions are prohibitions only (`README.md`, `auth-model.md`, `text-pages.md`, `cloudflare-frontend.md`).
- D — Routing Fix: logout redirects to `/` (`auth-model.md`). Superseded wording: login redirects to `/fanclub`.
- E — Data Alignment: `faq-and-ask.md` states `/ask` does not write to `faq_entries`. Superseded wording: `faq_entries` is a real table for the FAQ section, so its remaining mentions are correct.
- F — Homepage Order: `home.md` locks the order Hero, Spotlight, Weekly, Join, About, Social, Discussions, Friends, Milestones, Calendar, FAQ/Ask, Footer. A hidden fundraiser teaser sits above Spotlight (D-038).
- G — Missing Specs: all eight exist under `docs/reference/design/` (`fanclub-home`, `weeklyvote-results`, `health`, `home-friends`, `home-milestones`, `home-calendar`, `home-discussions`, `error-404`).
- H — Component Mapping: `home.md` maps every homepage section to its component or inline block.
- I — Route Cleanup (#4824): `events.md` and `fundraiser-details.md` added under `docs/reference/design/`. `/ai-review` is documented in `docs/ops/ai/AI-REVIEW-ACCESS.md` and is non-canonical for public design.
- A — Architecture Purge (#4825): `cms.md` is a Historical Pointer stub by design. `dashboard.md` is the live admin dashboard spec, not legacy architecture, so it stays in `docs/reference/design/`; its status banner and Definition of Done now match the 18 built tools. The archive path is `docs/archive/superseded/`; `/docs/archive/legacy-architecture/` is not used. Legacy-folder documents were archived there by #4830, including `AI-GUIDE.md`, which carried one of the `faq_entries` mentions.
- Legacy-platform mentions: the remaining hits in `website-as-designed.md`, the identity-provider decision brief and the compliance report are prohibitions or historical context; `lgfc-homepage-legacy-v6.html` has none. No work needed.
- J — Governance Hardening (#4826): contradiction audit run on 2026-10-23 over the active design, auth, platform and governance docs. Homepage order (`home.md`, the production design doc), auth and redirect behavior (`auth-model.md`, `auth-and-logout.md`, `join-login.md`) and the `/ask` data path (`ask_inbox`, checked in `functions/api/ask.ts`) agree; `/api/faq/submit` is a separate endpoint that writes `faq_entries`. No active doc points at a retired platform. Two dead pointers were repaired (#4840): `cms.md` named an archived copy deleted in #826, and `cms-data-layer.md` named `/docs/architecture/cms.md`. Contradictions corrected: `health.md` cited `CLOUDFLARE.md`, which does not define `/health`, and now cites `LGFC-Production-Design-and-Standards.md` (the same reference as `home.md`, `auth-model.md` and `error-404.md`, and it lists `/health` as a public route). `faq-system.md` treated `/faq` as a live page and admin API auth as `ADMIN_TOKEN` plus `sessionStorage`; `/faq` redirects to `/ask/` (`src/app/faq/page.tsx`) and admin auth is the member session (`functions/_lib/auth.ts`). `access-model.md`, `cms-data-layer.md` and `runtime-dependencies_MASTER.md` claimed to own system architecture; ownership is now each file's subject. `program-5-admin-page-and-tools-design-readiness.md` and the D1 guide described the removed localStorage admin token as current and now match the cookie-session model. Ruled non-contradictory: `auth-and-logout.md`, the homepage child specs, the `member_sessions` origin note. `error-404.md` was already correct.
- Execution model (section 4, #4827): corrected in #4831 to match `docs/governance/AGENT-TEAM.md`; Copilot reviews pull requests only.
- Ticket files: the twelve files under `documentation-remediation/tickets/` are historical records of the March PRs. Their `Status: OPEN` lines and the Copilot owner on ticket A are not live status; this section is.

### Pending
- None. Every workstream in section 5 is complete or recorded as superseded above.

### Handoff
No handoff is needed. New documentation drift is a new Issue, routed by `AGENT-TEAM.md` (Cursor holds Governance as a primary role, Claude Code holds Engineering and PMO Admin).

### Enforcement Rule (CRITICAL)
- This section MUST be updated with every PR open/merge
- This file is the single source of truth for remediation status
- Any mismatch = governance failure

## Bottom Line
Cleanup incomplete. This fixes it fully and removes ambiguity.
