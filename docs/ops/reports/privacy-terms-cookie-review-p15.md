---
Doc Type: Operations
Audience: Product Authority, Engineering, PMO, and implementation agents
Authority Level: Supporting (review and proposed copy for Product Authority decision; not legal advice and not a copy change)
Owns: The go-live P-15 review of the live `/privacy` and `/terms` pages against the 2027 fundraiser, participant registration, email and consent changes, with proposed copy for Product Authority to approve
Does Not Own: Any change to the live pages (public copy is Product Authority's), legal conclusions, the registration design (#4429), or the fundraiser model (#4415)
Canonical Reference: /docs/ops/reports/compliance-product-decision-register-2919.md
Related Issues: #4428, #4414, #4429, #4415, #4139, #4573, #4526, #4368, #2074
Last Reviewed: 2026-10-22
---

# Privacy, terms and cookie review for the fundraiser and registration (go-live P-15)

## Purpose

The 2027 fundraiser, participant registration and the new email setup change what the site collects, shows and links to. This review compares the live `/privacy` and `/terms` pages with those changes and proposes copy for Product Authority to approve. It changes no page. It is an engineering review, not legal advice; section 4 lists what I recommend a lawyer look at.

## What was checked, and its limits

- The public pages `https://www.lougehrigfanclub.com/privacy/` and `/terms/` were fetched on 2026-10-22, and their text was compared with `src/app/privacy/page.tsx` and `src/app/terms/page.tsx`. The live text equals the code's built-in default text, so no stored override in the database is replacing it today.
- Data flows come from the repository, the fundraiser design (`docs/reference/operations/2027-fundraiser-dashboard-and-checkpoint-prizes-design.md`), the email work of 2026-10-21 and the permission archive design (#4526).
- Not checked: Cloudflare, Google Analytics or Givebutter account settings, and anything not yet built (registration, leaderboard).
- Footer links to Privacy, Terms, Accessibility and Contact are present on the live pages.

## 1. What the live pages say

`/privacy` covers: Join and Login data (name, optional screen name, email, optional email opt-in), Ask a Question data, member records and welcome or transactional email, the session cookie, Library and photo submissions, basic technical logs, how the data is used, "we do not sell personal information", a removal-request address (`admin@lougehrigfanclub.com`) and a cookie section that says Google Analytics 4 runs only after Accept.

`/terms` covers respectful use, user submissions and the license to display them, copyright and attribution, "as is" warranty, and a contact address.

Neither page shows an effective or last-updated date.

## 2. Data flows against the live pages

| Flow | Data | Covered today? | Gap |
| --- | --- | --- | --- |
| Join and Login, Ask, member record | Name, email, optional screen name, opt-in | Yes | None |
| Welcome email and the admin notice of a new join | Email sent from the admin or support address; the club receives a "new join request" notice | Welcome email: yes. The notice to the club: not stated | Minor: say the club is notified of new join requests |
| Email delivery and receipt | Website email is sent by MailChannels; club mail is received through Cloudflare Email Routing | No provider is named | Add a service-provider section (F2) |
| Session cookie and consent choice | A session cookie after Login; the Accept or Decline choice kept in browser storage | Yes | List the items by name (F10) |
| Analytics | Google Analytics 4 only after Accept; `/admin` pages are excluded (#4746) | Yes | None for the public text |
| Link to Givebutter to donate | The visitor leaves LGFC; LGFC stores no Givebutter donor or user data (hard boundary from #4139) | No | The boundary statement is missing (F1) |
| Participant registration (planned, 2027-02-01) | Not designed yet (#4429 depends on #4415) | No | Needs copy before it opens (F3) |
| Public leaderboard and prize winners | Participant public display name, amount raised, supporter count, shown on the site and in social posts | No | Needs consent and a removal path (F3) |
| Rights-holder correspondence archive (#4526) | Names, emails and messages of copyright owners who reply to permission requests, kept in the database | No | People outside the club; needs a line (F6) |
| Archive content showing living people | Photographs and stories | Partly (submissions) | Add how a depicted person asks for removal (F6) |
| Retention and deletion | Soft-delete exists in Member Operations; no stated period | No | F4 |
| Children | No age statement | No | F5 |

## 3. Findings and proposed copy

Wording below is proposed. Product Authority approves, edits or rejects each one.

**F1. Givebutter boundary (required by #4428's second criterion).** Add to `/privacy`:
> "Donations are made on Givebutter, a separate service with its own privacy policy and terms. When you donate, Givebutter collects your payment and contact details. This site does not receive, store or log donor names, email addresses, per-donor amounts or messages. We show only campaign totals and the public names of registered fundraisers."

**F2. Service providers.** Add a short list in plain words: Cloudflare (hosting and the database), Backblaze (photo and media storage), MailChannels (sending site email), Google Analytics (only if you accept analytics), and Givebutter (only if you choose to donate). Say none of them is given your data to sell.

**F3. Participant registration and the leaderboard.** Before registration opens, the registration form and `/privacy` should say what is collected, that the display name, amount raised and supporter count are public on the leaderboard and may appear in social posts, how a participant picks the display name (a first name, a nickname or "Anonymous fundraiser"), and how to withdraw. Proposed text for the form:
> "Your display name, the amount you raise and your number of supporters are shown publicly on the fundraiser page and may appear in our social posts. Choose the name you want shown. You can ask us to change or remove it at any time at admin@lougehrigfanclub.com."
The registration data itself waits on #4415 and #4429.

**F4. Retention and deletion.** State the rule after Product Authority decides it. Suggested: keep member records while the membership is active; delete or anonymize on request within 30 days; keep aggregate fundraiser records (totals and winners' display names) as the campaign record. Soft-delete exists in the admin; whether a hard delete is needed is a decision.

**F5. Children.** Decide whether the club is for people 13 and over and say so ("This site is not directed to children under 13, and we do not knowingly collect their information"). If younger fans are meant to take part, parental consent rules apply and need a lawyer.

**F6. Rights holders and people in archive items.** Add: "If you are a copyright owner who replied to a permission request, we keep your reply so we can honor your terms. If you appear in an archive item or own it and want it changed or removed, contact admin@lougehrigfanclub.com." This matches the removal path the terms already promise for rights requests.

**F7. Fundraiser and prize terms (recommend legal review).** The calendar plans daily prize and giveaway posts and two checkpoint prizes (2027-04-30 and 05-31). Prizes, contests and giveaways can carry legal requirements (official rules, eligibility, how winners are chosen, tax and state rules, and whether any entry needs a donation). Draft a short "Fundraiser rules" page covering who may take part, how winners are chosen (the checkpoint rule from #4573), that prizes are supplied by the club, and that donations are processed by Givebutter. Say clearly where the money goes; that statement is a Product Authority commitment.

**F8. Affiliation and marks (recommend legal review).** I found no statement anywhere on the site that the club is not affiliated with Major League Baseball, the New York Yankees or the rights holder for Lou Gehrig's name and likeness, and the content rules already treat those as separate permission layers. Suggested line for `/terms` and the footer: "The Lou Gehrig Fan Club is an independent fan-run community. It is not affiliated with or endorsed by Major League Baseball, the New York Yankees or the Gehrig estate or its licensing agents. Team names, logos and likenesses belong to their owners."

**F9. Other terms items.** Add an effective date to both pages; a line that links to other sites (Givebutter, the store) are governed by those sites' terms; and how terms changes are announced. Governing law and any limit of liability are for the lawyer.

**F10. Cookie and storage list.** The cookie text is accurate. Make it concrete by naming what is used: the session cookie after Login; the saved Accept or Decline choice in browser storage; Google Analytics cookies only after Accept. State that the donation link opens Givebutter and sets nothing here. If a later design embeds a Givebutter widget on a page, that would load Givebutter scripts and cookies, so it must be behind the same consent choice (record this as a rule for #4431).

**F11. Email.** The removal address works with the live mail path. When a newsletter or any promotional email is introduced (#2074), commercial email needs a working unsubscribe link and the club's postal address; the welcome and join-confirmation emails are transactional and do not.

**F12. Footer.** Privacy, Terms, Accessibility and Contact are present. Keep them in any footer change.

## 4. Decisions for Product Authority

| # | Decision | Recommended |
| --- | --- | --- |
| 1 | Approve F1, F2, F6, F8 and F9 copy as the next `/privacy` and `/terms` update | Yes; engineering drafts the page change after approval |
| 2 | Participant registration copy (F3) waits on #4415 | Hold until P-01 is decided |
| 3 | Retention rule (F4) | 30-day deletion on request; aggregate campaign record kept |
| 4 | Age rule (F5) | 13 and over |
| 5 | Have a lawyer review F7 (prize terms), F8 (affiliation and marks) and the whole of F9 before 2026-12-31 | Yes; a short review of the three items |
| 6 | Who owns the fundraiser-rules page and the statement of where donations go | Product Authority |

## 5. Mapping to #4428

| Criterion | State |
| --- | --- |
| Updated copy approved by Bill | Proposed above; waits on decisions 1 to 4 |
| Boundary statement matches the #4139 hard constraint | F1 is written to it |
| Footer links still present | Verified on the live pages 2026-10-22 |

Changing the live pages is a separate pull request after approval; the pages read from the database if an override is stored, so that change must say whether it edits code, the stored content or both. This review authorizes none of it.

## Validation

Valid when Product Authority records decisions on #4428 and a follow-up Issue carries the page change.

## Rollback

Revert this documentation commit. No page or setting is changed.
