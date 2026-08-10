---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: #3268 Phase 1 ("Current-state and security preflight") current-state/decision report — repository-derivable facts, the new read-only D1 investigation preflight, and the explicit list of facts/decisions this increment cannot resolve
Does Not Own: #3268 Phase 2 (export/backup proof), Phase 3 (scheduled service), or Phase 4 (restore drill) — all explicitly deferred to later increments; any R2 resource (none exists yet); any Production D1 write, export, or restore; the #2860/#2859 Production population decisions themselves
Source Issue: #3268
Canonical Reference: /docs/ops/reports/d1-backup-restore-3268-phase1.md
Related Issues: #3268, #2860, #2779, #2780, #2859, #2913, #3282
Last Reviewed: 2026-08-10
Executor: Claude Code
---

# #3268 Phase 1 — D1 backup current-state and decision report

## Purpose

Bill's 2026-08-10 GO on #3268 ("proceed with bounded implementation/non-Production
qualification") starts here, at #3268's own Phase 1: "Current-state and security
preflight." This report separates what is already knowable from repository
evidence alone, what a new read-only CI preflight can answer using credentials
this repo already has, and what genuinely requires either a new credential
Bill must provision or a Product Authority decision this report cannot make.

It performs no Production write, export, or restore. It does not create any
R2 resource (none exists) and does not request or use any new credential
beyond the existing `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/
`D1_DATABASE_NAME`/`D1_DATABASE_ID` secrets this repo's CI already has.

## Scope

Covers #3268 Phase 1 only (its own 7 numbered items). Does not attempt
Phase 2 (export/backup proof for #2860), Phase 3 (scheduled Workflow), or
Phase 4 (restore drill) — #3268's own ordering places all three after Phase
1's facts are known, and this report's job ends where genuine unknowns
require either a live preflight result or Bill's decision.

## Current known truth

- The repository has exactly one D1 database configured:
  `wrangler.toml` `[[d1_databases]]` — `binding = "DB"`,
  `database_name = "lgfc_lite"`, `database_id = "22d0dc3e-ad34-43af-8e6a-2063df1a1e04"`.
- `docs/reference/platform/component-environment-isolation.md` (the repo's own
  canonical isolation inventory) states this database is **production-shared**:
  "Single `database_id` in repo with no `[[env.preview.d1_databases]]`
  override... Not implemented (requires platform decision): separate preview
  D1." **There is no isolated Preview D1 database in this repository or
  account as currently configured.** Any read against "the database" is a
  read against the same database Production uses.
- No Cloudflare R2 resource is configured anywhere in this repository: no
  `[[r2_buckets]]` block in `wrangler.toml`, and a repo-wide search of
  `.github/workflows/**` for `secrets.R2_*` returns zero matches (confirmed
  by direct grep this pass). Backblaze B2 (`secrets.B2_*`, `functions/_lib/b2.ts`,
  `functions/_lib/aws4fetch.ts`) is a separate, already-configured service used
  for media storage — it is not Cloudflare R2 and does not satisfy #3268's
  "private R2-backed" requirement.
- Existing repo secrets `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ACCOUNT_ID`/
  `D1_DATABASE_NAME`/`D1_DATABASE_ID` already exist (established by #2913's
  successful real preflight run) and are sufficient for a **read-only** D1
  identity/metadata check. They are not known to include R2 scope, and this
  report does not assume they do.

## Intended final state

This snapshot is superseded by the new preflight's real result once it runs
(a fresh `#3268` issue comment posted by the workflow, not an edit to this
file), and again by each later phase's own report. This document's job is
done once Phase 1's answerable items are answered and its unanswerable
items are named for Bill's decision.

## 1. Phase 1 items — what's answered, what needs the new preflight, what needs Bill

| # | #3268 Phase 1 item | Status | Source |
| --- | --- | --- | --- |
| 1 | Exact Production D1 database name and UUID | **Answered** (repo evidence) | `wrangler.toml` (above) |
| 2 | Storage version supports Time Travel | **Needs the new preflight** (best-effort `wrangler d1 time-travel info`) | New workflow, Section 2 |
| 3 | Account plan and applicable Time Travel retention | **Cannot be answered by any CLI read this script can make** | Requires Bill to check the Cloudflare dashboard directly, or a separate account-level API call out of this preflight's scope |
| 4 | Inventory existing R2 buckets; dedicated bucket vs. isolated prefix | **Cannot proceed — no R2 resource or R2-scoped credential exists yet** | Requires Bill to create the bucket and provision a least-privilege R2 API token as a new repo secret before any R2 investigation can run |
| 5 | Inventory existing tokens/bindings/secret patterns/CI deployment authority | **Partially answered** (repo evidence: known secret names enumerated above); token *scope* (what permissions `CLOUDFLARE_API_TOKEN` actually has) is not verifiable without either a live permissions-introspection call or Bill confirming it directly | Repo evidence + Bill confirmation |
| 6 | Classify D1 data sensitivity (member/auth/moderation/attribution/audit/PII) | **Not attempted this pass** — this is a data-classification/documentation task, not a live read; appropriately Phase 1's next repository-evidence increment, not this preflight | Deferred to next increment |
| 7 | Confirm no backup object is publicly reachable | **Not yet applicable — no backup object exists yet** (Phase 2 has not run) | Deferred until a real export exists |

## 2. New artifact this PR adds: read-only D1 investigation preflight

`scripts/ci/d1_backup_phase1_preflight_3268.mjs` +
`.github/workflows/ops-d1-backup-phase1-preflight-3268.yml` — a
`workflow_dispatch`-gated, human-confirmed CI job that runs exactly two
read-only wrangler invocations (`d1 info`, best-effort `d1 time-travel
info`) against the existing D1 secrets, and posts its result as a durable
`#3268` issue comment. It performs no write, export, or restore, and uses
no new credential. It answers item 2 above (best-effort) and confirms item
1 against the live database rather than `wrangler.toml` alone.

**Verified locally:** `npx vitest run tests/d1-backup-phase1-preflight-3268.test.mjs`
— 11/11 passing (pure-function coverage of the markdown/metadata/bookmark
extraction helpers; `main()` itself requires live credentials this sandbox
does not have and is verified by the real CI run, same precedent as #2913's
own preflight script, which has no unit test of its own for the same
reason).

## 3. Decisions genuinely required from Bill before Phase 2 can start

- Account plan tier and Time Travel retention window (item 3) — dashboard-only fact.
- Dedicated R2 bucket vs. isolated prefix in an existing bucket, exact bucket
  name, and jurisdiction if applicable (item 4) — Product Authority decision
  plus account-level bucket creation and credential provisioning, neither of
  which this sandbox can perform.
- Confirmation of `CLOUDFLARE_API_TOKEN`'s actual permission scope (item 5) —
  or a decision to provision a separate, more narrowly-scoped token for
  backup operations specifically, per #3268's own least-privilege requirement.

None of these are engineering work this report can substitute for; they are
named here exactly as #3268 already named them, not invented by this report.

## 4. What this PR does not do (explicitly, so it isn't assumed)

- Does not export any data.
- Does not create, configure, or reference any R2 bucket.
- Does not attempt a restore or restore drill (Phase 4 — needs Phase 1/2 facts first).
- Does not change #2860's or #2859's own Production-write eligibility — those
  remain gated on this project's real backup proof (Phase 2), not on Phase 1
  alone.

## Acceptance checklist (this report)

- [x] Every Phase 1 item is individually classified (answered / needs
      preflight / needs Bill), not summarized vaguely.
- [x] The R2 non-existence finding is backed by an actual repo grep, not an
      assumption.
- [x] No R2 resource, credential, or Production write is created or requested.
- [x] The new preflight's tested scope (pure functions only) is disclosed
      honestly, matching the same limitation already accepted for #2913's
      precedent script.

## Rollback (of this PR)

The workflow and script are additive-only and independently revertible via
a normal PR revert; they modify no existing file, schema, or binding. This
report is documentation-only.
