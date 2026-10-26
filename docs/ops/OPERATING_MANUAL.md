---
Doc Type: Operations
Audience: Human + AI
Authority Level: Superseded
Owns: Historical operator procedures only — delivery, rollback, and emergency policy moved to governance
Does Not Own: Delivery-model selection, production approval routing, degraded-service routing, or emergency recovery authority
Canonical Reference: /docs/governance/OPERATIONS-AND-RECOVERY.md
Related Issues: #2495
Last Reviewed: 2026-07-13
---

# LGFC Operating Manual

## Status

**Superseded for delivery, rollback, incident routing, and emergency recovery policy.** Canonical domain policy now lives in governance:

| Topic | Canonical owner |
| --- | --- |
| Model A, Model B, promotion, and rollback policy | `docs/governance/DELIVERY-AND-RELEASE.md` |
| Degraded-service routing and emergency recovery | `docs/governance/OPERATIONS-AND-RECOVERY.md` |
| Rollback profiles and evidence schema | `docs/reference/delivery/delivery-and-rollback-profiles.md` |
| Model A release procedure | `docs/how-to/delivery/run-model-a-release.md` |
| Model B component release procedure | `docs/how-to/delivery/run-model-b-component-release.md` |
| Emergency recovery procedure | `docs/how-to/ops/run-emergency-recovery.md` |

The body below retains historical operator context until a later archive pass. Do not cite this file for delivery-model boundaries, production rollback policy, incident severity routing, or emergency response authority.

## Codespaces Shell Rule (Hard Prohibition)

**Do NOT use `set -euo pipefail` in GitHub Codespaces for this repo.** It can crash the Codespaces terminal session. This prohibition applies to all contributors and all AI agent outputs.

**Status:** LOCKED  
**Effective Date:** 2026-01-25  
**Purpose:** Operational reference for LGFC repository maintainers and contributors

---

## Overview

