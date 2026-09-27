---
Doc Type: Archived Reference
Audience: Human + AI
Authority Level: Historical
Owns: Historical PR-as-ticket prompt only
Does Not Own: Current assignment templates or Codex execution
Canonical Reference: /docs/templates/agent-assignment-template.md
Archived From: /PROMPTS/PR-as-ticket-template.md
Archived Reason: Replaced by the current assignment template; Codex execution in this prompt is retired; archived under #3155
Last Reviewed: 2026-09-27
---

# PR-as-ticket

> Archived under #3155 on 2026-09-27. Not current authority. Use `docs/templates/agent-assignment-template.md`.

### PR-AS-TICKET

## OBJECTIVE
<clear 1-line goal>

---

## TASK
<exact change to implement>

---

## FILE SCOPE (ALLOWLIST)
- <file path>

---

## REQUIREMENTS
- Work ONLY on this branch
- Do NOT create a new branch
- Do NOT create a new PR
- Modify ONLY allowlisted files
- No extra files
- No refactors

---

## ACCEPTANCE CRITERIA
- <explicit measurable outcome>

---

## CODEX EXECUTION
Implement this PR exactly as written.

Do NOT use git push.

Use Codex GitHub integration to:
- update the existing PR branch
- ensure commits appear in THIS PR

Do not create a new branch or PR.
Do not leave results only in sandbox.

---

## CURSOR EXECUTION
Open a NEW Cursor thread.

- Edit ONLY allowlisted files
- Do NOT run git commands
- Do NOT create branches or PRs

Return when complete.
