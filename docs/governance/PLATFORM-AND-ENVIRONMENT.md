---
Doc Type: Governance
Audience: Human + AI
Authority Level: Domain Policy
Owns: Platform architecture ownership, environment classification, preview/component/production boundaries, credentials and external-service decision rules, deployment/migration/rollback platform boundaries, and platform escalation
Does Not Own: Delivery Model A/B selection, agent approval routing, CI gate implementation, product/UX behavior, or day-to-day operator checklists
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #2688, #2686
Last Reviewed: 2026-08-11
---

# Platform and Environment

## Purpose

This document is the canonical **Platform and Environment** domain policy. It defines who owns platform and environment decisions, how environments are classified, what is protected, how credentials and external services are authorized, and how deployment, migration, and rollback boundaries apply at the platform layer.

Detailed Cloudflare, D1, B2, and isolation inventories live under `docs/reference/platform/**`. Those files are **supporting specifications**, not co-owners of this domain policy.

Delivery model selection remains in `docs/governance/PMO-PORTFOLIO.md` and `docs/governance/DELIVERY-AND-RELEASE.md`. Agent roles and protected-stop contracts remain in `docs/governance/AGENT-TEAM.md`. Operations degradation and emergency recovery remain in `docs/governance/OPERATIONS-AND-RECOVERY.md`.

## Role-based ownership

| Role | Actor | Owns in this domain |
| --- | --- | --- |
| **Product Authority** | Bill | Platform go/no-go that changes product risk; credentials, cost, vendor, or business authorization; final judgment when isolation or hosting model is material |
| **PMO / Engineering** | ChatGPT | Platform documentation package authorship; environment classification completeness; primary PR review for platform/environment policy and protected platform changes |
| **Implementation / Operations** | Cursor | Scoped implementation of approved platform docs and allowlisted platform work; no self-approval of platform authority |
| **PR Approver / Engineering** | ChatGPT (Bill alternate) | Approval and merge of platform/environment PRs per delivery profile; not a substitute for Product Authority on credentials, cost, or material isolation decisions |
| **Supporting platform references** | `docs/reference/platform/**` | Resource inventories, isolation classifications, and operational platform facts only |

Rules:

- Product Authority decisions recorded by Bill outrank competing platform commentary in issues, PRs, chat, or agent memory when credentials, cost, vendor access, isolation, or hosting model are material.
- Chat authors and maintains the platform documentation package; Cursor implements within the approved allowlist.
- Cursor must not invent isolation claims, provision production-affecting resources, or treat supporting inventories as independent policy owners.
- Supporting platform references must cite this domain policy and must not restate competing domain ownership.

## Authority stack inside this domain

When platform or environment sources conflict inside this domain, resolve in this order:

1. Locked Product Authority decisions recorded by Bill (issue, PR, or approved platform lock)
2. This domain policy (`docs/governance/PLATFORM-AND-ENVIRONMENT.md`)
3. Isolation and mutating-resource inventory: `docs/reference/platform/component-environment-isolation.md`
4. Resource inventories under `docs/reference/platform/**` (Cloudflare, D1, B2, and related guides)
5. Source GitHub issue allowlist and acceptance criteria for the active task
6. Historical explanation, ops notes, or evolution records (non-binding)

## Environment classification

| Environment | Definition | Isolation status (current truth) |
| --- | --- | --- |
| **Production** | `main` deploy to production Pages project / production domains | Authoritative write target |
| **Preview** | Per-PR or per-branch Cloudflare Pages URL | **Not isolated** — shares production bindings unless a recorded control says otherwise |
| **Component** | Model B `component/*` preview URL | **Not isolated** — shares production bindings unless a recorded control says otherwise |
| **Local** | Local development (`npm run dev` and optional proxies) | Depends on operator `.env`; defaults must remain fail-closed |

Rules:

- PR **intent** metadata (`Target environment: component|preview|production|recovery`) classifies delivery intent. It does **not** by itself prove runtime isolation.
- URL alone does not isolate data, credentials, or bindings.
- Agents must not claim preview or component isolation that the supporting inventory does not prove.
- Unsafe preview/component mutation of production resources is a protected stop under `docs/governance/AGENT-TEAM.md`.

