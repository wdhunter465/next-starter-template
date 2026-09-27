---
Doc Type: Archived Reference
Audience: Human + AI
Authority Level: Historical
Owns: Historical Cursor prompt summary only
Does Not Own: Current Cursor rules, role assignment, or pull-request creation
Canonical Reference: /docs/ops/ai/CURSOR-RULES.md
Archived From: /PROMPTS/Cursor-Rules.md
Archived Reason: Contradicted current roles and was a duplicate of CURSOR-RULES.md; retired under #3155
Last Reviewed: 2026-09-27
---

# CURSOR RULES

> Archived under #3155 on 2026-09-27. Not current authority. Role mapping is `docs/governance/AGENT-TEAM.md`. Cursor product rules are `docs/ops/ai/CURSOR-RULES.md`.

## CORE MODEL
- Cursor = file editor
- ChatGPT = planner
- GitHub = control plane

## REQUIRED BEHAVIOR
- Use NEW thread per task
- Follow prompt exactly
- Edit ONLY allowlisted files

## PROHIBITED
- DO NOT run git commands
- DO NOT create branches
- DO NOT create PRs
- EXCEPTION: GitHub-assigned implementation issues that explicitly ask Cursor to open a PR may create a working branch and PR.
- DO NOT modify files outside scope

## OUTPUT
- Return completed file edits only
- No commentary
- No partial work

## SUCCESS CONDITION
- Files match PR specification exactly
- No scope drift
