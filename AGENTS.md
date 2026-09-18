# Product-neutral agent bootstrap

This file is a **compatibility/router** layer for tools that auto-load
`AGENTS.md`. It does not grant Cursor-only authority to Codex, ChatGPT, or
any other product. After this file, `Agent.md` remains the mandatory LGFC
navigation authority.

When a Cloud Agent session loads this file, the bootstrap is not complete until the agent has read the canonical chain below.

Do not merely report that these files are required. Read them before making any repo-work, readiness, implementation, or PR-governance claim:

1. `Agent.md`
2. `docs/governance/REPOSITORY-AUTHORITY.md`
3. `docs/governance/AGENT-TEAM.md`
4. `docs/ops/ai/CORE-RULES.md`
5. The **applicable product-specific pointer** (choose the active product; do not default every product to Cursor):
   - Cursor → `docs/ops/ai/CURSOR-RULES.md`
   - Codex → `docs/ops/ai/CODEX-RULES.md`
   - ChatGPT → `docs/ops/ai/CHATGPT-RULES.md`
   - Claude Code → `docs/ops/ai/CLAUDE-CODE-RULES.md`
   - Copilot → `docs/ops/ai/COPILOT-RULES.md`
   - Devin → `docs/ops/ai/DEVIN-RULES.md`
   - OpenAI / Work → `docs/ops/ai/WORK-RULES.md` (retired #4074; historical only — do not run as a live product)

For PR, issue, review, remediation, or implementation work, also read:

6. `.agents/skills/lgfc-pr-governance/SKILL.md`
7. `.github/pull_request_template.md`
8. Product-applicable how-to. Cursor PR work uses `docs/how-to/cursor/open-task-pr.md`.

A bootstrap report that says these files are "required but not yet read" is noncompliant.

## First bootstrap report

Before any other repo-work response, report each file as **read**:

- AGENTS.md: read
- Agent.md: read
- REPOSITORY-AUTHORITY.md: read
- AGENT-TEAM.md: read
- CORE-RULES.md: read
- product pointer: read (the active row from step 5)

For PR work, also report:

- lgfc-pr-governance/SKILL.md: read
- .github/pull_request_template.md: read
- docs/how-to/cursor/open-task-pr.md: read (Cursor PR work only; other products use their mapped how-to)

## Cursor Cloud route (Cursor product only)

The following Cursor Local/Cloud transport notes apply **only** when the
active product is Cursor. Codex and ChatGPT must ignore this section as
authority and use their own product pointers and wake paths.

> **Design shift (#3013, 2026-08-03):** Cursor Local handoff is **labels/status
> only** — `agent:cursor` + `handoff:ready` on an open Issue not already handed
> off (`status:review`/`status:complete`/`status:post-merge-verify`). There is
> no comment-marker protocol.
>
> **Transport (#3212 Phase 4 / #3424):** Primary wake is GitHub Actions
> `lgfc-cursor-dispatch` on runner label `lgfc-cursor` (identifiers-only
> wrapper). Cursor Local Bridge is **decommissioned** as a primary
> auto-start path; automatic packet delivery and the local poll-wake loop
> remain **retired as execution dependencies**. Canonical:
> `docs/governance/standards/CURSOR-RUNTIME-ROUTING.md` and
> `docs/how-to/ci/configure-lgfc-cursor-dispatch-runner.md`.

Cursor Cloud first bootstrap report additionally includes:

- CURSOR-RULES.md: read

## Stop before implementation when

- No primary source issue is identified
- No exact file-touch allowlist is defined

Task prompts do not override the chain in `Agent.md`.

## Local vs cloud bootstrap

- **Cursor Local Composer/Agent:** `.cursor/rules/*.mdc` (`alwaysApply: true`)
- **Cursor Cloud Agent:** this file (`AGENTS.md`) then the Cursor product pointer
- **Codex / ChatGPT / other products:** this file is a router only; continue from `Agent.md` and the matching product pointer
- **Skills:** `.agents/skills/*` are relevance-selected; they are not a substitute for this bootstrap and must not override LGFC authority or add approval gates

This file routes to canonical governance. It does not replace `Agent.md` or duplicate shared/core doctrine.

See `docs/how-to/cursor/agent-session-bootstrap.md` for Cursor verification steps.
See `docs/reference/ai/openai-agentic-surface-inventory.md` for the OpenAI surface inventory (#3815).
