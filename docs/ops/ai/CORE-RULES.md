---
Doc Type: Operational Rules
Audience: All AI Agents
Authority Level: Core
Owns: Shared execution rules, enforcement model, PR discipline, stop conditions, shared product-startup framework
Does Not Own: Design authority, platform configuration, tracker content
Canonical Reference: /docs/ops/ai/SHARED-AGENT-RULES.md
Related Issues: #3055, #3113, #3117, #3138, #3142
Last Reviewed: 2026-08-08
---

# CORE-RULES.md

## Purpose

This document is the **detailed expansion** of shared AI-agent execution rules, including PR discipline, verification behavior, drift prevention, PR gate-readiness troubleshooting, and mandatory stop conditions.

For the categorized shared agent law index (evidence-first work, one issue per PR, parser-safe PR bodies, gates, documentation taxonomy, ZIP safety, secrets, and scope boundaries), read [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) first. Keep both documents aligned; do not weaken restrictions in either file.

## Mandatory documentation chain

Before any repo work, every agent must follow the chain defined in [`Agent.md`](../../../Agent.md):

[`Agent.md`](../../../Agent.md) → [`SHARED-AGENT-RULES.md`](./SHARED-AGENT-RULES.md) → this document → applicable agent-specific rule file → applicable repo governance/procedure docs → applicable `.agents/skills/*/SKILL.md` files.

Rules:

- Start at `Agent.md`; do not skip shared or core rules.
- Agent-specific rules are additive; they never replace shared law or repo governance.
- For PR, issue, review, remediation, and implementation work, read `.agents/skills/lgfc-pr-governance/SKILL.md` and `.github/pull_request_template.md` before opening or updating a PR.
- Task prompts and subagent instructions do not override this chain.
- If a required source issue is missing, stop before PR creation.

## Scope

This document applies to all AI agents working in this repository. It governs agent behavior, not product design, runtime architecture, platform configuration, or final merge authority.

## Current Known Truth

Repository governance is DIATAXIS-first, PRs are issue-scoped, and human/operator approval remains required for merge. PR gate-readiness troubleshooting requires correlated inspection of PR panel state, issue-accounting, review threads, PR body accounting, latest head workflow runs, failed job logs, and workflow implementation behavior.

GitHub Issues and Pull Requests are the authoritative execution record for normal implementation work. Tracker files are historical/status indexes and are not routine implementation closeout ledgers.

## Intended Final State

Agents should execute repository work predictably: one task per thread, one issue per task, one PR per implementation, all required gates passing, no scope drift, and no claims without verification against repository files and live PR state.

Normal implementation PRs should complete through the source Issue and PR lifecycle without a second tracker-update PR.

---

# EXECUTION DISCIPLINE

- One task → one thread → one deliverable
- One task → one Issue → one PR
- No mixed intent
- No scope expansion
- No routine tracker-update PRs for normal implementation tasks

If additional work is discovered → log it in the source Issue or PR, do not execute it.

---

# ISSUE-FIRST HARD GATE

A live, open same-repository governing source Issue is a **mandatory hard precondition** for every repository-changing action: branch creation, first commit, Pull Request, workflow edit, code change, documentation change, configuration change, emergency containment, or any other repository mutation.

The only repository action permitted when no governing Issue exists is **creation of that Issue**.

Required order (no exceptions):

1. Create or identify the governing Issue.
2. Verify the Issue authorizes objective, scope, writable paths, agent, validation, rollback, and review boundaries.
3. Create the authorized branch.
4. Create authorized commits.
5. Open the PR with an explicit governing-Issue reference that predates the branch and commits.

Rules:

- The governing Issue must **predate** branch creation, first commit, and PR creation.
- The PR must explicitly link to exactly one primary same-repository, open, non-PR governing Issue.
- The source Issue remains the task authority for implementation, review, post-merge verification, and closure.
- Open PR count must stay limited and purposeful.
- **No PR-first path is compliant.** Operations, incidents, CI, workflow, documentation-only, emergency, or administrative work has no exception.
- A later Issue reference does not retroactively make an issue-less branch, commit, or PR compliant; it is process correction only.
- Auto-created OPS tracker Issues after a PR already exists are not a compliant substitute for a pre-existing governing Issue.
- OPS tracker Issues must not replace, override, or hijack the source task Issue.
- Post-merge validation must report against the source task Issue.
- Merge authority remains human/operator only.

