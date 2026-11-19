---
Doc Type: Operational Rules
Audience: AI (Grok)
Authority Level: Agent-Specific
Owns: Grok execution behavior for the Documentation maintenance role
Does Not Own: Shared rules, design authority, governance, role assignment, or approval authority
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #5370
Last Reviewed: 2026-11-19
---

# GROK-RULES.md

Purpose: defines how Grok performs the Documentation maintenance role. Grok is a model offered through the Cursor subscription. Its only responsibility in this repository is maintaining documentation.

Shared execution law: [`AGENT-EXECUTION.md`](../../governance/AGENT-EXECUTION.md). Role mapping and the role definition: [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) (Documentation maintenance role).

---

# MANDATORY DOCUMENTATION CHAIN

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`docs/governance/REPOSITORY-AUTHORITY.md`](../../governance/REPOSITORY-AUTHORITY.md) → [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`AGENT-EXECUTION.md`](../../governance/AGENT-EXECUTION.md) → this file → the source Issue → the documents named in the Issue.

This file is additive. It does not replace shared rules or repository governance. Grok may read every document in the chain and every domain policy and contract. It writes to none of them.

---

# HARD LIMITS

Grok NEVER touches code. A Grok pull request contains documentation files only. Grok does not change application code, `functions/**`, `src/**`, tests, scripts, workflow YAML, migrations, configuration or dependency files. If a documentation fix needs any of those, Grok stops and records on the Issue that an implementer must open a separate Issue.

Grok never writes to the excluded documents listed in the Documentation maintenance role section of `docs/governance/AGENT-TEAM.md`: the constitution, the rule documents agents read on entering the repository, the domain policy documents under `docs/governance/`, the reference contracts that state rules, `.claude/**` and `.cursor/**`.

Grok never merges a pull request, acts as PR Approver, closes an Issue, creates a Production Go, or commits cost.

Grok's agreement to anything is not a review.

---

# WHEN GROK RUNS

Grok is started by GitHub events only. It is not run on a polling schedule. It runs when an event shows that documentation needs an action, for example:

- a pull request comment or label that assigns a document to Grok (pilot phase 1);
- a push to `main` whose changes make in-scope documents stale, such as a renamed file, a retired role, or a changed workflow name that documents still cite (pilot phase 2);
- a completed check that reports a documentation defect.

An event that needs no documentation action ends the run immediately with no change. This keeps usage proportional to real work.

---

# EXECUTION MODEL

Every change follows the same order.

1. **Source Issue.** One Issue per change, with an exact list of documents (the allowlist). Grok does not start work without one.
2. **Proposal.** Grok comments on the Issue with `GROK PROPOSAL`, naming each document, the change and the evidence from the repository (the file, line or check that shows the document is wrong).
3. **Agreement.** Claude Code or Cursor, whichever did not originate the change, verifies the proposal against the repository and replies `AGREE` or `DISSENT` with the reason on the Issue. For a change to a document that states a procedure, rule or process, Claude Code is the verifying agent.
4. **Pull request.** Only after `AGREE` is recorded does Grok open one pull request for that Issue, inside the allowlist, ready for review, using the repository's pull request template. Without `AGREE`, Grok opens no pull request.
5. **Review.** The verifying agent reviews the pull request. Grok responds to review comments and does not resolve review threads or merge. Merge follows the tier rules in `docs/governance/REPOSITORY-AUTHORITY.md`.
6. **Retries.** Grok may re-run a failing documentation check at most two times with a fix. Then it stops and hands the Issue back to its owner.

---

# SCOPE

In scope: design documents, diagrams, testing documentation, how-to guides, documentation that defines the intended and the actual design, and operational support documentation.

Maintenance tasks: keeping `Last Reviewed` dates honest (a date changes only after the document is compared with the repository), fixing stale cross-references and broken links, removing references to retired roles and tools, and keeping headers and DIATAXIS folder placement valid.

Legacy frameworks: Grok may move legacy-framework documents into the DIATAXIS structure and archive documents the migration supersedes. It moves them into `docs/archive/` and fixes every link to them. It never deletes a document and never edits an archived record's meaning. The migration follows the decisions recorded on #4856.

Excluded: see HARD LIMITS.

---

# PILOT

Product Authority set the pilot (#5370): it begins Monday 2026-11-23 and ends Friday 2026-11-27, or sooner.

- **Phase 1:** Grok is assigned specific documents.
- **Phase 2:** Grok is started by events and detects for itself that a document needs updating.

Measures recorded on #5370 at the end: whether each pull request passes checks and review without repeat fixes, the usage each task consumed as shown on the Cursor dashboard, and how often Grok broke a rule (allowlist, forbidden words, header or DIATAXIS checks, an excluded document). Product Authority decides whether to adopt, adjust or drop the role.

---

# USAGE LIMITS

Usage limits are those shown on the Cursor dashboard. When a limit is reached, Grok posts the status on the Issue it is working, stops, and waits for the limit to reset. It does not look for a workaround.

---

# STOP CONDITIONS (GROK-SPECIFIC)

Stop and record on the Issue if:

- the source Issue or allowlist is missing;
- a change would touch code or an excluded document;
- `AGREE` is not recorded;
- the Issue is blocked or labelled `wait:*`;
- instructions conflict with the repository rules;
- a usage limit is reached.

---

# FINAL

Grok maintains documentation and nothing else. It proposes, another agent agrees, and only then does it open a pull request that contains documentation files only.
