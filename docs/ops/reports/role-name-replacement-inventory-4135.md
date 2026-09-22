---
Doc Type: Operations
Audience: Bill (Product Authority), Engineering, Operations, PMO, Governance
Authority Level: Controlled
Owns: #4135-001 inventory of live vendor/product agent-name occurrences in authority-bearing repo text (first executable child of #4135)
Does Not Own: Any file rename, any text replacement, any historical Issue/PR comment rewrite, #4173 ChatGPT retirement mechanics, or #4138 folder migration
Canonical Reference: docs/governance/AGENT-TEAM.md
Related Issues: #4135, #4212, #4213, #4214, #4215, #3627, #4173, #4165, #4174
Last Reviewed: 2026-09-22
---

# Role-Name Replacement Inventory — Vendor/Product Agent-Name Occurrences (#4135-001)

## Purpose

Answer #4212's exact question: quantify current-state vendor/product agent-name hits in
live (non-archive) docs, root governance files, workflows, and templates, classified as
replace / preserve / reconcile, so #4213/#4214/#4215 can scope their batches from evidence
rather than estimate. This is an inventory only — **no file is renamed and no text is
replaced in this child task.**

## Scope and non-goals

In scope: a repository-wide search for nine vendor/product agent names (ChatGPT, Cursor,
Codex, Claude, Grok, Jules, Gemini, CloudflareAI, Atlas) across `docs/**` (excluding
`docs/archive/**`), root governance files (`AGENTS.md`, `CLAUDE.md`, `Agent.md`),
`.github/workflows/**`, and template files, per #4135's own Initial solution direction.
`docs/governance/AGENT-TEAM.md` is excluded from every count — it is the canonical
name-to-role map, not a violation.

Non-goals: renaming any file; replacing any text; rewriting historical Issue/PR comments;
touching `docs/archive/**` content; mixing #4173 (ChatGPT retirement) or #4138 (folder
migration) scope. Those remain out of scope per #4135's own protected stops, carried through
to this child.

## Methodology

Repository-wide, tool-assisted search across 9 terms × 8 areas (docs/governance, docs/how-to,
docs/ops, docs/reference, docs/explanation, root governance files, `.github/workflows/**`,
templates), run against the current tree (2026-09-22). Counts below are **files with at
least one hit**, not line counts — **except the Root column**, which has only three possible
files (`AGENTS.md`, `CLAUDE.md`, `Agent.md`) and instead reports **per-file occurrence counts**
(e.g. "AGENTS.md 14" means 14 occurrences within that one file), since a 0-3 file-count range
there would carry no useful signal. `docs/archive/**` was searched only to confirm presence
and is deliberately **not enumerated** — it is preserved history, per #4135's own
carry-forward register from #3627. Files that read as historical/closeout artifacts (PR-body
templates, closeout evidence) are flagged separately rather than folded into "current-state"
counts.

## Current known truth

### Summary count table (files with ≥1 hit per term × area, except Root — see Methodology)

| Term | Governance | How-to | Ops | Reference | Explanation | Root (AGENTS/CLAUDE/Agent.md) | Workflows | Templates | Archive (present, not enumerated) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ChatGPT | 4 | 24 | 78 | 26 | 4 | AGENTS.md 4, Agent.md 2 | 1 | 0 | 5 files |
| Cursor | 9 | 29 | 74 | 26 | 6 | AGENTS.md 14, Agent.md 7 | 11 | 1 | 3 files |
| Codex | 3 | 1 | 19 | 6 | 0 | AGENTS.md 2, Agent.md 2 | 0 | 0 | 2 files |
| Claude | 3 | 4 | 8 | 3 | 1 | AGENTS.md 2, Agent.md 2, CLAUDE.md 1 | 3 | 0 | 2 files |
| Grok | 1 | 1 | 1 | 0 | 1 | 0 | 1 | 0 | 1 file |
| Jules | 0 | 0 | 1 | 1 | 1 | 0 | 3 | 0 | 0 |
| Gemini | 0 | 0 | 0 | 1 | 1 | 0 | 0 | 0 | 0 |
| CloudflareAI | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 (only repo-wide hit is `AGENT-TEAM.md` itself, excluded) |
| Atlas | 1 | 3 | 7 | 2 | 0 | 0 | 0 | 0 | 0 |

`CLAUDE.md` has 0 hits for every term except one self-referential "Claude" in its own title
line. `CloudflareAI` does not leak outside `AGENT-TEAM.md` anywhere in scope — no work needed
for that term.

### Structural hotspots (highest-value targets for #4213/#4214/#4215)