Motivating incident: PR #3115 was opened before governing Issue #3116 existed. That sequence must never recur (Issue #3117).

Compliant sequence: Issue → branch → commits → PR (with Issue reference).

Non-compliant sequences (examples):

- branch or commits before any Issue;
- PR opened, then Issue created and linked;
- emergency or CI fix without a pre-existing Issue;
- “operations exception” or “PR-first troubleshooting” paths.

---

# CURSOR-STYLE PR PREFLIGHT STANDARD

All agents must follow the execution pattern that has produced the lowest-friction PRs:

1. Confirm exactly one same-repository, open, non-PR source Issue.
2. Read the source Issue and only the task-relevant authority documents linked by that Issue.
3. Define an exact changed-file allowlist before implementation.
4. Keep the final diff inside the allowlist.
5. Use exactly one intent label.
6. Run task-relevant local checks before marking the PR ready.
7. Update the PR body so the allowlist, change summary, acceptance criteria, and verification evidence match the final diff.
8. Do not include unrelated tracker, documentation, runtime, workflow, or cleanup edits.
9. Stop when the scoped PR is ready for review or blocked by a documented gate.

This standard applies to Cursor, Codex, ChatGPT, Copilot, and any future implementation agent.

---

# OPERATIONAL TRUTH HIERARCHY

When PR readiness signals conflict, agents must use this order of authority:

1. live PR check panel state
2. latest head workflow runs and failed job logs
3. workflow files and enforcement scripts in the repository
4. GitHub review-thread state
5. PR body issue-accounting and reviewer-accounting sections
6. governance and AI operational documentation
7. prior conversation memory or agent assumptions

Rules:

- Workflow implementation and live CI results outrank assumptions or intended behavior.
- Gate behavior must be documented from actual workflow files, enforcement scripts, and CI logs.
- Undocumented exception paths must not be treated as current enforcement behavior.
- A gate is fixed only after the live PR panel and latest head workflow state support that claim.

---

# PR GATE READINESS TROUBLESHOOTING

When preparing any PR for merge approval, agents must validate all required gate classes, not only reviewer response.

Required sequence:

1. inspect the live PR check panel before relying on commit-scoped workflow runs
2. confirm PR issue-accounting uses exactly one same-repository, open, non-PR Issue reference as the primary source Issue
3. inspect PR body sections, file-touch allowlist, ZIP safety, source authority, acceptance criteria, and issue/reviewer accounting sections
4. inspect GitHub review-thread state and resolve addressed threads directly in PR review state
5. inspect the latest head workflow runs for every required gate
6. inspect failed job logs for any failing gate, including PR issue-accounting, reviewer-response gates, intent labeling, drift control, docs guardrails, quality checks, ZIP safety, and secret scanning
7. inspect relevant workflow files or enforcement scripts before documenting gate behavior or exception paths
8. patch the underlying content, workflow, PR body, issue link, or review-state defect
9. add a later maintainer acknowledgment for any high-severity review-level finding required by the gate logs
10. rerun or wait for gate evaluation and verify the live PR check panel plus latest gate runs together

Rules:

- The live PR check panel is authoritative for merge readiness.
- A green reviewer gate alone does not mean the PR is ready for merge approval.
- PR issue-accounting must be checked separately from reviewer response.
- The PR issue-accounting gate currently requires exactly one primary `Issue:` reference to one same-repository, open, non-PR issue.
- Design-compliance warnings and manually dispatched deployment workflows are not current blocking PR gate classes unless the live PR panel shows them as failing required checks.
- Reviewer-accounting, thread-resolution state, issue-accounting, review-level acknowledgments, latest job logs, workflow behavior, and all required checks must be reconciled together.

Canonical governance authority:

- `docs/governance/standards/governance-enforcement-standard.md`

---

# REQUIRED VERIFICATION

Before making any claim, agents MUST:

- read the source Issue
- read task-relevant design, architecture, governance, or implementation-plan files linked from the source Issue
- inspect the actual changed files and live PR state before readiness or closeout claims

