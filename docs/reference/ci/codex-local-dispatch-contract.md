---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Cursor-parity Codex local dispatch contract (runner, events, wrapper, health)
Does Not Own: Cursor dispatch internals, Production deployment, or later CI/review/merge wake extensions
Canonical Reference: /docs/reference/ci/codex-local-dispatch-contract.md
Related Issues: #4052, #3808, #3212, #3844
Last Reviewed: 2026-09-17
---

# Codex local dispatch contract

## Current known truth

Codex local auto-start uses the same control plane as Cursor Phase 4, with Codex-specific labels and CLI:

```text
GitHub Issue routing state
  -> GitHub Actions: LGFC Codex Dispatch
  -> GitHub-hosted security-negative preflight
  -> dedicated self-hosted runner: lgfc-codex
  -> fixed identifiers-only local wrapper
  -> authenticated local `codex exec`
  -> Codex loads Agent.md + CODEX-RULES + live source Issue
```

The #3844 stack (broad `pull_request` / `pull_request_review` / `workflow_run` self-hosted wake) is **not operational** and must not be reintroduced here.

## Event surface

Automatic: `issues:labeled` when the live Issue carries `agent:codex` and `handoff:ready`.

Manual: `workflow_dispatch` from `main` with confirmation `CODEX_DISPATCH` by `wdhunter465` or `wdhunter645`.

Forbidden on this runner workflow: `pull_request`, `pull_request_target`, `workflow_run`, `push`, fork heads.

## Wrapper rules

- Identifiers only (`repo`, numeric issue, event, delivery-id, run-id).
- No Issue/comment body interpolation into shell or Codex argv.
- Exclusive local lock `~/.lgfc-codex-dispatch/dispatch.lock`.
- Fail closed on unexpected repository remote or dirty worktree.
- Invoke `codex exec --cd <workspace> <prompt>` without dangerous bypass flags.

## Health

`.github/workflows/lgfc-codex-runner-health.yml` runs on GitHub-hosted `ubuntu-latest` and queries the self-hosted runner API for label `lgfc-codex`.

## Later extensions

Direct review/CI/merge wake is a separately designed second stage. Prefer a GitHub-hosted classifier that writes canonical Issue routing state rather than widening the self-hosted trust boundary.
