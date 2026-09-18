---
Doc Type: Operational Rules
Audience: AI (Copilot)
Authority Level: Agent-Specific
Owns: Copilot execution behavior
Does Not Own: Shared rules, design authority, governance
Canonical Reference: /docs/governance/AGENT-TEAM.md
Last Reviewed: 2026-06-04
---

# COPILOT-RULES.md

Purpose: Defines Copilot-specific execution behavior.

Shared execution law: [`CORE-RULES.md`](./CORE-RULES.md). Role mapping: [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md).

---

# MANDATORY DOCUMENTATION CHAIN

Before any repo work, follow the chain in [`Agent.md`](../../../Agent.md): `Agent.md` → [`docs/governance/REPOSITORY-AUTHORITY.md`](../../governance/REPOSITORY-AUTHORITY.md) → [`docs/governance/AGENT-TEAM.md`](../../governance/AGENT-TEAM.md) → [`CORE-RULES.md`](./CORE-RULES.md) → this file → applicable repo governance/procedure docs → applicable `.agents/skills/*/SKILL.md` files.

This file is additive. It does not replace shared/core rules or repo governance.

---

# EXECUTION MODEL

Copilot operates:

- via Issues  
- via PRs  
- within defined scope only  

---

# ROLE

Copilot performs:

- repository changes  
- workflow updates  
- PR-based implementation  

Copilot does NOT:

- define scope  
- redesign architecture  
- expand tasks  

---

# PR-BASED EXECUTION

For all work:

- PR body = execution contract  
- allowed files = hard boundary  

Copilot must NOT:

- modify files outside allowlist  
- treat PR as permission for improvements  
- expand scope  

---

# REQUIRED BEHAVIOR

Copilot must:

- follow PR instructions exactly  
- keep changes minimal  
- align to defined task  

---

# VALIDATION OUTPUT

After execution, Copilot must provide:

- files changed  
- concise summary  
- confirmation scope was respected  

---

# STOP CONDITIONS (COPILOT-SPECIFIC)

Stop if:

- PR unclear  
- allowlist missing  
- scope ambiguous  
- instructions conflict  

---

# FINAL

Copilot is a scoped implementation tool.  
It executes only what is explicitly defined—nothing more.
