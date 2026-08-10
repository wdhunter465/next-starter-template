---
Doc Type: Operations Report
Audience: Bill, Work, Cursor, LGFC maintainers, and implementation agents
Authority Level: Evidence Snapshot
Owns: #3268 Phase 1 ("Current-state and security preflight") current-state/decision report — repository-derivable facts, the new read-only D1 investigation preflight, and the explicit list of facts/decisions this increment cannot resolve
Does Not Own: #3268 Phase 2 (export/backup proof), Phase 3 (scheduled service), or Phase 4 (restore drill) — all explicitly deferred to later increments; any R2 resource (none exists yet); any Production D1 write, export, or restore; the #2860/#2859 Production population decisions themselves
Source Issue: #3268
Canonical Reference: /docs/ops/reports/d1-backup-restore-3268-phase1.md
Related Issues: #3268, #2860, #2779, #2780, #2859, #2913, #3282, #3283, #3285, #3287
Last Reviewed: 2026-08-10 (updated same day: R2 bucket provisioned)
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
- **Update, same day:** Bill provisioned the private R2 bucket (`lgfc-d1-backups`,
  Standard storage, public access disabled) and its least-privilege S3-compatible
  credentials as repo secrets (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET_NAME`, `R2_ACCOUNT_ID`). Section 5 below adds the corresponding
  read-only R2 investigation preflight. Backblaze B2 (`secrets.B2_*`,
  `functions/_lib/b2.ts`, `functions/_lib/aws4fetch.ts`) remains a separate,
  already-configured service used for media storage — it is not this new R2
  bucket and does not satisfy #3268's requirement on its own; this update does
  not change that distinction.
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
| 4 | Inventory existing R2 buckets; dedicated bucket vs. isolated prefix | **Bucket decided and provisioned by Bill** (`lgfc-d1-backups`, Standard storage, public access disabled); **needs the new R2 preflight** to confirm reachability with the provisioned credential | Section 5 |
| 5 | Inventory existing tokens/bindings/secret patterns/CI deployment authority | **Answered for R2**: least-privilege S3 credential provisioned (`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_BUCKET_NAME`/`R2_ACCOUNT_ID`). `CLOUDFLARE_API_TOKEN`'s own R2 scope is still unverified — the new preflight's best-effort `wrangler r2 bucket list` corroboration will confirm or refute it | Section 5 |
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

- Account plan tier and Time Travel retention window (item 3) — dashboard-only
  fact. **Still outstanding** — the one remaining Phase 1 blocker as of this
  update.
- ~~Dedicated R2 bucket vs. isolated prefix...~~ — **resolved**: `lgfc-d1-backups`,
  Standard storage, public access disabled, least-privilege credentials
  provisioned.

None of these are engineering work this report can substitute for; they are
named here exactly as #3268 already named them, not invented by this report.

## 4. What this report does not do (explicitly, so it isn't assumed)

- Does not export any data.
- Does not upload, write, or delete any R2 object.
- Does not attempt a restore or restore drill (Phase 4 — needs Phase 1/2 facts first).
- Does not change #2860's or #2859's own Production-write eligibility — those
  remain gated on this project's real backup proof (Phase 2), not on Phase 1
  alone.
- Does not begin Phase 2 (real D1 export → R2 upload → checksum → restore
  proof) — per Bill's explicit 2026-08-10 instruction, that step waits for
  the account plan tier / Time Travel retention fact (item 3 above).

## 5. Update, 2026-08-10 — R2 bucket provisioned; new read-only R2 investigation preflight

Bill provisioned the private R2 bucket and credentials (Current known truth,
above). This adds `scripts/ci/d1_backup_r2_phase1_preflight_3268.mjs` +
`.github/workflows/ops-d1-backup-r2-phase1-preflight-3268.yml`: a
`workflow_dispatch`-gated, human-confirmed CI job that performs exactly one
bounded, read-only S3 `ListObjectsV2` call (max 1000 keys, single page)
against the bucket using the provisioned least-privilege credential, plus a
best-effort `wrangler r2 bucket list` corroboration using the existing
Cloudflare API token. It reuses `AwsClient` from
`functions/_lib/aws4fetch.ts` — the same S3 SigV4 signer already used for
the existing, already-shipped, read-only B2 integration in
`functions/_lib/b2.ts` (classified **read-only** in
`docs/reference/platform/component-environment-isolation.md`). It performs
no write, upload, or delete, and does not itself confirm "public access
disabled" (no S3-API bucket-ACL-read operation is exposed by R2 for that;
it remains a Cloudflare-account-level fact Bill has stated).

**Verified locally:** `npx vitest run tests/d1-backup-r2-phase1-preflight-3268.test.mjs`
— 15/15 passing (pure-function coverage of the XML-parsing, bucket-listing
extraction, and markdown-rendering helpers; `main()` requires live R2
credentials this sandbox does not have and is verified by the real CI run,
same precedent as the D1 preflight and #2913).

This answers Phase 1 item 4's reachability half and corroborates item 5's R2
credential half. It does not answer item 3 (plan tier / retention), which
remains the one fact standing between this report and Phase 2's real backup
path, per Bill's explicit sequencing.

**Live run history:** the first live run failed with an uninformative
generic error; a follow-up fixed the preflight to surface a real,
safely-redacted diagnostic (never the raw hostname or bucket-name-bearing
response text, which could otherwise leak `R2_ACCOUNT_ID`/`R2_BUCKET_NAME`
into this public issue). The second live run returned a specific,
actionable diagnostic: `ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE` against the
constructed R2 endpoint. A further fix now trims and reports (as a
non-leaking boolean only) whether any R2 secret value had leading/trailing
whitespace, since that is a plausible, cheap-to-rule-out cause of a
malformed hostname/SNI producing exactly this class of TLS failure. The
third live run showed `hadUntrimmedCredential: NO` and the identical
`ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE` recurred, ruling out the
whitespace hypothesis with real evidence.

Bill then verified from the Cloudflare dashboard: R2 is active, the account
ID matches the known-good `CLOUDFLARE_ACCOUNT_ID`, the endpoint format
(`<account-id>.r2.cloudflarestorage.com`) is correct, no jurisdiction-
specific endpoint applies, and `lgfc-d1-backups` exists with public access
disabled — ruling out account/dashboard misconfiguration. This directed
troubleshooting to the client/network/TLS execution path. The preflight
added two raw `tls.connect()` handshake attempts (default ALPN, and
`http/1.1`-only ALPN) with no HTTP request and no credentials, before the
S3 read. The fourth live run showed **both raw TLS attempts failed with
the identical `ERR_SSL_SSL/TLS_ALERT_HANDSHAKE_FAILURE`** — the same error
`fetch()` produces — which rules out the earlier hypothesis that this was
specific to `fetch()`/undici's TLS negotiation, since Node's `tls` module
is a completely separate implementation. `wrangler r2 bucket list` also
failed independently (exit 1, no detail captured at the time).

Bill reviewed this evidence and pushed back correctly on chasing a
Bot Fight Mode/WAF hypothesis without evidence, since Cloudflare's R2 S3
API is a separate account-level endpoint, not documented as governed by a
zone's WAF. He recommended checking Cloudflare's Security → Events
dashboard for a matching timestamp instead (his own action item), and
directed further work toward safe structural/network diagnostics rather
than another guess: endpoint-suffix/account-ID-label structure validation,
DNS resolution (address count/family only), TLS version-pinned attempts
(not just ALPN variants), and two more independent clients (`openssl
s_client`, `curl`) as a fourth and fifth data point beyond Node's own `tls`
module and `fetch()`. A general `redactSecrets()` helper now strips every
known secret value from any diagnostic text before it's included in the
public result, so richer diagnostic output (openssl's connection banner,
wrangler's actual stderr) can be safely captured instead of omitted
out of caution. Not yet re-run against this version as of this update.

## Acceptance checklist (this report)

- [x] Every Phase 1 item is individually classified (answered / needs
      preflight / needs Bill), not summarized vaguely.
- [x] The original R2 non-existence finding was backed by an actual repo
      grep, not an assumption, and this update reflects the real, later
      change (Bill's provisioning), not a silent contradiction.
- [x] No R2 write, upload, delete, or Production D1 action is created or requested.
- [x] Both preflights' tested scope (pure functions only) is disclosed
      honestly, matching the same limitation already accepted for #2913's
      precedent script.
- [x] Phase 2 (the real backup path) is explicitly named as still waiting on
      item 3, per Bill's own instruction — not implied as unblocked by R2
      provisioning alone.

## Rollback (of this PR)

The workflow and script are additive-only and independently revertible via
a normal PR revert; they modify no existing file, schema, or binding. This
report is documentation-only.
