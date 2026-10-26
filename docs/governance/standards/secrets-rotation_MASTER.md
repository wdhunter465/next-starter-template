---
Doc Type: Governance Standard
Audience: Human + AI
Authority Level: Operational
Owns: Secrets rotation policy: which credentials are covered, where they are stored, and what triggers rotation
Does Not Own: Platform and environment credential handling rules (PLATFORM-AND-ENVIRONMENT.md); step-by-step rotation runbooks
Canonical Reference: /docs/governance/PLATFORM-AND-ENVIRONMENT.md
Last Reviewed: 2026-02-20
---

# Secrets Rotation Policy (MASTER)

## Purpose
Define how credentials are stored, replaced, and secured.

## Secrets Covered
- API keys
- Service tokens
- Deployment credentials

## Storage
Use:
- Cloudflare environment variables
- GitHub encrypted secrets

Never commit secrets to the repo.

## Rotation Triggers
- Exposure
- Staff change
- Platform migration
