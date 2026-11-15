import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { classifyDeliveryProfile, runCli as runDeliveryProfileCli } from '../../../scripts/ci/delivery_profile.mjs';
import { evaluateComponentIntegration } from '../../../scripts/ci/component_integration_eligibility.mjs';
import {
  evaluateMigrationRatchet,
  parseDispositionMap,
} from '../../../scripts/ci/diataxis_migration_ratchet.mjs';
import { evaluatePrPreflight } from '../../../scripts/ci/pr_preflight.mjs';
import {
  FIXTURE_DISPOSITION_MAP,
  LEGACY_HEADER,
  MULTI_STEP_ROLLBACK_FIELDS,
  ONE_STEP_ROLLBACK_FIELDS,
  PROMOTION_PACKAGE_FIELDS,
  assertRollbackFailsWhenOmitted,
  assertRollbackFailsWhenReordered,
  missingEvidenceFields,
  parseEvidenceBlock,
  prBody,
  runOrderedRollbackSimulation,
} from './helpers.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function codes(items = []) {
  return items.map((item) => item.code);
}

function greenChecks() {
  return [
    { name: 'GATE — Quality Checks', conclusion: 'success' },
    { name: 'GATE — Diff Scope', conclusion: 'success' },
  ];
}

function eligibleChildProfile(overrides = {}) {
  return {
    deliveryModel: 'B-child',
    gateProfile: 'component-child',
    approvalProfile: 'component-auto-integration',
    componentBranch: 'component/delivery-system-v1',
    componentMaster: '#2477',
    protectedChange: false,
    errors: [],
    baseRef: 'component/delivery-system-v1',
    baseBehindComponentHead: 0,
    ...overrides,
  };
}

