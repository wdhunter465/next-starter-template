---
Doc Type: Report
Audience: Human + AI
Authority Level: Program Evidence
Owns: Phase 1-3 findings and consolidation proposal for the #4091 AI-agent-governance audit
Does Not Own: Governance policy itself — this report proposes changes to canonical files; it is not canonical until Bill reviews it
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #4091
Last Reviewed: 2026-09-04
---

# AI Governance Audit — 2026-09-04

## Origin

Bill reported inconsistent task performance across ChatGPT, Work, and Codex and asked for a root-cause audit of the repository's AI-agent governance surface (`Agent.md`, `AGENTS.md`, `docs/ops/ai/**`, `docs/governance/**`). Claude Code was authorized to own the audit and its implementation end-to-end (Issue #4091). This report is Phase 3: a concrete, file-by-file consolidation proposal for Bill's review. **No file named below has been changed by this report.** Phase 5 (implementation) is separate follow-up work, gated on this review.

## Method

Every file in `docs/ops/ai/**` (17 files, 2,923 lines) and `docs/governance/**` (37 files, 5,569 lines) — the full 8,628-line, ~48-file surface nominally required reading before an agent acts — was read in full or, for the `docs/governance/standards/` cohort, read by front-matter header (`Doc Type`, `Authority Level`, `Canonical Reference`, `Last Reviewed`) plus targeted full reads where headers indicated risk. Each file was classified as:

- **Load-bearing** — real, current, non-duplicated operational rule. Keep.
- **Redundant pointer** — superseded, adds no unique content beyond a "see X" table. Safe to collapse.
- **Dead / historical** — describes a program, session, or model that has already concluded. Safe to archive.
- **Actively wrong** — contradicts current canonical policy, not merely superseded. Safe to delete (git history preserves it).
- **Misplaced** — legitimate content in the wrong Diataxis folder, creating ambiguity about whether it's part of the mandatory chain.

## Headline finding

**`docs/governance/**` is the healthy part of the system.** All 37 files there are dated 2026-07 through 2026-09, cross-reference each other correctly, and most carry an explicit "Supersession" section naming exactly what old behavior they replace. `REPOSITORY-AUTHORITY.md` (constitutional) and `AGENT-TEAM.md` (role mapping) — the two files every other governance file points to — are internally consistent and current.

**The drift is concentrated in `docs/ops/ai/**`.** It predates the `docs/governance/**` rebuild and was never fully reconciled afterward. Five of its 17 files are the healthiest part of the whole surface (`CHATGPT-RULES.md`, `WORK-RULES.md`, `CODEX-RULES.md`, `CLAUDE-CODE-RULES.md`, `CURSOR-RULES.md` — all `Last Reviewed: 2026-09-01/02`). The rest range from fine to actively contradictory.

## File-by-file disposition — `docs/ops/ai/**`

