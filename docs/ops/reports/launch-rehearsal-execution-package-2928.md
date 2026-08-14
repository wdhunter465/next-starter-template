---
Doc Type: Operations Report
Audience: Bill, ChatGPT, Cursor, LGFC maintainers, and reviewers
Authority Level: Task Evidence
Owns: #2928 (#2781 Task 003) formal-rehearsal execution package — writable allowlist, freeze proposal, rehearsal scope split, and remaining deferred-entry dispositions
Does Not Own: Live journey execution, Production mutation, freeze ACCEPT, Pipeline intake closeout for #2776/#2777/#2783/#2786/#2787, or #2929 GO/NO-GO
Canonical Reference: /docs/ops/reports/launch-rehearsal-execution-runbook-2928.md
Related Issues: #2928, #2781, #2926, #2927, #2929, #2818, #3382, #2784
Last Reviewed: 2026-08-14
---

# Launch rehearsal execution package — #2928

## Purpose

Complete the #2928 execution envelope so formal rehearsal can start from a packaged
allowlist, named freeze proposal, and explicit scope split, without inventing
write-capable authority or mutating Production.

## Current known truth

| Field | Value |
| --- | --- |
| Parent | #2781 (Active P4; Cursor Local owns remaining chain #2928 → #2929) |
| This increment | Collision-safe package + live entry-criteria reconciliation |
| Component tip at start | `origin/component/launch-rehearsal@49851b89f1b07b1a3313434717f26ff4fee6820b` |
| Planning candidate (not freeze) | `component/launch-rehearsal@9900f98d3841c806cf20eaa82f91e1849066927a` |
| Proposed freeze (not applied) | `origin/main@87414533984aa9b5579b679fc8f9746b93517c5d` |
| Isolation evidence | Satisfied on `origin/main` (#2818 CLOSED; `lgfc-litedev` isolated) |
| This component wrangler | Production `lgfc_lite` only — not a write-capable rehearsal runtime |
| Formal journeys executed | None |

Schema `ready: true` on the entry harness remains schema/package readiness only.

## Exact writable allowlist (this increment)

- `docs/ops/reports/launch-rehearsal-entry-criteria-record-2926.json`
- `docs/ops/reports/launch-rehearsal-execution-package-2928.md`
- `docs/ops/reports/launch-rehearsal-execution-runbook-2928.md`

Out of scope: wrangler, workflows, runtime, Preview/Production configuration,
journey evidence logs, and defect ledgers with live results.

## Freeze proposal (protected — PMO/Product ACCEPT required)

Freeze the isolated website candidate as:

```text
origin/main@87414533984aa9b5579b679fc8f9746b93517c5d
environment: Cloudflare Pages Preview bound to D1 lgfc-litedev
```

Do not freeze the `component/launch-rehearsal` tip. That branch holds rehearsal
assets/runbooks only and still lacks Preview D1 isolation in `wrangler.toml`.

Until ACCEPT, `candidateIdentity` in the entry record stays the planning tip.

## Rehearsal scope split

From `docs/ops/reports/launch-rehearsal-journey-registry-2927.json` (22 journeys).

### Observe-only (eligible after freeze ACCEPT)

GET / read / contract-assert journeys that must not POST or write D1/email/admin:

- `anon-home-browse`
- `anon-search`
- `anon-error-fallback`
- `member-unauthorized-access`
- `fanclub-gallery-photo`
- `fanclub-library`
- `fanclub-memorabilia`
- `content-media-rights-attribution`
- `fundraiser-enabled-state`
- `fundraiser-disabled-state`
- `ops-deployment-monitoring`
- `ops-evidence-closeout`

### Write-capable / side-effect (blocked until freeze ACCEPT **and** remaining intake waiver or acceptance)

- `member-join-login`
- `member-logout-session-expiry`
- `fanclub-profile-card`
- `fanclub-discussion-submission`
- `content-publication-takedown`
- `email-notification-success`
- `email-notification-failure-contingency`
- `ops-incident-intake`
- `ops-rollback-recovery`
- `ops-operator-communication`

## Live entry-criteria dispositions (2026-08-14)

Satisfied from live GitHub / `origin/main` evidence:

- #2778, #2779, #2785, #2780, schema/harness, #2927 catalog
- #2818 isolation (CLOSED; isolated Preview D1 on `origin/main`)
- #2784 compliance project CLOSED `status:complete`
- #3382 Club Newspaper Phase 1 CLOSED

Still deferred (Pipeline intake; not waived by this package):

| Issue | Live state | Owner |
| ---: | --- | --- |
| #2776 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline or PMO waiver |
| #2777 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline or PMO waiver |
| #2783 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline or PMO waiver |
| #2786 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline or PMO waiver |
| #2787 | OPEN `pmo:pipeline` / `pmo:stage:intake` | Engineering Pipeline or PMO waiver |
| Frozen SHA | Proposed, not applied | PMO / Product Authority ACCEPT |

## What this increment does not do

- Execute any #2927 journey against Preview or Production.
- Invent a frozen SHA in `candidateIdentity`.
- Copy `wrangler.toml` isolation from `main` onto the component branch.
- Start #2929.
- Close #2928.

## Successor

After this package is independently reviewed and merged to
`component/launch-rehearsal`, Cursor waits for PMO/Product freeze ACCEPT (and
any intake waivers) before opening a separate #2928 increment with an exact
evidence-log / defect-ledger allowlist for the observe-only subset.
