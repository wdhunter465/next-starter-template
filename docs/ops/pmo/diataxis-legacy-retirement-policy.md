---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: DIATAXIS legacy retirement rules, archive non-authority policy, and migration manifest requirements for PMO portfolio work
Does Not Own: Individual legacy file moves, deletions, or portfolio task implementation sequencing
Canonical Reference: /docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md
Related issues: #1353, #1076, #1134, #2140
Last Reviewed: 2026-09-27
---

# DIATAXIS Legacy Retirement Policy

## Purpose

Record the agreed rules for retiring legacy live documentation paths before larger
PMO portfolio work begins. This policy documents authority and retirement
process only. It does not execute legacy folder deletion or moves.

## Scope

This document owns:

- DIATAXIS authority precedence over legacy live folders during transition
- Incremental legacy retirement requirements
- Archive non-authority rules for agents
- Migration manifest row requirements

This document does not own:

- Actual legacy file moves or deletions (deferred to later task PRs)
- Portfolio task implementation plans or worklist execution
- Full `#1132` legacy migration matrix execution

## DIATAXIS Authority Rule

- DIATAXIS folders (`docs/tutorials/`, `docs/how-to/`, `docs/reference/`,
  `docs/explanation/`, `docs/governance/`, `docs/ops/`) are **current authority**
  for active operational guidance.
- Legacy live folders (for example `ops/ai/`, `governance/ai/`, split
  tracker roots, and other transitional paths documented in transition audits) are
  **transitional only**.
- If a DIATAXIS document and a legacy live document conflict on the same topic,
  **DIATAXIS wins**.
- See also `/docs/governance/standards/DIATAXIS-AUTHORITY-RESOLUTION.md` and
  `/docs/explanation/diataxis/legacy-documentation-lifecycle.md`.

## Legacy Retirement Rule

Legacy docs are retired **incrementally** as their authoritative DIATAXIS
replacements land in task-scoped PRs.

Requirements:

- Retired legacy docs must **not** remain live beside DIATAXIS replacements.
- Each retirement must record provenance in `/docs/archive/MIGRATION-MANIFEST.md`
  before or in the same PR that removes the live legacy path.
- Retired legacy docs must either:
  - move to `docs/archive/superseded/**` with a manifest entry;
  - move to a DIATAXIS-preserving path under `docs/archive/**` when the source issue explicitly authorizes preservation of the former DIATAXIS folder shape; or
  - be deleted from the live path only when the manifest records replacement or
    deletion rationale.

This policy PR does **not** delete or move any legacy folders. Actual retirement
happens one doc set at a time in later task PRs.

## Archive Rule

- `docs/archive/**` is **historical and non-authoritative**.
- Agents may read archived docs only for provenance or migration history.
- Agents must **not** use archived docs as implementation authority unless a
  current DIATAXIS document explicitly cites them for historical context only.
- Archive content must not compete with canonical DIATAXIS authority or participate
  in operational routing.

## Migration Manifest Rule

Every retired legacy doc requires an old path to new authority mapping in
`/docs/archive/MIGRATION-MANIFEST.md`.

Required manifest row fields:

| Field | Description |
| --- | --- |
| legacy path | Former live path before retirement |
| archive path or deleted | Archive destination permitted by this policy, or `deleted` |
| replacement DIATAXIS path | Current authoritative DIATAXIS document |
| status | For example `planned`, `in-progress`, `retired`, `deleted` |
| rationale | Why the legacy path was retired or deleted |
| date | Retirement or deletion date (YYYY-MM-DD) |

The manifest starts as a placeholder in the implementing PR. Rows are appended as
legacy retirement task PRs land.

## Agent Safety Rule

Agents must:

- verify DIATAXIS coverage before using any legacy reference for implementation
- not treat legacy folders as equal authority to DIATAXIS folders
- stop and report if both a legacy doc and a DIATAXIS doc appear authoritative
  for the same topic without a manifest retirement record

Agents must not bulk-delete legacy folders without an approved task allowlist and
manifest rows for every affected path.

## Related Documents

| Document | Role |
| --- | --- |
| `/docs/ops/projects/DIATAXIS-TRANSITION.md` | Transition scope and folder purpose |
| `/docs/archive/MIGRATION-MANIFEST.md` | Retirement ledger (append-only rows) |
| `/docs/reference/legacy-to-diataxis-migration-matrix-1132.md` | Legacy root inventory (when present) |
| `/docs/ops/pmo/program-registry.md` | PMO program chain; Program 3 owns full migration execution |

## Verification Expectations

Policy-only PRs that introduce this document must:

- remain docs-only under `docs/**`
- pass changed-file header checks and canonical hash verification
- disclose any known pre-existing repo-wide header failures out of scope

Legacy retirement task PRs must additionally:

- include manifest rows for every retired path
- confirm no live duplicate authority remains beside the DIATAXIS replacement
