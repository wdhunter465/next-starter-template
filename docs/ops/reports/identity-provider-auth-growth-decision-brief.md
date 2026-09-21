---
Doc Type: Operations
Audience: Bill, ChatGPT, Cursor, Claude Code, LGFC maintainers, and reviewers
Authority Level: Controlled
Owns: Project #2442 identity-provider/authentication growth decision brief — Day-1 auth inventory, evaluation-claim validation, retain/add-later/migrate comparison, migration and rollback risk assessment, and a Product-discussion recommendation
Does Not Own: Authentication implementation, OAuth application registration, secrets/environment-variable changes, user-account migration, or any Production authentication change
Canonical Reference: /docs/reference/design/auth-model.md
Related Issues: #2442, #4192, #4193, #4194, #4195
Last Reviewed: 2026-09-21
---

# Identity Provider and Authentication Growth Decision Brief (#2442)

## Purpose

Answer, with repository and deployment evidence, whether the absence of OAuth/social identity
providers constrains LGFC growth, and produce a retain / add-later / migrate recommendation for
Bill and Atlas to discuss. This brief implements the ordered work units on the #2442 launch
package (#4192 → #4193 → #4194 → #4195) as a single accumulating document per the
`Model A` delivery model.

This document makes **no runtime, schema, secret, or Production auth change**, registers no
OAuth application, links no accounts, and does not unlock the Day-1 auth lock. It is a docs-only
deliverable on `docs/ops/reports/identity-provider-auth-growth-decision-brief.md`.

## Scope and non-goals

In scope: current-state auth inventory; validation of the OAuth evaluation claim; retain /
add-later / migrate comparison; account-linking, privacy, secret, and rollback risk
documentation; a recommendation ready for Product discussion.

Out of scope (non-goals): OAuth provider implementation; OAuth application registration; any
secret or environment-variable change; user-account migration; an authentication refactor; any
Production authentication change. Any of these remains a **protected stop** and requires a
separately approved issue plus an explicit unlock of `docs/reference/design/auth-model.md`.

---

## Work unit 1 (#4192) — Current-state inventory and claim validation

### Evaluation claim under review

> "Only email/password authentication is prebuilt; Google, GitHub, or other OAuth providers
> would require additional implementation."

### Live repository evidence

| Area | Evidence | Finding |
| --- | --- | --- |
| Canonical auth spec | `docs/reference/design/auth-model.md` (LOCKED, Last Reviewed 2026-07-21) | Day-1 model is a **cookie-backed D1 server session**, not password auth. External auth providers, localStorage-as-source-of-truth, magic links, and `ADMIN_EMAILS`-as-primary-gate are all explicitly **prohibited in active docs**. |
| Login endpoint | `functions/api/login.ts` | Validates the submitted email exists in `join_requests` (case-insensitive), rate-limits to 3 failed attempts/IP/hour via `login_attempts`, then creates a 30-day row in `member_sessions` and sets the `lgfc_session` cookie. **There is no password field, no password hash comparison, and no password verifier anywhere in this function.** |
| Session cookie/store | `functions/_lib/session.ts` | `lgfc_session` cookie is `HttpOnly; Secure; SameSite=Lax`, 30-day `Max-Age`; session store is D1 `member_sessions`; helper functions cover session ID generation, cookie set/clear, session revocation, and soft-delete checks. No token/JWT/OAuth handling present. |
| Member/identity table | `migrations/0019_members.sql`, `migrations/0039_members_profile_fields.sql` | `members` table columns: `id, email (UNIQUE COLLATE NOCASE), role, created_at, updated_at`, later extended with `first_name, last_name, screen_name, email_opt_in`. **No password/credential column exists on `members` at any migration.** Role (`member`/`admin`) is DB-native, not `ADMIN_EMAILS`-gated. |
| Join/intake table | `migrations/0001_join_requests.sql`, `migrations/0020_join_requests_profile_fields.sql` | `join_requests` is the intake gate `/api/login` checks against; it stores name/email/profile fields, not credentials. |
| Rate limiting | `migrations/0012_login_attempts.sql` | `login_attempts(ip, email, ok, created_at)` with indexes on `(ip, created_at)` and `(email, created_at)`; enforced in `functions/api/login.ts`. |
| Dependency manifest | `package.json` (dependencies + devDependencies) | No NextAuth, Auth.js, Clerk, Auth0, Passport, `bcrypt`/`argon2`, or any Google/GitHub/Apple/Microsoft OAuth SDK is present. Runtime deps are limited to Next.js/React/Cloudflare tooling plus a handful of unrelated libraries (`@cf-wasm/photon`, `@pinecone-database/pinecone`, `next-elfsight-widget`, `yet-another-react-lightbox`). |
| Legacy routes | `docs/reference/design/auth-model.md` redirect policy | `/login` and `/auth` are legacy compatibility redirects to `/` and `/join` respectively; the canonical join/login surface is `/join` (`/join?mode=login` for the login tab). |
| `ADMIN_EMAILS` usage | repo-wide search | Only reference is `functions/api/env/check.ts` (an env-presence diagnostic), not an auth gate. Consistent with the lock's prohibition on using it as the primary auth gate. |

### Validation verdict

**The claim is rejected as stated.** The Day-1 model is not "email/password" — it is **passwordless,
email-identified, D1-backed session auth**, gated by prior membership in `join_requests`. There is
no password implementation to compare OAuth against, and OAuth/external-provider auth is not an
omission: it is **explicitly locked out** by `docs/reference/design/auth-model.md`'s "Prohibited in
Active Docs" section. Any accurate framing of "the gap" must describe it as *"no external identity
provider is integrated, by design lock, and the existing model has no password to begin with,"*
not *"password auth exists but OAuth is missing."*

---

## Work unit 2 (#4193) — Retain / add-later / migrate comparison

| Dimension | Option A — Retain Day-1 lock (current) | Option B — Add OAuth later | Option C — Migrate to external IdP |
| --- | --- | --- | --- |
| Description | Keep email + `join_requests` gate + D1 `member_sessions`, unchanged. | Add one or more OAuth providers (Google/GitHub/Apple/etc.) alongside the existing email flow, once Product unlocks the spec. | Replace the D1-native session model with a third-party identity platform (e.g., Auth0, Clerk, Cognito) as primary identity source. |
| Registration friction | Low: single email field, no password to create/remember. Friction source, if any, is the `join_requests` pre-approval gate, not the auth mechanic itself. | Potentially lower for users who prefer "Sign in with Google," but adds a provider-selection decision step and a consent screen. | Similar to Option B for end users; friction moves to migration event for existing members. |
| Accessibility | No third-party JS SDK, no popup/redirect flow to a provider's UI (which LGFC does not control for a11y). | Provider consent/login screens are outside LGFC's accessibility control; must be evaluated per provider. | Same as Option B, plus the IdP's hosted UI (if used) is fully outside LGFC's control. |
| Security posture | Small attack surface: one first-party endpoint, rate-limited, `HttpOnly/Secure/SameSite=Lax` cookie, no password to leak or brute-force. | Adds OAuth callback endpoints, client secrets, and token handling — new classes of misconfiguration risk (open redirect, state/PKCE handling, token storage). | Shifts session/token security to the IdP but adds a new critical external dependency and vendor trust boundary. |
| Cost / vendor dependency | None — fully repo-native, Cloudflare D1 only. | Provider API costs are typically free at LGFC's scale, but requires app registration, secret management, and ongoing provider-policy monitoring. | Recurring vendor cost, contractual dependency, and platform-policy risk (pricing/ToS changes, outages). |
| Support/ops workload | Minimal — no "forgot password" flow exists or is needed. | New support surface: "my Google login isn't linking to my existing membership," provider outages, revoked-app edge cases. | Highest ongoing ops workload: full identity-platform administration, monitoring, and incident response. |
| Existing-account impact | None. | Requires account-linking design (see Work unit 3) between OAuth identity and existing `members.email`. | Requires a full identity migration for every existing member row; highest-risk option. |
| Effort to deliver | None (status quo). | Medium: new callback routes, secret storage, linking logic, updated `auth-model.md`, new tests. | High: net-new architecture, data migration, likely a separate Program (per #2084-style launch package), not a task-level change. |
| Governance | Fully consistent with current lock; zero policy conflict. | Requires a **Product unlock** of `docs/reference/design/auth-model.md`'s "Prohibited" section before any implementation issue can be opened. | Requires a Product unlock plus a dedicated Program-level launch package (comparable in weight to #2084/#2442 themselves). |

### Framing for the growth questions

- **Registration friction/abandonment**: no evidence in this repo indicates the *mechanism*
  (email-only, no password) is a friction source; the `join_requests` pre-approval gate is the
  more plausible friction point, and that is independent of OAuth.
- **Would a provider materially improve the member experience?** Plausible for convenience, but
  unquantified — LGFC has no funnel/analytics evidence cited anywhere in the repo showing
  sign-up abandonment tied to the auth mechanic specifically. This should be a prerequisite data
  point before any Add-Later decision, not an assumption.
- **Provider/audience fit, lock-in, platform-policy risk**: unresolved and provider-specific;
  deferred to a future task if Add-Later is chosen.

---

## Work unit 3 (#4194) — Account-linking, privacy, secret, and rollback risks

| Risk area | Current state (Option A) | Risk if Option B (add OAuth) is later pursued | Risk if Option C (migrate IdP) is later pursued |
| --- | --- | --- | --- |
| Identity keys / account records | `members.email` (UNIQUE, case-insensitive) is the sole identity key. | New provider-issued subject IDs must map to the same `members.email` row without creating duplicate accounts; email-match heuristics can silently merge or fail to merge accounts. | All identity keys move to the IdP's subject model; every `members`/`member_sessions` row needs a migration mapping, with no silent-loss guarantee. |
| Existing email accounts | N/A — only account type. | Must decide: does linking a provider replace or supplement the email flow? Orphaned `join_requests`-only members (no provider link) must remain functional. | Every existing member requires either a forced re-auth/link step or a batch migration with consent implications. |
| Account linking / duplicate reconciliation | N/A. | Highest-risk item: a mismatched or spoofable email claim from a provider could let one person claim another member's account if verification isn't enforced. | Same risk, amplified by full-population migration timing (batch vs. lazy). |
| Session/cookie/authorization/role model | `lgfc_session` cookie + `member_sessions` + `members.role`. Simple, first-party, already `HttpOnly/Secure/SameSite=Lax`. | New token types (OAuth access/ID tokens) must not replace or weaken the existing cookie model without a full redesign and test pass. | Full replacement of the session model; every protected-route check (`/fanclub`, `/fanclub/**`) must be re-verified against the new model. |
| Protected routes / admin access | Role sourced from D1 `members.role`, not `ADMIN_EMAILS`. | Provider claims (e.g., a verified email) must never become an implicit admin/role grant — role must still be D1-sourced. | Same constraint; also must ensure the current explicit prohibition on `ADMIN_EMAILS`-as-gate is preserved in any new design. |
| Consent / privacy / deletion / audit | Covered under existing `/privacy` disclosures for email/session/library fields (see `docs/ops/reports/compliance-candidate-qualification-2921.md` item 7). | New consent disclosures needed for what data a provider shares (email, name, avatar, scopes); privacy copy must be updated before any provider goes live. | Full privacy/consent and deletion-flow redesign required; audit trail must span both the legacy and IdP-era records. |
| Secrets / callback URLs / Cloudflare config | None required today — no client secrets in this flow. | New OAuth client ID/secret per provider, redirect URI allow-listing, and Cloudflare Pages environment-variable management; **explicitly listed as a protected stop for this project**. | Full IdP credential/config lifecycle (API keys, webhook secrets, tenant config) — larger and more sensitive than Option B. |
| Rollback / provider-outage behavior | N/A — no external dependency to fail. | If a provider is down or an app is revoked, email-based login must remain a guaranteed fallback; must not be provider-only. | An IdP outage would be a **single point of failure for all authentication** — requires a documented fallback/rollback plan before any migration begins, and rollback becomes materially harder once member data has moved. |

**Protected-stop reminder:** none of the above analysis authorizes touching `functions/api/login.ts`,
`functions/_lib/session.ts`, any `migrations/**` file, or any secret/environment variable. That
remains true even if Option B or C is eventually approved — those would require their own
separately approved implementation issues under an explicit Product unlock.

---

## Work unit 4 (#4195) — Recommendation

### Recommendation: **Retain** the Day-1 lock now; revisit only on a defined trigger

1. **Retain** (Option A) is the recommended near-term direction. The evaluation claim that
   motivated this review is rejected: there is no password auth to "catch up" to OAuth parity
   with, the current model already has low registration friction (single email field, no
   password to manage), and the Day-1 lock in `auth-model.md` already forbids external providers
   by explicit governance decision, not by gap or oversight.
2. **Add OAuth later** (Option B) should only be considered if Product supplies concrete evidence
   of registration friction or abandonment tied specifically to the auth mechanism, and is willing
   to open a **new** Product-approved unlock of `auth-model.md` naming: the specific provider(s),
   cost/credential owner, and account-linking design (per Work unit 3). This project does not
   authorize that unlock.
3. **Migrate IdP** (Option C) is out of scope for a task-level decision. If ever pursued, it should
   be scoped as its own Program-level launch package (comparable to #2084/#2442), not a follow-on
   task of this review.

### Trigger conditions for revisiting this recommendation

- Documented member-journey data showing sign-up abandonment attributable to the auth mechanism.
- A specific partner/sponsor/audience requirement that mandates a named OAuth provider.
- A security or compliance finding that the current D1 session model is deficient (none is
  identified in this review).

### Acceptance criteria trace (back to #2442)

| #2442 acceptance criterion | Satisfied by |
| --- | --- |
| Current authentication capabilities are inventoried from repository and deployment evidence. | Work unit 1 table. |
| The evaluation claim is validated or rejected. | Work unit 1 verdict — **rejected as stated**. |
| Growth impact is tied to measurable LGFC member journeys. | Work unit 2, "Framing for the growth questions" — flagged as currently unquantified; treated as a precondition for Option B, not assumed. |
| Candidate OAuth providers are evaluated against audience, privacy, security, support, and platform constraints. | Work unit 2 comparison table (provider-specific evaluation explicitly deferred to a future task if Option B is chosen, per Non-goals). |
| Existing-account migration and account-linking risks are documented. | Work unit 3 table. |
| A recommended identity roadmap is ready for Bill/Atlas discussion. | This section. |

### Stop conditions confirmed not triggered by this brief

No OAuth application was registered, no secret or environment variable was added or changed, no
account was linked or migrated, no file under `functions/**`, `src/**`, or `migrations/**` was
modified, and no Production authentication behavior was changed. This document is the sole
deliverable of #2442's implementation phase.