## Current platform safety truth

As of the supporting isolation inventory:

- Cloudflare Pages project bindings other than D1 may still be shared; **D1** is split in the repo contract: Production `lgfc_lite` (`22d0dc3e-…`) vs Preview/Development `lgfc-litedev` (`35232809-…`) via `wrangler.toml` + required dashboard Preview `DB` binding (`docs/how-to/operations/bind-pages-preview-d1-dev.md`, #3357). Live Preview isolation is not claimed until that dashboard binding is verified.
- Shared rate-limiter namespace and admin/media mutation surfaces remain **production-shared** risk when production credentials are mirrored onto preview.
- B2 object listing at runtime is **read-only** in Pages Functions; admin B2→D1 sync paths remain **production-shared** when secrets and admin credentials are present.
- Outbound email and analytics are **disabled by default** and become **production-shared** when enabled with production values.
- Admin mutation surfaces are blocked when `ADMIN_TOKEN` is unset and are **production-shared** when production credentials are mirrored onto preview.
- Fail-closed Prod≠Dev D1 identity checks live in `scripts/ci/d1_prod_dev_identity_check.mjs` and `d1-migrations.yml`.

Required controls while isolation is incomplete:

- Do not mirror production `ADMIN_TOKEN`, MailChannels enablement, GA ids, or B2 write-capable secrets onto preview/component deploys unless Product Authority and Chat record an intentional, bounded exception.
- Treat mutating preview paths that share production D1 as protected for Model B integration decisions.
- Prefer fail-closed defaults documented in the isolation inventory and `.env.example`.

## Decision boundaries

| Decision class | Authority | Required record |
| --- | --- | --- |
| Platform architecture / hosting model | Product Authority go/no-go; Chat packages design | Source issue + platform package |
| Environment classification or isolation claim | Chat updates isolation inventory; Product Authority when material risk changes | Updated `component-environment-isolation.md` cited by PR |
| Provisioning separate preview/component resources | Product Authority + Chat | Source issue authorization before implementation |
| Credentials, secrets, vendor access, or paid service enablement | Product Authority (credentials/cost/business); Chat records packaging | Source issue authorization; secrets never committed |
| External-service mutation (B2 write sync, email send, analytics) | Chat review; Product Authority when production impact or cost applies | Source issue + protected-change review when required |
| Deployment binding / Pages project / production domain change | Chat primary; Product Authority when material | Protected-change review |
| D1 schema migration affecting production | Chat review; Product Authority when destructive or irreversible | Migration plan + protected-change review |
| Platform rollback of bindings, credentials, or external writes | Chat/Bill per Operations and Delivery policies | Rollback package on source issue / PR |
| Emergency platform stabilization | Operations and Recovery path | Incident/source issue disposition |

No agent may treat an implementation convenience, screenshot, prior PR, or draft comment as a platform isolation or credential decision.

## Protected platform changes

The following require Chat review before component integration or production merge, and Product Authority when credentials, cost, vendor access, or irreversible risk apply:

- destructive or non-backward-compatible database migration;
- authentication or authorization boundary that changes platform access;
- secret or credential handling;
- deployment workflow, Pages project, or production binding change;
- irreversible external-service mutation;
- any change that claims or weakens preview/component isolation.

Protected-path baselines used by delivery automation remain in `docs/reference/ci/delivery-profile-contract.md`. This domain policy owns the platform meaning of those boundaries; it does not own CI gate implementation.

## Credentials and external services

| Resource class | Policy |
| --- | --- |
| Repo secrets / Cloudflare secrets | Never commit values; document names only in supporting specs |
| Admin tokens | Fail-closed when unset; production values must not be mirrored to preview/component |
| B2 keys | Names only in docs; write-capable use is admin/operator controlled |
| MailChannels / GA / other outbound services | Disabled by default on non-production; enablement requires recorded authorization |
| D1 remote apply / scheduled sync workflows | Production-shared operator surfaces; not preview-invoked |

Credential, cost, or business authorization missing from the source issue is a protected stop.

## Deployment, migration, and rollback boundaries

| Concern | Domain boundary |
| --- | --- |
| **Deployment** | Production deploys from `main` through the Cloudflare Pages project. Preview/component URLs are not production. Delivery model and promotion rules remain in Delivery and Release. |
| **Migration** | Schema changes use controlled migrations. Production D1 is the authoritative data store. Preview-first testing is required before remote production apply when isolation allows meaningful testing; when preview shares production D1, treat migrations as protected production-affecting work. |
| **Rollback** | Binding/credential/config restoration and previous Pages deployment restoration follow Delivery and Operations rollback profiles. This domain owns which platform resources are in scope; it does not redefine Model A/B rollback profiles. |

## Escalation rules

Stop and escalate to Product Authority (Bill), with Chat as gate-review partner, when:

- two active platform sources disagree and the source issue does not resolve precedence;
- preview or component execution can mutate production without an approved control;
- credentials, cost, vendor, or business authorization is required and not recorded;
- a requested change would claim isolation that the inventory does not prove;
- an approved platform design cannot satisfy acceptance criteria without replanning.

Routine inventory wording fixes, reference routing corrections, validation remediation, and bounded allowlist documentation are not escalation events.

## Approval rules

| Change type | Platform-doc update first? | Approval |
| --- | --- | --- |
| Docs-only supporting inventory correction aligned to existing authority | Yes (the docs PR is the change) | Chat primary; Bill alternate |
| Implementation matching already-recorded platform facts | No additional ownership change | Per delivery profile (`docs/governance/DELIVERY-AND-RELEASE.md`) |
| Material isolation, binding, credential, or hosting change | Yes | Product Authority go/no-go when material, then Chat review/merge |
| Component-child drafting under an authorized Model B program | Per child allowlist | Component auto-integration only when the child profile allows it; does not activate `main` policy alone |

Cursor never self-approves platform authority.

## Supporting specification map

| Topic | Supporting owner (non-policy) |
| --- | --- |
| Preview/component isolation inventory | `docs/reference/platform/component-environment-isolation.md` |
| Cloudflare resource inventory | `docs/reference/platform/CLOUDFLARE.md` |
| Backblaze B2 inventory | `docs/reference/platform/Backblaze_B2.md` |
| D1 design and operations guide | `docs/reference/platform/LGFC-D1-DATABASE-DESIGN-and-OPERATIONS-GUIDE.md` |
| D1 data-protection notes | `docs/reference/platform/d1-data-protection_MASTER.md` |
| Machine-readable isolation inventory | `scripts/ci/preview-isolation-manifest.json` (implementation artifact; not domain policy) |

Inventories under `docs/reference/platform/**` may be LOCKED as platform facts. LOCKED means the specification is frozen for implementation claims; it does not make that file a Domain Policy co-owner.

## Drift detection

A change is platform/environment drift when it:

- claims preview or component isolation without updating the isolation inventory and proving the control;
- treats a supporting platform inventory as higher authority than this domain policy or Product Authority;
- mirrors production credentials onto preview/component without recorded authorization;
- changes bindings, migrations, or external-write surfaces without explicit source-issue authorization;
- introduces competing “this file wins” domain-policy language outside this document’s authority stack.

## Canonical references

| Topic | Owner |
| --- | --- |
| Repository precedence | `docs/governance/REPOSITORY-AUTHORITY.md` |
| Agent roles and protected stops | `docs/governance/AGENT-TEAM.md` |
| Delivery approval and rollback profiles | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Operations degradation and emergency recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Isolation inventory | `docs/reference/platform/component-environment-isolation.md` |

## Supersession

Within the Platform and Environment domain, this file supersedes competing domain-policy claims previously implied by:

- `docs/reference/platform/**` headers that claimed ownership of platform operational policy;
- “SOURCE OF TRUTH” / independent policy framing in platform inventories that competed with domain ownership.

Those files remain active as supporting specifications after subordination. Shared constitutional routing updates outside this allowlist are reserved for #2690.