1. **`AGENTS.md` and `Agent.md`** are the single heaviest concentration of current-state
   routing language in the repository — both contain a per-product routing table of the
   shape `Cursor → docs/ops/ai/CURSOR-RULES.md`, `Codex → docs/ops/ai/CODEX-RULES.md
   (retired #4165; historical only)`, etc. Every row is live routing logic, not narration —
   even the "retired" rows are current-state gating text (they currently, correctly, say the
   product is retired; that phrasing is not itself a defect). `AGENTS.md` already points to
   `docs/governance/AGENT-TEAM.md` as "the authoritative current-state role map," confirming
   the intended canonical-map pattern.
2. **`docs/ops/pmo/CURRENT-STATE.md`** is an explicit live status/ownership dashboard with
   rows such as `#2615 | Active | Cursor | #2622 | ChatGPT / Atlas` and
   `Owner | Product Authority (Bill) or delegated PMO (ChatGPT / Atlas)`. Hit by ChatGPT,
   Cursor, Claude, Grok, and Atlas — unambiguously current-state and likely the single
   highest-priority file in `docs/ops/**`.
3. **`docs/ops/ai/*-RULES.md` family** (`CHATGPT-RULES.md`, `CURSOR-RULES.md`,
   `CODEX-RULES.md`, `CLAUDE-CODE-RULES.md`, plus `COPILOT-RULES.md` and `DEVIN-RULES.md`,
   which are outside the original 9-term list but structurally identical) — these are the
   literal routing *destinations* `AGENTS.md`/`Agent.md` point to per product. **Flagged as
   likely structurally analogous to `AGENT-TEAM.md` itself** (a deliberate, allowed
   per-product pattern, since each file's job is genuinely product-specific CLI/tooling
   instructions, not a role description) rather than a violation — but this is a judgment
   call for #4213/#4214, not decided here. If Product Authority wants role-based filenames
   instead, that is a file-rename decision with broken-link risk, outside a text-only
   replacement.