Tracker files may be read for verification when relevant. Tracker files are updated only when the source Issue explicitly includes tracker governance, tracker reconciliation, or tracker/status-index edits in scope.

Fact handling (mandatory):

- All facts must be verified
- Sources must be cited when available
- No assumptions presented as fact
- If unverifiable → state explicitly

No guessing. No assumptions.

---

# DOCUMENTATION SOURCE TRACKING

Every task and PR must identify which documentation source path was used.

Allowed source classifications:

- `DIATAXIS_FULL` — a complete Diataxis document supplied the needed information.
- `DIATAXIS_ROUTED` — a Diataxis routing document directed the agent to a specific legacy source.
- `LEGACY_FALLBACK` — no complete Diataxis document or Diataxis routing document existed, so the agent searched legacy documentation directly.

Required agent report format:

```text
DOC_SOURCE: DIATAXIS_FULL | DIATAXIS_ROUTED | LEGACY_FALLBACK
DOC_SOURCE_FILES:
- <exact file path>
DIATAXIS_GAP:
- REQUIRED if LEGACY_FALLBACK was used
- NONE if not applicable
```

Rules:

- Agents must start with Diataxis when task-relevant documentation exists.
- Agents may use legacy documentation through a Diataxis routing document.
- Agents may use direct legacy search only as a safety valve when Diataxis lacks both full coverage and routing coverage.
- Every `LEGACY_FALLBACK` occurrence must identify a Diataxis coverage gap for follow-up work.
- `LEGACY_FALLBACK` does not create legacy authority; it identifies transition debt.

---

# SOURCE OF TRUTH HANDLING

If ZIP is present:

- treat ZIP as truth
- ignore memory over ZIP
- inspect files directly

If context becomes unreliable → STOP and restart in new thread.

---

# DRIFT PREVENTION

Agents must NOT:

- redesign routes, layout, or structure
- create duplicate governance files
- create alternate “versions” of canonical files
- silently fix unrelated issues
- expand task scope
- add tracker/status-index edits to implementation PRs unless the source Issue explicitly authorizes them

---

# PR DISCIPLINE

- PR body = execution contract
- File allowlist = hard boundary
- Out-of-scope edits = forbidden
- Source Issue link = required; governing Issue must predate branch, commits, and PR (issue-first hard gate; no exceptions)
- Tracker/status-index edits = forbidden unless explicitly in the source Issue scope

Defaults:

- PR = draft
- Stop after PR creation unless instructed

---

# AGENT COMPLETION DEFINITION

An implementation agent is not complete when code is pushed or a PR is opened.

The agent's task is complete only when all of the following are true:

1. The PR body is updated to match the final diff, source issue, allowlist, verification evidence, and reviewer-response accounting.
2. All reviewer comments, bot comments, and review threads have been inspected.
3. Every actionable reviewer item has either been fixed, rejected with rationale, marked not applicable, or linked to a bounded follow-up issue using the required PR-body disposition format.
4. All required gates have passed on the latest PR head after the final code and PR-body updates.
5. The PR status is changed from DRAFT/BLOCKED to READY FOR REVIEW, or the agent explicitly reports the exact blocker preventing readiness.
6. The agent's final report includes the current head SHA, exact checks run, gate status, reviewer disposition status, and whether the PR is READY FOR REVIEW.

A PR must not be handed to ChatGPT/Bill for review while any required gate, reviewer comment, bot comment, review thread, PR-body section, or source-issue accounting item still requires agent action.

---

# CAPABILITIES

- Work owns Issue and PR creation under standing operator permission.
- Work may create, comment on, label, update, and organize Issues and Pull Requests when task scope is clear.
- Issue-first hard gate remains mandatory for all work; no PR-first operations, incident, CI, or emergency exception exists.
- PR creation is NOT delegated unless explicitly instructed.
- Merge authority remains human/operator only.

`Work` is the OpenAI product that holds the PMO / Engineering, PR Approver / Engineering, and Administration & Communications roles in `docs/governance/AGENT-TEAM.md`'s current team mapping — this is the product previously named `ChatGPT` in this file and elsewhere in repository history (#3052). Ordinary conversational Chat (outside the Work product) is not part of the operational delivery chain; see `docs/ops/ai/WORK-RULES.md`.

---

# AGENT ROUTING PRIORITY

