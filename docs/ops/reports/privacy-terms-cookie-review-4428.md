---
Doc Type: Operations Report
Audience: Human + AI
Authority Level: Supporting (review and draft copy for Product Authority approval; not approved copy)
Owns: The 2026-11-14 review of /privacy and /terms against the fundraiser, registration, analytics and email, plus draft copy
Does Not Own: Approval of legal or privacy copy, the registration decision (P-01), or any change to the live pages
Canonical Reference: /docs/reference/operations/2027-launch-calendar-operating-contract.md
Related Issues: #4428, #4414, #4139, #3633
Last Reviewed: 2026-11-14
---

# Privacy, terms and cookie review (#4428)

Legal and privacy copy is a Product Authority decision. This report reviews the live pages and drafts copy. It changes no page. Nothing here is approved until Bill says so on #4428.

## Findings

| Area | Live `/privacy` and `/terms` | Gap |
| --- | --- | --- |
| Join / Login, Ask, member verification, library submissions | Described (what is collected, why, opt-in email, removal contact). | None found. |
| Analytics consent | Google Analytics 4 runs only after Accept; Decline keeps it off. | None found. |
| Session cookie | Described as short-lived and used only after Login. | None found. |
| Givebutter boundary (#4139 hard constraint) | Not mentioned. | **Gap.** No statement that LGFC keeps no donor information. |
| Participant registration (P-16) | Not mentioned. | **Open.** Depends on the P-01 registration decision. |
| Footer links | Privacy, Terms, Accessibility and Contact are present in `src/components/Footer.tsx`. | None. |

## Draft copy for approval (Givebutter boundary)

Proposed new section on `/privacy`, after the section on what we collect:

> **Donations through Givebutter.** Donations are made on Givebutter, a separate service with its own privacy policy. The Lou Gehrig Fan Club does not receive, store or keep your donor or payment information, and we do not build our own list of donors. Anything you give Givebutter is held by Givebutter under its terms. If you also join the Fan Club, that is a separate sign-up and is covered by the rest of this page.

Proposed line on `/terms`:

> Donations are processed by Givebutter under Givebutter's terms. The Fan Club is not a party to that transaction and does not hold your donor information.

This wording matches the #4139 constraint: LGFC retains zero donor or user information from Givebutter. It is a statement of how the site is built, so it stays true only while that holds. #4139 carries the evidence that it does.

## Not drafted

- Registration copy waits on P-01.
- A legal review is Bill's call. Operations does not give legal advice.

## Next step

Bill approves, edits or rejects the draft on #4428. On approval, a small page change follows in its own pull request.
