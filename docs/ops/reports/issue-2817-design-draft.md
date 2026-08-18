---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Evidence / Design Record
Owns: Design draft for Project #2817 governance implementation, safety, and effectiveness remediation
Does Not Own: Product priority, implementation Go, Production promotion, or child-issue file-touch allowlists
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2817, #2818, #2819, #2820, #2821, #2822, #2823, #2824, #2825, #2826, #2827, #2828, #2829, #2830, #2831, #2832
Last Reviewed: 2026-08-18
---

# Issue #2817 design draft

## Status

`_DRAFT` — PMO Pipeline Engineering Preparation. This draft does not authorize child implementation.

## Purpose

Record the technical design needed for PMO Graduation Review of Project #2817: prove, enforce, measure, and simplify the existing governance model rather than expand policy for its own sake.

## Scope

- Parent project #2817 and its authoritative 15-child graph from the source Issue.
- Architectural boundaries: Preview/Component isolation, Model A profile traversal, authority-chain reconciliation, protected-change independence, candidate identity, operations interruption, PMO progress measurement, pipeline aging, threat modeling, supply-chain assurance, SLOs, live GitHub enforcement, and control-effectiveness metrics.
- Risks, non-goals, and protected stops that remain Product Authority decisions.

### Out of scope

- Child implementation Pull Requests before Project Graduation `GO` plus explicit child launch.
- Invented sibling graphs that omit #2818 or renumber GitHub issues as Tasks 001–014 starting at #2819.
- Production promotion of this preparation packet.

## Current known truth

- #2817 is an open Pipeline project. Assessment baseline commit is `29a13728b9f94d9f58174e3d098349ee656442c5`.
- The authoritative child graph lives on #2817. GitHub issue numbers are concurrent-creation IDs; **Order** is the execution sequence.
- Highest-risk finding: Preview and Component environments may share Production bindings and data, so Model B component work is not a safe non-Production environment until isolation is proven (#2818).
- Repository branch naming is `main`. Merges to `main` are Production-path evidence, not merges to `master`.
- This preparation PR targets `main` as documentation only. Child execution after graduation remains Model B on `component/**` unless a later PMO decision changes the delivery model.

## Intended final state

- Design draft and launch packet cite the same 15-order graph as #2817, including Order 001 = #2818.
- PMO can review graduation with a complete-enough package: purpose, scope, current truth, intended state, ordered graph, validation, and rollback.
- After Graduation `GO`, children launch serially under standing parent authority without substituting a different graph.

## Authoritative child task graph

Copied from #2817. Do not reorder by GitHub number.

| Order | Issue | Workstream |
| ---: | ---: | --- |
| 001 | #2818 | Isolate Preview and Component resources from Production |
| 002 | #2822 | Define the Model A Development-to-Candidate transition |
| 003 | #2823 | Reconcile the repository entry-point authority chain |
| 004 | #2820 | Reduce duplicated normative governance rules |
| 005 | #2821 | Implement a policy-control capability matrix |
| 006 | #2825 | Require actor-independent approval for protected changes |
| 007 | #2819 | Trace exact candidate identity through Production |
| 008 | #2824 | Make Operations interruption impact-aware |
| 009 | #2826 | Replace equal-weight PMO completion with milestone progress |
| 010 | #2830 | Add Engineering Pipeline aging and reaffirmation controls |
| 011 | #2831 | Establish threat modeling and security requirements |
| 012 | #2827 | Add supply-chain provenance, SBOM, and attestation |
| 013 | #2829 | Define SLOs, recovery objectives, and exercises |
| 014 | #2828 | Verify and document live GitHub enforcement |
| 015 | #2832 | Measure governance control effectiveness |

## Architecture

### Immediate safety

1. **Environment isolation (#2818).** Preview and Component must not share Production D1, rate-limiter namespaces, admin/media mutation paths, or Production administrative credentials. Runtime write guards fail closed.
2. **Model A path (#2822).** Model A must traverse Development → Promotion Candidate → Production without a hidden Development skip.
3. **Entry-point chain (#2823).** `Agent.md` → repository authority → agent-team → shared/core rules must be one chain.
4. **Policy control (#2820, #2821).** Deduplicate normative rules and publish a capability matrix of documented vs enforced vs measured controls.
5. **Protected-change independence (#2825).** Actor-independent approval for protected paths.
6. **Candidate identity (#2819).** Exact candidate SHA/identity from Promotion Candidate through Production.

### Security and Production readiness

7. **Operations interruption (#2824).** Impact-aware interrupt handling, not equal-weight halt of every lane.
8. **PMO progress (#2826, #2830).** Milestone progress instead of equal-weight child completion; Pipeline aging and reaffirmation.
9. **Threat model and security requirements (#2831).**
10. **Supply chain (#2827).** Provenance, SBOM, attestation.
11. **Reliability (#2829).** SLOs, RTO/RPO, restoration exercises.
12. **Live enforcement (#2828).** Documented GitHub protection vs live settings.
13. **Effectiveness metrics (#2832).** Measure control effectiveness, not only operational metadata volume.

### Delivery model after graduation

Project #2817 is sized Medium and selected as **Model B** on #2817 because isolation, protected-path, and environment work cannot be treated as one-shot Model A docs. That selection does not change this preparation PR: the packet itself is Model A documentation targeting `main`.

Promotion profile path (canonical PMO planning path):

```text
optional Sandbox -> Development -> Promotion Candidate -> Production
```

Day-2 Operations is post-promotion ownership, not a fifth promotion-profile step.

## Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| Isolation incomplete while Model B proceeds | Critical | #2818 is Order 001; do not treat component work as non-Production until isolation is proven |
| Child graph drift (omitting #2818 or starting at #2819) | High | Packet and draft must match the #2817 table |
| Incomplete documentation merged to `main` | High | Pre-merge CI (`diataxis-folder-audit`, PR hygiene, delivery profile) |
| Scope creep | Medium | Each child owns its Issue allowlist; this draft does not invent paths |

## Non-goals

- Replacing the #2817 graph with a parser/schema/dashboard workstream.
- Authorizing Cursor to implement #2818 from this packet alone without Graduation `GO` and the child Issue envelope.
- Changing live branch protection in this preparation PR.

## Acceptance

- [x] Authoritative 15-child graph including #2818 as Order 001
- [x] `main` used as the repository default branch name
- [x] Promotion path matches `docs/governance/PMO-PORTFOLIO.md`
- [ ] PMO Graduation Review decision recorded on #2817 (not claimed by this draft)
