---
Doc Type: Operations
Audience: Human + AI
Authority Level: Controlled
Owns: Project #2460 launch-critical versus deferred architecture classification (#4206) and post-launch role options with revisit triggers (#4207)
Does Not Own: Production architecture mutation; implementing #2442, #2443, #2459, #2445, or #2448; reopening closed Programs; a second website or operating-system Program
Canonical Reference: docs/governance/PLATFORM-AND-ENVIRONMENT.md
Related Issues: #2460, #4206, #4207, #4208, #2449, #2442, #2443, #2459, #2445, #2448, #3268
Last Reviewed: 2026-09-22
---

# Platform Architecture and Scalability Decision Brief (#2460)

## Purpose

Separate architecture questions that must be decided before 2027 fundraiser production readiness from questions that stay deferred platform strategy. #4206 owns the classification table. This revision (#4207) adds post-launch role options and revisit triggers. The published recommendation plus related-review sequence remains #4208.

## Scope

In scope: classify current Cloudflare Pages, D1, B2, authentication, content/media, and deploy/rollback/disaster-recovery questions as **launch-critical** or **deferred**, with owners.

Out of scope: substituting this brief for Active website delivery; mutating Production architecture; implementing related reviews inside this Program; creating a broader operating-system Program.

## Current known truth

Observed 2026-09-22 on `origin/main` (`e8ea4e3d`):

- Near-term design package on #2460: production website plus repository governance. Broader platform stays a future Program.
- One GitHub repository (`wdhunter465/next-starter-template`) and one Pages project in `wrangler.toml` (`name = "lgfc-lite"`). Inventory of that single-repo assumption lives on #2459, not here.
- Production D1 `lgfc_lite` (`22d0dc3e-ad34-43af-8e6a-2063df1a1e04`) and Preview D1 `lgfc-litedev` (`35232809-b4c1-4df9-9f39-2f178b13c378`) are both declared in `wrangler.toml`. Public read paths are fail-closed by existing website work, not by this Program.
- Day-1 auth is a locked cookie-backed D1 session (`docs/reference/design/auth-model.md`). #2442 already recommended **retain** that lock; OAuth is not an omission to fill from #2460.
- D1 backup, retention, and restore verification remain open as #3268. This brief does not implement backup.
- Parent PMO master #2449 is closed. This Program does not reopen it.

## Intended final state

Every architecture question in the table is either **deferred** by default or **launch-critical** because it is named to fundraiser reliability, data integrity, auth, content/media operations, or deploy/rollback/DR, and has an owner outside speculative platform work. Near-term repository role is production website plus governance. This file does not authorize Production architecture change or a new operating-system Program.

## Classification rule (#4206)

Default is **deferred**. **Launch-critical** is allowed only when the question is named to at least one of:

- fundraiser reliability
- data integrity
- auth
- content/media operations
- deploy, rollback, or disaster recovery

Owners below already exist. This table does not create new implementation work.

## Architecture questions

