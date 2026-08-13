# Cursor Cloud Agent bootstrap

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

When a Cloud Agent session loads this file, the bootstrap is not complete until the agent has read the canonical chain below.

Do not merely report that these files are required. Read them before making any repo-work, readiness, implementation, or PR-governance claim:

1. `Agent.md`
2. `docs/ops/ai/SHARED-AGENT-RULES.md`
3. `docs/ops/ai/CORE-RULES.md`
4. `docs/ops/ai/CURSOR-RULES.md`

For PR, issue, review, remediation, or implementation work, also read:

5. `.agents/skills/lgfc-pr-governance/SKILL.md`
6. `.github/pull_request_template.md`
7. `docs/how-to/cursor/open-task-pr.md`

A bootstrap report that says these files are "required but not yet read" is noncompliant.

After the canonical chain, read applicable `.agents/skills/*/SKILL.md` files for the task and the source GitHub issue with task-linked authority files.

## First bootstrap report

Before any other repo-work response, report each file as **read**:

- AGENTS.md: read
- Agent.md: read
- SHARED-AGENT-RULES.md: read
- CORE-RULES.md: read
- CURSOR-RULES.md: read

For PR work, also report:

- lgfc-pr-governance/SKILL.md: read
- .github/pull_request_template.md: read
- docs/how-to/cursor/open-task-pr.md: read

## Stop before implementation when

- No primary source issue is identified
- No exact file-touch allowlist is defined

Task prompts do not override the chain in `Agent.md`.

## Local vs cloud bootstrap

- **Local Composer/Agent:** `.cursor/rules/*.mdc` (`alwaysApply: true`)
- **Cloud Agent:** this file (`AGENTS.md`)
- **Skills:** `.agents/skills/*` are relevance-selected; they are not a substitute for this bootstrap

This file routes to canonical governance. It does not replace `Agent.md` or duplicate shared/core doctrine.

See `docs/how-to/cursor/agent-session-bootstrap.md` for verification steps.


## Continuous serial implementation (#3055)

For a graduated project, the exact prepared child graph is standing authority. After WORK records predecessor `ACCEPT`, the next package-complete serial child may proceed without a repeat Administration/PMO dispatch. The implementation runtime must record starting SHA, branch, allowlist confirmation, and pre-implementation checkpoint before editing.

Missing package fields produce `PACKAGE-INCOMPLETE`; a substantive dependency or protected boundary produces an evidence-specific `HOLD`. Merge alone is not acceptance. WORK owns acceptance, child/parent reconciliation, and successor release, and cannot independently verify or approve work WORK implemented.