export const SCENARIOS = [
  {
    id: 1,
    name: 'Small Model A documentation change',
    run() {
      const result = classifyDeliveryProfile({
        baseRef: 'main',
        headRef: 'cursor/model-a-docs',
        body: prBody({
          size: 'small',
          deliveryModel: 'A',
          intentLabel: 'docs-only',
          prClass: 'docs-governance',
        }),
        changedFiles: ['docs/reference/ci/delivery-profile-contract.md'],
      });
      assert(result.errors.length === 0, `unexpected errors: ${JSON.stringify(result.errors)}`);
      assert(result.deliveryModel === 'A', 'expected Model A');
      assert(result.rollbackProfile === 'one-step', 'expected one-step rollback');
      assert(result.protectedChange === false, 'docs-only Model A should not be protected');
    },
  },
  {
    id: 2,
    name: 'Small Model A code change',
    run() {
      const result = classifyDeliveryProfile({
        baseRef: 'main',
        headRef: 'cursor/model-a-code',
        body: prBody({
          size: 'small',
          deliveryModel: 'A',
          intentLabel: 'intent:feature',
          prClass: 'code',
        }),
        changedFiles: ['src/components/example.tsx'],
      });
      assert(result.errors.length === 0, `unexpected errors: ${JSON.stringify(result.errors)}`);
      assert(result.deliveryModel === 'A', 'expected Model A');
      assert(result.gateProfile === 'production-candidate', 'expected production-candidate gate');
    },
  },
  {
    id: 3,
    name: 'Eligible Model B child auto-integrates',
    run() {
      const result = evaluateComponentIntegration({
        profile: eligibleChildProfile(),
        checks: greenChecks(),
        reviews: [],
        componentState: 'green',
        labels: [],
        changedFiles: ['src/components/example.tsx'],
      });
      assert(result.eligible === true, `expected eligible: ${JSON.stringify(result.blockedReasons)}`);
      assert(result.requiresChatReview === false, 'eligible child must not require Work review');
    },
  },
  {
    id: 4,
    name: 'Failed Model B child does not integrate',
    run() {
      const result = evaluateComponentIntegration({
        profile: eligibleChildProfile(),
        checks: [
          { name: 'GATE — Quality Checks', conclusion: 'failure' },
          { name: 'GATE — Diff Scope', conclusion: 'success' },
        ],
        componentState: 'green',
        changedFiles: ['src/components/example.tsx'],
      });
      assert(result.eligible === false, 'failed checks must block integration');
      assert(codes(result.blockedReasons).includes('failed_check'), 'expected failed_check');
    },
  },
  {
    id: 5,
    name: 'Protected Model B child pauses for Work review',
    run() {
      const body = prBody({
        deliveryModel: 'B-child',
        targetEnvironment: 'component',
        approvalProfile: 'protected-change-review',
        gateProfile: 'component-child',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
      });
      const result = evaluateComponentIntegration({
        profile: {
          body,
          baseRef: 'component/delivery-system-v1',
          headRef: 'cursor/protected-child',
          baseBehindComponentHead: 0,
        },
        checks: greenChecks(),
        componentState: 'green',
        changedFiles: ['.github/workflows/component-child-integration.yml'],
      });
      assert(result.eligible === false, 'protected child must not auto-integrate');
      assert(result.requiresChatReview === true, 'protected child requires Work review');
      assert(codes(result.blockedReasons).includes('protected_change'), 'expected protected_change');
    },
  },
  {
    id: 6,
    name: 'Component red state blocks successor',
    run() {
      const result = evaluateComponentIntegration({
        profile: eligibleChildProfile(),
        checks: greenChecks(),
        componentState: 'red',
        changedFiles: ['src/components/example.tsx'],
      });
      assert(result.eligible === false, 'red component must block');
      assert(codes(result.blockedReasons).includes('component_red_state'), 'expected component_red_state');
    },
  },
  {
    id: 7,
    name: 'Model B promotion requires complete child, evidence, and rollback package',
    run() {
      const incompleteBody = prBody({
        deliveryModel: 'B-promotion',
        targetEnvironment: 'production',
        approvalProfile: 'cmo-production',
        gateProfile: 'component-promotion',
        rollbackProfile: 'multi-step',
        componentBranch: 'component/delivery-system-v1',
        componentMaster: '#2477',
        extra: `
## Promotion package

integrated_children_complete: no
pilot_evidence_path: missing
package_finalized_before_promotion: no
`,
      });
      const profile = classifyDeliveryProfile({
        baseRef: 'main',
        headRef: 'component/delivery-system-v1',
        body: incompleteBody,
        changedFiles: ['docs/ops/reports/delivery-system-v1-pilot-evidence.md'],
      });
      assert(profile.errors.length === 0, `profile errors: ${JSON.stringify(profile.errors)}`);
      assert(profile.deliveryModel === 'B-promotion', 'expected B-promotion');

      const incompleteFields = parseEvidenceBlock(incompleteBody);
      const missing = missingEvidenceFields(incompleteFields, PROMOTION_PACKAGE_FIELDS);
      assert(missing.length > 0, 'incomplete package must be rejected');

      const completePackage = `
release_unit: component/delivery-system-v1
rollback_trigger: promotion verification failure or production smoke failure
disablement_steps: pause new automation workflows
external_write_stops: none beyond GitHub Actions pause
config_restoration: restore branch protection and ruleset snapshot
data_restoration: not-applicable
deployment_restoration: restore pre-promotion Cloudflare deployment
dependency_order: 1 pause automation; 2 revert promotion; 3 restore config; 4 verify
verification_checklist: production routes; required checks; ruleset state
reconciliation: reopen #2502 if promotion rolled back
package_owner: Work
package_finalized_before_promotion: yes
integrated_children_complete: yes
pilot_evidence_path: docs/ops/reports/delivery-system-v1-pilot-evidence.md
authority_disposition_complete: yes
`;
      const completeMissing = missingEvidenceFields(
        parseEvidenceBlock(completePackage),
        PROMOTION_PACKAGE_FIELDS,
      );
      assert(completeMissing.length === 0, `complete package missing: ${completeMissing.join(', ')}`);
    },
  },
  {
    id: 8,
    name: 'Emergency recovery bypasses normal migration blocking but creates follow-up',
    run() {
      const body = prBody({
        deliveryModel: 'emergency-recovery',
        changeMode: 'emergency',
        targetEnvironment: 'recovery',
        approvalProfile: 'emergency-approval',
        gateProfile: 'emergency-recovery',
        rollbackProfile: 'emergency-stabilization',
        componentBranch: 'not-applicable',
        componentMaster: 'not-applicable',
        extra: `
Follow-up issue required: YES
Follow-up issue: #2599
`,
      });
      const report = evaluateMigrationRatchet({
        changedFiles: [{ path: 'docs/governance/legacy-emergency-source.md', status: 'modified' }],
        fileSnapshots: {
          'docs/governance/legacy-emergency-source.md': {
            before: `${LEGACY_HEADER}\nOld.\n`,
            after: `${LEGACY_HEADER}\nEmergency hotfix content.\n`,
          },
        },
        dispositionEntries: parseDispositionMap(FIXTURE_DISPOSITION_MAP),
        prBody: body,
      });
      assert(report.emergencyDeferral === true, 'expected emergency deferral');
      assert(
        report.findings.every((finding) => finding.code === 'EMERGENCY_DEFERRAL' || finding.severity === 'warning'),
        `unexpected hard failures: ${JSON.stringify(report.findings)}`,
      );
      assert(
        codes(report.findings).includes('EMERGENCY_DEFERRAL'),
        'expected EMERGENCY_DEFERRAL warning',
      );

      const missingFollowUp = evaluateMigrationRatchet({
        changedFiles: [{ path: 'docs/governance/legacy-emergency-source.md', status: 'modified' }],
        fileSnapshots: {
          'docs/governance/legacy-emergency-source.md': {
            before: `${LEGACY_HEADER}\nOld.\n`,
            after: `${LEGACY_HEADER}\nEmergency hotfix content.\n`,
          },
        },
        dispositionEntries: parseDispositionMap(FIXTURE_DISPOSITION_MAP),
        prBody: prBody({
          deliveryModel: 'emergency-recovery',
          changeMode: 'emergency',
          targetEnvironment: 'recovery',
          approvalProfile: 'emergency-approval',
          gateProfile: 'emergency-recovery',
          rollbackProfile: 'emergency-stabilization',
        }),
      });
      assert(
        codes(missingFollowUp.findings).includes('EMERGENCY_FOLLOW_UP_REQUIRED'),
        'missing follow-up must fail',
      );
    },
  },
  {
    id: 9,
    name: 'Header-only legacy edit fails the migration ratchet',
    run() {
      const report = evaluateMigrationRatchet({
        changedFiles: [{ path: 'docs/governance/legacy-header-only.md', status: 'modified' }],
        fileSnapshots: {
          'docs/governance/legacy-header-only.md': {
            before: `${LEGACY_HEADER}\nBody stays the same.\n`,
            after: LEGACY_HEADER.replace('2026-07-13', '2026-07-14') + '\nBody stays the same.\n',
          },
        },
        dispositionEntries: parseDispositionMap(FIXTURE_DISPOSITION_MAP),
        prBody: prBody({ deliveryModel: 'A' }),
      });
      assert(report.ok === false, 'header-only change must fail ratchet');
      assert(
        codes(report.findings).includes('HEADER_ONLY_INCOMPLETE'),
        'expected HEADER_ONLY_INCOMPLETE',
      );
    },
  },
  {
    id: 10,
    name: 'Preflight and CI produce identical classification',
    run() {
      const input = {
        baseRef: 'component/delivery-system-v1',
        headRef: 'cursor/parity-child',
        body: prBody({
          deliveryModel: 'B-child',
          targetEnvironment: 'component',
          approvalProfile: 'component-auto-integration',
          gateProfile: 'component-child',
          rollbackProfile: 'multi-step',
          componentBranch: 'component/delivery-system-v1',
          componentMaster: '#2477',
        }),
        changedFiles: ['src/components/example.tsx'],
      };

      // Local/preflight path: in-process evaluator used by `npm run pr:preflight`.
      const localPreflight = evaluatePrPreflight({
        body: input.body,
        baseRef: input.baseRef,
        headRef: input.headRef,
        changedFiles: input.changedFiles,
        repository: 'wdhunter645/next-starter-template',
      });
      const localProfile = localPreflight.deliveryProfile;

      // CI/CLI path: file-based wrapper that Actions jobs invoke via env files.
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-system-parity-'));
      const bodyFile = path.join(tmpDir, 'pr_body.md');
      const changedFilesFile = path.join(tmpDir, 'changed_files.txt');
      const resultFile = path.join(tmpDir, 'delivery_profile.json');
      try {
        fs.writeFileSync(bodyFile, input.body);
        fs.writeFileSync(changedFilesFile, `${input.changedFiles.join('\n')}\n`);
        const exitCode = runDeliveryProfileCli({
          PR_BODY_FILE: bodyFile,
          CHANGED_FILES_FILE: changedFilesFile,
          PR_BASE_REF: input.baseRef,
          PR_HEAD_REF: input.headRef,
          DELIVERY_PROFILE_RESULT_JSON: resultFile,
        });
        assert(exitCode === 0, `CI delivery-profile CLI failed with exit ${exitCode}`);
        const ciProfile = JSON.parse(fs.readFileSync(resultFile, 'utf8'));

        const localSummary = {
          deliveryModel: localProfile.deliveryModel,
          gateProfile: localProfile.gateProfile,
          approvalProfile: localProfile.approvalProfile,
          rollbackProfile: localProfile.rollbackProfile,
          protectedChange: localProfile.protectedChange,
          errors: localProfile.errors,
        };
        const ciSummary = {
          deliveryModel: ciProfile.deliveryModel,
          gateProfile: ciProfile.gateProfile,
          approvalProfile: ciProfile.approvalProfile,
          rollbackProfile: ciProfile.rollbackProfile,
          protectedChange: ciProfile.protectedChange,
          errors: ciProfile.errors,
        };
        assert(
          JSON.stringify(localSummary) === JSON.stringify(ciSummary),
          `local/preflight vs CI/CLI classification diverged: ${JSON.stringify({ localSummary, ciSummary })}`,
        );
        assert(localProfile.errors.length === 0, `local profile errors: ${JSON.stringify(localProfile.errors)}`);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  },
  {
    id: 11,
    name: 'Model A one-step rollback simulation succeeds',
    run() {
      const evidence = `
rollback_target_type: revert-commit
rollback_target_ref: 8bf68e7de29c780feeecd398e5496817b2ee000d
smoke_tests: 1 homepage; 2 health endpoint; 3 required GitHub checks
verification_owner: Work
`;
      const fields = parseEvidenceBlock(evidence);
      const missing = missingEvidenceFields(fields, ONE_STEP_ROLLBACK_FIELDS);
      assert(missing.length === 0, `missing one-step fields: ${missing.join(', ')}`);

      const steps = [
        {
          id: 'revert',
          apply: (state) => {
            if (state.deployedSha !== 'bad') {
              throw new Error('one-step revert requires a known bad deployment pointer');
            }
            return { ...state, deployedSha: fields.rollback_target_ref, reverted: true };
          },
        },
        {
          id: 'smoke',
          apply: (state) => {
            if (!state.reverted) throw new Error('smoke requires revert first');
            return { ...state, smokePassed: true };
          },
        },
        {
          id: 'verify',
          apply: (state) => {
            if (!state.smokePassed) throw new Error('verify requires smoke');
            return { ...state, verified: true, lastStep: 'verify' };
          },
        },
      ];

      const result = runOrderedRollbackSimulation({
        initialState: { deployedSha: 'bad', reverted: false, smokePassed: false, verified: false },
        steps,
        expectedAfterEach: [
          { reverted: true },
          { smokePassed: true },
          { verified: true },
        ],
        expectedFinal: { verified: true, deployedSha: fields.rollback_target_ref },
      });
      assert(result.ok === true, 'one-step dry-run must succeed');
      assertRollbackFailsWhenOmitted({
        initialState: { deployedSha: 'bad', reverted: false, smokePassed: false, verified: false },
        steps,
        omitStepId: 'smoke',
      });
      assertRollbackFailsWhenReordered({
        initialState: { deployedSha: 'bad', reverted: false, smokePassed: false, verified: false },
        steps,
      });
    },
  },
  {
    id: 12,
    name: 'Model B ordered rollback simulation succeeds',
    run() {
      const evidence = `
release_unit: component/delivery-system-v1
rollback_trigger: component red state or failed promotion verification
disablement_steps: disable component-child-integration workflow dispatch path
external_write_stops: pause write routes that mutate production-shared resources
config_restoration: restore .github workflows and ruleset snapshot from pre-promotion SHA
data_restoration: retain forward-compatible migrations; no destructive rollback required
deployment_restoration: redeploy Cloudflare Pages artifact from pre-promotion commit
dependency_order: 1 disablement; 2 external writes; 3 config; 4 deployment; 5 verify; 6 reconcile
verification_checklist: component green; production routes; required checks
reconciliation: update #2477/#2501/#2502 status from live evidence
package_owner: Work
package_finalized_before_promotion: yes
`;
      const fields = parseEvidenceBlock(evidence);
      const missing = missingEvidenceFields(fields, MULTI_STEP_ROLLBACK_FIELDS);
      assert(missing.length === 0, `missing multi-step fields: ${missing.join(', ')}`);
      assert(fields.package_finalized_before_promotion === 'yes', 'package must be finalized');

      const steps = [
        {
          id: 'disablement',
          apply: (state) => ({ ...state, automationPaused: true, lastStep: 'disablement' }),
        },
        {
          id: 'external_writes',
          apply: (state) => {
            if (!state.automationPaused) throw new Error('external write stop requires disablement first');
            return { ...state, writesStopped: true, lastStep: 'external_writes' };
          },
        },
        {
          id: 'config',
          apply: (state) => {
            if (!state.writesStopped) throw new Error('config restore requires write stops first');
            return { ...state, configRestored: true, lastStep: 'config' };
          },
        },
        {
          id: 'deployment',
          apply: (state) => {
            if (!state.configRestored) throw new Error('deployment restore requires config first');
            return { ...state, deploymentRestored: true, lastStep: 'deployment' };
          },
        },
        {
          id: 'verify',
          apply: (state) => {
            if (!state.deploymentRestored) throw new Error('verify requires deployment restore');
            return { ...state, verified: true, lastStep: 'verify' };
          },
        },
        {
          id: 'reconcile',
          apply: (state) => {
            if (!state.verified) throw new Error('reconcile requires verification');
            return { ...state, reconciled: true, lastStep: 'reconcile' };
          },
        },
      ];

      const result = runOrderedRollbackSimulation({
        initialState: {
          automationPaused: false,
          writesStopped: false,
          configRestored: false,
          deploymentRestored: false,
          verified: false,
          reconciled: false,
        },
        steps,
        expectedAfterEach: [
          { automationPaused: true },
          { writesStopped: true },
          { configRestored: true },
          { deploymentRestored: true },
          { verified: true },
          { reconciled: true },
        ],
        expectedFinal: { reconciled: true, verified: true },
      });
      assert(result.ok === true, 'multi-step dry-run must succeed');
      assertRollbackFailsWhenOmitted({
        initialState: {
          automationPaused: false,
          writesStopped: false,
          configRestored: false,
          deploymentRestored: false,
          verified: false,
          reconciled: false,
        },
        steps,
        omitStepId: 'config',
      });
      assertRollbackFailsWhenReordered({
        initialState: {
          automationPaused: false,
          writesStopped: false,
          configRestored: false,
          deploymentRestored: false,
          verified: false,
          reconciled: false,
        },
        steps,
      });
    },
  },
];
