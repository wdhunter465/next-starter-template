---
Doc Type: How-To
Audience: Human + AI
Authority Level: Operational
Owns: Program #2039 production rollback procedure
Does Not Own: Cloudflare account administration
Canonical Reference: /docs/reference/DEPLOYMENT_GUIDE.md
Related issues: #2039, #2047
Last Reviewed: 2026-07-01
---

# Website Production Rollback

## Purpose

Define rollback path if post-launch verification fails.

## Procedure

1. Stop queue advancement and mark Program #2039 blocked in PMO tracker.
2. In Cloudflare Pages, redeploy the last known-good production commit.
3. Verify smoke tests on rolled-back build.
4. Open bounded remediation issue for the failing task only.
5. Record rollback evidence in the launch evidence template.

## Stop conditions

- Public route regression on auth, legal, or join flows
- False live fundraiser claims appear
- Admin-only staging content exposed on public routes
