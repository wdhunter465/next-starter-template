---
Doc Type: Reference
Audience: Human + AI
Authority Level: Operational
Owns: Codex local dispatch security, queue, acknowledgment, retry, and rollback contract
Does Not Own: Cursor dispatch configuration or agent implementation authority
Canonical Reference: /docs/reference/ci/codex-local-dispatch-contract.md
Related Issues: #3808, #3212
Last Reviewed: 2026-09-01
---

# Codex local dispatch contract

The independent `lgfc-codex-dispatch` workflow mirrors Cursor's identifiers-only runner design. It routes trusted `agent:codex` + `handoff:ready` Issue labels and Product Authority manual dispatch, with review/merge notifications restricted to Codex-owned PRs.

The fixed wrapper accepts only repository, numeric Issue, event, delivery ID, run ID, workspace, and dry-run identifiers. It writes an atomic idempotent queue record, invokes `/usr/bin/codex exec` only with an identifier-only prompt, and records acknowledgment or retryable failure. Public comments and payload text never become shell commands or prompts.

Wake is awareness, not scope: Codex must load live repository authority and the source Issue. The runner cannot claim a serial lane, approve, merge, access Production credentials, or trust fork refs.

## Retry and rollback

`retryable-failure` records include attempt, bounded error text, and a next retry timestamp. Duplicate delivery IDs are acknowledged as `duplicate` without a second invocation. Stop the dedicated service and disable only `.github/workflows/lgfc-codex-dispatch.yml` to roll back; Cursor files and services remain unchanged.