This operating manual provides standardized operational procedures, workflow gates, and day-to-day maintenance guidance for the Lou Gehrig Fan Club (LGFC) repository. All contributors must follow these procedures to ensure consistency, quality, and stability.

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Pull Request Workflow](#pull-request-workflow)
3. [Testing Requirements](#testing-requirements)
4. [Deployment Procedures](#deployment-procedures)
5. [Incident Response](#incident-response)
6. [Maintenance Tasks](#maintenance-tasks)
7. [Quality Gates](#quality-gates)

---

## Daily Operations

### Pre-Work Checklist

Before starting any development work:

1. **Pull latest changes:**
   ```bash
   git checkout main
   git pull origin main
   ```

2. **Verify clean state:**
   ```bash
   npm ci
   npm run lint
   npm test
   npm run build:cf
   ```

3. **Check for alerts:**
   - Review GitHub Actions for failed workflows
   - Check nightly assessment results
   - Review any open security alerts

### Branch Naming Convention

- Feature branches: `feature/description`
- Bug fixes: `fix/description`
- Documentation: `docs/description`
- Hotfixes: `hotfix/description`
- Agent-created branches: `copilot/description`

### Development Workflow

1. **Create feature branch:**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make minimal changes:**
   - Follow the principle of minimal modifications
   - Change only what's necessary to address the issue
   - Preserve existing working code

3. **Test locally:**
   ```bash
   npm run lint
   npm test
   npm run test:e2e
   npm run build:cf
   ```

4. **Commit changes:**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

5. **Push and create PR:**
   ```bash
   git push origin feature/your-feature
   ```

---

## Pull Request Workflow

### PR Creation Requirements

All PRs must include:

1. **Clear title** following conventional commits format:
   - `feat(scope): description`
   - `fix(scope): description`
   - `docs(scope): description`
   - `refactor(scope): description`

2. **PR description** using `.github/pull_request_template.md`:
   - Reference to authoritative docs
   - Change summary with exact file paths
   - Acceptance criteria checklist
   - Verification steps

3. **Appropriate intent label (exactly ONE required):**
   - `infra` - CI/CD, workflows, build config
   - `feature` - Application features, UI, API
   - `docs-only` - Documentation-only changes
   - `platform` - Cloudflare runtime config only
   - `change-ops` - Operational changes, migrations
   - `codex` - AI/agent configuration
   - `recovery` - Emergency fixes (manual assignment only)
   
   See `/docs/governance/pr-intent-labels.md` for full definitions.

### PR Review Process

1. **Automated checks** (must pass):
   - Lint check (`npm run lint`)
   - Unit tests (`npm test`)
   - Build check (`npm run build:cf`)
   - Drift gate validation
   - ZIP file prohibition check
   - Design compliance warnings

2. **Code review** (required):
   - At least one approving review
   - No requested changes outstanding
   - All comments resolved

3. **Documentation validation:**
   - If UI/navigation changes: docs updated
   - If header/footer changes: LGFC-Production-Design-and-Standards.md updated
   - If design changes: LGFC-Production-Design-and-Standards.md updated
   - No "..." placeholders in touched documentation sections

### Merge Requirements

Before merging to `main`:

- [ ] All CI checks green
- [ ] Drift gate passes
- [ ] Code review approved
- [ ] Documentation updated (if applicable)
- [ ] No ZIP files in commit history
- [ ] Branch up to date with main

---

## Testing Requirements

### Test Levels

1. **Unit Tests:**
   ```bash
   npm test
   ```
   - Required for all code changes
   - Must maintain or improve coverage

2. **End-to-End Tests:**
   ```bash
   npm run test:e2e
   ```
   - Required for UI changes
   - Tests homepage sections, navigation, and key user flows

3. **Homepage Structure Tests:**
   ```bash
   npm run test:homepage-sections
   ```
   - Required for homepage changes
   - Validates V6 token compliance

4. **Assessment Harness:**
   ```bash
   npm run assess
   ```
   - Validates routes, navigation, and design invariants
   - Required to pass before merge

### Test-First Development

For new features:
1. Write failing test first
2. Implement minimal code to pass test
3. Refactor while keeping tests green
4. Document test intent

---

## Deployment Procedures

### Cloudflare Pages Deployment

#### Pre-Deployment Checklist

- [ ] All tests passing locally
- [ ] Build completes without errors
- [ ] Assessment harness passes
- [ ] PR approved and merged to main
- [ ] D1 database bindings configured (if applicable)
- [ ] Environment variables set (if applicable)

#### Deployment Process

1. **Automatic deployment** (on merge to main):
   - Cloudflare Pages automatically builds and deploys
   - Build logs available in Cloudflare dashboard
   - Deployment status visible in GitHub Actions

2. **Manual deployment** (if needed):
   ```bash
   npm run build:cf
   npx wrangler pages deploy out
   ```

3. **Post-deployment verification:**
   - Check homepage loads correctly
   - Verify navigation works
   - Test key user flows (Join, Login, Weekly Vote)
   - Confirm Social Wall renders
   - Check footer links

#### Rollback Procedure

If deployment causes issues:

1. **Identify last known good deployment:**
   - Check Cloudflare Pages deployment history
   - Note the commit hash and deployment ID

2. **Execute rollback:**
   - Cloudflare Dashboard → Pages → Deployments
   - Find last good deployment
   - Click "Rollback to this deployment"
   - Or: `npx wrangler pages deployment rollback <deployment-id>`

3. **Document rollback:**
   - Create incident issue
   - Document failure type and symptoms
   - Reference commit that introduced regression
   - Update `/docs/drift-log.md`

4. **Fix forward:**
   - Create fix PR with proper testing
   - Reference rollback incident
   - Include regression tests

---

## Incident Response

### Severity Levels

**P0 - Critical (Site Down):**
- Homepage white screen
- Complete navigation failure
- Production deployment failure
- **Response time:** Immediate
- **Action:** Rollback first, fix forward

**P1 - High (Feature Broken):**
- Login/Join flow broken
- Social Wall not rendering
- Major section missing
- **Response time:** Within 2 hours
- **Action:** Fix or rollback within 4 hours

**P2 - Medium (Degraded Experience):**
- Styling issues
- Minor alignment problems
- Non-critical link broken
- **Response time:** Within 24 hours
- **Action:** Fix in next release

**P3 - Low (Cosmetic):**
- Minor visual inconsistencies
- Documentation typos
- **Response time:** Next sprint
- **Action:** Batch with other fixes

### Incident Response Workflow

1. **Detect:**
   - Automated alerts (nightly assessment)
   - Manual report (user, team member)
   - CI failure notification

2. **Assess:**
   - Determine severity level
   - Identify affected components
   - Check recent deployments

3. **Respond:**
   - P0/P1: Rollback immediately
   - P2/P3: Create issue, schedule fix

4. **Resolve:**
   - Fix root cause
   - Add regression tests
   - Update documentation

5. **Document:**
   - Update `/docs/drift-log.md`
   - Record in issue tracker
   - Share lessons learned

---

## Maintenance Tasks

### Daily

- [ ] Review GitHub Actions status
- [ ] Check nightly assessment results
- [ ] Monitor security alerts
- [ ] Review open PRs

### Weekly

- [ ] Review snapshot diffs
- [ ] Update Weekly Vote content
- [ ] Check dependency updates
- [ ] Review and close stale issues

### Monthly

- [ ] Dependency security audit
- [ ] Review and archive old snapshots (90+ days)
- [ ] Review drift log for patterns
- [ ] Update documentation for any process changes

### Quarterly

- [ ] Full security audit
- [ ] Performance review
- [ ] Documentation completeness check
- [ ] Review and update design standards (if needed)

---

## Quality Gates

### Code Quality

All code must meet:
- ESLint rules (zero errors)
- TypeScript strict mode compliance
- No console.log statements (use proper logging)
- No hardcoded secrets or credentials
- Proper error handling

### Documentation Quality

All documentation must:
- Use consistent terminology
- Include examples where appropriate
- Reference authoritative source docs
- Contain no "..." placeholders
- Stay synchronized with implementation

### Design Quality

All UI changes must:
- Follow LGFC-Production-Design-and-Standards.md
- Maintain navigation invariants
- Preserve locked design tokens
- Pass homepage structure tests
- Include responsive behavior

### Security Quality

All changes must:
- Pass Gitleaks secret scanning
- Not introduce dependency vulnerabilities
- Follow principle of least privilege
- Include proper input validation
- Use secure communication (HTTPS)

---

## References

**Primary Documentation:**
- `/docs/reference/design/LGFC-Production-Design-and-Standards.md` - Authoritative design standards
- `/docs/governance/PR_GOVERNANCE.md` - Operational and rollback standards
- `/.github/pull_request_template.md` - PR structure and formatting
- `docs/reference/design/LGFC-Production-Design-and-Standards.md` - Navigation rules

**Process Documentation:**
- `/.github/pull_request_template.md` - PR template
- `/docs/RECOVERY.md` - Snapshot and rollback procedures
- `/docs/TROUBLESHOOTING.md` - Common issues and solutions

**Technical Documentation:**
- `/docs/ARCHITECTURE_OVERVIEW.md` - System architecture
- `/docs/CLOUDFLARE_PAGES_SETUP.md` - Deployment setup
- `/docs/DEPLOYMENT_GUIDE.md` - Deployment procedures

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-25 | Initial operating manual (ZIP #1) |

---

**END OF OPERATING MANUAL**
