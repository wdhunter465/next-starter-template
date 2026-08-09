---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Task Evidence
Owns: #2930 (#2782 Task 001) immutable candidate manifest template, Go/No-Go evidence checklist, and readiness harness
Does Not Own: The actual Production Go/No-Go decision (Product Authority); #2781's rehearsal evidence (owned by that project's own reports); Production execution (#2932, separately protected)
Canonical Reference: /docs/ops/reports/production-deployment-candidate-manifest-template-2930.md
Related Issues: #2930, #2782, #2781, #2931, #2932
Last Reviewed: 2026-08-08
---

# Production deployment candidate manifest template and Go/No-Go evidence — #2930

## Purpose

Deliver #2930 (#2782 Task 001): the immutable candidate manifest template, the
Go/No-Go evidence checklist drawn verbatim from #2782's "Go/No-Go evidence:
Required" list, and a deterministic readiness harness — so the actual Go/No-Go
reconciliation, once #2781 accepts and Product Authority is ready to decide, is
filling in a pre-agreed structure against machine-checked evidence citations, not
inventing a checklist under deployment pressure.

## Scope

Covers the candidate manifest schema, its field-completeness harness
(`scripts/ci/production_deployment_candidate_manifest.mjs`), and the evidence
citation requirements below. It does not cover #2781's rehearsal evidence itself
(only cites it), does not decide Production Go/No-Go, and does not cover #2931's
change-window/role/rollback preparation or #2932's actual deployment execution —
each is owned by its own task.

## Current known truth

- #2781 has not been accepted and Product Authority has not recorded a Production
  Go. No real candidate manifest exists yet — this document and its companion
  harness are **manifest design, evidence-checklist, and automation scaffolding**.
- `buildGoNoGoReadiness()` is implemented and tested against synthetic fixtures
  (`tests/production-deployment-candidate-manifest.test.mjs`), proving the
  completeness logic is sound before any real manifest is filled in.
- This document does not authorize deployment, Production mutation, or credential
  use of any kind — it defines what evidence a future manifest must cite.

## Intended final state

This document is evolving scaffolding pending #2781 acceptance and Product
Authority's Production Go. Its stable, post-decision state — once #2930 is
actually executed with a real candidate — replaces the template below with the
actual candidate manifest (every field populated with a real citation), the
`buildGoNoGoReadiness()` result for that manifest, and either "Production Go
recorded" or the explicit unresolved-decision list blocking it. The manifest
schema and evidence-checklist requirements themselves are not expected to change
— only "Current known truth" above is expected to update, from "no candidate
manifest exists" to a link to the real one.

## Non-blocking prerequisite rule

Per #2930's non-blocking prerequisite rule, this document and the readiness
harness are **manifest design, evidence inventory, source-Issue/PR/release
mapping, preflight planning, rollback preparation, and package completion** — the
collision-safe category #2930 explicitly authorizes before #2781's rehearsal
evidence is accepted for the final candidate qualification. No manifest is filled
in with real evidence here, and no Production authorization is implied.

## Candidate manifest — required fields

Every field below is a direct restatement of one bullet in #2782's "Go/No-Go
evidence: Required" list. Each value must be a non-empty evidence citation (a
link, issue/PR reference, or short description) — a bare `true`/`false` is not
accepted; `validateManifest()` fails closed on any missing or empty field.

| Manifest field | #2782 source requirement |
| --- | --- |
| `candidateSha` | Immutable candidate SHA with complete source-Issue/PR/release identity |
| `sourceIssueAccounting` | Source-Issue/PR/release identity for the candidate |
| `contract2776Evidence` | "complete #2776 contract" evidence |
| `sequence2777Evidence` | "complete ... #2777 sequence evidence" |
| `productProjectReadiness` | "accepted product project ... readiness" |
| `contentDataReadiness` | "accepted ... content/data ... readiness" |
| `complianceReadiness` | "accepted ... compliance ... readiness" |
| `communicationReadiness` | "accepted ... communication ... readiness" |
| `platformReadiness` | "accepted ... platform ... readiness" |
| `recoveryReadiness` | "accepted ... recovery ... readiness" |
| `monitoringReadiness` | "accepted ... monitoring ... readiness" |
| `operatorReadiness` | "accepted ... operator ... readiness" |
| `vendorAccountReadiness` | "accepted ... vendor/account readiness" |
| `program2781GoRecommendation` | "#2781 GO recommendation for the exact candidate" |
| `ciReviewChecksEvidence` | "all required CI/review/Promotion Candidate checks" |
| `cloudflareEnvironmentIdentity` | "exact Cloudflare environment/binding/configuration identity" |
| `rollbackTargetAndOwner` | "tested rollback target and recovery owner" |
| `noOpenLaunchBlockerEvidence` | "no open launch-blocking defect or unresolved protected decision" |
| `productAuthorityProductionGo` | "Product Authority Production Go" |

## Readiness harness

`scripts/ci/production_deployment_candidate_manifest.mjs`:

- `--manifest <path>` (required): reads a manifest JSON file.
- `--unresolved-decisions <path>` (optional): reads an unresolved-protected-decisions
  JSON array file; omit the flag entirely when there are none.

The CLI reports `{ ready, blockers, detail }`. `ready: true` means every
required field is a non-empty citation and no unresolved protected decision
remains — it does **not** mean Production Go is authorized, only that the
manifest is mechanically complete enough for Product Authority to make that
decision from.

Usage:

```bash
node scripts/ci/production_deployment_candidate_manifest.mjs \
  --manifest candidate-manifest.json \
  --unresolved-decisions unresolved-decisions.json
```

## What #2931 inherits from this task

- The candidate manifest schema and readiness harness, ready to validate the
  real manifest once #2781 is accepted and evidence citations are filled in.
- The exact evidence-checklist mapping above, so #2931's change-window/role/
  rollback preparation can reference manifest fields by name instead of
  re-deriving #2782's requirement list.

## Validation

- `npx vitest run tests/production-deployment-candidate-manifest.test.mjs` — all tests passing.
- `node scripts/ci/production_deployment_candidate_manifest.mjs --manifest <sample>` — verified `ready: true` on a fully-compliant synthetic manifest and `ready: false` with the correct blocker on each incomplete/malformed case, including a null manifest and a non-array unresolved-decisions value.
