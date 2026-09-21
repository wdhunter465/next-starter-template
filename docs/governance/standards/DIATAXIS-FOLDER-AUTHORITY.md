---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Diataxis folder usage rules and no-drift documentation model
Does Not Own: Design specifications; operational task details; application behavior
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #3752, #4138, #4196, #4137
Last Reviewed: 2026-09-21
---

# DIÁTAXIS FOLDER AUTHORITY (NO-DRIFT MODEL)

## Purpose
Defines strict folder usage rules. No drift allowed.

## Scope

In scope: which top-level `docs/` folders are DIATAXIS core, which are authorized adjacent, and which remain undecided pending later #4138 children.

Out of scope: mass file moves; deleting live docs; CI wiring; Task-4 binding-rule moves.

## Current known truth

- Structure now includes `templates/`, which Model C already treats as an approved write surface.
- `docs/archive/` is a permanent top-level sibling, not nested under a DIATAXIS type.
- Folder freeze evidence: `docs/ops/reports/diataxis-folder-classification-4138.md` (#4196). No moves in that child.

## Intended final state

Every top-level `docs/` folder is either a retained core/adjacent folder or has an explicit later-child disposition. Migration complete is declared only after later children finish and an audit reports zero remaining undecided folders.

## Authority Resolution

Folder correctness alone does not determine authority during the transition.

See: `/docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md`

That document defines:
- when Diataxis overrides legacy
- when legacy remains authoritative
- how conflicts are resolved

## Structure
- tutorials/
- how-to/
- reference/
- explanation/
- governance/
- ops/
- archive/
- templates/

## Folder classification (#4138 / #4196)

| Folder | Classification | Disposition |
| --- | --- | --- |
| `tutorials/`, `how-to/`, `reference/`, `explanation/` | DIATAXIS core | Retain |
| `governance/`, `ops/`, `archive/` | Authorized adjacent, permanent | Retain; `archive/` stays a top-level sibling |
| `templates/` | Authorized Model C write surface | Retain; listed in Structure |
| `as-built/` | Undecided | Later: fold into `reference/`. No move in #4196. |
| `postmortems/` | Undecided | Later: fold into `ops/incident-response/`. No move in #4196. |
| `reports/` | Undecided; duplicates `ops/reports/` | Later: merge into `ops/reports/`. No move in #4196. |

Canonical freeze record: `docs/ops/reports/diataxis-folder-classification-4138.md`.

## Rules

### tutorials
- allowed: step-by-step flows
- prohibited: system definitions, rationale

### how-to
- allowed: single task execution
- prohibited: explanation, system definitions

### reference
- allowed: facts, schemas, routes
- prohibited: instructions, "should", rationale

### explanation
- allowed: reasoning, tradeoffs
- prohibited: steps, commands

### governance
- allowed: rules, invariants
- prohibited: implementation

### ops
- allowed: projects, trackers
- prohibited: authority, system definitions

### archive
- allowed: deprecated content only

### templates
- allowed: reusable document skeletons
- prohibited: live policy, as-built facts, or operational evidence

## Model C write surfaces

Delivery Model C (documentation-only) may write only under the approved documentation namespaces defined in `docs/governance/DELIVERY-AND-RELEASE.md`. Those namespaces include the DIATAXIS tree under `docs/`:

```text
docs/tutorials/**
docs/how-to/**
docs/reference/**
docs/explanation/**
docs/governance/**
docs/ops/**
docs/archive/**
docs/templates/**
```

Rules:

1. **Classify before place.** DIATAXIS type and destination folder must be decided before creating or moving a document under Model C.
2. **Path-based boundary.** Model C eligibility is path-based. A documentation-looking file outside these (and other Model C-approved) surfaces is not Model C work.
3. **No coding-folder exception.** Documentation that must live under application, runtime, CI, test, or other executable trees uses Model A or Model B for the destination write.
4. **Canonical owner.** Model C must not create a second active owner for a topic already owned under repository authority.
5. **Archive.** Deprecated content moves to `docs/archive/**` with supersession disposition complete.

CI path enforcement for Model C is owned by issue #3753 and must conform to this folder authority without inventing a competing taxonomy.

## Enforcement
Violations trigger validation failure and escalation.
