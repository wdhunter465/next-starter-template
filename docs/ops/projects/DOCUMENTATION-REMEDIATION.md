---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Documentation remediation project scope, workstream definitions, execution model
Does Not Own: Design authority; product specs; implementation sequencing outside this project
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
Related Issues: #4822, #4824
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
- Copilot = Documentation remediation
- Cursor/Codex = Website implementation
- No overlap

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

Verified against the repository on 2026-10-23 (Issue #4822; updated for #4824). Letters follow section 5. The ticket files under `/docs/ops/projects/documentation-remediation/tickets/` use a different lettering (A–L); those tickets all merged on 2026-03-26 (#703, #705, #707, #711, #715, #717, #721, #723, #727, #729, #731, #741) and are not repeated here.

### Completed
- B — Canonical Authority Lock: 695 of 701 docs carry a `Canonical Reference` header; the production design doc is the named source.
- C — Auth Model: `auth-model.md` is the single canonical auth source. Superseded wording: the model is D1-backed cookie sessions (`lgfc_session`), not localStorage `lgfc_member_email`. Remaining magic-link mentions are prohibitions only (`README.md`, `auth-model.md`, `text-pages.md`, `cloudflare-frontend.md`).
- D — Routing Fix: logout redirects to `/` (`auth-model.md`). Superseded wording: login redirects to `/fanclub`.
- E — Data Alignment: `faq-and-ask.md` states `/ask` does not write to `faq_entries`. Superseded wording: `faq_entries` is a real table for the FAQ section, so its remaining mentions are correct.
- F — Homepage Order: `home.md` locks the order Hero, Spotlight, Weekly, Join, About, Social, Discussions, Friends, Milestones, Calendar, FAQ/Ask, Footer. A hidden fundraiser teaser sits above Spotlight (D-038).
- G — Missing Specs: all eight exist under `docs/reference/design/` (`fanclub-home`, `weeklyvote-results`, `health`, `home-friends`, `home-milestones`, `home-calendar`, `home-discussions`, `error-404`).
- H — Component Mapping: `home.md` maps every homepage section to its component or inline block.

- I — Route Cleanup (#4824): `events.md` and `fundraiser-details.md` added under `docs/reference/design/`. `/ai-review` is documented in `docs/ops/ai/AI-REVIEW-ACCESS.md` and is non-canonical for public design.

### Pending
- A — Architecture Purge (partial, #4825):
  - `docs/reference/architecture/cms.md` is already a Historical Pointer stub.
  - `docs/reference/design/dashboard.md` is still `Canonical` and `STATUS: INCOMPLETE`, and describes the live admin dashboard. Product Authority decides whether to archive it or finish it.
  - `/docs/archive/legacy-architecture/` does not exist; the archive uses `docs/archive/superseded/`. Product Authority decides whether to keep the brief path.
- Legacy-platform mentions: the remaining hits in `website-as-designed.md`, the identity-provider decision brief and the compliance report are prohibitions or historical context; `lgfc-homepage-legacy-v6.html` has none. No work needed.
- J — Governance Hardening (#4826): no contradiction audit has been run since the auth and homepage changes. Open check: `health.md` and `error-404.md` cite different Canonical References than the other new specs.
- Execution model (section 4, #4827): Copilot is no longer a role holder (`docs/governance/AGENT-TEAM.md`). Section 4 needs Product Authority's replacement wording.

### Handoff to Cursor
Cursor holds Governance as a primary role and Engineering as secondary (`AGENT-TEAM.md`). Handoff goes through GitHub Issues labeled `agent:cursor`, one Issue and one PR per pending item above, not through this file.

### Enforcement Rule (CRITICAL)
- This section MUST be updated with every PR open/merge
- This file is the single source of truth for remediation status
- Any mismatch = governance failure

## Bottom Line
Cleanup incomplete. This fixes it fully and removes ambiguity.
