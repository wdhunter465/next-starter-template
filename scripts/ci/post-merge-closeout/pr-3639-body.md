# PR Summary

- **Issue:** #3547
- Intent label: intent:fix
- PR class: code
- Size: large
- Delivery model: A
- Change mode: project
- Target environment: production
- Approval profile: work-bill-production
- Gate profile: production-candidate
- Rollback profile: one-step
- Implementation agent: not-applicable
- Component branch: not-applicable
- Component master: not-applicable
- Promotion PR: not-applicable

## Scope

Allowed paths:
- `functions/_lib/auth.ts`
- `functions/api/admin/**`
- `src/app/admin/**`
- `src/components/admin/**`
- `src/lib/adminClient.ts`
- `tests/**`
- `docs/reference/architecture/access-model.md`
- `docs/how-to/website/admin-audit-and-reporting.md`
- `docs/how-to/website/admin-cms-and-page-content.md`
- `docs/how-to/website/admin-d1-inspect.md`
- `docs/how-to/website/admin-dashboard-and-member-operations.md`
- `docs/how-to/website/admin-editorial-archive-operations.md`
- `docs/how-to/website/admin-events-calendar.md`
- `docs/how-to/website/admin-fundraiser-preview.md`
- `docs/how-to/website/admin-matchup.md`
- `docs/how-to/website/admin-media-assets.md`
- `docs/how-to/website/admin-moderation-and-faq.md`
- `docs/how-to/website/admin-operations-overview.md`
- `docs/ops/implementation-plans/website-operations-admin.md`
- `.env.example`

Out-of-scope changes present: NO
Exception issue/approval if YES: not-applicable

Note: `functions/_lib/session.ts` was in the allowlist but did not need to change —
it already contained `requireAdminMember()` matching the required pattern exactly.
`docs/ops/reports/website-operations-admin-as-built-gap-analysis.md` was left
untouched (dated point-in-time snapshot, not a live claim, no active conflict to
remove).

## Change Summary

Replaces the browser-entered shared `ADMIN_TOKEN` model with authenticated
member-session authorization backed by D1 `members.role = 'admin'`, per Product
Authority decision in #3547. `functions/_lib/auth.ts`'s `requireAdmin()` — the
single choke point every `/api/admin/**` handler already funneled through — now
delegates entirely to the existing `requireAdminMember()` session/role helper, so
every admin endpoint independently fails closed (401 unauthenticated, 403
authenticated non-admin, 503 missing D1 binding) with no shared-secret fallback.
Removed the operator-facing `AdminTokenPanel`, `localStorage` token handling, and
`x-admin-token` usage from the client (`src/lib/adminClient.ts` and all 16 admin
pages), removed `ADMIN_TOKEN` from `.env.example`, and updated canonical
admin-access/operator documentation and tests to describe the session-only model.

## Element-by-element Execution Contract verification (#3547)

