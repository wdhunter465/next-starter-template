---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Repository-wide authority location index
Does Not Own: Runtime behavior, agent entry-point ownership, governance hierarchy ownership, authority-resolution rules, or implementation status
Canonical Reference: /docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md
Related Issues: #1019
Last Reviewed: 2026-05-14
---

# Repository Authority Index

## Purpose

This document indexes current repository authority locations.

Humans and AI agents should use this index to find the correct authority document after entering through the primary repository entry points, including `README.md`, `AGENTS.md`, and governance standards.

This document does not replace `AGENTS.md` as the single agent entry point.

This document does not define authority-resolution rules. Authority resolution is owned by `/docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md` and `/docs/governance/standards/document-authority-hierarchy_MASTER.md`.

## Primary Authority Locations

| Area | Current authority location |
|---|---|
| Governance hierarchy | `/docs/governance/standards/document-authority-hierarchy_MASTER.md` |
| Diataxis and legacy authority resolution | `/docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md` |
| Runtime website behavior | `/docs/reference/design/LGFC-Production-Design-and-Standards.md` |
| Content inventory architecture | `/docs/reference/content-inventory-design-spec.md` |
| Content inventory schema | `/docs/reference/content-inventory-d1-schema.md` |
| PR governance | `.github/pull_request_template.md` |
| Agent entry point | `AGENTS.md` |
| Repository governance normalization tracking | Issue #1019 and child governance issues |
| Operational work tracking | implementation worklists and active issues |

## Use Notes

- Use this document to locate the current authority source.
- Use governance documents to resolve authority conflicts.
- Use source issues to understand task scope, not to supersede canonical authority.
- Use operational worklists and historical planning issues as tracking or context unless current canonical authority explicitly reaffirms them.
