---
Doc Type: Operations
Audience: Human + AI
Authority Level: Operational Authority
Owns: Live operating procedures, incident response, monitoring, operator workflows
Does Not Own: Redefining design/architecture/platform specs; historical records
Canonical Reference: /docs/ops/OPERATING_MANUAL.md
Last Reviewed: 2026-02-20
---

# Incident Response — Quickstart

Status: _MASTER (Operations authoritative)
Last Updated: 2026-02-05

## Purpose
Give Day-2 Operations a fast, deterministic entry point for handling production incidents.

## Definition
An incident is any event where:
- Production is unavailable, incorrect, or unsafe
- Governance enforcement is broken (drift gates bypassed or misconfigured)
- Deploy pipeline cannot produce a healthy build

## First 10 minutes (do these in order)
1) Confirm impact
- What is failing (route, auth, deploy, CI, data)?
- Is it production-only or preview too?

2) Stop the bleeding
- Pause merges if needed.
- Avoid stacking multiple PRs unless required for rollback.

3) Roll back to last-known-good
- Revert the most recent suspect PR.
- Re-deploy and verify health.
- Stabilize first; debug second.

4) Capture evidence (in repo)
- Add a brief note to `/docs/ops/deploy-log.md` (timestamp + what broke).
- If major: create a postmortem under `/docs/ops/incident-response/`.

## Triage classification
- Platform incident: Cloudflare build/runtime, routing, headers, environment.
- Governance incident: drift gate/intent label enforcement broken.
- App incident: runtime errors, broken pages, auth gating failures.

## Minimum verification after recovery
- `/` returns 200
- `/health` returns success
- `/fanclub/**` redirect works when unauthenticated
- Header/footer invariants present
- CI checks are green on the rollback PR

## Post-incident requirement
Within 24 hours:
- Write a postmortem doc.
- Add a prevention gate (test, invariant, CI guardrail, or verification step).
