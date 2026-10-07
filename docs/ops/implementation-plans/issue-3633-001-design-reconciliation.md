---
Doc Type: Implementation Plan
Audience: Human + AI
Authority Level: Operational Plan
Owns: Task #3633-001 reconciliation of Project #3633 design, current state, dependencies, and acceptance
Does Not Own: New workflows, gap dispositions, CI consolidation, Production admission, or Product date changes
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #3633, #3981, #3982, #3983, #2450, #2453, #2815, #2817, #4089, #4139
Last Reviewed: 2026-10-07
---

# Issue #3633-001 design reconciliation

## Status

`_DRAFT` — first executable task of Active project #3633. This file does not add or change CI.

## Purpose

Record the authoritative design, the repository state on 2026-10-07, the dependencies that must stay intact, and which acceptance criteria are still open. Phase 1 of #3633 is a test-requirements catalog. This reconciliation extracts that catalog from the parent Issue so later tasks inventory and build against one list.

## Scope

- Parent #3633 and its open preparation tasks #3981, #3982, and #3983.
- The Phase 1 catalog below, classified only by how the parent says each requirement must be proved.
- Gap status stays unset. Phase 4 assigns `EXISTING_SUFFICIENT`, `EXISTING_NEEDS_HARDENING`, `DUPLICATED_CONSOLIDATE`, `MISSING_BUILD`, `MANUAL_EXPLORATORY`, `CONTROLLED_RECOVERY_EXERCISE`, or `DEFER_PRODUCT_DECISION`.

### Out of scope

- Adding, editing, or deleting `.github/workflows/**`.
- Treating this catalog as proof that a check exists.
- Merging #3633 with #2815 (pilot and admission control; parent closeout already recorded) or with closed #4089 (CI design improvement).
- Fundraiser E2E implementation. #4139 remains a separate Engineering follow-up.
- Production, credential, or merge authority.

## Current state — 2026-10-07

- #3633 is Active, `pmo:priority:1`, `team:pmo`, implementation owner `agent:cursor` (Product Authority assignment 2026-10-07). Dashboard tasks are 0/3.
- The Issue body still says Pipeline / Design Needed, owner cloudflareAI, and preferred owner Grok. Those lines are stale. The label and this reconciliation are the current owner record. The phase order in the body remains the design.
- Preparation tasks are open and generic: #3981 (this reconciliation), #3982 (ordered plan, validation, rollback, handoff), #3983 (launch package). The parent's ten execution children (catalog, inventory, dedup, gaps, PR CI, scheduled/E2E, Production health, recovery, fundraiser qualification, final handoff) are not opened yet.
- `main` at `3d8f7287` contains 107 workflow files under `.github/workflows/`. That count is a size signal for Phase 2. It is not the inventory.
- Required pre-merge checks named by sibling #2815 remain `quality`, `gitleaks`, and `reviewer-response-completion`. Advisory checks named there include `pr-hygiene` and `diff-scope`. This task does not change that set.
- Target dates on the parent are unchanged: CI / Day-2 implementation complete 2026-10-31; aggressive-testing support through 2026-11-30; confidence checkpoint 2026-12-01.

## Dependencies

Preserve these boundaries. Do not invent a second launch-readiness contract or a second governance-control set.

| Issue | Relationship |
| --- | --- |
| #2450 | Parallel Cursor project for delivery automation, repository health, and throughput. Map to it. Do not replace it. |
| #2453 | Launch-readiness contract and evidence matrix. #3633 consumes it. |
| #2815 | Closed admission-control parent. Live catalog and Day-2 work stays on #3633. |
| #2817 | Governance remediation. On hold. Consume #2821, #2827, #2828, #2829, and #2831 where they already define a control. |
| #4089 | Closed CI design-improvement project. Historical input only. |
| #4139 | Fundraiser/Givebutter E2E follow-up, owned by Claude under `team:engineering`. Block only the fundraiser qualification child. |
| #3631 | Parallel-lane governance. Unrelated auth, content, recovery, and repository qualification may proceed while fundraiser UI is unstable. |

Protected stops from the parent still apply: no silent expansion of Product, Production, credential, destructive-data, paid-service, or merge authority. No new workflow until Phases 1–4 are accepted.

## Phase 1 catalog

Primary class is the parent's required distinction. One row may later gain a second class in Phase 4. Disposition is intentionally blank.

### Repository / PR qualification

| Requirement | Primary class |
| --- | --- |
| Build, typecheck, and lint where applicable | Deterministic CI |
| Unit tests | Deterministic CI |
| Integration tests | Deterministic CI |
| Schema and migration validation | Deterministic CI |
| Documentation and DIATAXIS validation | Deterministic CI |
| Secrets and credential leakage | Deterministic CI |
| Dependency and supply-chain checks | Deterministic CI |
| Authorization and protected-route checks | Deterministic CI |
| Required reviewer and separation of duties | Deterministic CI |
| Candidate and commit identity | Deterministic CI |
| Post-merge closeout | Deterministic CI |

### Public website

| Requirement | Primary class |
| --- | --- |
| Homepage and public routes | Scheduled qualification |
| Navigation and links | Scheduled qualification |
| Responsive layout at mobile, tablet, and desktop widths | Scheduled qualification |
| Browser compatibility where practical | Manual / exploratory |
| Metadata, sitemap, and robots | Deterministic CI |
| Error and degraded states | Scheduled qualification |
| Caching and stale-content behavior | Production health |

