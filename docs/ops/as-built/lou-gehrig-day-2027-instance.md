---
Doc Type: Operations
Audience: Product Authority, Operations, editors, and PMO
Authority Level: Operational Evidence
Owns: First 2027 Lou Gehrig Day annual instance using only Product-approved dates
Does Not Own: Additional 2027 public dates; public copy; publication Go; automatic posting; Production mutation
Canonical Reference: /docs/reference/operations/annual-lou-gehrig-day-operating-contract.md
Related Issues: #2084, #3858, #2093, #1700
Last Reviewed: 2026-09-21
---

# Lou Gehrig Day 2027 annual instance

## Purpose

Instantiate the durable #2084 contract for calendar year 2027. Only the June 2 Lou Gehrig Day anchor is treated as an approved public date. Every other public window stays Product-gated via #2093 / Product Authority.

## Scope

In scope: the first 2027 annual instance using only Product-approved dates (`2027-06-02`).

Out of scope: additional 2027 public dates; public copy; publication Go; automatic posting; Production mutation. Unapproved fields stay Product-gated.

## Current known truth

- `lou_gehrig_day_date`: 2027-06-02
- #2093 (2027 Launch Calendar) is still Pipeline. This instance does not copy unapproved calendar rows from that parent.
- Scheduled-content docs mention a 2027-06-02 Lou Gehrig Day closeout post as a #2093 example. That is not publication Go for this package.
- No 2027 public copy, spotlight payload, social deck, newsletter, fundraiser mention, or partner list is Product-approved in this record.

## Intended final state

Operators can fill remaining fields as Product approvals arrive, without rewriting the durable contract. Unapproved fields stay `not-authorized`.

## Instance record

```text
year: 2027
lou_gehrig_day_date: 2027-06-02
additional_public_windows: not-authorized
product_owner: Bill
operations_owner: not-authorized
editor_owner: not-authorized
public_copy_status: not-authorized
rights_status_summary: no public items authorized
website_spotlight: not-authorized
social_export: not-authorized
newsletter_export: not-authorized
fundraiser_mentions: not-authorized
partner_recognition: not-authorized
freeze_starts_at: 2027-05-19T00:00:00-04:00
publication_go: not-authorized
rollback_owner: Operations
evidence_report_path: not-started
```

`freeze_starts_at` is the internal T-14 mark from the how-to (14 days before 2027-06-02). It is not a public event.

## Public-item register (2027)

No public items are authorized yet. When Product approves an item, add a row using the content-package fields. Until then the register is empty on purpose.

| item_id | channel | window | status |
| --- | --- | --- | --- |
| — | — | 2027-06-02 | not-authorized |

## Protected gates still open

- Additional 2027 campaign dates (owned by #2093 / Product)
- Public copy and credits
- Homepage/Club Home spotlight payload
- Social and newsletter exports
- Fundraiser mentions
- Partner, donor, and recognition names
- Publication Go

## How to extend this instance

1. Product records an approval on #2084 or #2093 naming the exact field.
2. Replace only that field's `not-authorized` value.
3. Do not backfill other fields as a side effect.