LGFC implementation routing is defined in [`LGFC-AI-TEAM-OPERATING-MODEL.md`](./LGFC-AI-TEAM-OPERATING-MODEL.md) (issue #1754, superseded) and [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) (current).

All LGFC implementation tasks (website, repository, ops, CI, and docs implementation):

1. **Cursor Local** and **Claude Code** = co-equal active LGFC standing implementation executors, each assigned bounded work through its own source Issue; neither is sole executor as of the 2026-08 multi-agent parallel-operation decision (#3052). A single task is assigned to exactly one executor; parallel operation means concurrent, non-overlapping assignments, not shared ownership of the same Issue.
   - **Cursor Local** is a normal standing executor for `team:operations`, `team:pmo`, and `team:governance` work, and is **not** a normal `team:engineering` executor.
   - **Claude Code** is a normal standing executor for `team:pmo` and `team:engineering` work (and Governance when explicitly assigned). Claude is **not** a normal Operations executor; Claude may join a bounded Operations Issue only when explicitly escalated for additional engineering support. Escalation does not create a Tier-2 Operations Team and does not change Team ownership (`#3152` four-Team topology: Operations, Governance, PMO, Engineering).
2. **Work** = PMO / Engineering, PR Approver / Engineering, and Administration & Communications authority; does not perform routine scoped file implementation unless the source Issue explicitly assigns it. See [`WORK-RULES.md`](./WORK-RULES.md).
3. **Codex** = selective-use executor only — **not** a standing LGFC implementation executor and receives no work by default. Product Authority may explicitly authorize Codex on a bounded source Issue; that authorization is sufficient and does **not** require global governance reactivation. Without that bounded authorization, Codex stops because **task-specific authority is missing**, not because Codex is categorically forbidden from repository work. Codex has a mandatory startup contract (orientation only); startup itself grants no implementation authority. See [`CODEX-RULES.md`](./CODEX-RULES.md) and `#3142`.
4. All other agents, including **Claude** (conversational) and **Notion** (controlled-document workspace), = tertiary/support agents only by explicit bounded routing need; neither holds a durable repository role or GitHub mutation authority. See `docs/governance/AGENT-TEAM.md`.

Prior documentation that listed Cursor as sole implementation executor, described Codex as repository-prohibited / globally disabled for all LGFC implementation, or required a separate “Codex reactivation” governance event before any bounded Product Authority assignment, is superseded for LGFC work by this section and `docs/governance/AGENT-TEAM.md`.

Routing priority controls assignment preference only. It does not override design authority, scope limits, PR discipline, separation-of-duty (an executor does not approve its own protected work), or merge approval. Selective Codex authorization does not alter normal standing routing priority for other work.

---

# TRACKER / STATUS-INDEX RULES

Tracker files are historical/status indexes, not routine implementation ledgers.

Only allowed tracker files:

- /docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md
- /docs/ops/trackers/THREAD-LOG_Master.md

Rules:

- Do not update tracker files during normal website, CI, repository, or documentation implementation PRs.
- Update tracker files only when the source Issue explicitly authorizes tracker governance, tracker reconciliation, or status-index maintenance.
- Preserve append-only history when tracker edits are authorized.
- Do not create alternate trackers.
- GitHub Issues and PRs are the authoritative execution record for task status and closure.

---

# VERIFICATION DOCTRINE

Agents must prefer:

1. file inspection
2. config validation
3. dependency checks
4. deterministic validation

No speculative redesign.

---

# MANDATORY STOP CONDITIONS

STOP immediately if:

- authority conflict exists
- scope is unclear
- repo state is unclear
- required source Issue is missing
- changed-file allowlist is missing
- live PR state cannot be verified for a readiness claim

---

# PRODUCT STARTUP FRAMEWORK

Shared skeleton for every recognized LGFC agent product's mandatory `run startup` procedure (#3052). Product-specific rule files (`WORK-RULES.md`, `CODEX-RULES.md`, `CLAUDE-CODE-RULES.md`) are additive to this skeleton; they do not replace it.

## When startup is mandatory

- every new product session;
- every new repository session;
- after a material loss of session state;
- after switching repository, checkout, or materially different assigned role;
- whenever Product Authority explicitly says `run startup`.

Startup is not required again for every prompt within the same verified session.

## Product-local command resolution

The literal command `run startup` resolves according to the active product — Product Authority does not need to say `run Work startup` or `run Codex startup`. Each product recognizes its own identity and executes its own startup contract:

- In **Work**: run the Work startup contract (`docs/ops/ai/WORK-RULES.md`).
- In **Codex**: run the Codex startup contract (`docs/ops/ai/CODEX-RULES.md`).
- In **Claude Code**: run the Claude Code startup contract (`docs/ops/ai/CLAUDE-CODE-RULES.md`).
- In **Cursor**: existing bootstrap applies (`AGENTS.md` for Cloud, `.cursor/rules/*.mdc` for Local); unchanged by this framework.
- In ordinary **Chat** or **Claude** (conversational, outside Work or Claude Code): no product-specific startup contract exists; state plainly that the product is outside the operational delivery chain and has no durable repository role.

## Shared startup steps

Every product-specific startup contract must, at minimum:

1. Detect and declare the active product.
2. Declare the assigned durable role(s) from `docs/governance/AGENT-TEAM.md`.
3. Declare operating mode (orientation only).
4. Confirm repository identity.
5. Confirm GitHub access.
6. Confirm any other required connected-source access for that product (e.g., Google Drive, Notion workspace, local checkout).
7. Read the complete mandatory authority chain from `Agent.md`.
8. Read the product-specific rules file.
9. Report only explicitly supplied active context — no queue audit, no inferred work.
10. Determine and report whether any work is authorized (it is not, by startup alone).
11. Stop.

## What startup must never authorize

Regardless of product, startup completion never authorizes:

- queue or backlog audits;
- inferred next work;
- issue or PR administration;
- branch creation, file edits, commits, or pushes;
- implementation or remediation;
- verification continuation;
- assignment packaging;
- GitHub mutation;
- PMO progression;
- administrative reconciliation.

A source Issue, its acceptance criteria, an exact file-touch allowlist, the applicable promotion profile, role authority, and an explicit implementation Go are loaded and confirmed separately, after startup completes. Startup completion is never itself interpreted as task authorization.


## Continuous parent-level execution (#3055 / #3145)

For a graduated Project or Program, the exact prepared child graph is standing authority. Eligible agents self-claim the next package-complete serial child one task at a time without routine Administration/PMO redispatch. The implementation runtime must record starting SHA, branch, allowlist confirmation, and pre-implementation checkpoint before editing.

Missing package fields produce `PACKAGE-INCOMPLETE`; a substantive dependency or protected boundary produces an evidence-specific `HOLD` scoped to the affected action — not queue-wide freeze for ordinary sequencing. Merge alone is not substantive acceptance. WORK owns preparation, monitoring, assurance, exception handling, and parent/program acceptance where judgment is required; WORK is not a routine per-task dispatcher. Deterministic CI remains the single automatic source-Issue closeout owner and cannot independently verify or approve work WORK implemented.

PMO defines sequencing and readiness coordination, not a general execution gate (#3113 / #3145). Ordinary predecessor and advisory conditions are comments, package notes, and order metadata. When only part of a task is gated, split bounded increments and continue collision-safe work. WORK prepares successor packages before implementer idle time. Product-authorized agent routing (Cursor Local for Operations + PMO + Governance; Claude Code for PMO + Engineering, and Governance when assigned) is preserved per Team eligibility and claim (#3152).

## Execution Contract Fidelity (#3138)

Approved assignments and Product Authority–approved actions are governed by the canonical standard `docs/governance/standards/AGENT-EXECUTION-FIDELITY.md`.

- Agreed `1-2-3-4-5` means execute `1-2-3-4-5`. Do not silently substitute `X-Y-Z`.
- Do not summarize, compress, expand, narrow, reinterpret, redesign, optimize, or replace agreed elements without new Product Authority approval.
- Before reporting completion, verify each agreed requirement against the actual resulting state (`Agreed → Delivered → PASS/FAIL`).
- If exact execution becomes impossible, stop the affected action, report the specific blocker, and obtain approval before any alternative.
- Bounded technical discretion remains allowed only inside intentionally open contract details that do not change meaning, scope, source, destination, or required end state.
- Agent-specific rule files are additive and must not weaken or reinterpret this shared rule.
