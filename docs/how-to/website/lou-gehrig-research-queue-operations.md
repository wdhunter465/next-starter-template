---
Doc Type: How-To
Audience: LGFC operators, researchers, and editors
Authority Level: Procedure
Owns: Operator steps for Lou Gehrig research queue triage, assignment, and disposition
Does Not Own: Runtime queue UI, workflow YAML, or autonomous triage decisions
Canonical Reference: /docs/reference/website/lou-gehrig-research-queue-triage-workflow.md
Related issues: #1738, #1740
Last Reviewed: 2026-10-26
---

# Lou Gehrig Research Queue Operations

## Purpose

Use this procedure to triage, assign, defer, reject, or promote Lou Gehrig
content candidates in the manual research queue.

## Preconditions

- Candidate record exists with minimum intake fields populated.
- Source category inventory reviewed for approved/disallowed classification.
- Operator has queue access (spreadsheet, tracker, or future admin surface).

## Steps

### 1. Open the queue

Review all items in `queued` state sorted by priority (P1 first).

### 2. Run triage checks

For each item, verify:

- source title and citation or URL;
- approved source category;
- minimum metadata completeness;
- initial rights and privacy flags;
- duplicate suspicion flags.

Record triage outcome in queue notes. Move state to `triaged` or `rejected`.

### 3. Assign priority

Assign P1–P5 using the priority model in the queue reference. Document rationale
for P1/P2 elevation.

### 4. Assign owner

Assign a primary reviewer based on item needs:

- provenance questions → provenance reviewer;
- rights/privacy questions → rights reviewer;
- ready for editorial shaping → editorial reviewer.

Move state to `assigned`.

### 5. Active review

Reviewer moves item to `in-review` and completes the applicable review how-to:

- provenance: `docs/how-to/website/lou-gehrig-source-provenance-review.md`;
- rights/privacy: same how-to, rights sections;
- editorial: `docs/how-to/website/lou-gehrig-content-intake.md` staging sections.

### 6. Disposition

Choose one:

| Disposition | Queue state | Metadata update |
| --- | --- | --- |
| Promote | `promoted` | Update `review_status` to approved tier |
| Defer | `deferred` | Add defer reason in notes |
| Reject | `rejected` | Set `review_status` rejected; require `rejection_reason` |
| Re-queue | `queued` | Clear blockers documented in notes |

### 7. Handoff

Promoted items proceed to editorial conversion or reference archive per
`review_status`. Do not publish to public routes.

## Queue operations table

| candidate_id | queue_state | priority | owner | last_action | next_action |
| --- | --- | --- | --- | --- | --- |
|  | queued |  |  |  |  |

## Stop conditions

Stop and escalate to Product Authority when:

- rights status is ambiguous after review;
- privacy involves minors or sensitive donor data;
- source institution denies reproduction;
- item may affect launch-critical public content;
- duplicate conflicts with published inventory.

## Related references

- Source inventory: `docs/reference/website/lou-gehrig-source-category-inventory.md`
- Queue model: `docs/reference/website/lou-gehrig-research-queue-triage-workflow.md`
