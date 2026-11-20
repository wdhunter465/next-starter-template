---
Doc Type: Reference
Audience: Human + AI
Authority Level: Design
Owns: The design of the synthetic sign-in check's test accounts (#4682): which accounts exist, what each is for, where they live, how the check obtains them, and the steps still needing Product Authority's Go
Does Not Own: Member and admin authentication rules (the auth model), the check script and how to run it, Production writes, or the scheduled workflow
Canonical Reference: /docs/reference/design/auth-model.md
Related Issues: #4682, #4657, #4443, #4414
Last Reviewed: 2026-11-20
---

# Synthetic sign-in check: test accounts

## Decisions of record

- **Product Authority, 2026-11-19 (#4682):** the test accounts are email addresses that log in to the website. They are documented in design documentation in the repository (this page) and are added to the Production `members` table in D1 with all other member addresses. They are **not** repository secrets.
- **Product Authority, 2026-10-28 (#4657):** the test member uses `test@lougehrigfanclub.com`. No GitHub Actions secret is created for test credentials.
- **Production write:** adding the rows is a Production write. It waits for a separate explicit Go that names the exact addresses, and is done through the admin member tooling, never by editing rows by hand.

## Why the admin address is not written here

Sign-in is by email alone (`docs/reference/design/auth-model.md`). Admin rights come from one place: `members.role = 'admin'` in D1. So the test admin's address is as sensitive as an admin password, and this repository and its Issues are public.

This page therefore names the **member** address, which Product Authority already stated publicly, and names the **admin** account only by role. The admin address must also be one nobody can guess: a predictable address such as an `admin@` or `synthetic-admin@` name on the club's domain would let anyone who guessed it sign in as an administrator. Product Authority should give the exact admin address in the Go through a channel that is not public (told in session, with the Issue recording only that it was confirmed), and the admin tooling should create it.

If Product Authority prefers the admin address documented here anyway, that is Product Authority's call and should be recorded on #4682 first.

## The accounts

| Account | Address | Role in D1 | Used for | Not used for |
| --- | --- | --- | --- | --- |
| Synthetic member | `test@lougehrigfanclub.com` | `member` | Member sign-in, session, member-only Club Home data, the Fan Club page, and proving a plain member is refused by an admin endpoint | Anything public |
| Synthetic admin | Not recorded in the repository (see above) | `admin` | Admin sign-in, one admin endpoint, one admin page | Real administration |

Both rows need `email_verified_at` set. Login answers `email_not_verified` for an unverified member (auth model, Email verification, 2026-11-06), so a new test row without it would fail every run. Set it through the admin tooling when the row is created, not by sending a verification email.

## Rules the accounts follow

- **Not counted as members.** They must stay out of member counts, leaderboards, fundraiser figures and any report that treats a member as a person. Where a report counts rows in `members`, it must exclude these two addresses, and Product Authority should confirm how (by address, or by a marker column if one is added).
- **No mail.** Neither account opts in to updates or newsletters. Nothing is sent to them except the one-time verification mail if the tooling sends it.
- **Locked out after 3 failed sign-ins an hour.** The check signs in once per account per run and never retries, so a failure is reported, not repeated.
- **Read only.** The check creates nothing and writes nothing except signing the two sessions out.
- **Private visibility.** The rows follow the Production data read policy (`docs/reference/operations/production-data-read-policy.md`): agents read only schema, counts and the Product Authority-approved fields, and never print these addresses.

## How the scheduled check gets the addresses

The script reads both addresses from its environment. A scheduled GitHub Actions run would need them as secrets, which Product Authority has ruled out. The options:

| Option | Admin covered | Secret in GitHub | Notes |
| --- | --- | --- | --- |
| A. Run the check inside Cloudflare on a schedule (a Worker or Pages Function that reads the two addresses from D1) | Yes | None | New Production binding and a cron trigger: a protected change needing review. Free tier covers it. The admin address never leaves D1 |
| B. GitHub Actions with the addresses as secrets | Yes | Two | Contradicts the 2026-10-28 decision |
| C. Scheduled check for the member account only, using the public address, plus the "member is refused by an admin endpoint" check | Partly: the admin gate is proven; admin sign-in is not | None | Smallest change; no new binding. Admin sign-in is then checked by hand before each release |

Recommendation: **C now, A as a follow-up Issue.** C needs no secret, no new binding and no admin address anywhere outside D1, and it still catches a broken sign-in and a broken admin gate. A adds the admin sign-in once Product Authority approves the binding.

## Ownership of the remaining work

| Work | Owner | Depends on |
| --- | --- | --- |
| This design | Claude Code | Done with this page |
| The Go naming the exact addresses (admin address through a non-public channel) | Product Authority | Choice of option below |
| Creating the two rows through the admin member tooling, with `email_verified_at` set and the admin role on the second; evidence recorded on #4682 without the admin address | Operations role (Cursor-primary) | The Go |
| A first manual run against Production with both explicit acknowledgements the script requires | Operations role | The rows existing |
| The scheduled workflow for option C | Pull request under #4682, with protected-change review | The manual run |
| Option A as its own Issue, if wanted | Product Authority decides; Engineering builds | Approval of the new Cloudflare binding |

## Reversal

Delete the two rows through the admin tooling and revert the pull requests. Nothing else depends on them.

## Open decisions for Product Authority

1. Option C now with A later, or A directly, or B.
2. Whether the admin address stays out of the repository (recommended).
3. How the two accounts are excluded from member counts.
