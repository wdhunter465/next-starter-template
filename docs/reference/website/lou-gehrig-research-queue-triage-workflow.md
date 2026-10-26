---
Doc Type: Reference
Audience: LGFC operators, researchers, editors, and AI implementation agents
Authority Level: Controlled
Owns: Research queue states, triage rules, priority model, and promotion/defer/reject behavior for Lou Gehrig content collection
Does Not Own: Runtime queue implementation, workflow YAML, database migrations, or publication automation
Canonical Reference: /docs/reference/website/lou-gehrig-source-category-inventory.md
Related issues: #1738, #1740, #1739
Last Reviewed: 2026-10-26
---

# Lou Gehrig Research Queue and Triage Workflow

## Purpose

This reference defines how Lou Gehrig content candidates enter a research queue,
are prioritized, assigned, deferred, rejected, or promoted toward provenance
and editorial review.

The queue is human-operated. Automation may assist metadata validation in a
future program (#2040) but may not bypass human triage decisions.

## Scope

This reference covers:

- queue entry conditions;
- queue states and transitions;
- triage rules and priority model;
- assignment and ownership;
- defer, reject, and promote behavior;
- compatibility with human editorial review.

This reference does not authorize runtime code, API routes, or workflow YAML.

## Queue entry conditions

A candidate enters the research queue when:

1. an operator captures a source lead through an approved intake channel;
2. minimum intake evidence fields are present (see source category inventory);
3. `review_status` is `candidate`, `needs-source`, or `needs-rights-review`;
4. the item is not already rejected with a documented reason.

Candidates do not enter the publication queue directly from discovery.

## Queue states

| State | Meaning | Allowed next states |
| --- | --- | --- |
| `queued` | Captured and awaiting triage | `triaged`, `deferred`, `rejected` |
| `triaged` | Objective checks complete; ready for assignment | `assigned`, `deferred`, `rejected` |
| `assigned` | Owned by a reviewer for active work | `in-review`, `deferred`, `rejected` |
| `in-review` | Provenance, rights, or editorial review underway | `promoted`, `deferred`, `rejected` |
| `promoted` | Passed review gate; ready for next pipeline stage | terminal for queue (hands off to provenance/editorial docs) |
| `deferred` | Retained but not current work | `queued` (re-queue) |
| `rejected` | Must not proceed; reason required | terminal |

Queue state is separate from candidate `review_status` in the metadata schema.
Both must remain consistent; see Task 003 (#1741) for metadata field definitions.

## Triage rules

Triage is an objective-first pass. The triage operator records:

| Check | Pass criteria | Fail action |
| --- | --- | --- |
| Source identifiable | Source title and citation or URL present | Set `needs-source`; remain in queue |
| Category approved | Source type in approved inventory table | Reject with reason |
| Disallowed category | Not in high-risk/disallowed list | Reject with reason |
| Minimum metadata | Required intake fields populated | Return to intake; block promotion |
| Duplicate suspicion | Possible overlap with existing candidate or inventory | Flag for reviewer; do not auto-merge |
| Privacy flag present | `privacy_flag` assigned | Route to rights/privacy review path |
| Rights initial assessment | `rights_status` assigned (may be `unknown`) | Route to rights review if high risk |

Automation may **flag** triage checks in a future phase. Automation must not
auto-promote or auto-reject without a human authority rule.

## Priority model

| Priority | Criteria | Examples |
| --- | --- | --- |
| P1 — urgent | Time-sensitive public event, verified rights, website launch dependency | Lou Gehrig Day content, confirmed LGFC-owned media |
| P2 — high | Strong provenance, clear rights path, high editorial value | Hall of Fame catalog citation, corroborated timeline fact |
| P3 — normal | Standard research lead with complete metadata | Newspaper archive citation, book reference |
| P4 — low | Incomplete metadata or uncertain rights | `needs-source`, `needs-rights-review` items |
| P5 — backlog | Deferred items | Revisit in scheduled research sessions |

Priority is assigned at triage and may be revised on reassignment.

## Assignment behavior

| Role | Responsibility |
| --- | --- |
| Queue operator | Triage, priority assignment, initial routing |
| Provenance reviewer | Source, credit, citation verification (Task 003) |
| Rights reviewer | Rights, privacy, publication clearance (Task 004) |
| Editorial reviewer | Conversion to website-ready content (Task 005) |

Assignment rules:

- one primary owner per active queue item;
- reassignment requires a queue note;
- Product Authority may override priority for launch-critical content;
- no item may skip provenance or rights review for public-copy promotion.

## Defer behavior

Defer when:

- source verification requires external response;
- rights clearance is pending institution reply;
- privacy review needs consent or redaction decision;
- research session capacity is exhausted;
- item has value but is not current-priority.

Deferred items retain all metadata and re-enter `queued` when reactivated.

## Reject behavior

Reject when:

- source is untraceable after reasonable effort;
- category is disallowed;
- rights risk is unacceptable;
- privacy risk cannot be mitigated;
- duplicate with no new editorial value;
- factual claims lack reliable support.

Rejection requires `rejection_reason` and `reviewer` in candidate metadata.

## Promote behavior

Promote when:

- triage checks pass;
- provenance review complete for the target use (`approved-for-reference` or `approved-for-public-copy`);
- rights and privacy review complete for the target use (Task 004);
- editorial conversion criteria met when targeting public copy (Task 005).

Promotion hands off to the editorial conversion workflow; it does not publish.

## Operator procedure

Detailed steps: `docs/how-to/website/lou-gehrig-research-queue-operations.md`.

## Deferred automation candidates

- automatic priority scoring;
- duplicate detection across candidates;
- queue SLA reminders;
- auto-assignment by category.

These remain deferred until #1738 manual workflow evidence supports #2040 review.

## Acceptance checklist

- [x] Queue states documented
- [x] Triage rules documented
- [x] Assignment/defer/reject/promote behavior documented
- [x] Priority model compatible with human editorial review
