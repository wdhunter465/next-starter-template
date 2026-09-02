---
Doc Type: Operations
Audience: LGFC operators (PMO/ops staff who process physical donations/loans), Human + AI
Authority Level: Operational Authority
Owns: How to record a physical archive donation/loan and move it through custody at `/admin/archive-items`
Does Not Own: The acquisition/custody/donation product decisions themselves (owned by #4059, recorded on that issue); schema/migration detail (owned by `migrations/0065_archive_acquisition_core.sql` and `functions/_lib/archive-items-repository.ts`); emergency rollback (owned by `docs/ops/how-to/archive-item-rollback-recovery.md`)
Canonical Reference: /docs/reference/content/content-rights-runtime-as-built-2073.md
Related Issues: #2073, #4059, #4060, #4061, #4062, #4063
Last Reviewed: 2026-09-02
---

# How to: physical archive item intake and custody tracking

## Purpose

LGFC operators use `/admin/archive-items` to record a physical item (photo,
letter, document, memorabilia, audio, or video) a donor or lender has
offered, and to track it through custody until it's stored, returned, or
deaccessioned. This is the operator-facing procedure for #2073's Work
Package items 3-5 (schema, intake, admin UI), built on the decisions Bill
recorded on #4059 (2026-09-02).

This is **not** the same system as `/admin/rights-review` (web-sourced
content rights triage) or `/admin/media-assets` (B2 object inventory) — see
`content-rights-runtime-as-built-2073.md`'s admin surfaces table if you're
unsure which admin page a given task belongs on.

## Scope

Covers: recording a new physical-item intake (donation or loan) and
advancing it through custody state at `/admin/archive-items`, who is
authorized to do it, and the common mistakes operators hit.

Does not cover: the product/privacy/custody decisions this feature
implements (owned by #4059, recorded on that issue); schema or migration
detail (owned by `migrations/0065_archive_acquisition_core.sql` and
`functions/_lib/archive-items-repository.ts`); what to do if this surface
or its schema needs to be rolled back (owned by
`docs/ops/how-to/archive-item-rollback-recovery.md`).

## Current known truth

`/admin/archive-items`, its two `requireAdmin`-gated API endpoints
(`POST /api/admin/archive-items`, `POST /api/admin/archive-items/custody`),
and migration 0065's `archive_items`/`archive_item_custody_events` tables
are live on `main` and applied to both Development and Production D1 as of
PR #4067 (merged 2026-09-02). The procedure below reflects that shipped
behavior, not a design intent — every field, transition, and API response
it describes is read directly from `archive-items-repository.ts`,
`archive-items-admin.ts`, and `src/app/admin/archive-items/page.tsx` as
they exist on `main` today.

## Who can do this

`/admin/archive-items` and its two API endpoints
(`POST /api/admin/archive-items`, `POST /api/admin/archive-items/custody`)
are gated by `requireAdmin` — you need an authenticated D1 admin member
session. Per #4059 decision 2, custody-state changes are PMO/ops-operated,
not self-service: there is no donor- or member-facing version of this page.

## Recording a new intake (donation or loan)

1. Go to `/admin/archive-items`. The **New intake** form is at the top of
   the page.
2. Fill in:
   - **Title** and **Summary** — plain-language description of the item.
   - **Item type** — photograph, letter, document, memorabilia, audio,
     video, or other.
   - **Custody type** — **Donation** (permanent) or **Loan** (temporary).
     Choosing Loan reveals a required **Expected return date** field; the
     form refuses to submit a loan without one.
   - **Donor name** / **Donor contact** — admin-only fields. Neither is
     ever exposed on any public route (see `archive-items-repository.ts`'s
     `serializeArchiveItemForAdmin`, the only place this row is ever
     projected, and there is no public serializer for this table at all).
   - **Donor consented to a public credit line** checkbox — only check this
     if the donor explicitly agreed their name/credit can appear publicly.
     Checking it reveals a **Public credit line** field (e.g. "Gift of Jane
     Donor"). Per #4059 decision 4: this is the *only* donor-attributable
     field any future public surface may show, and only once this consent
     is recorded — donor name and contact stay admin-only regardless.
   - **Storage location** — free text, D1 metadata only (#4059 decision 5;
     no physical-storage vendor integration this phase).
   - **Your name** — required; recorded on the intake's first custody
     event (`offered`) as the actor.
3. Click **Create intake record**. This does three things atomically at the
   API layer (`createArchiveItem` in `archive-items-repository.ts`):
   - Allocates a `candidate_id` (the same `lgfc-gehrig-<year>-<seq>`
     namespace every other intake stream uses) and creates a
     `content_items` row with `input_stream = 'physical_acquisition'`.
   - Creates the `archive_items` row, starting in custody state `offered`.
   - Records the initial `archive_item_custody_events` row
     (`from_state = NULL → to_state = 'offered'`).
4. The new item appears in the list below the form, identified by its
   `candidate_id`.

## Advancing custody state

Each item card shows its current custody state and, if any transitions are
available, a **Custody Controls** row. The state machine
(`CUSTODY_TRANSITIONS` in `archive-items-repository.ts`, mirrored in the
UI's `NEXT_STATES` map) is:

```
offered → received → cataloged → stored
                  ↘ returned  (from received, cataloged, or stored — loans only)
                  ↘ deaccessioned  (from any non-terminal state)
```

- `received`, `cataloged`, and `stored` are reachable only in that forward
  order.
- `returned` is reachable from `received`, `cataloged`, or `stored` — not
  only from `stored` — use it when a loaned item goes back to its owner.
  Setting `to_state = 'returned'` also stamps `loan_returned_at`
  automatically. The UI only offers `returned` for loans (`custody_type =
  'loan'`); the server-side state machine doesn't distinguish by
  `custody_type`, so a direct API call could still mark a donation
  `returned`, but there's no operator-facing path to do that by accident.
- `deaccessioned` is reachable from any non-terminal state — use it if an
  item is withdrawn from the collection (returned to a donor by mutual
  agreement, lost, damaged beyond use, etc.). Always add a **Note**
  explaining why when deaccessioning.
- `returned` and `deaccessioned` are both terminal — no further transitions
  are offered once an item reaches either.

To advance an item: pick the target state from **Advance to…**, enter your
name, optionally add a note, and click **Update custody state**. The API
(`updateCustodyState`) validates the transition server-side regardless of
what the UI offers — an invalid transition returns `400` with
`InvalidCustodyTransitionError`'s message, and the item's `custody_state`
column is never written unless the transition is valid. Every successful
transition, valid or not attempted otherwise, appends a new
`archive_item_custody_events` row (`from_state`, `to_state`, `actor`,
`note`, `recorded_at`) — this table is append-only, matching this
pipeline's `rights_evidence`/`moderation_events` audit-trail convention. It
has no admin UI of its own yet; query it directly in D1 if you need an
item's full custody history.

## Recording rights consent for a donation/loan

A donor's or lender's consent to LGFC using the item is **not** recorded on
the `archive_items` row itself — it goes through the existing
`rights_evidence` mechanism, using the `donor_agreement` evidence type
added by migration 0065 (#4059 decision 3). There is no dedicated UI for
this yet; record it the same way any other `rights_evidence` row is
recorded today (see
`docs/ops/as-built/gehrig-content-collection-rights-pipeline-as-built-3826.md`),
against the `content_items` row created by the intake above (its
`candidate_id` is shown on the item's card).

## Common mistakes

- **Trying to skip a custody state** (e.g. `offered` straight to `stored`).
  The UI only ever offers valid next states, but if you're calling the API
  directly, expect a `400`.
- **Forgetting the expected return date on a loan.** The intake form
  refuses to submit; fix it client-side rather than expecting the API to
  default one.
- **Checking "consented to public credit" without an actual signed/verbal
  consent on file.** This flag is what a future public surface will use to
  decide whether to show the donor's credit line — only check it once
  consent is genuinely recorded, per #4059 decision 4.
