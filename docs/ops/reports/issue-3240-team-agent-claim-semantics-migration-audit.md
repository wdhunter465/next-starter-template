---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Evidence Snapshot
Owns: Migration classification evidence (ACTIVE_CLAIM / EXPLICIT_RESERVATION / STALE_PREASSIGNMENT / AMBIGUOUS) for open `agent:*` Issues, produced for #3240
Does Not Own: The team-vs-agent claim-lifecycle policy itself (owned by `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`); execution of any label removal, which remains a separate, evidence-backed operation per Rollback below
Source Issue: #3240
Canonical Reference: /docs/ops/reports/issue-3240-team-agent-claim-semantics-migration-audit.md
Related Issues: #3240
Last Reviewed: 2026-08-23
Executor: Grok (original + 2026-08-23 cursor pass), Claude Code (2026-08-10 evidence pass)
---

# Issue #3240 — team vs agent claim semantics migration audit

## Purpose

Classify open `agent:*` Issues against the claim lifecycle defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md` so only proven `STALE_PREASSIGNMENT` labels are removed.

## Scope

Covers classification of every open GitHub Issue carrying an `agent:*` label at audit time, against the four classes defined in the Classification rules table below. It does not decide or change any `team:*` label (out of scope per Policy constraints), and it does not itself remove any label — classification is evidence collection; removal is a separate follow-up action gated on proven `STALE_PREASSIGNMENT` evidence.

## Current known truth

- `agent:claude` (15 open Issues, audited 2026-08-10): 0 `STALE_PREASSIGNMENT`; 9 `ACTIVE_CLAIM`, 6 `EXPLICIT_RESERVATION` — see the per-issue table below.
- `agent:grok` (4 open Issues, audited 2026-08-10): 1 `ACTIVE_CLAIM` (#3240 itself), 3 `AMBIGUOUS` (label/body ownership contradictions requiring Grok or Cursor confirmation).
- `agent:cursor` (open Issues, audited 2026-08-23): classification table below; 0 proven `STALE_PREASSIGNMENT` in this pass — no label removals indicated.
- No `agent:*` label has been removed by this document or its remediation pass.
- Machine contract for claim decisions: `scripts/ci/agent-claim-contract.mjs` (classify / canClaim / shouldReleaseAtHandoff).

## Intended final state

Once AMBIGUOUS cases are dispositioned with agent confirmation and any future proven `STALE_PREASSIGNMENT` findings are removed only via a separate, evidence-backed follow-up PR per the Policy constraints below — never bulk-deleted from this report alone.

## Classification rules

| Class | Meaning | Action |
| --- | --- | --- |
| ACTIVE_CLAIM | Agent is actively executing or has current handoff evidence | Keep `agent:*` |
| EXPLICIT_RESERVATION | Product Authority deliberately reserved the Issue for a named agent | Keep until released |
| STALE_PREASSIGNMENT | Historical pre-assignment with no recent activity or reservation evidence | Remove `agent:*` only after recorded evidence |
| AMBIGUOUS | Insufficient evidence to classify | Leave; do not bulk-delete |

## Policy constraints

- No bulk deletion of valid reservations.
- No removal of `ACTIVE_CLAIM` or `EXPLICIT_RESERVATION`.
- `team:*` remains durable queue ownership and is out of scope for this migration.

## Classification evidence — bounded pass (2026-08-10, Claude Code)

This section is a bounded, evidence-backed classification pass covering the `agent:claude` and `agent:grok` open-Issue sets, performed as post-merge remediation for a review finding on this doc (this doc previously described the methodology but recorded no actual classifications).

### `agent:claude` (15 open Issues, live GitHub search 2026-08-10)

| Issue | Class | Evidence |
| --- | --- | --- |
| #2780 | EXPLICIT_RESERVATION | 2026-08-08 PMO "Lane assignment — Claude Code" comment on #2860 names #2780 as part of Lane 1's owned chain (Library migration → #2857 → #3172 → #2780 → #2781 → #2782). |
| #2781 | EXPLICIT_RESERVATION | Same Lane 1 assignment; #2926/#2928/#2929 (its children) have merged PRs with Claude Code as implementation agent. |
| #2782 | EXPLICIT_RESERVATION | Same Lane 1 assignment; #2930/#2931/#2932/#2933 (its children) have merged PRs with Claude Code as implementation agent. |
| #2860 | EXPLICIT_RESERVATION | Named first in the same Lane 1 assignment comment; children #2910–#2913 all closed complete under `agent:claude`. |
| #2909 | ACTIVE_CLAIM | PR #3249 merged this session; two Copilot findings dispositioned and resolved; closeout evidence posted. |
| #2926 | ACTIVE_CLAIM | PR #3236 merged; both review threads resolved pre-merge. |
| #2928 | ACTIVE_CLAIM | PR #3225 merged; all 4 review threads resolved pre-merge. |
| #2929 | ACTIVE_CLAIM | PR #3226 merged; all 4 review threads resolved pre-merge. |
| #2930 | ACTIVE_CLAIM | Post-merge remediation PRs #3252/#3259 merged this session; Bill recorded an explicit NO-GO-for-Production/continue-scaffolding decision, actively tracked. |
| #2931 | ACTIVE_CLAIM | PR #3230 merged; both review threads resolved pre-merge. |
| #2932 | ACTIVE_CLAIM | PR #3231 merged; Bill's post-merge reconciliation comment confirms clean, no remediation required. |
| #2933 | ACTIVE_CLAIM | Post-merge remediation PRs #3255/#3259 merged this session; Bill recorded an explicit HOLD-on-acceptance decision, actively tracked. |
| #3124 | EXPLICIT_RESERVATION | Bill's 2026-08-06 routing comment names Claude Code's specific role (independent engineering review/verification, steps 2 and 5 of the bounded Codex/Claude/Bill sequence) for this Issue by name. |
| #3213 | EXPLICIT_RESERVATION | Issue body explicitly schedules a single future execution date ("Do not execute this research before 2026-09-08"); the `agent:claude` label is a deliberate future assignment, not a stale artifact. |
| #3215 | ACTIVE_CLAIM | Currently under active bounded remediation (#3222, #3224, this Issue's #3262/#3248-cleanup pass). |

Result: 0 `STALE_PREASSIGNMENT` found in the `agent:claude` set — every open Issue has direct, current evidence of either active execution or a deliberate Product Authority reservation. No label removals are indicated by this pass.

### `agent:grok` (4 open Issues, live GitHub search 2026-08-10)

| Issue | Class | Evidence |
| --- | --- | --- |
| #3240 | ACTIVE_CLAIM | This Issue's own subject; PR #3248 merged 2026-08-09 with Grok as implementation agent; this audit doc is itself part of that active work. |
| #3134 | AMBIGUOUS | Issue body's own "Implementation routing" section names "Proposed implementer: Cursor Local", not Grok — a label/body inconsistency this bounded pass cannot safely resolve without Grok or Cursor confirming current ownership. |
| #2679 | AMBIGUOUS | Issue body states "Owner: ChatGPT / Atlas" explicitly, contradicting the `agent:grok` label — same class of inconsistency; left unchanged per the AMBIGUOUS handling rule rather than guessed. |
| #1038 | AMBIGUOUS | Created 2026-05-14 with zero comments recorded; no activity evidence available to this bounded pass to distinguish a dormant-but-still-owned backlog item from `STALE_PREASSIGNMENT` without Grok's confirmation. |

Result: 1 `ACTIVE_CLAIM`, 3 `AMBIGUOUS` (correctly left unchanged and surfaced here for disposition, per the Classification rules table above — not bulk-removed).

## Classification evidence — `agent:cursor` pass (2026-08-23, Grok)

Live open Issues carrying `agent:cursor` were reviewed from GitHub list state (titles, labels, package state language). Product Authority takeover notes and Pipeline "not executable" / graduation-prep packages are treated as **EXPLICIT_RESERVATION** (deliberate named executor, work not yet started). Issues with insufficient activity evidence to prove staleness remain **AMBIGUOUS**. No row is marked `STALE_PREASSIGNMENT` without direct proof that the agent is not working it and no reservation exists.

| Issue | Class | Evidence |
| --- | --- | --- |
| #3531 | EXPLICIT_RESERVATION | Product Authority pilot for Claude identity; Cursor listed for post-username repo follow-up — deliberate reservation, not idle pre-fill. |
| #3301 | EXPLICIT_RESERVATION | Governance design Issue with `agent:cursor`; standing assignment for design ownership until disposition. |
| #3155 | AMBIGUOUS | Engineering review packet; agent label present without recent Cursor execution evidence in this pass. |
| #3153 | AMBIGUOUS | Design/research only; no recent Cursor execution evidence in this pass. |
| #3134 | EXPLICIT_RESERVATION | Body routes proposed implementer to Cursor Local; Product Authority takeover language aligns with reservation. |
| #2872 | EXPLICIT_RESERVATION | Pipeline future promotion; Future Implementation Owner: Cursor Local after Graduation — reserved, not claimable. |
| #2871 | EXPLICIT_RESERVATION | Pipeline capability expansion; Future Implementation Owner: Cursor Local after Graduation. |
| #2832–#2818 family (2817 children) | EXPLICIT_RESERVATION | Graduation-prep packages state Assigned Implementation / Operations: Cursor Local (Product Authority takeover 2026-08-18); not executable until Graduation GO. |
| #2682 | AMBIGUOUS | Active PMO design factory; Cursor enrichment role named but enrichment activity not verified in this pass. |
| #2679 | AMBIGUOUS | Operations SLO issue; conflicting owner metadata historically noted; left unchanged. |
| #2638 / #2637 / #2636 | EXPLICIT_RESERVATION | Pipeline tasks under #2871; execution after launch only; Cursor named as post-launch agent. |
| #2460 / #2459 / #2458 / #2457 | AMBIGUOUS | Pipeline/strategic intake children with `agent:cursor` but no recent execution evidence; not proven stale. |

Result: **0 `STALE_PREASSIGNMENT`** in this cursor pass. No label removals authorized. AMBIGUOUS rows require Cursor or Product Authority confirmation before any future removal.

## Machine contract

Deterministic helpers for claim decisions live in `scripts/ci/agent-claim-contract.mjs`:

- `classifyClaim` — four-class model from evidence flags
- `canClaim` — collision control (queue-only / same-agent / blocked by ACTIVE or RESERVATION / stale reclaimable)
- `shouldReleaseAtHandoff` — release at PR-ready unless remediation or post-merge duty remains

Tests: `tests/agent-claim-contract.test.mjs`.

## Rollback

Revert this report via reviewed PR. Label removals (if any) are separate, evidence-backed operations.
