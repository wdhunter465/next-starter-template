---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Documentation remediation project scope, workstream definitions, execution model
Does Not Own: Design authority; product specs; implementation sequencing outside this project
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
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

### Completed (Merged)
- None (tracker corrected to reflect implementation state)

### Pending Implementation (Ticket Merged, Doc Changes Not Fully Applied)
- A — Architecture Purge → PR #703 (MERGED 2026-03-26)
  - Note: Ticket merged, but archive/stub authority enforcement remained incomplete and is still implementation-pending.
- C — Auth Model (LOCKED) → PR #707 (MERGED 2026-03-26)
  - Note: Ticket merged, but active design docs still contained stale auth language and required implementation follow-through.

### In Progress (Open PRs)
- B — Canonical Authority Lock → PR #705 (OPEN)
- D — Routing Fix → PR #711 (OPEN)
- E — Homepage Alignment → PR #715 (OPEN)
- F — Navigation Sync → PR #717 (OPEN)
- G — Footer Standardization → PR #721 (OPEN)
- H — Content Deduplication → PR #723 (OPEN)
- I — Tracker Alignment → PR #727 (OPEN)
- J — Governance Cleanup → PR #729 (OPEN)
- K — Index Cleanup → PR #731 (OPEN)
- L — Terminology Standardization → PR #741 (OPEN)

### Enforcement Rule (CRITICAL)
- This section MUST be updated with every PR open/merge
- This file is the single source of truth for remediation status
- Any mismatch = governance failure

## Bottom Line
Cleanup incomplete. This fixes it fully and removes ambiguity.
