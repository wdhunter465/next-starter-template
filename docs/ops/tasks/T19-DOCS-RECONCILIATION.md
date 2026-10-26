---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Task brief for T19 footer documentation reconciliation
Does Not Own: Final design authority (see canonical reference)
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-03-24
---

# T19 — Footer docs reconciliation

## Objective

Reconcile documentation to the production public footer now implemented on the Cloudflare site.

## Canonical footer model

- Right side is a two-row layout
- Row 1: Privacy → `/privacy`, Terms → `/terms`
- Row 2: Contact → `/contact` only
- No `mailto:` footer link
- No public-footer Admin link
- Contact/support email belongs on `/contact`, not in footer navigation

## Required updates

1. `docs/reference/design/LGFC-Production-Design-and-Standards.md`
   - Replace footer section so it matches the canonical footer model above.

2. `docs/governance/PR_GOVERNANCE.md`
   - Update footer enforcement language and rejection conditions to match the canonical footer model.

3. `docs/reference/cloudflare-frontend.md`
   - Reconcile footer/as-built wording to production.

4. `docs/reference/design/dashboard.md`
   - Remove any claim that the public footer exposes Admin.

5. `docs/reference/RECONCILIATION-NOTES_2026-02.md`
   - Add a supersession note that the older five-link footer model is no longer current.

6. `docs/ops/trackers/IMPLEMENTATION-WORKLIST_Master.md`
   - Append clarification that older mailto/Admin footer wording is superseded.

7. `docs/ops/trackers/THREAD-LOG_Master.md`
   - Append clarification that docs were later reconciled to production and that the public footer does not include mailto/Admin.

## Conditional checks

Review these only if they still assert the older footer model:
- `docs/explanation/ARCHITECTURE_OVERVIEW.md`
- `docs/reference/design/text-pages.md`
- `docs/governance/PR_PROCESS.md`

## Hash requirement

If canonical design docs change, regenerate/update:
- `docs/reference/design/.canonical-hashes.sha256`

## Constraints

- Docs-only PR
- No `src/**` changes
- No route or styling changes
- Tracker updates must be append-only

## Exit criteria

- No active doc claims the public Cloudflare footer contains `mailto:` Contact or Admin.
- `LGFC-Production-Design-and-Standards.md` matches the production footer.
- Canonical hashes are updated for any changed canonical design docs.
