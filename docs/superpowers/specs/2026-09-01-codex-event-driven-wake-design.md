# Codex Event-Driven Wake Design

## Goal

Provide Codex the same trusted, durable GitHub Actions-to-local-runner wake pattern as Cursor without changing the working Cursor dispatch configuration.

## Current authority

The live Cursor path is `lgfc-cursor-dispatch.yml` on the dedicated `lgfc-cursor` runner. Its security boundary is identifiers-only input, trusted repository/ref/actor checks, no fork or pull-request execution, and live Issue lookup after wake. Local Codex is available as `/usr/bin/codex exec` (`codex-cli 0.130.0`).

## Design

Add an independent `lgfc-codex-dispatch` workflow and fixed wrapper. The workflow accepts trusted `issues:labeled` events for `agent:codex` plus `handoff:ready`, and trusted manual dispatch by Product Authority. It runs security-negative tests on GitHub-hosted infrastructure, then invokes the wrapper only on a dedicated `lgfc-codex` self-hosted runner.

The wrapper receives only repository, Issue number, event, delivery ID, run ID, workspace, and dry-run identifiers. It validates numeric identifiers, obtains the live Issue through `gh`, writes an atomic durable queue record, rejects duplicate delivery IDs, and invokes `codex exec` with an identifier-only prompt directing Codex to load current repository authority. It writes an acknowledgment record and GitHub Issue comment containing delivery metadata but never public payload text. Failed invocation remains queued with retry metadata and a stale-event report; no arbitrary shell or prompt content is accepted.

The workflow covers assignments/comments routed through the canonical `agent:codex` + `handoff:ready` labels, PR/review/CI/merge notifications only when an authoritative workflow applies those labels, and explicit PMO/Operations resume via manual dispatch. Awareness does not grant scope, claim a serial lane, approve, or merge.

## Security and rollback

Only trusted same-repository label events and Product Authority manual dispatch are eligible. Public comments and payload fields are never interpolated into shell or Codex argv. The runner has no production credentials and no persistent GitHub write token beyond the workflow's scoped Issue comment capability. Rollback is disabling the Codex workflow and stopping/uninstalling only the dedicated Codex runner service; Cursor configuration is untouched.

## Validation

Tests will prove event filtering, identifier-only invocation, hostile payload rejection, durable queue/idempotency, retry/stale detection, acknowledgment output, and separation from Cursor configuration.
