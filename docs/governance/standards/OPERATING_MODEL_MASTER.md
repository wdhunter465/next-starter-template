---
Doc Type: Governance
Audience: Human + AI
Authority Level: Canonical
Owns: Governance rules, PR process, enforcement, AI guardrails
Does Not Own: Design/architecture/platform specifications; step-by-step ops procedures
Canonical Reference: /docs/governance/REPOSITORY-AUTHORITY.md
Last Reviewed: 2026-02-20
---


Agent Rules — Repository Governance

Purpose

This repository permits agentic AI (including GitHub Copilot, OpenCode, and future agents) only for configuration stewardship, governance enforcement, and documentation alignment.

Feature development, product logic, and application code changes are explicitly out of scope.

Allowed Actions

Agents MAY:

Propose changes via Pull Requests only
Modify files within the approved allowlist (see below)
Explain intent and impact before applying changes
Enforce repository governance, CI integrity, and configuration consistency
Prohibited Actions

Agents MUST NOT:

Push directly to main or any protected branch
Modify files outside the approved allowlist
Create ZIP files or commit binary artifacts
Introduce new features or refactor application logic
Change licensing, ownership, or security posture without explicit instruction
Modify this file (agent-rules.md) unless explicitly directed
Approved File Allowlist

Agents may modify ONLY the following paths:

