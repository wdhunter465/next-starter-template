---
Doc Type: Operations
Audience: Human + AI
Authority Level: Supporting (interim evidence record; not the launch-revision Go packet row)
Owns: Interim evidence for go-live task P-27 (#4440): which data each site address reads, the repository's environment contract, what is shared, and what remains to be proven for the launch revision
Does Not Own: The isolation inventory (docs/reference/platform/component-environment-isolation.md), the Go packet, any binding change, or any Production write
Canonical Reference: /docs/reference/platform/component-environment-isolation.md
Related Issues: #4440, #4414, #2818, #4443, #4424
Last Reviewed: 2026-10-08
---

# Production bindings and environment isolation evidence (go-live P-27), interim record

## Purpose

The launch-readiness evidence matrix has a blocking row, "D1 and B2 bindings". It needs evidence, for the launch revision, that Production reads and writes the right resources and that previews cannot reach Production. This record collects what can be shown today, read-only and without secrets, so the launch-revision run only has to repeat and extend it.

## Method and limits

- Checked on 2026-10-08 against `main` at `0d6ff5a3`.
- Reads were public only: the repository, public pages, response headers, and the public list endpoints. No admin, member, or database endpoint was called. This stays inside Tier 1 of the proposed read policy (#4443).
- Counts below are item counts from public lists, not row contents.
- The Cloudflare dashboard bindings were not viewed. Where a statement depends on them it is marked "not proven here".

## Evidence

### 1. Repository environment contract

| Item | Value | Source |
| --- | --- | --- |
| Production database | `lgfc_lite` (`22d0dc3e-ad34-43af-8e6a-2063df1a1e04`), top-level binding `DB` | `wrangler.toml` |
| Preview and Development database | `lgfc-litedev` (`35232809-b4c1-4df9-9f39-2f178b13c378`), binding `DB` under `env.preview` | `wrangler.toml` |
| Identity check that Production and Development differ | `scripts/ci/d1_prod_dev_identity_check.mjs`, run by the migrations workflow | isolation inventory |
| Machine-readable inventory of preview-reachable mutating resources | `scripts/ci/preview-isolation-manifest.json` | isolation inventory |

Database names and IDs are identifiers already in the repository, not credentials.

### 2. What each address reads (public lists, 2026-10-08)

| Address | Role | FAQ items | Friends items | Milestones items | Next-event items | Health `db_ok` | Indexing signal |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `www.lougehrigfanclub.com` | Production | 10 | 8 | 19 | 1 | true | none sent |
| `next-starter-template-6yr.pages.dev` | Pages project root address | 10 | 8 | not checked | not checked | not checked | none sent; robots allows crawling |
| `claude-sharp-wozniak-efh08a.next-starter-template-6yr.pages.dev` | Branch preview | 9 | 9 | 19 | 1 | true | `x-robots-tag: noindex` |

Reading: the branch preview returns different FAQ and Friends counts than Production, which fits a separate database. The Pages project root address returns the same counts as Production, which fits Production data.

### 3. Shared and disabled resources (from the isolation inventory)

| Resource | Class | Note |
| --- | --- | --- |
| Pages project and its functions | production-shared | Same project for preview and production URLs. A URL alone does not isolate data |
| Rate limiting | production-shared | Dashboard setting |
| Admin APIs | disabled when the admin token is unset; production-shared when it is set | The production admin token must not be mirrored to preview |
| B2 listing at runtime | read-only | Admin sync from B2 is production-shared when its secrets are present |
| Outbound email | disabled by default | Becomes production-shared if enabled with production values |
| Analytics | The Production build includes the Google Analytics ID in its layout script; it loads only after consent. Non-`main` builds force it empty | Consent behavior is a P-11 check |

## Findings

1. **The Pages project root address serves Production data and is indexable.** `next-starter-template-6yr.pages.dev` returned Production counts, sent no `noindex` header, and its `robots.txt` allows crawling. Only the branch and per-deployment preview hosts send `noindex`. P-11 expects the `pages.dev` host to stay noindexed, which is true for previews but not for the root address. This is a duplicate-content and bypass risk. It is reported here for a decision; no change is made.
2. **Preview and Production return different data**, consistent with the repository contract.
3. **The dashboard Preview binding is not proven here.** The isolation inventory states isolation is not claimed for live Preview until the dashboard Preview `DB` binding matches `lgfc-litedev`. The count difference supports it but does not replace a dashboard check.
4. **No preview write path was exercised.** Proving that previews cannot write to Production needs either the dashboard binding view or a write test in an approved environment, and a write test needs a recorded Go.

## What remains for the launch-revision evidence

| Step | Owner | Needs |
| --- | --- | --- |
| View the Pages dashboard bindings for Production and Preview and record the database names (no secrets) | Operations with the environment owner | Dashboard access |
| Repeat the section 2 comparison on the launch candidate revision and attach it | Operations | Launch candidate deployed |
| Decide how to handle the project root `pages.dev` address (noindex header, redirect to `www`, or leave) | Product Authority | Decision |
| Reconcile #2818 (isolate Preview and Component resources from Production) with this evidence | PMO Admin | Review |

## Decision for Product Authority

How should the project root `pages.dev` address behave? Recommended: send a `noindex` header and a redirect to `www.lougehrigfanclub.com`, as a bounded change recorded on a child Issue before the 2026-12-31 freeze.

## Validation

Valid when the findings can be reproduced from the commands and addresses named above, and the launch-revision steps are run again on the candidate.

## Rollback

Revert this documentation commit. No system state is created.