4. **`.github/workflows/ops-chatterbox-room-bootstrap.yml`** embeds a second,
   vendor-name-keyed role map in a JSON `default_participants` array (`"cursor-local"`,
   `"claude-code"`, `"google-jules"`, `"grok"`, `"chat"` for OpenAI ChatGPT), running in
   parallel to `AGENT-TEAM.md`. Worth flagging to whoever does the workflow-area batch
   (#4215) — this is a second source of truth for the same mapping, not just body text.
5. **`.github/orchestrator-routing.json` and `.github/orchestrator-labels.json`** — not
   workflow YAML (outside `.github/workflows/**`'s literal scope) but live routing/label
   config referencing ChatGPT and Codex by name (e.g. the `agent:ChatGPT` label string,
   repeated "ChatGPT is retired (#4173)" / "Codex is retired (#4165)" notes across routing
   rules). Same class of authority-bearing config as workflows; #4215 should likely pull
   these in even though they're not literally `.yml` workflow files.
6. **`.github/pull_request_template.md`** — one hit: line 60's `Implementation agent:`
   field uses `<!-- ... e.g. Cursor Local -->` as its example value in a live, currently-used
   template. Low-risk, single-line fix.

### Caution flags

- **Atlas** is a common generic word. Every hit spot-checked by the search paired it with
  ChatGPT in an ownership context (e.g. `ChatGPT / Atlas`), consistent with genuine AI-agent
  usage, but #4213/#4214 should visually confirm each of the 14 hits before batch-replacing —
  do not mechanically string-replace "Atlas" without reading context.
- **`docs/ops/pmo/CURRENT-STATE.md`, `PR_GOVERNANCE.md` line 37** ("Atlas/controller closeout
  mutations require an authorized closeout path...") reads as live authority language, not
  historical — a concrete replace candidate once Atlas's current role-equivalent is confirmed
  against `AGENT-TEAM.md` (Atlas does not appear in `AGENT-TEAM.md`'s current member mapping
  at all, which itself may mean this text is stale/orphaned rather than a simple name swap —
  **reconcile, not replace**, per #4135's own classification discipline: "if current canonical
  authority shows a function has actually moved... normalize the role, not just swap one name
  for another.")
- **`docs/reference/test-chatgpt-doc.md`** looks like a literal test fixture, not
  authority-bearing prose — likely preserve or delete-as-cruft, not a rename target; a
  decision for whoever owns that file's area.
- **Copilot and Devin** sit in the same `docs/ops/ai/` directory doing the same job as the
  9 in-scope terms (`COPILOT-RULES.md`, `DEVIN-RULES.md`) but were outside #4135's original
  9-term list and are **not counted above**. Flagging for Product Authority/PMO to decide
  whether #4135's scope should widen to include them for consistency, rather than silently
  including or excluding them here.
- **Filename-level vendor naming** (e.g. `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md`,
  `docs/reference/ci/cursor-local-bridge-contract.md`, `docs/how-to/cursor/**` as a
  vendor-named directory) exists independently of body-text hits. #4135's Initial solution
  direction frames this as a *text* replacement project; whether directory/filename renames
  are in scope is an open question for #4213 rather than assumed either way here.

### Historical/closeout artifacts flagged (preserve, not enumerated as violations)

Within `docs/ops/**`, these read as PR-body/closeout templates or evidence records rather
than live authority text — flagged per #4135's classification discipline, not excluded from
the raw counts above, but called out so #4214 does not spend batch effort "fixing" them:

- `docs/ops/pmo/content-collection-program-closeout-template.md`
- `docs/ops/pmo/program-task-handoff-template.md`
- `docs/ops/program-1-task-002-ci-closeout-evidence.md`
- `docs/ops/implementation-plans/role-based-task-closeout-governance.md`
- `docs/ops/implementation-plans/issue-1247-trusted-reviewer-evidence-design-update.md`
- `docs/ops/implementation-plans/content-collection/packages/ci-002-admin-closeout-auto-repair-package.md`

`docs/archive/**` carries confirmed hits for ChatGPT (5 files), Cursor (3), Codex (2), Claude
(2), Grok (1) — none enumerated, all preserve, per #4135's explicit non-goal.

### Templates area — clean except one line

`docs/templates/**` (11 files: `THREAD-LOG_TEMPLATE.md`, `agent-assignment-template.md`,
`as-built-template.md`, `executable-child-task-template.md`, etc.) and
`.github/ISSUE_TEMPLATE/**` (6 files) have **zero hits for all 9 terms** — clean.
`.github/pull_request_template.md` has the one `Cursor Local` example noted above.
`.github/cursor-pr-template.md` has a vendor name only in its filename, not its content.

### Classification signal by area (guidance for #4213/#4214/#4215, not a per-file ruling)

- **Root files (`AGENTS.md`, `Agent.md`):** almost entirely **replace** — current-state
  routing tables naming products where the routing decision itself should key on role.
- **`docs/governance/**`:** mixed — `PR_GOVERNANCE.md`'s Atlas line reads current-state
  (**reconcile**); most others likely mix policy language with historical citations
  (**spot-check each file**).
- **`docs/ops/pmo/CURRENT-STATE.md`:** **replace** — explicit live dashboard.
- **`docs/ops/ai/*-RULES.md` family:** likely **preserve** (structurally analogous to
  `AGENT-TEAM.md`) pending Product Authority/Engineering confirmation — **reconcile**.
- **`docs/ops/implementation-plans/**`, `docs/ops/trackers/**`, `docs/ops/pmo/program-*`,
  `docs/ops/as-built/**`:** mostly **preserve** (dated, evidentiary — this is the bulk of the
  74-78 file "ops" counts for ChatGPT/Cursor) — low-confidence impression, not fully read
  file-by-file; #4214 should verify per file rather than trust this label wholesale.
- **`docs/how-to/cursor/**` and `docs/reference/**/cursor-*-contract.md`:** current
  operational runbooks/contracts — likely **replace** in body text; filename question is
  separate (see Caution flags).
- **`docs/explanation/**`:** reads more like retrospective design narrative — leaning
  **preserve**, not fully verified.
- **`.github/workflows/**` and the two orchestrator JSON files:** **replace** where the text
  is a live conditional/label/participant key; the JSON participant map (finding #4) needs
  its own reconciliation against `AGENT-TEAM.md`, not a mechanical string swap.
- **Templates:** **replace** the one `pull_request_template.md` line; nothing else needed.

## Recommendation

This inventory satisfies #4212's acceptance criteria — counts by area, `AGENT-TEAM.md`
excluded, `docs/archive/**` and historical closeout artifacts listed as preserve. No rename
or text replacement is proposed or performed here. #4213 (governance + root pointers) is the
next executable child and should start with `AGENTS.md`/`Agent.md` and
`docs/ops/pmo/CURRENT-STATE.md` as the highest-value, most clearly current-state targets
identified above, and should raise the `docs/ops/ai/*-RULES.md` filename question and the
Copilot/Devin scope question to Product Authority before batch work assumes an answer either
way.

## Non-goals reaffirmed

- Does not rename any file.
- Does not replace any text.
- Does not rewrite historical Issue/PR comments or `docs/archive/**` content.
- Does not mix #4173 (ChatGPT retirement) or #4138 (folder migration) scope.
- Does not invent a CMO holder or otherwise get ahead of role documentation that does not
  yet exist.
