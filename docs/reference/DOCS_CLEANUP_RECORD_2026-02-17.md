---
Doc Type: Reference
Audience: Human + AI
Authority Level: Historical
Owns: Record of the 2026-02-17 documentation cleanup
Does Not Own: Current folder authority
Canonical Reference: /docs/governance/standards/DIATAXIS-FOLDER-AUTHORITY.md
Related Issues: #4138, #4480, #4484
Last Reviewed: 2026-10-08
---

# Docs Cleanup Record — 2026-02-17

## Purpose
Lock the documentation structure after the docs/root cleanup so we do not reintroduce drift, duplicate authorities, or broken references.

## What changed
- Root /docs now contains only authority + entry-point documents.
- Reference artifacts (legacy HTML snapshots, research, baselines, phase notes, style notes) were moved under:
  - docs/design/reference/
  - docs/reference/
- Governance consolidation was completed previously (OPERATING_MODEL_MASTER is authoritative).
- Broken link in docs/reference/DEPLOYMENT_GUIDE.md was fixed:
  - Removed reference to missing ./TROUBLESHOOTING.md
  - Replaced with ../incident-response/quickstart_MASTER.md

## Current hard rules
1) Do not add “helper” docs in /docs root unless they are true authority/entry points.
2) If a doc references another doc, the target MUST exist in-repo at the referenced path.
3) No duplicate governance/process docs. One authority per topic.

## Implementation scope freeze
- Mobile + tablet implementation is HALTED until further notice.
- Desktop implementation remains the only active UX target.
- Any doc text implying mobile/tablet requirements should be treated as FUTURE/DEFERRED unless explicitly re-approved.

## Where to put things (non-negotiable)
- Product authority/spec: docs/design/ (or root only if top-level authority)
- Governance/process: docs/governance/
- Architecture deep dives: docs/architecture/
- As-built logs and platform ops: docs/reference/ (folded from docs/as-built/ in #4480)
- Reference and historical snapshots: docs/reference/ and docs/design/reference/
