#!/usr/bin/env node

import fs from 'node:fs';
import { classifyDeliveryProfile } from './delivery_profile.mjs';
import { parsePrClass, VALID_PR_CLASSES } from './pr_hygiene_audit.mjs';

export const QUALITY_PROFILES = {
  'docs-governance': {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
    reason: 'governance docs do not require production build unless paired with code changes',
  },
  'docs-content': {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
    reason: 'content/docs-only changes do not require production build by default',
  },
  code: {
    typecheck: true,
    lint: true,
    test: true,
    build: true,
    reason: 'code changes require full quality path',
  },
  config: {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
    reason: 'configuration changes do not require production build by default',
  },
  ci: {
    typecheck: true,
    lint: true,
    test: true,
    build: false,
    reason: 'CI/governance changes use static checks and targeted tests during transition',
  },
  release: {
    typecheck: true,
    lint: true,
    test: true,
    build: true,
    reason: 'release changes require full quality path',
  },
  ops: {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
    reason: 'ops-only changes do not require production build by default',
  },
  'mixed-approved': {
    typecheck: true,
    lint: true,
    test: true,
    build: true,
    reason: 'mixed approved changes require full quality path',
  },
};

export const DELIVERY_QUALITY_MINIMUMS = {
  'production-candidate': {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
    fullBuildPrClasses: ['code', 'release', 'mixed-approved'],
  },
  'component-child': {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
    protectedRequires: { test: true, build: true },
  },
  'component-promotion': {
    typecheck: true,
    lint: true,
    test: true,
    build: true,
  },
  'emergency-recovery': {
    typecheck: true,
    lint: true,
    test: false,
    build: false,
  },
  // Model C: deliberately lighter — no production build/test solely for documentation.
  documentation: {
    typecheck: false,
    lint: false,
    test: false,
    build: false,
  },
};

export function normalizePrClass(value = '') {
  const cleaned = String(value || '').trim().replace(/<!--([\s\S]*?)-->/g, '').trim();
  return VALID_PR_CLASSES.includes(cleaned) ? cleaned : '';
}

function stricterFlag(left, right) {
  return Boolean(left || right);
}

function applyDeliveryMinimums(plan, deliveryProfile = {}) {
  const gateProfile = deliveryProfile.gateProfile || '';
  const minimums = DELIVERY_QUALITY_MINIMUMS[gateProfile];
  const merged = {
    ...plan,
    deliveryGateProfile: gateProfile,
    deliveryModel: deliveryProfile.deliveryModel || '',
    protectedChange: Boolean(deliveryProfile.protectedChange),
    deliveryProfileValid: !deliveryProfile.errors?.length,
  };

  if (!minimums) {
    return merged;
  }

  // Model C documentation gate: do not escalate to code build/test via PR class defaults.
  if (gateProfile === 'documentation' && deliveryProfile.deliveryModel === 'C') {
    merged.typecheck = false;
    merged.lint = false;
    merged.test = false;
    merged.build = false;
    merged.reason = 'Model C documentation gate skips code build/test/typecheck/lint; path and DIATAXIS gates enforce docs boundary';
    return merged;
  }

  merged.typecheck = stricterFlag(plan.typecheck, minimums.typecheck);
  merged.lint = stricterFlag(plan.lint, minimums.lint);
  merged.test = stricterFlag(plan.test, minimums.test);
  merged.build = stricterFlag(plan.build, minimums.build);

  if (gateProfile === 'production-candidate' && minimums.fullBuildPrClasses?.includes(plan.prClass)) {
    merged.test = true;
    merged.build = true;
  }

  if (gateProfile === 'component-child' && deliveryProfile.protectedChange) {
    merged.test = stricterFlag(merged.test, minimums.protectedRequires?.test);
    merged.build = stricterFlag(merged.build, minimums.protectedRequires?.build);
  }

  if (gateProfile === 'component-promotion') {
    merged.test = true;
    merged.build = true;
  }

  return merged;
}

export function determineQualityPlan({
  body = '',
  prClass = '',
  deliveryProfile = null,
  baseRef = '',
  headRef = '',
  changedFiles = undefined,
} = {}) {
  const normalized = normalizePrClass(prClass || parsePrClass(body));
  const selectedClass = normalized || 'code';
  const profile = QUALITY_PROFILES[selectedClass] || QUALITY_PROFILES.code;
  const basePlan = {
    prClass: selectedClass,
    explicitPrClass: Boolean(normalized),
    ...profile,
  };

  const resolvedDeliveryProfile = deliveryProfile || classifyDeliveryProfile({
    baseRef,
    headRef,
    body,
    changedFiles,
  });

  return applyDeliveryMinimums(basePlan, resolvedDeliveryProfile);
}

export function renderQualityPlan(plan) {
  const lines = [
    `PR class: ${plan.prClass}`,
    `Explicit PR class: ${plan.explicitPrClass ? 'yes' : 'no'}`,
    `Delivery gate profile: ${plan.deliveryGateProfile || 'unknown'}`,
    `Delivery model: ${plan.deliveryModel || 'unknown'}`,
    `Protected change: ${plan.protectedChange ? 'yes' : 'no'}`,
    `Run typecheck: ${plan.typecheck ? 'yes' : 'no'}`,
    `Run lint: ${plan.lint ? 'yes' : 'no'}`,
    `Run unit tests: ${plan.test ? 'yes' : 'no'}`,
    `Run production build: ${plan.build ? 'yes' : 'no'}`,
    `Reason: ${plan.reason}`,
  ];

  if (plan.deliveryProfileValid === false) {
    lines.push('Delivery profile valid: no');
  }

  return lines.join('\n');
}

function readDeliveryProfile(env) {
  const jsonPath = env.DELIVERY_PROFILE_JSON;
  if (!jsonPath || !fs.existsSync(jsonPath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
}

function readChangedFiles(env) {
  const changedFilesPath = env.CHANGED_FILES_FILE;
  if (!changedFilesPath || !fs.existsSync(changedFilesPath)) {
    return undefined;
  }
  return fs.readFileSync(changedFilesPath, 'utf8').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

export function runCli(env = process.env) {
  const bodyPath = env.PR_CLASS_BODY_FILE || env.PR_HYGIENE_BODY_FILE;
  const body = bodyPath && fs.existsSync(bodyPath) ? fs.readFileSync(bodyPath, 'utf8') : '';
  const plan = determineQualityPlan({
    body,
    prClass: env.PR_CLASS || '',
    deliveryProfile: readDeliveryProfile(env),
    baseRef: env.PR_BASE_REF || '',
    headRef: env.PR_HEAD_REF || '',
    changedFiles: readChangedFiles(env),
  });
  const output = renderQualityPlan(plan);
  console.log(output);

  if (env.GITHUB_OUTPUT) {
    fs.appendFileSync(env.GITHUB_OUTPUT, `pr_class=${plan.prClass}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `delivery_gate_profile=${plan.deliveryGateProfile || ''}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `delivery_model=${plan.deliveryModel || ''}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `protected_change=${plan.protectedChange ? 'true' : 'false'}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `run_typecheck=${plan.typecheck ? 'true' : 'false'}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `run_lint=${plan.lint ? 'true' : 'false'}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `run_test=${plan.test ? 'true' : 'false'}\n`);
    fs.appendFileSync(env.GITHUB_OUTPUT, `run_build=${plan.build ? 'true' : 'false'}\n`);
  }

  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = runCli();
}