| File | Lines | Classification | Proposed action |
| --- | --- | --- | --- |
| `Agent.md` | 247 | Load-bearing | Keep. Remove step 4 (`SHARED-AGENT-RULES.md`) from the "Mandatory authority chain" — see "SHARED-AGENT-RULES.md dependency" below. |
| `AGENTS.md` | 73 | Load-bearing | Keep as-is. Already fixed in PR #4092 (chain now mirrors `Agent.md`). |
| `CORE-RULES.md` | 498 | Load-bearing | Keep almost entirely — this is genuinely dense operational law (Issue-first gate, PR discipline, drift prevention, stop conditions, Product Startup Framework), not bloat. Fix its front matter `Canonical Reference` (currently `/docs/ops/ai/SHARED-AGENT-RULES.md`, should be `/docs/governance/REPOSITORY-AUTHORITY.md`) and drop the `SHARED-AGENT-RULES.md` step from its own "Mandatory documentation chain" (line 24) and "read first" instruction (line 18). |
| `SHARED-AGENT-RULES.md` | 39 | Redundant pointer | **Delete**, after repointing every file below that cites it. Its own body already says "Do not treat this file as competing policy" and its only content is a topic→canonical-owner table that duplicates information already in the files it points to. It also misdescribes `CHATGPT-RULES.md`/`CURSOR-RULES.md` as "superseded pointer files" (line 36-37) — they are current canonical files, so this file is not just redundant but stale. |
| `CHATGPT-RULES.md`, `WORK-RULES.md`, `CODEX-RULES.md`, `CLAUDE-CODE-RULES.md`, `CURSOR-RULES.md` | ~275 total | Load-bearing | Keep as-is. No changes proposed. |
| `COPILOT-RULES.md`, `DEVIN-RULES.md` | 216 total | Load-bearing | Keep content. One-line front-matter fix each: `Canonical Reference` from `/docs/ops/ai/SHARED-AGENT-RULES.md` to `/docs/governance/AGENT-TEAM.md`, matching the 5 healthy rule files' pattern. |
| `LGFC-AI-TEAM-OPERATING-MODEL.md` | 261 | Dead / historical | **Archive** to `docs/archive/`. Front matter already says `Authority Level: Superseded`; nearly the entire body (Team roles, Operating mode taxonomy, End-to-end workflow, Authority boundaries) describes a since-replaced Bill→ChatGPT→**Cursor-only** execution model. It also retains a `<details>` block (lines 106-119) with actively-contradictory historical Codex guidance ("Do not assign LGFC implementation work to Codex") that a reader could mistake for current policy despite the surrounding caveats — current `CODEX-RULES.md`/`AGENT-TEAM.md` reactivated Codex as a standing executor per #3755. |
| `WORK-CONTINUITY-LEDGER.md` | 207 | Dead / historical | **Archive** to `docs/archive/`. Dated `Last Updated: 2026-08-14` (three weeks stale) — a narrative, point-in-time PMO snapshot (specific comment IDs like `#5282226120`, specific in-flight assignments like "#3382 P1-09") presenting itself as continuity infrastructure. `docs/governance/PMO-PORTFOLIO.md` (current, 2026-09-01) already defines a durable "PMO Current State" record contract that supersedes exactly this pattern — this file is the *reason* that contract exists, not a live instance of it. |
| `chatgpt-cursor-handoff-workflow.md` | 326 | Load-bearing | Keep as-is. Legitimately complex structured cross-agent event-envelope protocol; no contradictions found. |
| `GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md` | 423 | Dead / historical | **Archive** to `docs/archive/`. Scoped entirely to Program #1500 Tasks 002-005. Confirmed via live GitHub state: Issue #1545 (Task 002) and #1548 (Task 005, terminal) are both `closed` / `completed`. The program this file launch-controls has finished; nothing in it describes live or pending work. |
| `pr-lifecycle-standard.md` | 42 | **Actively wrong** | **Delete.** Asserts "ChatGPT = PR owner" / "PR is created in DRAFT state by ChatGPT" for all PRs (lines 17, 39). This directly contradicts current canonical `docs/governance/PR_PROCESS.md` (2026-08-07) and `AGENT-TEAM.md`'s actual routing, where each implementer (Cursor Local, Claude Code, Codex, etc.) owns and progresses its own PRs — confirmed by this session's own practice. `PR_PROCESS.md` and `PR_LIFECYCLE_STATE_MACHINE.md` fully replace this file's intended scope with correct content; nothing here is worth archiving. |
| `AI-REVIEW-ACCESS.md` | 102 | Misplaced (content is fine) | Keep content; one-line front-matter fix: `Canonical Reference` from `/docs/ops/ai/SHARED-AGENT-RULES.md` to `/docs/ops/ai/CORE-RULES.md` (its actual operational parent). This is a narrow, correct technical reference (token-gated preview config) that happens to live in the agent-routing directory. Optional follow-up (not proposed for Phase 5): relocate to `docs/reference/platform/` or `docs/how-to/ci/` per Diataxis folder rules, since its presence in `docs/ops/ai/` next to mandatory-read files creates ambiguity about whether it's part of the required chain. |

## The `SHARED-AGENT-RULES.md` dependency chain

Six files currently cite `SHARED-AGENT-RULES.md` as a **mandatory read step** or **Canonical Reference**, even though the file itself disclaims authority:

1. `Agent.md` — "Mandatory authority chain" step 4
2. `CORE-RULES.md` — front matter `Canonical Reference`, plus body lines 18/24
3. `COPILOT-RULES.md` — front matter `Canonical Reference`
4. `DEVIN-RULES.md` — front matter `Canonical Reference`
5. `AI-REVIEW-ACCESS.md` — front matter `Canonical Reference`
6. `pr-lifecycle-standard.md` — front matter `Canonical Reference` (moot once this file is deleted)

Proposed Phase 5 order: repoint 1-5 to their real canonical parents (as specified in the table above), confirm nothing else cites `SHARED-AGENT-RULES.md`, then delete it. Deleting it first would leave five dangling references.

## File-by-file disposition — `docs/governance/**`

All 37 files are current and internally consistent, with one structural pattern worth fixing and one worth documenting as intentional:

**The stale `_MASTER` cohort (11 files, all `Last Reviewed: 2026-02-20` — the single oldest date in the entire tree):**

