---
Doc Type: Implementation Plan
Audience: Bill, ChatGPT, Cursor
Authority Level: Operational Plan (non-authoritative; supplements agent-assignment-template.md)
Owns: Content Collection Cursor Local assignment prompt pack — paste-ready prompts aligned with repo governance
Does Not Own: Canonical assignment template, source issue scope, design authority, or merge authorization
Canonical Reference: /docs/templates/agent-assignment-template.md
Related Issues: #2364, #2359, #2360, #2361, #2362
Last Reviewed: 2026-07-10
---

# Cursor Assignment Prompt Pack — Content Collection

## Purpose

Provide paste-ready Cursor Local assignment prompts for Content Collection program tasks (#2359). Prompts supplement — **do not replace** — `docs/templates/agent-assignment-template.md`.

Every prompt below must be wrapped in the mandatory template block (section 4 of the agent assignment template) with filled allowlists before execution.

## Scope

**In scope:**

- Universal Content Collection implementation prompt skeleton.
- Phase-specific prompts (P1 content model, P2–P5 feature lanes, P6 CI).
- Repo-grounded read-first list and stop rules.
- Freeze-marker contract for CC-001/CC-002.

**Out of scope:**

- Informal prompts without source issue and allowlist.
- Codex routing (inactive).
- Merge or closeout authority for Cursor.

## Current known truth

| Authority | Path |
| --- | --- |
| Assignment template (canonical) | `docs/templates/agent-assignment-template.md` |
| Operating model | `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md` |
| Handoff workflow | `docs/ops/ai/chatgpt-cursor-handoff-workflow.md` |
| PR governance skill | `.agents/skills/lgfc-pr-governance/SKILL.md` |
| Foundation packages | `docs/ops/implementation-plans/content-collection/packages/` |
| Audit disposition | `docs/ops/reports/content-collection-docs-audit-dedup-2360.md` |
| Intake drafts (non-authority) | `_incoming/drive-drafts/content-collection/` on `ChatGPT/drive-draft-intake-2367` |

Cursor is the **sole** LGFC implementation executor. Do not assign Codex.

## Universal Cursor prompt (copy and fill)

```markdown
# AGENT ASSIGNMENT — Content Collection / <Task Name>

## 1. Operating Mode

Implementation. Executor: Cursor only.

## 2. Source Issue

Primary source issue: #<task>

Parent program: #2359

## 3. Documentation Package

- Audit: `docs/ops/reports/content-collection-docs-audit-dedup-2360.md`
- Package index: `docs/ops/implementation-plans/content-collection/package-index.md`
- Assigned package: `docs/ops/implementation-plans/content-collection/packages/<package-id>.md`
- Support docs: `docs/ops/implementation-plans/content-collection/support/`

## 4. Draft / Reference Code

- Package path: <exact package doc>
- Pseudocode or reference paths from package doc only

## 5. Repository Authority

1. `Agent.md`
2. `docs/archive/LGFC-AI-TEAM-OPERATING-MODEL.md`
3. `docs/ops/ai/SHARED-AGENT-RULES.md`
4. `docs/ops/ai/CORE-RULES.md`
5. `docs/ops/ai/CURSOR-RULES.md`
6. `docs/templates/agent-assignment-template.md`
7. <package-specific canonical reference from package doc>

## 6. Objective

<One task from source issue only>

## 7. Deliverable

<Exact file path(s) from source issue allowlist>

## 8. Approved File Scope

- <path 1>
- <path 2>

## 9. Diataxis / Documentation Location

<Exact docs path if docs task>

## 10. Explicit Non-Goals

- No scope expansion beyond source issue
- No Codex routing
- No tracker edits unless authorized
- No workflow/runtime changes unless authorized
- No duplicate #2286 foundation rebuild

## 11. Acceptance Criteria

- [ ] <from source issue>
- [ ] Only allowlisted files changed
- [ ] Validation commands from package/issue run and reported

## 12. Verification Plan

- <commands from package doc or source issue>
- Post `CHATGPT HANDOFF` at review points

## 13. Rollback Plan

- Revert branch commits or discard worktree if verification fails
- Stop and request ChatGPT/Bill decision on authority conflict

## 14. Cursor Review Checkpoint

PASS required before file edits on new packages.

## 15. Bill/ChatGPT Stop-Gate Authorization

Execution authorized: <issue comment reference>

## 16. Handoff Required

Files changed, summary, verification, risks, scope confirmation.
```

## P1 — Content asset model prompt (CC-001 / CC-002)

Use for shared contract work only. **Do not** start Gallery, Library, Memorabilia, or Club feature implementation.

```markdown
MODE: Implementation
SOURCE ISSUE: #<task>
PACKAGE: CC-001 and/or CC-002
PACKAGE PATH: docs/ops/implementation-plans/content-collection/packages/cc-00*-*.md

Read first:
- cc-001-content-asset-model-package.md (gap matrix, #2286 inheritance)
- cc-002-provenance-rights-contract-package.md
- docs/reference/content/lgfc-content-candidate-model.md
- docs/reference/website/lou-gehrig-source-provenance-model.md
- docs/reference/website/lou-gehrig-rights-privacy-publication-review.md

Scope:
- Implement or document only the assigned contract delta within package allowlist
- Classify every change as consume | narrow extension | verified defect | integration adapter

Out of scope:
- Gallery, Library, Memorabilia, Club routes
- Rebuilding #2286 runtime foundation
- Creating docs/reference/website/content-collection/

Stop if:
- Change cannot be classified per CC-001 inheritance rule
- Parallel SOT would be created (C3/C4 from #2360)
- CONTRACT-FROZEN marker prerequisites not met for downstream lanes

Validation:
- Package validation commands
- Gap matrix updated if new gaps found

Freeze marker (post-merge/validation when authorized):
CONTRACT-FROZEN: content-asset-model v1
```

## P2 — Gallery prompt (GAL-001)

Use **only after** `CONTRACT-FROZEN: content-asset-model v1` is recorded in issue/PR.

```markdown
MODE: Implementation
SOURCE ISSUE: #<task>
PACKAGE: GAL-001
PACKAGE PATH: docs/ops/implementation-plans/content-collection/packages/gal-001-gallery-package.md

Prerequisite: CONTRACT-FROZEN marker on program issue thread

Scope:
- Governed Gallery display within package allowlist only
- Consume frozen content asset contract fields per CC-001 downstream view contract

Out of scope:
- Library, Memorabilia, Club shell
- CI workflows
- Shared content model files unless explicitly authorized

Stop if:
- CONTRACT-FROZEN missing
- Hot-zone path collision with open PR (see risk register R-003)
- Design compliance gaps (lgfc-design-compliance skill)
```

## P3 — Library prompt (LIB-001)

Use **only after** `CONTRACT-FROZEN: content-asset-model v1` is recorded in issue/PR.

```markdown
MODE: Implementation
SOURCE ISSUE: #<task>
PACKAGE: LIB-001
PACKAGE PATH: docs/ops/implementation-plans/content-collection/packages/lib-001-library-package.md

Prerequisite: CONTRACT-FROZEN marker on program issue thread

Read first:
- lib-001-library-package.md
- docs/ops/implementation-plans/content-collection/packages/cc-001-content-asset-model-package.md (downstream view contract)

Scope:
- Governed Library display within package allowlist only
- Consume frozen content asset contract fields per CC-001 downstream view contract

Out of scope:
- Gallery, Memorabilia, Club shell
- CI workflows
- Shared content model files unless explicitly authorized

Stop if:
- CONTRACT-FROZEN missing
- Hot-zone path collision with open PR (see risk register R-003)
- Design compliance gaps (lgfc-design-compliance skill)

Validation:
- Package validation commands
- Post `CHATGPT HANDOFF` at review points
```

## P4 — Memorabilia prompt (MEM-001)

Use **only after** `CONTRACT-FROZEN: content-asset-model v1` is recorded in issue/PR.

```markdown
MODE: Implementation
SOURCE ISSUE: #<task>
PACKAGE: MEM-001
PACKAGE PATH: docs/ops/implementation-plans/content-collection/packages/mem-001-memorabilia-package.md

Prerequisite: CONTRACT-FROZEN marker on program issue thread

Read first:
- mem-001-memorabilia-package.md
- docs/ops/implementation-plans/content-collection/packages/cc-001-content-asset-model-package.md (downstream view contract)

Scope:
- Governed Memorabilia display within package allowlist only
- Consume frozen content asset contract fields per CC-001 downstream view contract

Out of scope:
- Gallery, Library, Club shell
- CI workflows
- Shared content model files unless explicitly authorized

Stop if:
- CONTRACT-FROZEN missing
- Hot-zone path collision with open PR (see risk register R-003)
- Design compliance gaps (lgfc-design-compliance skill)

Validation:
- Package validation commands
- Post `CHATGPT HANDOFF` at review points
```

## P5 — Club newspaper prompt (CLUB-001)

```markdown
MODE: Implementation
SOURCE ISSUE: #<task>
PACKAGE: CLUB-001

Prerequisite:
- CONTRACT-FROZEN marker
- Shared shell risk controlled (see risk register R-007)

Scope:
- Scoped newspaper-style Club page changes within allowlist

Out of scope:
- Gallery/Library/Memorabilia route trees unless explicitly authorized
```

## P6 — CI prompt (CI-001 / CI-002 / Stage 0)

```markdown
MODE: Implementation
SOURCE ISSUE: #<task>
PACKAGE: CI-001 | CI-002 | Stage 0 gap analysis

Read first:
- docs/ops/implementation-plans/content-collection/packages/ci-00*-*.md
- docs/ops/implementation-plans/ci-stage-0-current-state-gap-analysis.md (when promoted)
- docs/governance/PR_LIFECYCLE_STATE_MACHINE.md

Scope:
- CI Stage 0 read-only inventory
- PR body generator or admin closeout **docs enrichment or bounded tooling** per child issue only

Out of scope:
- Feature app files
- Unsafe auto-repair without dry-run-first policy
- Bypassing Bill/ChatGPT merge/closeout authority

Stop if:
- Workflow change exceeds source issue allowlist
- CI scope creep (risk register R-005)
- Active feature-code lane has hot-zone collision — serialize

Validation:
- Inventory-first for Stage 0
- No workflow impl in Phase 0 docs-only issues
```

## PR requirements (all prompts)

Every Content Collection implementation PR must:

- Link exactly one source issue: `- **Issue:** #NNN`
- Include exact file allowlist matching final diff
- Use one intent label (`docs-only`, `change-website`, etc.)
- Include ZIP safety checkbox per PR template
- Post `CHATGPT HANDOFF` when PR opens
- Document validation evidence in PR body
- Not claim merge-readiness without gate inspection

## Procedure

1. Copy universal prompt block.
2. Fill all `<placeholders>` from source issue and package doc.
3. Complete Cursor review checkpoint on issue before edits (new packages).
4. Verify wake labels (`agent:cursor`, `handoff:ready`) if using poll-wake loop.
5. Post `CHATGPT HANDOFF` at review/completion points.

## Acceptance criteria

- [ ] Every task can be issued without manual reconstruction of role, scope, allowlist, validation, or stop rules.
- [ ] Prompts align with `agent-assignment-template.md` — no weakened governance.
- [ ] Codex references removed.
- [ ] #2286 inheritance and CONTRACT-FROZEN gates preserved.
- [ ] Intake draft path `docs/ops/programs/...` not used.

## Source intake mapping

| Intake draft | Enriched doc |
| --- | --- |
| `LGFC Cursor Assignment Prompt Pack — Content Collection Draft.docx` | This file (supplements `docs/templates/agent-assignment-template.md`) |

Disposition per #2360: `merge_into_existing` with template — this pack is program-specific operational overlay, not parallel template authority.