### Membership / authentication

| Requirement | Primary class |
| --- | --- |
| Join | Scheduled qualification |
| Login and logout | Scheduled qualification |
| Session expiration | Scheduled qualification |
| Stale, invalid, or tampered session | Deterministic CI |
| Soft-deleted, disabled, and restored account | Deterministic CI |
| Protected routes | Deterministic CI |
| Duplicate or malformed requests | Deterministic CI |
| Concurrent or interrupted sessions | Scheduled qualification |

### Administration

| Requirement | Primary class |
| --- | --- |
| Anonymous, member, and admin matrix for every admin route and API | Deterministic CI |
| Direct admin route access | Deterministic CI |
| Privilege enforcement | Deterministic CI |
| Mutation audit evidence | Deterministic CI |
| Rollback and failure handling | Controlled recovery exercise |
| Session expiration during mutation | Scheduled qualification |
| Concurrent administrative actions | Scheduled qualification |

### Content / media / Club Newspaper

| Requirement | Primary class |
| --- | --- |
| D1/B2 consistency | Scheduled qualification |
| Missing or slow asset | Scheduled qualification |
| Rights and publication gate | Deterministic CI |
| Article and media pairing eligibility | Deterministic CI |
| Insufficient eligible-image pool | Deterministic CI |
| Random selection only inside the eligible pool | Deterministic CI |
| Pairing, placement, and edition history | Deterministic CI |
| Rotation fairness, cooldown, and duplicate prevention | Scheduled qualification |
| Persistent editions | Scheduled qualification |
| Regenerate and rollback | Controlled recovery exercise |
| Takedown and suppression | Product / operator acceptance |
| Rights revoked after staging | Scheduled qualification |
| Malformed metadata and duplicate candidates | Deterministic CI |

### Fundraiser / Givebutter

| Requirement | Primary class |
| --- | --- |
| Fundraiser hidden when inactive | Scheduled qualification |
| Admin staging and preview | Product / operator acceptance |
| Publication to the homepage | Product / operator acceptance |
| Embedded Givebutter widget | Scheduled qualification |
| Donation button, inline form, goal bar, and signup widget as adopted | Scheduled qualification |
| Mobile fundraiser experience | Scheduled qualification |
| Givebutter unavailable or degraded | Scheduled qualification |
| Network interruption, refresh, and back navigation | Manual / exploratory |
| Campaign state, ended campaign, and stale cache | Scheduled qualification |
| Webhook duplicate, delay, malformation, replay, or unavailability, if webhooks are adopted | Deterministic CI |
| No payment credentials, secrets, or private donor data | Deterministic CI |

### Accessibility / UX

| Requirement | Primary class |
| --- | --- |
| Keyboard-only use | Manual / exploratory |
| Focus order | Scheduled qualification |
| Headings and landmarks | Deterministic CI |
| Contrast | Scheduled qualification |
| Alt text and media alternatives | Deterministic CI |
| Reduced motion where applicable | Scheduled qualification |
| Automated accessibility baseline plus named manual checks | Deterministic CI |

### Performance / reliability

| Requirement | Primary class |
| --- | --- |
| Representative route performance baselines | Scheduled qualification |
| Production health and Playwright invariants | Production health |
| Scheduled-job health | Production health |
| External-service timeout and unavailability | Scheduled qualification |
| Repeated-run stability | Scheduled qualification |
| Alert delivery and escalation | Production health |

### Recovery / Day-2

| Requirement | Primary class |
| --- | --- |
| Deployment rollback | Controlled recovery exercise |
| D1 backup creation and restore verification | Controlled recovery exercise |
| B2/D1 recovery relationships | Controlled recovery exercise |
| RTO, RPO, and SLO evidence per #2829 | Product / operator acceptance |
| Failed or partial deployment | Controlled recovery exercise |
| Production post-deploy smoke | Production health |
| Scheduled recovery exercises | Controlled recovery exercise |
| Monitor and alert failure handling | Production health |
| Incident evidence and operator runbook paths | Product / operator acceptance |

### Security / adversarial

| Requirement | Primary class |
| --- | --- |
| Auth bypass attempts inside safe test boundaries | Deterministic CI |
| Malformed or hostile input inside safe test boundaries | Deterministic CI |
| Stale privilege and session behavior | Deterministic CI |
| Secret exposure | Deterministic CI |
| Dependency and provenance findings | Deterministic CI |
| Direct API access without the UI | Deterministic CI |
| Privilege escalation paths | Manual / exploratory |
| Webhook signature and authentication, if implemented | Deterministic CI |

## Acceptance

Parent #3633 acceptance is not met. In particular, the catalog is extracted here but not yet accepted as the build gate, existing workflows are not mapped, and no missing check is implemented.

#3981 is complete when this reconciliation is on `main` and the parent records the next action. That next action is #3982: the ordered plan, validation, rollback, and handoff. #3982 must not open new workflows. It sequences Phase 2 (inventory of the 107 workflows and tests), Phase 3 (deduplication proposal), and Phase 4 (one disposition per catalog row) before any build child.

## Rollback

This change is one documentation file. Rollback is reverting the merge commit. No workflow, secret, or Production behavior changes.
