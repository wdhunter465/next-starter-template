---
Doc Type: Ops Report
Audience: Human + AI
Authority Level: Design Evidence (Phase 1)
Status: Draft — #3212 Phase 1 security design
Source Issue: #3212
Owns: Phase 1 design and security proof for replacing Cursor Local polling / loop-wake dependency with event-driven GitHub self-hosted runner dispatch (#3212)
Does Not Own: Host runner registration, live systemd install, production cutover, or retirement of the existing Bridge without Phase 3 qualification evidence
Canonical Reference: /docs/ops/reports/issue-3212-phase1-cursor-runner-dispatch-security-design.md
related issues: #3212, #3215
Last Reviewed: 2026-08-08
Executor: Grok
---

# Issue #3212 Phase 1 — Cursor runner dispatch security design

## Purpose

Record Phase 1 design and security proof for replacing Cursor Local polling / loop-wake dependency with event-driven GitHub Actions → dedicated self-hosted runner → fixed local wrapper → Cursor headless CLI dispatch.

This report is durable repository evidence only. It does not register runners, enable dispatch workflows, or mutate the existing Bridge package.

## Scope

**In scope**

- As-built inventory of `lgfc-repo-runner`, wake workflow, and local Bridge launch path.
- Target architecture with dedicated `lgfc-cursor` runner identity and fixed identifiers-only wrapper.
- Public-repository threat model and non-negotiable controls (no PR-head execution, no body interpolation into shell/argv).
- Trusted trigger allowlist, concurrency/dedupe, observability including independent offline detection.
- Phase 2–4 gates, rollback, and zero-cost boundaries.

**Out of scope**

- Host runner registration or systemd install.
- Enabling a live Cursor dispatch workflow on `main`.
- Bridge package behavior changes or polling retirement.
- Bulk rewrite of `wdhunter645` repository-slug strings (separate OPS track).
- Paid tunnels, extra cloud VMs, or additional AI subscriptions.

## Current known truth

As of default-branch SHA `e8907b1911f001f3aa825dc664101871840ec644`:

1. **Delivery-only self-hosted path already exists.**
   - Runner identity: `lgfc-chromebook-linux` with routing labels `[self-hosted, linux, x64, lgfc-repo-runner]`.
   - Contract: `config/github-actions/repository-runner.json`.
   - Health workflow: `.github/workflows/repository-runner-health.yml` (manual `workflow_dispatch` only).
   - Wake workflow: `.github/workflows/cursor-local-wake.yml` writes a host queue packet; it does **not** launch Cursor.

2. **Cursor launch is owned by the local Bridge, not by GitHub Actions.**
   - Package: `scripts/cursor-bridge/**` + `config/cursor-bridge/bridge.json`.
   - Contract: `docs/reference/ci/cursor-local-bridge-contract.md`.
   - Architecture narrative: `docs/explanation/operations/cursor-local-auto-start-architecture.md`.
   - Primary path: GitHub event → wake workflow → `lgfc-repo-runner` → `~/lgfc-cursor-bridge/queue/*.json` → Bridge drain → `cursor agent` / `agent` CLI.
   - Poll-wake loop is documented as **legacy backup only**, not primary.

3. **Public-repository isolation is already a hard contract for the existing runner.**
   - No fork/PR/push/schedule/secret/deploy work on `lgfc-repo-runner`.
   - Wake is label-gated (`agent:cursor` + `handoff:ready`) via `scripts/cursor-bridge/lib/wake-ingress.mjs`.
   - Comment bodies are not routing authority.

4. **Repository identity drift is present in active configs/workflows.**
   - Live GitHub repository is `wdhunter465/next-starter-template`.
   - Multiple active files still assert `wdhunter645/next-starter-template` as the repository slug (wake workflow `if:`, runner config, Bridge expected repo, ingress default).
   - That mismatch alone can cause fail-closed rejection of legitimate wakes. Correcting repository-owner misidentification is tracked separately under OPS governance and must be treated as a hard prerequisite for Phase 2 enablement on the live owner slug.

5. **Observed operational failure mode motivating #3212.**
   - Issue body records GitHub→Cursor bridge down since 2026-08-03 without timely detection.
   - Local Bridge dependency + any residual polling path can silently lose work when the host process is down, the queue is not drained, or health is only local.

## Intended final state

GitHub is the durable event bus and job queue. A dedicated Chromebook Linux runner labeled `lgfc-cursor` receives only narrowly scoped dispatch jobs. A fixed local wrapper invokes Cursor CLI headlessly with **identifiers only**. Cursor then loads repository authority and the source Issue before any mutation. Offline runner state and failed dispatch are visible in GitHub without relying on the dead local process to report itself. Legacy polling / loop-wake is retired only after Phase 3 evidence passes.

```text
Qualifying GitHub event
  -> validate actor/event/labels on protected workflow (main)
  -> enqueue job runs-on: [self-hosted, linux, x64, lgfc-cursor]
  -> dedicated runner accepts job over outbound HTTPS
  -> fixed local wrapper (no shell interpolation of Issue/comment text)
  -> Cursor CLI headless print mode with identifiers only
  -> Cursor fetches live Issue + repo authority
  -> bounded LGFC work under existing governance
```

## Relationship to the existing Bridge

| Layer | Existing (`lgfc-repo-runner` + Bridge) | Target (`lgfc-cursor` dispatch) |
| --- | --- | --- |
| Event durability | GitHub Actions job queue | Same |
| Host receive | Wake packet write only | Job that may invoke Cursor |
| Cursor launch | Bridge process / systemd | Fixed wrapper from Actions step |
| Authority | Source Issue (Bridge revalidates) | Source Issue (Cursor loads after wake) |
| Primary failure mode | Bridge down while packets pile up | Runner Offline visible in GitHub; jobs queue |
| Polling | Legacy poll-wake + Bridge reconcile | Must not be primary; retire after qualification |

**Design decision (Phase 1):** Prefer **extending** the Chromebook host with a second, more privileged but still narrowly scoped runner label `lgfc-cursor` rather than overloading `lgfc-repo-runner` with Cursor launch. Keeping wake-delivery and Cursor-dispatch as separate runner identities preserves least privilege: the delivery runner never holds Cursor credentials or launch authority.

If host capacity forces a single runner process, the job matrix still must use distinct workflow allowlists so that only the dispatch workflow can invoke the Cursor wrapper.

## Official interface verification (implementation-time recheck required)

### GitHub self-hosted runners (public repository)

GitHub documents that self-hosted runners on **public** repositories are high risk because:

- any user who can open a pull request may attempt to run workflow code on the runner;
- self-hosted environments are not guaranteed ephemeral clean VMs;
- a compromised runner can access job secrets, `GITHUB_TOKEN`, and persist across jobs.

Canonical guidance (verify at implementation time):

- [Hardening for self-hosted runners](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#hardening-for-self-hosted-runners)
- [Compromised runners](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions#potential-impact-of-a-compromised-runner)

**Non-negotiable design rules derived from that guidance:**

1. Never attach a general-purpose `runs-on: self-hosted` CI target for arbitrary PR/push workflows.
2. Never check out or execute PR-head / fork refs on `lgfc-cursor`.
3. Never use `pull_request` or `pull_request_target` as triggers for the Cursor dispatch workflow.
4. Minimize `GITHUB_TOKEN` permissions; prefer `contents: read` + `issues: read` unless a later phase proves a tighter need.
5. Do not place repository secrets, production credentials, or broad PATs in the dispatch job environment.
6. Assume persistence between jobs; dedicated user, controlled workdir, and post-job hygiene are mandatory.

### Cursor CLI headless interface

Cursor documents non-interactive CLI usage via print mode:

- `agent -p "..."` (or `cursor` binary per Bridge candidates) for scripts/automation;
- `CURSOR_API_KEY` for non-interactive auth in automation contexts;
- `--force` / `--yolo` enables file modification in print mode — **LGFC Bridge already prohibits yolo**; dispatch wrapper must inherit that prohibition unless Product Authority changes the cost/safety boundary.

Canonical docs to re-verify at implementation time:

- https://cursor.com/docs/cli/headless
- https://cursor.com/docs/cli/overview
- https://cursor.com/docs/cli/github-actions.md

**Wrapper constraint:** the Actions step must invoke a **fixed local script** with argv identifiers only (`issue_number`, `event_name`, `delivery_id`, `run_id`). It must not pass Issue title, body, or comment text as the agent prompt string. Cursor must fetch the Issue after start.

## Threat model and required controls

| # | Threat | Control |
| --- | --- | --- |
| 1 | Fork/PR code execution on Chromebook | No PR triggers; no checkout of untrusted refs; runner not targeted by product CI |
| 2 | Issue/comment injection into shell or agent prompt | Pass identifiers only; never interpolate bodies into `run:` strings or CLI argv beyond validated integers/enums |
| 3 | Credential theft | Dedicated Linux service account; no browser/home secrets; minimal job token; Cursor auth stored only where the wrapper needs it; no secrets on delivery runner |
| 4 | Persistence across jobs | Dedicated `lgfc-cursor` label; controlled workdir; pre-start cleanliness checks; recovery procedure documented |
| 5 | Workflow definition privilege escalation | Dispatch workflow only from protected `main`; CODEOWNERS / independent review for workflow + wrapper paths |
| 6 | Trigger abuse / DoS | Actor + label allowlist; concurrency group serializing Cursor dispatch; dedupe by `run_id` / delivery id |
| 7 | Silent offline | GitHub-hosted scheduled or API health check that does **not** depend on the self-hosted runner to report its own death |

## Trusted trigger allowlist (Phase 2 candidates)

Enable only what is necessary and filterable. Phase 2 default proposal:

| Trigger | Allowed? | Gate |
| --- | --- | --- |
| `issues` labeled with both `agent:cursor` and `handoff:ready` | Yes | Same mechanical predicate as `shouldDeliverCursorWake` |
| `workflow_dispatch` by Product Authority actor | Yes | Explicit confirmation input; actor allowlist |
| `issue_comment` | **No** (Phase 2) | Comment text is untrusted; labels already cover handoff |
| `pull_request` / `pull_request_target` | **No** | Public-repo runner risk |
| `push` / `schedule` on product paths | **No** | Not a Cursor handoff signal |
| CI failure on Cursor-owned PR | Deferred | Only after identity of "Cursor-owned" is proven without PR-head execution |

Reuse `scripts/cursor-bridge/lib/wake-ingress.mjs` (or a shared module extracted from it) so delivery and dispatch cannot diverge on routing rules.

**Repository string:** all active gates must use live owner `wdhunter465/next-starter-template`. Treating `wdhunter645` as repository owner is incorrect; `wdhunter645` remains valid only as Product Authority **user** account where actor checks require it.

## Runner identity

| Field | Value |
| --- | --- |
| Proposed name | `lgfc-cursor-chromebook` |
| Required labels | `self-hosted`, `linux`, `x64`, `lgfc-cursor` |
| Scope | repository |
| Purpose | Cursor dispatch only |
| Must not run | tests, builds, deploys, PR CI, secret-bearing jobs |

Existing `lgfc-repo-runner` remains delivery/health only.

## Local wrapper contract (fixed)

Conceptual interface (exact flags re-verified in Phase 2):

```text
lgfc-cursor-dispatch.sh \
  --repo wdhunter465/next-starter-template \
  --issue <int> \
  --event <enum> \
  --delivery-id <safe-token> \
  --run-id <int>
```

Wrapper must:

1. Validate argv types and reject unknown flags.
2. Confirm remote URL / checkout identity matches expected repo.
3. Acquire a local exclusive lock (one Cursor dispatch at a time).
4. Refuse if unexpected dirty worktree or foreign remote.
5. Invoke Cursor CLI with a **fixed prompt template** that only embeds the identifiers and instructs Cursor to fetch the Issue.
6. Emit structured start/end/error lines to job logs (no secrets).
7. Exit non-zero on preflight failure so the Actions job fails visibly.

## Concurrency and deduplication

- GitHub Actions `concurrency.group: lgfc-cursor-dispatch` with `cancel-in-progress: false`.
- Local file lock under the dedicated service account home.
- Delivery id = `wake-${run_id}-${issue}` (or successor) recorded as consumed after Cursor **acceptance**, mirroring Bridge transactional semantics where applicable.
- Duplicate events while a job is in progress must queue or skip with an explicit log reason — never parallel writers.

## Observability (fail-closed)

Required signals:

| Signal | Source |
| --- | --- |
| Every dispatch attempt and conclusion | GitHub Actions run list for the dispatch workflow |
| Runner Online/Offline | GitHub runner settings + independent health workflow on `ubuntu-latest` that queries runner status via API |
| Wrapper preflight failures | Job log + step summary |
| Cursor exit code | Job log (secret-safe) |
| Stale queued jobs | Actions UI + optional ops exception Issue when age exceeds threshold |

Independent offline detection must run on a **GitHub-hosted** runner so a dead Chromebook cannot suppress the alarm.

## Availability boundary

- **Durable:** GitHub retains the workflow run / queue while the host is offline (within GitHub retention).
- **Available:** local execution only while the Chromebook Linux VM is up and the runner service is connected.
- Acceptance does **not** require waking a powered-off device.
- Acceptance **does** require no silent discard: after reconnection, queued jobs process or fail visibly.

## Zero-cost boundary

Allowed: existing GitHub Actions minutes for public workflows, existing Chromebook/Linux VM, existing Cursor subscription/CLI.

Rejected without Product Authority change: paid tunnels, extra cloud VMs, additional AI subscriptions, paid queue services.

## Phase gates

### Phase 1 (this document) — design/security proof

- [x] As-built inventory of Bridge + `lgfc-repo-runner` + wake path
- [x] Target architecture with dedicated `lgfc-cursor` identity
- [x] Public-repo threat model and controls
- [x] Trusted trigger allowlist
- [x] Cursor CLI interface constraints and official doc pointers
- [x] Observability and independent offline detection requirement
- [x] Rollback and cost boundaries

### Phase 2 — bounded prototype (blocked until Phase 1 accepted and repo-slug prerequisites resolved)

- Register `lgfc-cursor` runner (host action; not this PR).
- Add dispatch workflow on `main` with fail-closed gates.
- Add fixed local wrapper (allowlisted path).
- Prove trusted manual dispatch wakes Cursor.
- Prove untrusted actor/event does not.
- Prove no PR-head execution path exists.

### Phase 3 — reliability validation

Repeated dispatch, dedupe, runner restart, temporary offline, independent offline alarm, Cursor failure signaling, serial concurrency.

### Phase 4 — cutover

Retire legacy polling dependency only after Phase 3 evidence is accepted; update contracts; keep explicit rollback to disabled-runner state.

## Rollback

1. Disable dispatch workflow jobs targeting `lgfc-cursor` (or delete workflow via reviewed PR).
2. Stop/unregister the `lgfc-cursor` runner service on the host.
3. Revoke any registration token introduced for that runner.
4. Leave `lgfc-repo-runner` wake-delivery intact unless separately authorized to change.
5. Do not re-enable polling as a permanent primary path without Product Authority decision.

## Explicit non-goals for Phase 1

- No host registration in this PR.
- No workflow enablement of Cursor launch in this PR.
- No mutation of Bridge package behavior in this PR.
- No bulk rewrite of `wdhunter645` strings (tracked under separate OPS issue).
- No paid infrastructure.

## Evidence references

Repository paths inspected for this design:

- `.github/workflows/cursor-local-wake.yml`
- `.github/workflows/repository-runner-health.yml`
- `config/github-actions/repository-runner.json`
- `config/cursor-bridge/bridge.json`
- `scripts/cursor-bridge/lib/wake-ingress.mjs`
- `docs/reference/ci/cursor-local-bridge-contract.md`
- `docs/reference/ci/repository-runner-contract.md`
- `docs/explanation/operations/cursor-local-auto-start-architecture.md`

External authority (re-verify at Phase 2):

- GitHub Actions self-hosted runner security hardening and compromised-runner guidance
- Cursor CLI headless / GitHub Actions integration docs
