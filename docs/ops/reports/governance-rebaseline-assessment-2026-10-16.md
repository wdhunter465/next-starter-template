---
Doc Type: Report
Audience: Human + AI
Authority Level: Operational Evidence
Owns: The 2026-10-16 governance rebaseline assessment: findings, gate-coverage answer, decisions needed, and remaining defects
Does Not Own: Any policy. Policy lives in the constitution and domain policies named below.
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Related Issues: #4639, #4643, #4649, #4651, #4653, #4655, #4659, #4662
Last Reviewed: 2026-10-16
---

# Governance Rebaseline Assessment — 2026-10-16

Requested by Product Authority on 2026-10-15. Prepared by Claude Code (PMO).

## Answers in brief

**Are the processes written in a logical manner?** The top of the structure is logical: a constitution with precedence, one owner per domain, a queue model and protected boundaries. Below that it is not consistently top-down. Policies were changed one rule at a time without cascading the change down, so lower documents, contracts and code still say the old thing.

**Is the constitution effective for the LGFC agentic team?** Not yet, for four reasons:

1. **Two role vocabularies.** The constitution and `AGENT-TEAM.md` use 11 roles. `Agent.md` and most contracts use 7 lane-style names ("PMO / Engineering", "Implementation / Operations"). A lane name doubles as a role name, so "who decides" is ambiguous.
2. **Enforcement lags policy.** Many written requirements have no merge-blocking gate (see the gate table).
3. **Documents do not reach the constitution.** 107 documents never reach `REPOSITORY-AUTHORITY.md` through their Canonical Reference chain. 107 distinct "Authority Level" values are in use.
4. **Stale actors and rules.** Retired members, the retired "WORK" actor and superseded files (`CORE-RULES.md`) are still named as live authority.