| Question | Class | Named to | Owner | Notes |
| --- | --- | --- | --- | --- |
| Keep the current Cloudflare Pages production deploy for `www.lougehrigfanclub.com` on `main` with one-step rollback to the previous Pages deployment | launch-critical | deploy/rollback/DR; fundraiser reliability | Existing delivery / Operations under `docs/governance/PLATFORM-AND-ENVIRONMENT.md` and `docs/how-to/delivery/manage-component-integration.md` | Do not replace Pages with a new hosting model from this Program. |
| Keep Production D1 `lgfc_lite` as the live content and membership store, with fail-closed public reads | launch-critical | data integrity; fundraiser reliability | Existing website/D1 operations; Preview isolation contract `#3357` | A second production database or a multi-tenant D1 platform is deferred. |
| Prove private D1 backup, retention, and restore so a fundraiser-week data loss is recoverable | launch-critical | data integrity; deploy/rollback/DR | #3268 (open) | Classification only. #2460 does not implement R2 backup or restore drills. |
| Keep Day-1 cookie/D1 session auth working; do not unlock external identity providers for launch | launch-critical | auth | `docs/reference/design/auth-model.md` lock; #2442 retain recommendation | Growth-review OAuth/social login stays deferred on #2442. |
| Keep B2 (and existing media URLs) fail-closed for public content so broken storage does not fake a live library | launch-critical | content/media operations | Existing B2/media operations (`functions/_lib/b2.ts`, website QA read-path evidence) | A new CDN or object-store platform is deferred. |
| Keep public fundraiser/donation surfaces fail-closed so the site does not claim a live campaign it cannot run | launch-critical | fundraiser reliability | Existing public-launch fundraiser boundary (`docs/ops/reports/website-public-launch-fundraiser-boundary.md`, Program #1700) | Payment-processor architecture is not a #2460 mutation. |
| Split the GitHub repository or add a second website/Pages project for scale | deferred | (none — default) | #2459 | Inventory and reusable-versus-premature classification already in progress there. Not a 2027 hosting rewrite from #2460. |
| Treat the repository as a reusable multi-tenant operating system or shared-infrastructure platform | deferred | (none — default) | Future Program after #2460 closeout, if Product opens one | Design package: near-term role is production website plus governance. |
| Add OAuth/social identity providers | deferred | (none — default) | #2442 (closed; retain Day-1 lock) | Revisit only on #2442's recorded triggers, not from this table. |
| Rebuild the UI onto a new component-system / design-foundation architecture | deferred | (none — default) | #2443 (open Project) | Sequence later; do not absorb implementation here. |
| Replace the current D1/SQLite model with a separately governed relational/NoSQL migration program | deferred | (none — default) | #2445 (open child under #2441) | Schema-governance discovery is not launch architecture mutation. |
| Install a new automated testing framework or migrate the quality foundation as a platform program | deferred | (none — default) | #2448 (open child under #2447) | Testing-model discovery is not a #2460 deploy change. |
| Make Preview share Production D1, or invent a third database environment | deferred | (none — default) | `#3357` / `docs/how-to/operations/bind-pages-preview-d1-dev.md` | Two D1 IDs already exist in `wrangler.toml`. Changing that isolation is not this brief. |
| Multi-repo GitHub Actions runner fabric or shared CI control plane for other products | deferred | (none — default) | #2459 plus existing `lgfc-cursor` runner contract | Chromebook runner sleep is host operations, not a new architecture Program from #2460. |

## Counts

| Class | Rows | Meaning for #2460 |
| --- | --- | --- |
| launch-critical | 6 | Keep or complete already-owned production invariants. No new architecture from this Program. |
| deferred | 8 | Default. Related reviews stay referenced, not duplicated. |

## Post-launch role options (#4207)

#2460 asked whether the repository is primarily a production website, a reference implementation, a reusable governance template, an AI-first engineering platform, or a broader operating system. Near-term recommended role, from the design package on #2460: **production website plus repository governance**. Broader platform remains a future Program. This child does not open that Program.

| Option | What it would mean | Fit for 2027 fundraiser production readiness | Pull into current #2460 scope |
| --- | --- | --- | --- |
| Production website | One public site on Cloudflare Pages, current D1/B2/auth, fundraiser-safe fail-closed public surfaces | Required. This is the live product. | No new architecture. Keep operating it. |
| Repository governance | Issue-first delivery, DIATAXIS docs, agent roles, merge protection | Required so the website can change safely | No new architecture. Keep the existing constitution. |
| Reference implementation | A sample others copy without operating LGFC | Optional later; not a 2027 visitor outcome | Deferred. Do not retarget Active work to teaching-sample quality. |
| Reusable governance template | Extract PMO/CI/agent docs for other repos | Overlaps #2459 reusable-later notes (PMO dashboard env fallback). No current second consumer. | Deferred. Do not build a template product from this Program. |
| AI-first engineering platform | Cursor/dispatch/CI as the product | Supporting machinery for this repo only | Deferred as a product identity. Do not expand dispatch into a multi-repo control plane from #2460. |
| Broader operating system | Shared infrastructure, multi-tenant, multi-site | Explicitly out of the #2460 design package | Deferred. Future Program only if Product opens one. |

Recommended near-term combination: **production website plus repository governance**. The other four options are named future-Program material, not current scope.

### Triggers to revisit the role choice

Revisit the recommended near-term role only when Product records one of:

- A second public website or second GitHub repository is authorized as a 2027 (or later) product, which would reopen #2459's retain-versus-split question rather than this Program.
- Documented member-journey evidence that Day-1 auth itself blocks join (the #2442 retain triggers), which still would not make the repo an identity platform.
- A compliance or DR finding that the current Pages + D1 + B2 shape cannot recover fundraiser-week data, which is owned by #3268 restore proof, not by renaming the repo an operating system.
- Product explicitly opens a new Program whose objective is shared infrastructure or a reusable template, with its own launch package.

Until one of those triggers is recorded, do not treat reference-implementation, template, AI-platform, or operating-system identities as Active architecture work.