.github/workflows/**
.github/intent-labeler.json
.github/agent-rules.md (only when explicitly instructed)
docs/**
active_tasklist.md
wrangler.toml
package.json
tsconfig.json
All other files are read-only context.

Pull Request Requirements

Every agent-generated PR MUST:

State intent clearly in the PR description
List files changed and why
Reference the triggering Issue or comment
Avoid unrelated or opportunistic edits
Preserve repository history and governance invariants
Interaction Contract

Agents respond only to explicit commands (e.g. /oc)
Ambiguous requests must result in clarification, not action
Silence is preferred over unsafe assumptions
Enforcement

Any violation of these rules invalidates the agent output. Human maintainers retain final authority at all times.

Governance — Roles

Status: _MASTER (Operations authoritative) Last Updated: 2026-02-05

Purpose

Define who owns decisions, who executes changes, and who verifies outcomes so operational responsibility is unambiguous.

Roles (Day-2)

Operations (Owner of _MASTER)

Owns production stability.
Owns incident response.
Owns _MASTER documentation accuracy.
Blocks merges that violate governance.
Project (Owner of _DRAFT and _INCOMPLETE)

Owns future direction and feature planning.
Produces drafts and incomplete docs that may later mature.
Automation / Agents

Execute only what is explicitly specified.
Must follow file-touch allowlists.
Must not “helpfully refactor” beyond scope.
Ownership model

_MASTER = Operations-owned, authoritative.
_INCOMPLETE = Project-owned, reference.
_DRAFT = Project-owned, intent.
See /docs/governance/document-status-and-naming_MASTER.md.

Responsibility boundaries

Operations will not:

Accept unbounded PR scope.
Accept changes without verification steps.
Accept changes that contradict design authority.
Project will not:

Treat _DRAFT/_INCOMPLETE as production truth during incidents.
Handoff rule

A document becomes _MASTER only when:

Behavior is stable in production.
Verification and rollback steps are defined.
Ownership explicitly transfers to Operations.
Governance — Modes

Status: _MASTER (Operations authoritative) Last Updated: 2026-02-05

Purpose

Define the operating modes used to prevent drift and keep work deterministic across sessions and tools.

Modes (authoritative definitions)

Control

Decision-making, scope lock, governance compliance, risk management. Output: instructions, checklists, acceptance criteria, verification steps. Execute

Making the change (code/docs/config edits) within an approved scope. Output: exact file edits (diff-ready), commands, and replacement content. Verify

Proving the change works and does not regress invariants. Output: validation commands, observed results, and pass/fail calls. Mode-switch rule

Mode switches must be explicit in the record (PR description or repo docs). Operations assumes:

Control → Execute → Verify Repeat as needed until stable Anti-drift rules

No Execute work without a scope lock. No Verify claims without explicit evidence. No “background work” or implied completion. Day-2 Operations expectation

When in doubt:

Stay in Control until the exact change is defined and bounded.


Tier A / Tier B — Overwatch + Gate Model (Source of Truth)

This document defines the two-tier workflow architecture for this repository.

Tier A (GATE) protects repository integrity and governs PR merges.
Tier B (OPS / Overwatch) observes everything, logs everything, and drives all actionable work into the Issues queue.
This model is intentionally designed to avoid “normal” assumptions: the repository has many interconnected workflows and environments. Every monitor must define what normal means and how to detect restoration.

Core Principles

Issues are the unified work queue

All actionable activity must surface as a GitHub Issue:

PR execution tracking
drift / unauthorized changes
CI failures that require action
operational degradations / outages
security or integrity events
external dependency incidents (treated the same; only ownership differs)
PRs are execution artifacts; Issues are prioritization and operational visibility.

Tier A (GATE) — PR Integrity Only

Scope: PR merge gating only.

Tier A workflows:

validate that a PR is safe to merge
enforce invariants, governance rules, and deterministic quality checks
reduce variance in Agent output (ensuring PR instructions are followed)
Tier A MUST:

be fast and deterministic
be repository-local (no live-site dependency checks unless explicitly approved as a gate)
be suitable for use as required checks
Tier A MUST NOT:

create or close Issues for “work accounting”
perform operational monitoring
create alert noise
attempt automated remediation
Naming:

.github/workflows/gate-*.yml
workflow names should start with GATE — ...
Tier B (OPS / Overwatch) — Observe Everything, Support Only

Scope: detect + classify + log + route work into Issues.

Tier B workflows:

observe everything in the repo (and outside the repo when necessary)
log all detections
convert actionable detections into Issues
never deny a PR
Tier B NEVER:

blocks merges
becomes a required PR check
fails a workflow as a signaling mechanism (signal via Issues instead)
Naming:

.github/workflows/ops-*.yml
workflow names should start with OPS — ...
External dependencies:

fold into this same model
difference is only in ownership routing and coordination with external teams/vendors
Tier B Classification: info / warn / alert

Every Tier B detection is classified:

info

log only
no Issue created
warn

log + create or update an Issue (normal priority)
alert

log + create or update an Issue (high priority)
includes escalation metadata for ops coordination
Alerts are not uniform. Severity is not derived from frequency alone.

Alert TYPEs, Threshold Rules, Severity

Tier B uses a two-step model:

TYPE (what kind of problem is this?)
Threshold rule (when does it become actionable?)
TYPE + threshold → severity + action
Threshold rule notation

Type1x1: 1 occurrence triggers 1 Issue (critical)
Type20x24: 20 events in a rolling 24h window triggers 1 Issue (pattern signal)
Not every alert uses the same threshold. Some are critical on first occurrence; some require patterning to avoid noise during known change activity.

A future “severity matrix” will map:

TYPE → threshold rule → Issue priority
Overwatch Lifecycle Standard (#1 / #1A / #1Z / #1R)

When Tier B monitors a domain, the standard pattern is:

#1 — Detector

detects abnormal condition
assigns TYPE and threshold rule
logs event metadata
opens/updates the primary Issue
#1A — Auto-fix (optional; only when deterministic and safe)

attempts a deterministic fix/restore action
comments outcome to the primary Issue
does not change Tier A gating behavior
If #1A fails:

keep the primary Issue open
open a second Issue for “auto-fix deployment failure” (the alert and the fix failure are separate operational problems)
#1Z — Restoration watcher

monitors the Issue + service for “all clear”
logs restoration timestamp
closes the primary Issue when normal state is verified
No monitor should exist without a defined normal + restoration condition.

#1R — Revert guardrail (optional, recommended when #1A changes state)

if #1A overlays a fix and the problem persists, revert only what #1A changed
purpose: avoid masking root cause and extending the impact window
REVERT means: undo what was just done — no more, no less
Event Normalization: Required Metadata

Every Tier B detection should record a normalized event record.

Required fields:

timestamp_utc: canonical (UTC, stable across DST)
type: alert TYPE (classification key)
threshold_rule: e.g., Type1x1, Type20x24
severity: derived from TYPE + threshold
source: PR / CI / repo / external
linked_pr: PR number + URL (if applicable)
linked_issue: Issue number + URL (if applicable)
status: open / investigating / restoring / restored
actor: higher-level owner for comms inclusion
event_owner: technical resolver responsible for investigation + resolution
Ownership model

Actor:

service owner / project owner / ops manager / PR requestor (PM)
included in communications
Event owner:

technical resource (agent or human) responsible for troubleshooting and resolution
provides status updates
As the org grows:

Level 1: ops monitoring/comms
Level 2: event owner focuses on resolution
Known Gaps and Concerns (Captured for Roadmap)

This model intentionally supports progressive maturity. Remaining gaps to implement over time:

Severity matrix per alert TYPE (alerts are not uniform)
Identity attribution: human vs agent vs automation, merger vs author vs committer
Non-PR mutation coverage: tags, releases, repo settings changes, force-pushes, protection rule edits
Workflow health governance: disabled workflows, permission scope drift, trigger drift
Issue hygiene: duplicate detection, orphan detection, stale detection, suppression during known incidents
Safe auto-fix allowlist + revert safety
External dependency observability expansion (same model; different ownership)
Immediate Alignment Requirement for repo workflows

PR → Issue creation/association is Tier B (OPS / Overwatch), not Tier A.
Tier A remains exclusively PR-gating.
Governance — Startup Procedure

Status: _MASTER (Operations authoritative) Last Updated: 2026-02-05

Purpose

Define the Day-2 startup procedure for an operator beginning work on this repository.

Startup checklist (Day-2)

Confirm source of truth The repository state is authoritative. Any uploaded ZIP is a working copy only if explicitly declared as source-of-truth for that session. Read the authority layer (required) /docs/governance/document-authority-hierarchy_MASTER.md /docs/governance/document-status-and-naming_MASTER.md /docs/reference/design/LGFC-Production-Design-and-Standards.md docs/reference/design/LGFC-Production-Design-and-Standards.md or docs/reference/design/LGFC-Production-Design-and-Standards.md (use the actual filename in repo) Verify production health (minimum) Fetch the home page and /health. Confirm Cloudflare Pages is deploying from the expected branch. Confirm GitHub Actions checks are green. Load current operational work active_tasklist.md (canonical tasklist file). /docs/ops/deploy-log.md for recent deployments. Choose a mode and record it Control → Execute → Verify, explicitly. Session rules

No assumptions. If data is missing, first establish it from repo docs or direct verification commands. No drifting scope. Every change must have a bounded file list and one intent label. Tooling notes

PR prompts must follow /docs/website-PR-process.md. Use line-range anchors only when the referenced file exists in repo and line numbers are stable.





