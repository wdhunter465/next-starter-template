---
Doc Type: Operational Rules
Audience: AI (Devin) — historical only
Authority Level: Agent-Specific (retired)
Owns: Historical Devin product pointer
Does Not Own: Live agent-team policy, implementation authority, or wake/dispatch
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #4399
Last Reviewed: 2026-09-27
---

# DEVIN-RULES.md

## Status

**Retired (#4399).** Product Authority recorded on 2026-09-27 that Devin is no longer in use.

This file is a historical pointer only. It grants no live role, implementation authority, or wake path. Do not run Devin as a live LGFC product.

The sections below are the pre-retirement record. Every MUST, Allowed, and Not allowed statement in those sections is historical. Do not treat that language as current policy.

Live role mapping: `docs/governance/AGENT-TEAM.md`. Copilot remains in use; this retirement does not apply to Copilot.

Purpose: Historical record of Devin-specific execution behavior.

Shared execution law: [`CORE-RULES.md`](./CORE-RULES.md). Role mapping: [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md).

---

# MANDATORY DOCUMENTATION CHAIN

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`docs/governance/REPOSITORY-AUTHORITY.md`](../../governance/REPOSITORY-AUTHORITY.md) → [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`CORE-RULES.md`](./CORE-RULES.md) → this file → applicable repo governance/procedure docs → applicable `.agents/skills/*/SKILL.md` files.

This file is additive. It does not replace shared/core rules or repo governance.

---

# ROLE

Devin is a constrained contributor.

Allowed:

- scoped implementation  
- opening draft PRs  
- producing verification notes  

Not allowed:

- merging PRs  
- policy creation  
- broad refactoring  
- scope expansion  

---

# EXECUTION MODEL

- One task → one branch → one PR  
- PR must be draft by default  

After PR creation → STOP  

No follow-up commits unless instructed.

---

# PR DISCIPLINE

- PR body = execution contract  
- file scope = strict boundary  

Devin must NOT:

- modify out-of-scope files  
- perform adjacent improvements  
- expand task intent  

---

# BRANCH RULES

- one task → one branch  
- no branch reuse  
- no direct work on main  

---

# VERIFICATION

Devin must provide:

- exact files changed  
- exact actions taken  
- any risks or blockers  

No vague claims.

---

# BREAKING CHANGE RULE

If change impacts behavior:

- explicitly state impact  
- leave PR as draft  
- stop for review  

---

# STOP CONDITIONS (DEVIN-SPECIFIC)

Stop if:

- PR unclear  
- scope ambiguous  
- references incorrect  
- repo state unverifiable  

---

# FINAL

Devin produces minimal, reviewable draft PRs.  
It stops at the draft boundary and does not proceed further.
