---
Doc Type: Explanation
Audience: Human + AI
Authority Level: Informational
Owns: The keep-or-change disposition and the safe-parallelism boundary for #2454
Does Not Own: A new PMO design, permission to relax a kept control, or a second priority system
Canonical Reference: /docs/governance/PMO-PORTFOLIO.md
Related Issues: #2454, #2449
Last Reviewed: 2026-09-27
---

# Delivery friction and safe parallelism

## Purpose

This review covers only controls that protect the 2027 fundraiser delivery path, for #2454. It is not a PMO redesign. Full portfolio maturity stays in `docs/governance/PMO-PORTFOLIO.md`.

## Scope

This file owns the keep-or-change disposition of the controls below and the safe-parallelism boundary. It does not own a new PMO design, permission to relax a kept control, or a second priority system.

## Current known truth

### Disposition

| Control | Disposition | Why |
| --- | --- | --- |
| GitHub Issues and pull requests as the executable authority | Keep | Without them, chat and drafts become a second authority |
| One intent per change | Keep | Mixed changes hide review and rollback |
| Builder and reviewer separation | Keep | Self-approval removes the independent check |
| File allowlists where the change is risky | Keep | They are what makes rollback and review bounded |
| Human merge and launch authorization | Keep | Agents do not merge and do not declare production Go |
| Blocking treatment of confirmed P0 findings | Keep | A confirmed production-blocking defect is not advisory |

No control in this table is retired. No lighter path is approved. A later change needs its own source Issue, a stated delivery benefit, and a stated risk. Benefit is not claimed here because this review did not measure cycle time.

### Safe parallelism

These may proceed beside an in-flight implementation without a new implementation Go:

- Reading the repository, Issues, and checks
- Drafting an explanation or reference that does not change canonical policy
- Investigating a failure and reporting it

These may not proceed in parallel as if they were authorized:

- Editing application code, workflows, or canonical policy
- Opening a pull request that mixes two source Issues
- Merging, deploying, or closing an Issue as accepted
- Treating a handoff-ready label as a website Go

### Low-risk path

There is no approved shortcut around one Issue and one pull request. A documentation-only change still uses one source Issue, one allowlist, and human merge. The smaller scope is the allowlist, not a waived review.

### Safeguard

Any future relaxation must say which row above it changes, what defect that row has prevented, what evidence shows the overhead, and how builder separation, human merge, and launch evidence stay intact. Until that Issue exists, the disposition is keep.

## Intended final state

Every control in the disposition table stays "Keep" until a future Issue meets the Safeguard section's bar. This file does not expect its own disposition to change; it expects to be superseded in full only if `docs/governance/PMO-PORTFOLIO.md` itself changes the underlying control set.
