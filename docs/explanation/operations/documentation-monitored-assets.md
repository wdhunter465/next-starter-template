---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: The monitored-documentation model for #2087: which operational docs are watched, who reviews them, and how drift becomes an Issue
Does Not Own: Canonical policy text, CI workflow behavior, Diátaxis migration, or permission for an author to waive documentation impact
Canonical Reference: /docs/governance/DOCUMENT-ARCHITECTURE.md
Related Issues: #2087, #2217, #3155
Last Reviewed: 2026-09-27
---

# Documentation as monitored operational assets

## Purpose

Operational documents are inputs to human work, agent work, CI closeout, release work, and PMO decisions. Drift between those documents and as-built behavior is an operational risk. This file records that model for #2087: which documents are monitored, who reviews them, and how a drift finding becomes an Issue. It does not replace `docs/governance/DOCUMENT-ARCHITECTURE.md` or `docs/governance/REPOSITORY-AUTHORITY.md`.

## Scope

This file owns the monitored-category list, the review-cadence rules, the update triggers, and the as-built-reconciliation and drift-to-Issue rules below. The review procedure itself is `docs/how-to/documentation/documentation-drift-review.md`.

It does not own canonical policy text, CI workflow behavior, the Diátaxis migration (#3155), a machine-readable asset registry (#2217), or permission for an author to waive documentation impact.

## Current known truth

The review procedure is `docs/how-to/documentation/documentation-drift-review.md`.

### Monitored categories

These categories are monitored. A file in one of them is a monitored asset even when a later registry (#2217) has not listed it yet.

| Category | What is watched | Canonical owner of the rules |
| --- | --- | --- |
| Authority and role routing | `Agent.md`, `docs/governance/REPOSITORY-AUTHORITY.md`, `docs/governance/AGENT-TEAM.md` | Those files |
| Product invariants | `docs/reference/design/` | The design standard and auth model |
| Pull-request and delivery rules | `docs/governance/PR_PROCESS.md`, `docs/governance/PR_LIFECYCLE_STATE_MACHINE.md`, the delivery-profile contract | Those files |
| PMO portfolio rules | `docs/governance/PMO-PORTFOLIO.md` and its referenced lifecycle contract | Those files |
| As-built records | `docs/ops/as-built/` | The as-built file for that behavior, subordinate to the design or governance owner |
| Operator procedures | `docs/how-to/` | The how-to, subordinate to the canonical owner named in its header |

Historical, archive, snapshot, and postmortem files are evidence. They are not monitored as current instructions.

### Ownership and cadence

The header field `Owns` states what the document owns (its scope), not a human or role owner. The role holding the matching durable role in `docs/governance/AGENT-TEAM.md` reviews the document that scope describes. Product Authority remains the final priority and protected-decision owner.

Review cadence:

- Review a monitored document in the same pull request that changes the behavior it describes.
- Review authority, role, auth, and PR-process documents when their canonical owner changes, before that change is treated as current.
- Review as-built documents when the production behavior they describe changes.
- Do not wait for a calendar sweep to record a known contradiction. Open an Issue when drift is found.

### Update triggers

Update the monitored document, or open an Issue to update it, when any of these happen:

- The as-built behavior changes.
- A canonical owner is renamed, superseded, or retired.
- A role holder changes in `AGENT-TEAM.md`.
- A pull request's closeout finds the diff and the docs disagree.
- A reader can follow two active documents to two different rules for the same decision.

### As-built reconciliation

An as-built document describes what the repository does. It does not grant a new rule. If an as-built file and a canonical design or governance file disagree, the canonical file wins and the as-built file is the drift to fix.

### How drift becomes an Issue

A drift finding becomes an Issue when the correcting edit is not already inside the pull request that caused it. The Issue names the documents, the contradiction, and the canonical owner. It does not authorize a bulk rewrite. #3155 remains the owner of legacy-to-Diátaxis migration. #2217 remains the owner of a machine-readable asset registry and is not implemented by this file.

### Preservation

Keep a document as current when its header says it owns a live decision and consumers still load it. Supersede it when a named replacement owns that decision and the old file points at the replacement. Archive it when it is evidence only. Do not delete historical evidence to make a folder look current.

### What this file does not do

- It does not rewrite the documentation set.
- It does not change workflow YAML.
- It does not let a pull-request author self-exempt documentation impact.

## Intended final state

Today, "monitored asset" is a category list and a manual review procedure. As #2217 (the machine-readable asset registry) matures, monitored-category membership and canonical-owner mappings are expected to move from this file's table into that registry, with this file continuing to record the review-cadence and drift-to-Issue rules rather than the per-file inventory. As #3155 (the legacy-to-Diátaxis migration) proceeds, the "Operator procedures" and "As-built records" rows here should be revisited so they still point at real, current folders.
