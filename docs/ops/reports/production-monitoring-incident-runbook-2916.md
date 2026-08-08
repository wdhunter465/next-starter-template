---
Doc Type: Operations Report
Audience: Bill, Day-2 Operations, Implementation/Operations, PMO/Engineering, implementation agents
Authority Level: Controlled
Owns: #2780 Task 003 — incident runbook (acknowledgment, escalation, Monitoring/Hold, containment, diagnosis, recovery, communication, verification, closeout) for Operations Issues raised by scripts/ci/production_health_routing.mjs
Does Not Own: Signal collection itself (#2915, scripts/ci/production_health_collectors.mjs), CI/delivery-pipeline monitoring (#2680, docs/ops/ci-monitoring-ownership.md), any Production write/remediation automation (none exists in this program)
Canonical Reference: /docs/ops/reports/production-monitoring-incident-runbook-2916.md
Related Issues: #2780, #2914, #2915, #2916, #2917
Last Reviewed: 2026-08-08
---

# Production monitoring incident runbook (#2780 Task 003)

## Purpose and scope boundary

This runbook covers what a human operator (or an agent acting under standing
#2780 authority) does when `scripts/ci/production_health_routing.mjs` opens
or updates an Operations Issue for a Production health finding from #2915's
collectors. It does not cover CI/delivery-pipeline incidents (#2680's
domain) and does not authorize or describe any Production write —
**no auto-remediation exists anywhere in this program.** The routing script's
only side effect is GitHub Issues API calls (create/update/close); recovery
of the underlying Production condition is always a separate, human-directed
action.

## How an Operations Issue gets here

1. `production-health-collectors-2915.yml` runs `production_health_collectors.mjs`
   hourly, producing one normalized result per check (`healthy`, `degraded`,
   `unavailable`, `stale`, `missing-evidence` — see #2914's map and #2915's
   collector for the full classification rules).
2. The same workflow run then runs `production_health_routing.mjs`, which
   opens/updates **one stable-titled issue per check** (`OPS — Production
   health: <check>`) for every non-healthy result, and closes that issue
   with a resolution comment the first time the check reports healthy again.
3. Because the issue title never encodes the current state, a check
   bouncing between `degraded` → `unavailable` → `stale` updates the *same*
   issue (new body + a timestamped comment each run) instead of spawning a
   new one — this is what makes duplicate alerts impossible by construction,
   not something an operator needs to enforce manually.

## Severity and owner (authoritative source: #2914's map, reproduced here for convenience)

| Check | Severity | Owner |
|---|---|---|
| `d1_health` | **P1** | Bill/Day-2 Operations (incident); Implementation/Operations (remediation) |
| `faq_list`, `events_next`, `photos_list`, `milestones_list`, `friends_list`, `cms_get`, `search` | P3 | Implementation/Operations |

P1/P2/P3/P4 definitions are #2780's own rubric, unchanged here:
unavailable/unsafe/destructive/security-privacy/fundraiser-critical (P1);
major journey unavailable without fallback (P2); degraded/partial/repeated
error (P3); bounded defect with workaround (P4).

## Lifecycle

### 1. Acknowledgment

On any new or updated `OPS — Production health: <check>` issue: read the
issue body (state, reason, severity, owner, fingerprint, run link). The
`reason` field is already redaction-safe by construction (fixed strings/HTTP
status/network-error vocabulary only — see #2915's redaction contract) — it
never needs to be treated as sensitive, and it never contains raw server
response content.

- **P1** (`d1_health`): treat as an active incident immediately. D1 being
  down means nearly every journey in #2914's map is affected.
  Bill/Day-2 Operations is the incident owner.
- **P3** (everything else in this program today): a single read-path
  degrading is not urgent, but repeated recurrence across runs (the issue
  staying open/updating across several hourly cycles) is a signal worth
  investigating rather than dismissing.

### 2. Escalation

Escalation *is* the issue itself — there is no separate paging mechanism in
this zero-budget program (per #2780's own constraint). "Escalating" means:
the issue exists, is labeled with its severity (`severity:p1`/`severity:p3`)
and `ops-runtime-finding`, and is visible in the repository's issue list.
For a P1, the expectation is Bill/Day-2 Operations reviews it promptly;
nothing in this program pages anyone automatically, and building that is
explicitly out of scope for #2780 (zero additional cost, no paid vendor).

### 3. Monitoring/Hold

If an issue is under active investigation and repeated auto-updates from
the hourly routing run are unhelpful noise, add the `monitoring-hold` label.
`production_health_routing.mjs` checks for this label before every
create/update/close decision and skips the issue entirely while it's
present — no further body updates, no comments, and critically **no
auto-close** even if the check reports healthy again while on hold. Remove
the label to resume normal routing once the investigation concludes (the
next hourly run will then correctly reflect the check's current state,
including closing it if it has genuinely recovered).

### 4. Containment

There is no containment action available in this program beyond what
already exists: the collector performs zero writes, so there is nothing to
"stop." If a check's `unavailable` state coincides with evidence of an
active abuse pattern (unlikely for these read-only public endpoints, but
possible), the existing `API_RATE_LIMITER` binding and `login_attempts`
table are the only rate-limiting surfaces in this codebase — see #2914's
map's "Rate limiting / abuse protection" row. This runbook does not add new
containment tooling.

### 5. Diagnosis

- Read the issue body's `reason` and `run` link to the workflow run
  (artifacts: `production-health-collectors-2915-result.json`/`.md` and
  `production-health-routing-2916-result.md`).
- Cross-reference the failing check's target endpoint in
  `scripts/ci/production_health_collectors.mjs`'s `TARGETS` array against
  the corresponding `functions/api/**` handler to understand what a
  `degraded`/`unavailable`/`missing-evidence` state actually implies for
  that endpoint (e.g. `d1_health`'s `db_ok=false` means the D1 `SELECT 1`
  probe itself failed — see `functions/api/health.ts`).
- `stale` specifically means: the current run's raw state was not healthy,
  but a last-known-good result exists within the last 24h — check whether
  this is a transient blip (likely fine) or the start of a longer outage
  (the issue will stop showing `stale` and start showing the raw state once
  the 24h window elapses without a new healthy result).

### 6. Recovery

This program has no automated recovery. Recovery is whatever fixes the
underlying Production condition (a Cloudflare Pages redeploy, a D1
incident resolved by the platform, a code fix merged and deployed) —
entirely outside this runbook's scope, which is routing/visibility only.
Once the underlying condition is fixed, no manual issue-closing step is
needed: the next hourly collector run will report `healthy`, and the next
routing run will close the issue automatically with a resolution comment.

### 7. Communication

The Operations Issue itself is the communication record — its title,
labels, and comment history are the timeline. There is no separate
notification channel in this program.

### 8. Verification

Before considering an incident closed, confirm:
- The collector's next scheduled run (or a manual `workflow_dispatch` of
  `production-health-collectors-2915.yml`) reports `healthy` for the
  affected check.
- The routing run closed the issue with a resolution comment (not merely
  that the issue "looks fine" — confirm the actual close event happened).
- If the incident involved a code or configuration change, that change is
  itself verified independently (this runbook does not substitute for
  normal PR review/CI on the fix).

### 9. Closeout

Closeout is automatic once verification (§8) passes — `close()` in
`production_health_routing.mjs` posts the resolution comment and sets
`state_reason: completed`. No manual closeout step exists or is needed
under normal operation. The only manual closeout path is for an issue left
on `monitoring-hold`: remove the label once the investigation concludes so
the next routing run can evaluate and close it normally.

## Explicitly out of scope

- No auto-remediation of any kind exists in this program — verified by
  `production_health_routing.mjs` having no code path that calls any API
  other than GitHub Issues (see its own module-level comment and the
  committed test asserting every `upsert` call's argument shape).
- No paid monitoring/alerting/paging vendor is used or proposed.
- No new containment or rate-limiting mechanism is added.
- CI/delivery-pipeline incidents remain #2680's domain
  (`docs/ops/ci-monitoring-ownership.md`).

## Related documents

| Document | Role |
|---|---|
| `docs/ops/reports/production-monitoring-service-journey-map-2914.md` | Source of severity/owner per check; full journey/gap inventory |
| `scripts/ci/production_health_collectors.mjs` | #2915 — the collectors this runbook's issues are raised from |
| `scripts/ci/production_health_routing.mjs` | #2916 — the routing/dedup/close logic this runbook describes |
| `scripts/ci/ops_runtime_escalation.mjs` | Shared idempotent Operations-Issue primitive reused (not duplicated) by the routing script |
