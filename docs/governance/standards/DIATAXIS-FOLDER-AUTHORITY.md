---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Diataxis folder usage rules and no-drift documentation model
Does Not Own: Design specifications; operational task details; application behavior
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #3752
Last Reviewed: 2026-08-26
---

# DIÁTAXIS FOLDER AUTHORITY (NO-DRIFT MODEL)

## Purpose
Defines strict folder usage rules. No drift allowed.

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
