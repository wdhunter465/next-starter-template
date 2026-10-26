---
Doc Type: Reference
Audience: Human + AI
Authority Level: Controlled
Owns: Runtime dependency inventory and outage impact notes
Does Not Own: Operational runbooks; governance policies; UI/UX design specifics; production behavior, auth, or homepage order
Canonical Reference: /docs/reference/design/LGFC-Production-Design-and-Standards.md
Last Reviewed: 2026-10-23
---

# Runtime Dependency Map (MASTER)

## Purpose
Identify all external systems and impact of failure.

## Critical Dependencies
- Cloudflare Pages → site availability
- Cloudflare D1 → data availability
- GitHub → deploy pipeline
- CI workflows → validation and release safety

## Operator Guidance
During outages:
- Identify failing dependency
- Avoid unrelated changes
