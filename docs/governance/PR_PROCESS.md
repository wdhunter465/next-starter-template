---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Pull request process policy, PR-body authority, profile-specific PR boundaries, reviewer lifecycle, Issue-to-PR collaboration boundary, and closeout ownership
Does Not Own: Product requirements, priority decisions, queue ownership, design specifications, Administration mutation taxonomy, delivery-model selection, or workflow implementation
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Supporting References:
  - /docs/reference/ci/pr-process-current-state.md
  - /docs/reference/ci/merge-protection-surface.md
  - /docs/reference/ci/pr-workflow-ci-inventory.md
  - /docs/reference/operations/administrative-control-lane-contract.md
  - /docs/reference/operations/operating-lanes-and-promotion-profiles.md
  - /docs/reference/operations/work-queue-and-collaboration-contract.md
Related Issues: #2175, #2208, #2640, #2641, #2699, #2709, #3117
Last Reviewed: 2026-08-07
---

# Pull Request Process

## Purpose

This document defines the canonical LGFC pull request process.

GitHub Issues are executable task authority. Pull requests document and validate Issue-scoped changes. The PR process preserves the mandatory profile progression:

Sandbox → Development → Promotion Candidate → Production

Queue ownership, universal collaboration, and Project Graduation are defined in `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.

## Core rules

1. **Issue-first hard gate:** A live, open same-repository governing source Issue must exist and **predate** the branch, first commit, and Pull Request. No PR-first, operations, incident, CI, workflow, documentation-only, or emergency exception exists. The only allowed action without a governing Issue is creating that Issue. Motivating incident: PR #3115 / Issue #3116 (see #3117).
2. One primary source Issue per normal PR; the Issue reference in the PR body must identify that pre-existing governing Issue.
3. The source Issue owns assignment, queue, execution owner, authority, collaboration state, and next action.
4. The PR owns the diff, checks, review threads, and technical evidence.
5. The PR body stores stable facts only.
6. Dynamic lifecycle, checks, reviews, routing, collaboration, holds, and closeout remain on GitHub-native surfaces.
7. Required gates are deterministic, necessary, and profile-appropriate.
8. Implementation / Operations does not self-approve protected work or Production promotion.
9. Deterministic CI may record automated eligibility for non-main integration; it does not impersonate PR Approver / Engineering.
10. Promotion Candidate is mandatory before Production.
11. Sandbox cannot move directly to Promotion Candidate or Production.
12. Development cannot move directly to Production.
13. Post-merge closeout is single-owner and idempotent.
14. Administration & Communications may reconcile state but does not create technical, queue, priority, or approval authority.

## Stable PR-body facts

Every PR should include:

- primary source Issue (must predate branch/commits/PR; issue-first hard gate);
- intent label and PR class;
- delivery model and promotion profile;
- target branch or environment;
- component or release identity when applicable;
- allowed paths;
- out-of-scope declaration;
- change summary;
- verification already run;
- acceptance criteria;
- rollback summary;
- follow-up Issue declaration;
- reviewer and bot attestation.

The PR body must not become a live ledger for:

- draft, review, merge, or closeout state;
- current CI results;
- review thread IDs or status;
- approval state;
- queue, priority, collaboration, or successor state;
- operational hold state;
- administrative exceptions.

## Source-Issue collaboration involving a PR

Normal agent-to-agent collaboration remains on the source Issue even when the collaborator must inspect a PR.

The collaboration sequence is:

1. The Issue owner posts `COLLABORATION REQUEST` on the source Issue.
2. The request identifies the PR and relevant head SHA as evidence.
3. The collaborator posts `COLLABORATION ACKNOWLEDGED` on the Issue.
4. The collaborator reads the PR, diff, checks, or threads as needed.
5. The collaborator posts `COLLABORATION RESPONSE` on the Issue.
6. The Issue owner applies the response and resumes branch and PR work.
7. The collaboration cycle closes with `COLLABORATION COMPLETE` without closing the work Issue merely because assistance is complete.

Normal advisory collaboration does not require the collaborator to:

- modify the branch;
- push commits;
- reply to PR threads;
- submit a PR review;
- take over implementation ownership.

A separate explicit contribution handoff is required before the collaborator changes the implementation. Collaboration does not change the source Issue's team or priority namespace.

## Formal PR review boundary

Formal PR review is distinct from advisory collaboration.

When policy requires independent review:

- the request must be explicit or arise from the governing review rule;
- the reviewer must hold the required independent-review authority;
- findings and approval use GitHub-native reviews and review threads;
- the review is anchored to the current head SHA or exact candidate identity;
- the controlling disposition is routed back to the source Issue;
- the formal reviewer does not become the Issue owner;
- a builder cannot approve its own protected work.

Advisory guidance, a PR comment, or a collaboration response is not approval.

A PR-dependent collaboration or review response is valid only for the evidence identity it names. A material head change may require another collaboration request or formal re-review.

## Profile-specific PR rules

### Sandbox PR

A Sandbox PR or branch transaction:

- targets an isolated Sandbox branch;
- uses scaled-down safety checks;
- may auto-integrate within the Sandbox when authorized;
- states that it is not Production-ready;
- does not target Promotion Candidate or `main`;
- exits only through discard, evidence-only disposition, or deliberate Development adoption.

### Development PR

A Development PR:

- targets `component/**` or another approved non-production Development branch;
- uses automated build, test, security, scope, and metadata gates;
- may use automated non-main eligibility and integration when non-protected;
- routes protected or material findings to PR Approver / Engineering;
- does not require whole-feature Production approval;
- does not claim public release readiness.

### Promotion Candidate PR or qualification record

A Promotion Candidate:

- identifies an exact integrated Development SHA or equivalent immutable identity;
- introduces no unqualified feature work after candidate selection;
- carries integrated, regression, performance, security, rollback, readiness, gap, and standards evidence as applicable;
- records Go, No-Go, or return-to-Development disposition;
- blocks Production until approved.

### Production PR

A Production PR:

- targets `main` or the canonical Production branch;
- promotes the exact approved candidate;
- contains no unreviewed post-candidate drift;
- applies the full repository standards;
- requires recorded Production authority and required Engineering approval;
- includes rollback and live-verification expectations.

## GitHub-native state

| State | Authoritative surface |
| --- | --- |
| PR draft, open, merged, closed | GitHub PR state |
| Validation and eligibility | Checks and workflow runs |
| Independent review | GitHub reviews and review threads |
| Task routing, team, priority, collaboration, and profile | Source Issue, labels, assignments, and structured comments |
| Candidate identity and qualification | Release Issue or PR, checks, artifacts, and reports |
| Production decision | Review and merge record plus recorded role authority |
| Deployment and live verification | Deployment status, checks, and incident or verification evidence |
| Closeout and exceptions | Source Issue, closeout record, and bounded exception Issue |

## PR classes

Current classes include:

- `code`;
- `docs-governance`;
- `docs-content`;
- `ci`;
- `config`;
- `ops`;
- `mixed-approved`.

PR class controls verification depth but does not replace promotion profile.

## Gate policy

Required pre-merge gates protect material invariants that are:

- machine-provable;
- attributable to the PR or candidate;
- appropriate to the current profile;
- necessary for the next transition.

Reporting lag, dashboard freshness, optional comments, cosmetic labels, session presence, duplicated PR-body state, and advisory collaboration state are not independent gates.

### Development automation

Development should heavily leverage automated PR gates for quality and eligible non-main integration.

### Promotion Candidate validation

Promotion Candidate applies broader solution-level validation that may span multiple PRs and the integrated release unit.

### Production controls

Production verifies the exact candidate, full standards, approvals, environment readiness, rollback, deployment, and live health.

## Reviewer lifecycle

Reviewer state comes from GitHub-native reviews and threads.

- PR Approver / Engineering owns subjective design and repository alignment.
- Deterministic CI owns explicit machine checks and eligibility only.
- Product Authority participates when product, priority, cost, business, or protected decisions require it.
- Administration & Communications may route and report reviewer state but cannot supply independent review.
- Collaboration may help a reviewer understand evidence but cannot manufacture reviewer authority.

## Standing authority and successor transition

For a graduated project with a complete ordered child graph, PR completion does not consume the project's implementation authority. After integration, deterministic closeout may reconcile mechanically provable child state. WORK evaluates the task against its executable package and records `ACCEPT`, `HOLD`, `REMEDIATE`, or `VERIFY MORE` when substantive assurance or discrepancy handling is required.

Eligible agents self-claim the next package-complete serial successor under standing parent authority without a new Administration or PMO dispatch (#3145). A label, wake event, or routing comment may notify the implementation runtime, but it is transport rather than new authority. Routine WORK “release” is not a mandatory execution prerequisite when deterministic predecessor completion already satisfies the prepared graph.

A green, approved, mergeable, integrated, or merged PR alone is never task acceptance. Acceptance also requires the source package, implementation evidence, required tests including applicable failure paths, review disposition, integration identity, post-integration verification, documentation, rollback disposition, and absence of unresolved protected stops — with WORK judgment applied when the project defines a substantive acceptance gate.

## Closeout

Closeout rules are profile-aware:

- Development child integration may close the task without claiming project or Production completion.
- Promotion Candidate closeout records approved, returned, superseded, or stopped disposition.
- Production closeout requires deployment and live verification.
- Incident closeout requires recovery and hold-release evidence.
- Collaboration completion returns execution to the Issue owner and does not by itself close the source Issue.

A successful closeout transaction must not be duplicated. Routine closeout does not block an independent Development successor.

## Minimal-gate rule

Do not add a gate to duplicate information already available from GitHub-native state.

Correct deterministic clerical defects at the earliest safe surface. Route material ambiguity, plan change, queue conflict, or authority conflict to the owning role.

## External tools

External reviewers or notifications are advisory unless canonical policy explicitly promotes them. Decisions made outside GitHub must be written back before repository work depends on them.

## DIATAXIS placement

- Governance policy: this document.
- Queue and collaboration policy: `docs/governance/WORK-QUEUES-AND-COLLABORATION.md`.
- Stable collaboration contract: `docs/reference/operations/work-queue-and-collaboration-contract.md`.
- Collaboration procedure: `docs/how-to/operations/request-agent-collaboration.md`.
- Promotion-profile procedure: `docs/how-to/operations/run-work-through-promotion-profiles.md`.

## Supersession

Older PR guidance is superseded where it requires dynamic PR-body lifecycle ledgers, treats Development integration as Production approval, permits direct Sandbox or Development movement to Production, serializes independent work through administrative closeout, treats PR comments as the primary collaboration record, or interprets advisory collaboration as formal approval.