`verification-criteria_MASTER.md`, `change-control_MASTER.md`, `document-status-and-naming_MASTER.md`, `quality/tests_MASTER.md`, `quality/verification_MASTER.md`, `quality/invariants_MASTER.md`, `ci-preview-invariants.md`, `stability-playbook_MASTER.md`, `OPERATING_MODEL_MASTER.md`, `change-freeze-policy_MASTER.md`, `phase-7-guardrails.md`

Each lists `Canonical Reference: docs/governance/standards/document-authority-hierarchy_MASTER.md` — a stub file that correctly self-declares `Authority Level: Superseded` and redirects to `REPOSITORY-AUTHORITY.md`, but whose own text says it is "retained... until archived in a later disposition pass." When that archival happens, all 11 pointers break with no owner noticing, since nothing currently reads the stub's *content* — only its existence at that path.

**Proposed action:** mechanical, content-neutral fix — repoint all 11 files' `Canonical Reference` to `/docs/governance/REPOSITORY-AUTHORITY.md` directly. No policy content changes. `document-authority-hierarchy_MASTER.md` itself can then be safely archived or deleted in a later pass once nothing points to it.

**Two files use a second root of authority** (`Authority Level: Binding`, `Canonical Reference: /Agent.md` rather than `/docs/governance/REPOSITORY-AUTHORITY.md`): `standards/CURSOR-RUNTIME-ROUTING.md` and `standards/AGENT-EXECUTION-FIDELITY.md`. This is not a defect — `Agent.md` is the routing entry point by design, and these are agent-execution-contract documents anchored to it rather than domain policy. Documenting it here so it isn't mistaken for drift in a future audit.

## Net impact if Phase 5 is approved

| Metric | Before | After |
| --- | --- | --- |
| `docs/ops/ai/` files | 17 | 12 (2 deleted, 3 archived) |
| `docs/ops/ai/` lines | 2,923 | ≈1,941 (-34%) |
| Files moved to `docs/archive/` (preserved, not deleted) | — | 3 (891 lines: `LGFC-AI-TEAM-OPERATING-MODEL.md`, `WORK-CONTINUITY-LEDGER.md`, `GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md`) |
| Files deleted outright | — | 2 (81 lines: `SHARED-AGENT-RULES.md`, `pr-lifecycle-standard.md`) |
| `docs/governance/standards/` files with fragile canonical pointers | 11 | 0 (repointed, zero content change) |
| Contradictory "mandatory chain" definitions for the same agent | 2 (`Agent.md` vs `AGENTS.md`) | 0 (already fixed, PR #4092) |

No load-bearing operational rule (Issue-first gate, PR discipline, stop conditions, the 5 healthy per-agent rule files, any of `docs/governance/**`'s substantive content) is touched. This proposal only removes redundant indirection, retires genuinely concluded historical material, and deletes one file whose content is now actively wrong rather than merely old.

## Proposed Phase 5 sequencing

Small, independently reviewable PRs rather than one large one, per this repo's own PR-discipline standard:

1. **PR A — `docs/governance/standards/` pointer fix.** 11 one-line front-matter edits. Zero content/policy change, lowest risk, ships first.
2. **PR B — `SHARED-AGENT-RULES.md` retirement.** Repoint `Agent.md`, `CORE-RULES.md`, `COPILOT-RULES.md`, `DEVIN-RULES.md`, `AI-REVIEW-ACCESS.md`, then delete `SHARED-AGENT-RULES.md`. Validate: re-run `tests/agent-governance-bootstrap.test.mjs` and confirm every per-agent rule file still resolves to a complete, non-contradictory chain.
3. **PR C — Archive three historical files.** Move `LGFC-AI-TEAM-OPERATING-MODEL.md`, `WORK-CONTINUITY-LEDGER.md`, `GOVERNANCE-LAUNCH-CONTROL-PACKAGE.md` to `docs/archive/`, fix any remaining inbound links (e.g. `CORE-RULES.md`'s "AGENT ROUTING PRIORITY" section already correctly caveats its `LGFC-AI-TEAM-OPERATING-MODEL.md` reference as superseded — confirm the link target still resolves after the move).
4. **PR D — Delete `pr-lifecycle-standard.md`.** Confirm no other file links to it as authoritative (only `CHATGPT-RULES.md` and `SHARED-AGENT-RULES.md`, per this audit's read of both, and the latter is already gone by PR B).

Each PR should run `docs_check_headers.sh` and the full `agent-governance-bootstrap` test suite before merge, per this repo's own documentation-header standard.

## Explicit non-goals (unchanged from #4091)

- No change to OpenAI-side agent configuration.
- No deletion of load-bearing operational rules.
- This report is not itself authorization to execute Phase 5 — that requires Bill's review of this proposal.
