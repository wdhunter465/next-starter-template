---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Operating model governance rules, PMO lifecycle stages, agent execution boundaries, and mode definitions
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/standards/document-authority-hierarchy_MASTER.md
Related Issues: #3597
Last Reviewed: 2026-08-18
---

# Operating Model (_MASTER)

## Purpose

Define the canonical operating model rules, PMO lifecycle stages, agent execution boundaries, and control modes across this repository.

## Scope

This document specifies:

- Agent execution allowlists and restrictions;
- Day-2 governance roles and responsibility boundaries;
- Control, Execute, and Verify operating modes;
- Canonical PMO lifecycle stages (`Initial Idea`, `Drafted Design`, `Pending Launch Packet`, `Graduation Candidate`, `Active`, `Closed`);
- Independent PMO execution priority sequences (`1...XXX`).

## Current known truth

- Repository work is structured into four exclusive queues: `team:operations`, `team:governance`, `team:pmo`, and `team:engineering`.
- `team:engineering` is explicitly limited to initial problem definition and qualification sufficient for PMO entry. Upon satisfying qualification, `team:engineering` is removed and the project enters PMO Pipeline at `Initial Idea`.
- PMO Pipeline projects progress serially through six canonical lifecycle stages: `Initial Idea` → `Drafted Design` → `Pending Launch Packet` → `Graduation Candidate` → `Active` → `Closed`.
- PMO Priority represents **execution order sequence** (`1...XXX`) within Pipeline and Active queues, rather than a fixed 4-level severity/importance classification.
- Agents operate strictly within approved file-touch allowlists and under explicit mode transitions.

## Intended final state

- Fully automated operating model enforcement ensuring zero-drift alignment between constitutional governance documents, issue tracking automation, and PMO dashboard views.

## Agent Rules — Repository Governance

### Purpose

This repository permits agentic AI (including GitHub Copilot, OpenCode, Claude Code, Cursor, and future agents) only for configuration stewardship, governance enforcement, documentation alignment, and authorized project implementation.

Feature development and application code changes are performed under explicit issue authorization.

### Allowed Actions

Agents MAY:

- Propose changes via Pull Requests only;
- Modify files within the approved allowlist for the task;
- Explain intent and impact before applying changes;
- Enforce repository governance, CI integrity, and configuration consistency.

### Prohibited Actions

Agents MUST NOT:

- Push directly to `main` or any protected branch;
- Modify files outside the approved allowlist;
- Create ZIP files or commit binary artifacts;
- Introduce unapproved features or refactor application logic outside task scope;
- Change licensing, ownership, or security posture without explicit instruction;
- Self-approve or self-merge pull requests.

### Approved File Allowlist Standard

Agents may modify ONLY paths explicitly permitted for the task. Default stewardship allowlist:

- `.github/workflows/**`
- `.github/intent-labeler.json`
- `.github/agent-rules.md` (only when explicitly instructed)
- `docs/**`
- `active_tasklist.md`
- `wrangler.toml`
- `package.json`
- `tsconfig.json`

All other files are read-only context unless an authorized implementation task explicitly grants a broader allowlist.

### Pull Request Requirements

Every agent-generated PR MUST:

- State intent clearly in the PR description using the canonical PR template (`.github/pull_request_template.md`);
- List files changed and why;
- Reference the triggering Issue or comment;
- Avoid unrelated or opportunistic edits;
- Preserve repository history and governance invariants.

## Governance — Roles

### Purpose

Define who owns decisions, who executes changes, and who verifies outcomes so operational responsibility is unambiguous.

### Roles (Day-2)

- **Operations (Owner of `_MASTER`):** Owns production stability, incident response, `_MASTER` documentation accuracy, and blocks merges that violate governance.
- **Project (Owner of `_DRAFT` and `_INCOMPLETE`):** Owns future direction and feature planning, producing drafts and incomplete docs that mature over time.
- **Automation / Agents:** Execute only what is explicitly specified under approved file allowlists.

## Governance — PMO Lifecycle and Priority Rules

### Canonical PMO Lifecycle Stages

1. **Initial Idea:** Concept recorded with problem statement and initial scope.
2. **Drafted Design:** Architecture, design options, and technical proposals drafted and undergoing multi-agent / stakeholder feedback.
3. **Pending Launch Packet:** Design approved; complete launch packet being created (child tasks, implementation plan, sequencing/dependencies, acceptance/validation, rollback/recovery, operational handoff).
4. **Graduation Candidate:** Complete design and launch packet assembled; ready for PMO graduation review.
5. **Active:** PMO explicitly graduates the project, assigns an Active priority (`pmo:priority:1...XXX`), and selects one end-to-end implementation owner.
6. **Closed:** Required implementation, acceptance, and closeout are complete with durable evidence recorded.

### PMO Execution Order Priority (`1...XXX`)

- PMO priority represents **execution order sequence** (`1...XXX`) within the respective lifecycle queue.
- Pipeline Priority (`1...XXX`) orders preparation work; Active Priority (`1...XXX`) orders implementation work.
- Priority `1` is the highest sequence position; subsequent work follows in numerical order (`1, 2, 3...XXX`).

## Governance — Modes

### Control, Execute, Verify

- **Control:** Decision-making, scope lock, governance compliance, risk management. Output: instructions, checklists, acceptance criteria, verification steps.
- **Execute:** Making the change (code/docs/config edits) within an approved scope. Output: exact file edits (diff-ready), commands, and replacement content.
- **Verify:** Proving the change works and does not regress invariants. Output: validation commands, observed results, and pass/fail calls.

Mode-switch rule: Mode switches must be explicit in the record. Operations assumes `Control → Execute → Verify`.
