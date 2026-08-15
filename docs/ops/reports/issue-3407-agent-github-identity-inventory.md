---
Doc Type: Operational Report
Audience: Human + AI
Authority Level: Operational Authority
Owns: #3407 migration steps 1–2 identity attribution inventory and Bill account-creation checklist
Does Not Own: Account creation, credential custody, permission grants, branch-protection changes, or as-built identity wiring
Canonical Reference: /docs/governance/AGENT-TEAM.md
Related Issues: #3407
Last Reviewed: 2026-08-15
---

# Issue #3407 — Agent GitHub identity inventory and Bill onboarding checklist

## Purpose

Record migration steps 1–2 for [issue #3407](https://github.com/wdhunter465/next-starter-template/issues/3407): inventory every mechanism that attributes agent repository activity to Bill, and provide Bill’s human-only account-creation and access checklist.

This report does **not** create accounts, store secrets, grant repository access, or change runtime identity wiring.

## Non-goals

- No passwords, MFA secrets, recovery codes, PATs, or private keys in this file or any Issue/PR/comment.
- No paid GitHub plan purchase, ownership transfer, branch-protection weakening, or agent admin grants.
- No removal of Bill’s emergency access.

## Current attribution reality

Observed on `wdhunter465/next-starter-template` as of 2026-08-15:

| Surface | What happens today | Attribution |
| --- | --- | --- |
| Issues / comments / labels | Agents act via Bill’s connected GitHub auth (`wdhunter465`) | Bill |
| PRs opened by Cursor / Grok / other agents | PR `user` is typically `wdhunter465` | Bill |
| Commits | Local/runner git often uses Bill’s name/email or GitHub noreply tied to Bill | Bill (or mixed) |
| PR merges by Product Authority | Bill merges when acting as Product Authority | Bill (correct when Bill merges) |
| GitHub Actions | `github-actions[bot]` or workflow `GITHUB_TOKEN` | Bot / Deterministic CI |
| Copilot review comments | GitHub Copilot app | App/bot |
| `CODEOWNERS` | `/docs/` paths → `@wdhunter645` | Related human identity, not per-agent |
| Logical agent identity | `agent:*` labels + governance docs only | Label / docs, not GitHub user |

**Core defect:** Logical LGFC agents (Grok, Claude, Cursor, Chat, WORK, Codex) do not map to distinct GitHub users. Almost all agent-performed API and git activity is attributable to Bill.

## Logical agent inventory versus GitHub identity

| Logical agent (#3407) | Docs / mapping today | Orchestrator label | Distinct GitHub user? |
| --- | --- | --- | --- |
| Grok | Not a durable row in `docs/governance/AGENT-TEAM.md`; active via tools | *(none in registry)* | No |
| Claude | Claude Code active; conversational Claude supporting only | *(none; Claude Code via workflows)* | No |
| Cursor | Implementation / Operations | `agent:cursor` | No |
| Chat | Ordinary Chat holds no durable role; “Chat” in #3407 may mean the Chat product surface | `agent:ChatGPT` (legacy name) | No |
| WORK | PMO / Admin / PR Approver per `AGENT-TEAM.md` | *(not in orchestrator labels)* | No |
| Codex | Selective use; quarantined in routing | `agent:codex` (quarantined) | No |
| Copilot *(out of #3407 agent list)* | Advisory review | `agent:copilot` (quarantined) | App identity only |

**Label registry gap:** `.github/orchestrator-labels.json` lists `agent:codex`, `agent:cursor`, `agent:copilot`, `agent:ChatGPT` only — no `agent:grok`, `agent:work`, or `agent:claude`.

## Mechanisms that force Bill attribution

### Human / tool auth paths

- Connected GitHub MCP / OAuth sessions authenticated as `wdhunter465`.
- Cursor Cloud / Local git push credentials (PAT or credential helper as Bill).
- Grok / Work / Chat product connectors using Bill’s GitHub connection.
- Claude Code GitHub integration logged in as Bill (when used).
- Codex GitHub integration (when used) under Bill.

### Git author / committer

- Local `user.name` / `user.email` on agent machines and runners.
- CI jobs that create commits with default token identity.
- Agent-assisted PRs still authored as the repository owner account.
- Merge commits by GitHub `web-flow` versus agent identity.

### Apps / bots (already distinct, not logical-agent mapped)

- `github-actions[bot]` — Deterministic CI.
- Copilot and other review apps.
- Any Cursor / Claude / OpenAI GitHub Apps installed on the repository.
- Self-hosted runners (`lgfc-cursor-*`, repository runner health) — host identity versus git identity.

### Workflow clusters to re-check after identity change

| Workflow cluster | Example workflows | Identity note |
| --- | --- | --- |
| Cursor bridge / wake / dispatch | `cursor-local-wake.yml`, `cursor-bridge-*.yml`, `lgfc-cursor-dispatch.yml` | Often `GITHUB_TOKEN` or Bill-owned secrets |
| Claude wake | `claude-code-wake.yml` | Same class of token ownership |
| Orchestrator | `orchestrator-*.yml`, `project-implementation-orchestrator.yml` | CI bot versus dispatching agent |
| Post-merge closeout | `post-merge-*.yml`, `ops-post-merge-self-healing.yml` | Usually Actions bot |
| AI execution bridge | `ai-execution-bridge.yml` | Bridge identity to document at wiring time |

## Assignment and labeling model (current)

| Mechanism | Role | Keep after migration? |
| --- | --- | --- |
| `team:*` | Queue ownership | Yes — not identity |
| `agent:*` | Execution claim / reservation | Yes if GitHub assignee alone is insufficient; align names with new users |
| GitHub Assignee | Optional human/agent account | Target: assign the agent’s GitHub user when work is claimed |
| PR author | Who opened the PR | Target: agent GitHub user |
| PR reviewer | Independent review | Target: different agent/user than implementer |

**Draft recommendation:** Prefer GitHub user (assignee + PR author) as primary attribution; keep `agent:*` for claim lifecycle and routing where assignee is missing or multi-role.

## Minimum permission model (draft)

Do **not** grant repository admin by default. Confirm per agent after pilot.

| Capability | Grok | Claude Code | Cursor | Chat | WORK | Codex |
| --- | --- | --- | --- | --- | --- | --- |
| Issues: comment / label | Yes | Yes | Yes | Yes* | Yes | Yes* |
| Issues: assign / close (bounded) | Policy-bound | Policy-bound | Policy-bound | Limited | Yes (Admin role) | Limited |
| Branches: create / push | If implementing | Yes | Yes | Rare | Rare | If implementing |
| PRs: open / update | If implementing | Yes | Yes | Rare | Rare | If implementing |
| PRs: review (not own work) | If PR Approver | Yes (not own) | No self-approve | — | Yes (not own) | — |
| PRs: merge | No default | No default | No default | No | No default | No |
| Actions: write / dispatch | Minimal | Minimal | As needed for runner | No | No | No |
| Admin / settings | No | No | No | No | No | No |

\*Chat / Codex only under explicit source-Issue authority per `docs/governance/AGENT-TEAM.md`.

**Starting access level:** Collaborator **Write** for implementers (Cursor, Claude Code); refine via rulesets and branch protection so required reviews cannot be satisfied by the implementer alone. Bill retains owner/admin emergency access.

## Integration matrix (complete during wiring)

For each integration at implementation time, record: current auth → target identity → credential type → permission → user versus App possible → migration step → rollback.

| Integration | Current (observed) | Target | User attribution possible? |
| --- | --- | --- | --- |
| Cursor Local git + PR | Bill / owner | Cursor GitHub user | Yes |
| Cursor Cloud | TBD | Cursor user or documented App | Partial |
| Claude Code | TBD / Bill | Claude GitHub user | Yes if CLI uses that account |
| Grok tooling | Bill connection | Grok GitHub user | Yes if OAuth/PAT is Grok’s |
| WORK / Chat connectors | Bill connection | WORK or Chat user | Yes if connectors support non-Bill OAuth |
| Codex | Quarantined | Codex user when authorized | Yes when used |
| GitHub Actions closeout/gates | `github-actions[bot]` | Keep bot; logical owner = Deterministic CI | No (bot by design) |
| Copilot review | Copilot app | Keep app; not a durable implementer | No |
| Self-hosted runner | Host + token | Token scoped to Cursor (or CI) user/App | Partial |

## Bill — manual account and access checklist

Complete offline. Return **usernames only** on the source Issue or secure channel — never credentials.

### Account creation (six accounts)

- [ ] Create GitHub user for **Grok**
- [ ] Create GitHub user for **Claude** (Claude Code operator identity)
- [ ] Create GitHub user for **Cursor**
- [ ] Create GitHub user for **Chat**
- [ ] Create GitHub user for **WORK**
- [ ] Create GitHub user for **Codex**
- [ ] Complete email verification, CAPTCHA, Terms of Service, and MFA for each
- [ ] Record recovery/custody model offline (Bill-only vault) — not in the repository

### Naming (return to implementer)

- [ ] Final username: Grok = `________________`
- [ ] Final username: Claude = `________________`
- [ ] Final username: Cursor = `________________`
- [ ] Final username: Chat = `________________`
- [ ] Final username: WORK = `________________`
- [ ] Final username: Codex = `________________`

### Repository access (after permission model sign-off)

- [ ] Invite each user to `wdhunter465/next-starter-template` at the agreed role (start **Write**, no admin)
- [ ] Confirm branch protection still requires non-author review
- [ ] Confirm Bill retains owner/admin emergency access
- [ ] Do **not** remove Bill’s access as part of #3407

### Explicit non-actions until Product decision

- [ ] No paid organization/plan purchase without stop-and-ask
- [ ] No transfer of repository or organization ownership
- [ ] No weakening of required reviews
- [ ] No agent repository administration privileges

## Pilot and rollout order

1. [x] Identity inventory (this report)
2. [ ] Bill checklist accepted and six usernames returned
3. [ ] Permission model finalized in repository documentation
4. [ ] Pilot one agent (recommended: **Cursor** — highest commit/PR volume)
5. [ ] Verify Issues, commits, PRs, and reviews under the pilot identity
6. [ ] Roll out remaining agents one at a time
7. [ ] Remove remaining agent-use of Bill’s identity where technically controllable
8. [ ] Document rollback and emergency-access procedure
9. [ ] Update as-built documentation (`AGENT-TEAM.md`, agent rules, orchestrator labels)

## Acceptance criteria tracking (#3407)

| Criterion | Status |
| --- | --- |
| Distinct GitHub accounts (six) | Blocked on Bill |
| Bill onboarding checklist documented | This report |
| Minimum permissions documented | Draft table — needs Product/implementer confirm |
| Correct attribution on supported actions | Not started |
| Commits not Bill where controllable | Not started |
| Issues/PRs/comments not Bill where controllable | Not started |
| Implementer/reviewer separation enforceable | Policy exists; identity switch strengthens |
| No secrets in repository | Ongoing constraint |
| Unavoidable bots documented | Partial (Actions, Copilot) |
| Integrations still operate after migration | Not started |
| Rollback/emergency access documented | Not started |
| Final as-built docs | Not started |

## Open Product Authority decisions

1. **Chat versus WORK:** One GitHub user each, or is “Chat” only the non-durable conversational surface (no account)?
2. **Grok / WORK labels:** Add `agent:grok` and `agent:work` to the orchestrator registry?
3. **Pilot agent:** Confirm Cursor first.
4. **Org versus user accounts:** Personal GitHub users versus a future LGFC organization (organization may trigger paid-plan stop).
5. **CODEOWNERS:** Replace `@wdhunter645` with team/agent users after accounts exist?

## Stop conditions (unchanged from #3407)

Stop and request Bill’s decision before purchasing any GitHub plan or paid service; changing repository or organization ownership; weakening branch protection or review requirements; granting an agent repository administration privileges; deleting or disabling Bill’s access; or making a credential or MFA design decision not covered by the approved custody model.

## References

- Source issue: [#3407](https://github.com/wdhunter465/next-starter-template/issues/3407)
- Durable roles and product inventory: `docs/governance/AGENT-TEAM.md`
- Orchestrator labels: `.github/orchestrator-labels.json`
- Orchestrator routing: `.github/orchestrator-routing.json`
- Queue label registry: `.github/queue-label-registry.json`
- CODEOWNERS: `.github/CODEOWNERS`