**Why did the three-failure stop not work overnight?** The rule (#4589) was written as policy and implemented for two workflows only. `OPS — Scheduled Job Health` had no rule applied to it, and it failed on every run for a structural reason (a weekly job had no success inside the monitor's 2-hour window). The exception Issues it opened carried no `ops:priority` label, so Operations did not treat them as interrupts. This is the same top-down break in miniature: policy without the implementation underneath it. Fixed in #4636 (monitor), #4638 (sweeper for every scheduled workflow), both merged. The watcher that opens exception Issues still omits `ops:priority`; follow-up under #4600.

## What changed in this rebaseline

Product Authority directives (2026-10-15): Bill is CMO; Claude Code is PMO; every PR is ready for review before approval; non-production PRs are self-approved (intentional, to speed development); human-only approval is for Production only; fix top-down.

| Level | Change | PR | State |
| --- | --- | --- | --- |
| Operations | Enforce PR Only retries the merged-PR lookup | #4634 | merged |
| Operations | Monitor passes a job awaiting its first run | #4636 | merged |
| Operations | Halt any scheduled Action after 3 consecutive failures; one Issue; `ops:priority` | #4638 | merged |
| 1 Constitution, 2 Agent Team | Hierarchy levels, tiered Merge authority, PR readiness; Bill = CMO, Claude Code = PMO | #4640 | merged |
| 2 Domain | No draft state; lifecycle and handoff point to constitution | #4647 | merged |
| 2 Domain | `PR_PROCESS`, `PR_GOVERNANCE`, `DELIVERY-AND-RELEASE` tiered merge authority | #4650 | merged |
| 2 Domain | CMO-fallback wording removed from PLATFORM, PRODUCT, PMO, CI policies | #4652 | merged |
| 3 Reference | PMO reference contracts point to constitution | #4654 | merged |
| 5 Explanation | AI-workforce explanation points to constitution | #4656 | merged |
| 5 Template, skill | PR template comment and `continuous-workflow` skill | #4661 | merged |

Every PR in this table is merged. The agent merged none of them.

## Gate coverage: which PR requirements have no enforcing gate

Yes: several written requirements have no merge-blocking gate. The PR process has been in a deliberate "safe mode" since the July 2026 rebuild (#2175, #2208). Only three checks are required on `main`: `quality`, `gitleaks` and `reviewer-response-completion`. Advisory-first promotion was planned but not carried out.

| Requirement | Where written | Enforced by | Merge-blocking? |
| --- | --- | --- | --- |
| Delivery metadata valid for the model and profile | PR template, delivery-profile contract | `quality` (delivery profile, Model C path) | Yes (rejected several wrong PR bodies during this work) |
| No secrets | CI policy | `gitleaks` | Yes |
| Review threads resolved; no CHANGES_REQUESTED; protected promotion has an independent approval | PR process | `reviewer-response-completion` | Yes |
| Draft PRs cannot merge | PR lifecycle | GitHub itself | Yes (native) |
| PR opened ready for review, not draft | Constitution (#4640) | No gate; convention plus GitHub's merge block | Partly |
| Governing Issue predates the branch | PR process, AGENT-EXECUTION | None (`gate-ensure-issue` is a deprecated no-op; issue accounting is manual-only) | No |
| One primary source Issue | PR process | None | No |
| Diff inside the allowlist | PR process | `diff-scope` and `pr-hygiene` (advisory) | No |
| Attestation checkboxes ticked | PR template | `pr-hygiene` checks text presence only; advisory | No |
| Exactly one intent label | Intent-label policy | Labeler is manual-only | No |
| Docs headers and canonical hashes | Docs policy | `docs_guardrails` runs on PRs but is not in the ruleset | No |
| DIATAXIS folder placement | Document architecture | Advisory comment | No |
| ZIP / intent-allowlist blocking | `.github/platform-intent-and-zip-governance.md` claims "BLOCKS merge" | `gate-drift` is manual-only | No (document claims a gate that does not run) |
| Implementer is not the approver of protected work | AGENT-TEAM, delivery policy | Reviewer gate for Model B promotion only; approval inventory validator is unwired | Partly |
| CMO / Production human approval | Constitution | Ruleset requires 0 approving reviews; agents share one identity | No |
| Stable-facts-only PR body | PR process | Contradicted by PR-body auto-repair (flagged on #2822) | No |
| No direct push to `main` | Ruleset | `Enforce PR Only Changes` detects after the fact | Detective only |

Four contract validators exist as libraries but are not wired to any workflow: claim-collision, executable-child, deterministic-approval-inventory and engineering-candidate-intake.

Recommendation, for Product Authority to decide (a ruleset change is its decision): promote issue-predates-branch, diff-scope (hard fail) and `docs_guardrails` to required checks; replace the Production approval convention with a dedicated agent identity (#3234) so a human approval can be told apart from an agent's.

## Decisions needed from Product Authority

1. **Model C governance documentation.** #4650 makes constitutional and domain-policy changes self-approved after required checks, removing the independent review they used to need. Confirm, or ask for it to be kept.
2. **Protected stops in non-production.** The delivery-profile code still requires independent review for Model B child changes that touch protected stops (credentials, auth boundary, production bindings, privileged workflows). The constitution keeps these as protected decisions, so the docs and code agree today. Confirm that is intended before the automation is changed.
3. **Self-approval in non-isolated environments.** `PLATFORM-AND-ENVIRONMENT.md` says Preview and Component environments share production bindings. Self-approval must not reach credential, cost, binding or destructive changes there. The constitution says so; confirm.
4. **Sweeper settings.** The alert-only list (backups, snapshot, production audit, uptime probe, D1 sync) and the `actions: write` permission were merged with #4638; confirm both stand.
5. **One role vocabulary.** Retire lane names as roles everywhere, or keep both and define the mapping once.
6. **Archive plan.** Approve archiving the superseded standards set (the Feb-2026 `*_MASTER` files, `AI-GUIDE.md`, cursor-local bridge contract) once their remaining useful rules are folded into the domain policies.

## Remaining defects, top-down

**Level 1–2 (constitution, domain policy)**
- Authority Level vocabulary is defined in #4640 but 107 values remain in use; migrate headers.
- `DELIVERY-AND-RELEASE`: Model A still says "PR Approver approval plus Production authority"; Model B child protected-stop review wording.
- `ADMINISTRATION-AND-COMMUNICATIONS`: retired "WORK" actor still named in two items.
- `AGENT-EXECUTION`: "human/operator only" (two places) not scoped to Production; CAPABILITIES contradiction; ZIP-as-truth rule; Cursor poller path in shared law.
- `PMO-PORTFOLIO` and `CI-AND-VERIFICATION` cite `docs/ops/ai/CORE-RULES.md` (retired pointer) for rules now owned by `AGENT-EXECUTION`.
- Role table with a CMO row is copied into PLATFORM, PRODUCT and CI policies (duplicate ownership; `governance-duplication-check` does not catch it).
- PLATFORM and PRODUCT approval tables say "PMO Admin review/merge"; AGENT-TEAM says PMO Admin does not merge.
- Closeout of an assigned child task: administration policy and implementation-authority contract say the implementer; PR process and lifecycle say PMO Admin. One owner needed.
- `DOCUMENT-ARCHITECTURE` is 86 days stale and lists two PR documents while banning two.

**Level 3 (reference contracts)**
- `delivery-profile-contract` says Model C is not implemented; the script implements it.
- The approval profile token `work-bill-production` embeds a person and a retired product name.
- Evidence schema in `delivery-and-rollback-profiles` names the retired actor "Chat".
- `work-queue-and-collaboration-contract` still defines the 4-stage pipeline that `PMO-PORTFOLIO` supersedes with 10 stages.
- `post-merge-validation-surface` calls post-merge-readiness blocking; the merge-protection surface says it is retired.
- CI classification matrix says `docs-guardrails.yml` is manual-only; it runs on PRs.
- Policies and program designs filed under `reference/` (for example `production-data-read-policy`, the 2027 launch and fundraiser contracts) with no governance parent. `docs/ops/pmo/PMO-JULY-2026-OPERATING-MODEL.md` is declared controlling over a reference document.

**Level 4–5 (procedures, templates, skills)**
- 230 broken references in 77 files (docs/ops 100, docs/reference 67, archive 23).
- `.agents` skill points to `CORE-RULES.md` and a retired ChatGPT handoff document; `.cursor/rules/20-stop-conditions.mdc` points to `CORE-RULES.md`.
- Issue templates are Copilot-era ("Draft until this merges").
- `ai/AI-GUIDE.md` is a one-time site build prompt labelled Canonical governance.
- ChatGPT is referenced in about 190 places across living documents (reference 69, how-to 76, explanation and templates 22, ops/ai 15, entry docs 9).

**Level 6 (automation)**
- `delivery_profile.mjs`, `component_integration_eligibility.mjs` and the approval inventory encode independent review that decision 2 may change.
- `orchestrator-draft-pr` creates no PR now, only moves an Issue to `status:pr-draft`; rename when the labels are next touched.
- The exception-Issue watcher does not add `ops:priority` (#4600).
- Four validators above are unwired.

## Reading coverage

Stated exactly, because the request was to read all documentation.

- **Read in full:** entry documents (`Agent.md`, `AGENTS.md`, `CLAUDE.md`), all of `docs/governance/**`, the governance standards, the reference contracts for operations, delivery, agents, CI and PMO, `.claude/skills`, `.agents/skills`, `.cursor/rules`, and the `.github` documents.
- **Scanned by script across all 919 Markdown files (about 777,000 words):** front matter and Authority Level, Canonical Reference chains, link integrity, retired-actor and pattern search, staleness. These produced the counts above.
- **Not read line by line:** most of `docs/how-to`, `docs/tutorials`, `docs/explanation`, `docs/templates`, `docs/ops` evidence, reports, trackers and tasks, and the architecture, platform, design, website and content references. Findings for those come from the scans only. Defects specific to their content are likely and not yet found.

This report is therefore a complete answer on the constitution, domain policies, contracts and enforcement, and a partial one on the procedures and operational record.