1. Admin signs in through normal member login flow — unchanged; no auth-flow code touched. ✅
2. D1 `members.role = 'admin'` determines admin status — unchanged, already how `requireAdminMember()` in `functions/_lib/session.ts` works; now the sole authorization path (server) with no token fallback. ✅
3. Only an authenticated admin sees the Admin entry link — unchanged; pre-existing gating in the Fan Club entry component was not touched (not required by this change) and was not weakened. ✅
4. Every `/admin/**` page verifies the active member session and D1 admin role — unchanged; `src/app/admin/layout.tsx` (`useMemberSession({ requireAdmin: true })`) already gates the full `/admin/**` route tree and redirects unauthenticated/non-admin visits to `/`; not modified because it was already correct and outside what needed to change. ✅
5. Every `/api/admin/**` endpoint independently verifies session + D1 admin role — `requireAdmin()` in `functions/_lib/auth.ts` now calls `requireAdminMember()` directly; all ~54 admin route handlers already called `requireAdmin()` as their first step, so this is enforced endpoint-by-endpoint, not just via the UI gate. ✅
6. Unauthenticated/non-admin direct `/admin/**` visits redirect to `/` — unchanged, pre-existing `useMemberSession` redirect behavior; verified still in place. ✅
7. Unauthenticated admin API calls → 401; authenticated non-admin → 403 — implemented via `requireAdminMember()`'s `{ok:false, status, body}` result, surfaced as-is by `requireAdmin()`. Covered by tests in `tests/faq-moderation.test.ts` and the per-endpoint auth tests listed below. ✅
8. Removed operator-facing admin-token field, `localStorage` token handling, `x-admin-token` requirement — `AdminTokenPanel.tsx` deleted; `getStoredAdminToken`/`setStoredAdminToken`/`ADMIN_TOKEN_STORAGE_KEY` removed from `src/lib/adminClient.ts`; `adminJson`/`adminDownload` now send `credentials: 'include'` instead of the `x-admin-token` header. ✅
9. `ADMIN_TOKEN` removed as the website-admin authorization mechanism, no mixed token/session auth remains — `functions/_lib/auth.ts` has zero references to `env.ADMIN_TOKEN`; grepped all of `functions/api/admin/**` to confirm no route reads it directly. (The unrelated `CHATTERBOX_PREVIEW_ADMIN_TOKEN` used by `scripts/ci/chatterbox_bridge_command.mjs` for the separate Chatterbox preview API is untouched and out of scope.) ✅
10. Tests and canonical admin-access/operator docs updated — 20 test files converted from `x-admin-token`/`ADMIN_TOKEN` env fixtures to session-cookie fixtures (2 new helpers: `tests/helpers/adminSession.ts`, `tests/helpers/adminSqliteSession.ts`); `docs/reference/architecture/access-model.md` rewritten, all 11 `docs/how-to/website/admin-*.md` files and the as-built section of `docs/ops/implementation-plans/website-operations-admin.md` updated to remove every "save the admin API token" step and token-gating reference. ✅
11. Existing admin functions and fail-closed behavior preserved — no admin endpoint's business logic changed, only the authorization check at entry; fail-closed on missing session, wrong role, and missing D1 binding all preserved/verified by tests. ✅
12. No weakening of member auth, no public exposure of admin functions, no auth based solely on a UI button — server-side `requireAdminMember()` is authoritative and independent of any client UI state; verified by endpoint-level tests (401/403 cases) rather than relying on hidden buttons. ✅

## Verification

Local verification:
- Command: `npm run typecheck`
  Result: PASS
- Command: `npm run lint`
  Result: PASS (only pre-existing, unrelated `<img>`-element warnings)
- Command: `npm test` (full suite)
  Result: PASS — 1516 tests passed across 140 files
- Command: `npm run build`
  Result: PASS — compiled, typechecked, linted; all 48 static routes generated including every `/admin/**` route; postbuild script completed

CI verification:
- Required checks expected to pass: YES
- Known failing/advisory checks: none

## Acceptance Criteria

- [x] Source issue acceptance criteria reviewed
- [x] Criteria complete, or a follow-up issue is linked below

Follow-up issue required: NO
Follow-up issue if required: not-applicable

## Reviewer / Bot Review Attestation

- [x] I have read all human review threads on this PR (none yet)
- [x] I have read all bot/advisory findings on this PR

## REVIEWER RESPONSE ACCOUNTING

- review-comment:3835860294 — accepted — FAQ queue step list skipped 2 → 4 in `docs/how-to/website/admin-moderation-and-faq.md`; renumbered the steps sequentially in the merged head — thread state: resolved
- review-comment:3835860298 — accepted — `seedAdminSession()` in `tests/helpers/adminSqliteSession.ts` built SQL via string interpolation; switched to parameterized `sqlite.prepare().run()` statements in the merged head — thread state: resolved

## Governance notes

- Self-approval/self-merge: not performed — this PR requires independent review and Product Authority approval before production merge, per #3547.
- Rollback: revert this PR if session-backed admin authorization blocks a legitimate admin or permits non-admin access. Do not restore a browser-distributed shared secret as a workaround; any alternate design requires a new Product Authority decision.

## Post-merge remediation record

This body corrects the merged PR #3639 record for post-merge closeout exception
#3641 (source issue #3547): the merged head resolved both Copilot review threads
in substance and natively on GitHub, but the PR body did not carry the explicit
`review-comment:<id> — <verb> — ... — thread state: <state>` disposition lines
the post-merge auditor requires. Added under "REVIEWER RESPONSE ACCOUNTING"
above. No repository code, test, or documentation content changes were needed —
this is a PR-body evidence correction only, applied via the
`post-merge-pr-body-closeout.yml` `workflow_dispatch` remediation path per
`docs/ops/as-built/post-merge-originating-agent-remediation-3069.md`.
