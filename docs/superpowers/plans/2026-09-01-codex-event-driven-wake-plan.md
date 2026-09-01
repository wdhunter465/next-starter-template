# Codex Event-Driven Wake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, durable GitHub-to-local Codex wake path that mirrors Cursor's dispatch architecture without modifying Cursor configuration.

**Architecture:** A trusted label/manual-dispatch workflow performs hosted security tests, then routes identifiers to a dedicated `lgfc-codex` runner. A fixed Node wrapper validates identifiers, persists an idempotent queue record, invokes `/usr/bin/codex exec`, and records acknowledgment/retry state.

**Tech Stack:** GitHub Actions, Node.js 22 ESM, shell wrapper boundaries, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-codex-event-driven-wake-design.md`

## Global Constraints

- Cursor workflow/configuration files are read-only and must not change.
- Public event payloads are identifiers-only; never execute Issue/comment text.
- No paid relay, credential expansion, autonomous merge, or serial-lane claim.
- Issue authority is loaded live after wake; labels only route awareness.

### Task 1: Security contract and wrapper tests

**Files:**

- Create: `tests/lgfc-codex-dispatch.test.mjs`
- Create: `scripts/lgfc-codex-dispatch/test-dispatch-security.mjs`

- [ ] Write failing tests for trusted event filtering, hostile payload rejection, numeric identifiers, idempotent delivery, retry/stale state, and acknowledgment records.
- [ ] Run focused tests and confirm failure for missing wrapper exports.
- [ ] Keep test fixtures identifier-only and assert Cursor files are not modified.

### Task 2: Fixed local dispatch wrapper

**Files:**

- Create: `scripts/lgfc-codex-dispatch/dispatch.mjs`

- [ ] Implement strict argument parsing and trusted repository/event validation.
- [ ] Implement atomic queue writes, delivery-id deduplication, retry metadata, stale detection, and acknowledgment records.
- [ ] Invoke `/usr/bin/codex exec` only with a generated identifier-only prompt; support `--dry-run`.
- [ ] Run Task 1 tests to green.

### Task 3: GitHub workflow and runner contract

**Files:**

- Create: `.github/workflows/lgfc-codex-dispatch.yml`
- Create: `config/github-actions/codex-dispatch-runner.json`

- [ ] Add trusted `issues:labeled` and Product Authority `workflow_dispatch` gates, hosted security tests, dedicated `lgfc-codex` runner labels, and scoped permissions.
- [ ] Wire only numeric metadata to the wrapper and document no untrusted checkout/payload execution.
- [ ] Run workflow/security contract tests.

### Task 4: Operational runbook and final verification

**Files:**

- Create: `docs/how-to/ci/configure-lgfc-codex-dispatch-runner.md`
- Create: `docs/reference/ci/codex-local-dispatch-contract.md`

- [ ] Document registration, dry-run/live proof, acknowledgment/retry inspection, security boundary, and rollback.
- [ ] Run focused tests, `git diff --check`, and relevant repository quality checks.
- [ ] Prepare one PR against `main`; stop at independent review.
