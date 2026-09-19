#!/usr/bin/env node
/**
 * Codex-only agent-configuration validator (#3125 / #3883).
 * Configuration cannot grant authority. Missing required fields fail closed.
 * This check is scoped to .agents/configs, .agents/pilots, and .agents/schemas.
 */

import fs from 'node:fs';
import path from 'node:path';

export const PLACEHOLDER_RE = /^(?:<[^>]+>|____|TODO|TBD)$/i;
export const FORBIDDEN_GRANT_KEYS = [
  'mergeAuthority',
  'productionGo',
  'standingRoleGrant',
  'selfApproval'
];

const REQUIRED_CONFIG_FIELDS = [
  'schema',
  'schemaVersion',
  'product',
  'status',
  'durableRole',
  'roleMappingAuthority',
  'authorityChain',
  'pilotIsolation',
  'cannotGrant'
];

const REQUIRED_ENVELOPE_FIELDS = [
  'schema',
  'schemaVersion',
  'product',
  'sourceIssue',
  'branch',
  'mode',
  'promotionProfile',
  'allowlist',
  'implementer',
  'reviewer',
  'implementationGo',
  'protectedStops'
];

function isBlank(value) {
  if (value == null) return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'string') return value.trim() === '' || PLACEHOLDER_RE.test(value.trim());
  return false;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function addError(errors, message) {
  errors.push(message);
}

export function validateProductConfig(config, { repoRoot, filePath } = {}) {
  const errors = [];
  if (!config || typeof config !== 'object') {
    return { ok: false, errors: ['product config is missing'] };
  }
  if (config.schema !== 'agent-product-config') {
    addError(errors, 'schema must be agent-product-config');
  }
  for (const field of REQUIRED_CONFIG_FIELDS) {
    if (isBlank(config[field])) addError(errors, `missing required field ${field}`);
  }
  for (const key of FORBIDDEN_GRANT_KEYS) {
    if (config[key] != null) addError(errors, `configuration cannot grant ${key}`);
  }
  const routed = config.pilotIsolation?.routedProducts || [];
  const excluded = config.pilotIsolation?.excludedProducts || [];
  if (config.product === 'codex') {
    if (!routed.includes('codex') || routed.length !== 1) {
      addError(errors, 'Codex pilot must route only product "codex"');
    }
    for (const other of ['cursor', 'chatgpt', 'claude-code', 'work']) {
      if (routed.includes(other)) {
        addError(errors, `Codex pilot must not route ${other}`);
      }
      if (!excluded.includes(other)) {
        addError(errors, `Codex pilot must exclude ${other}`);
      }
    }
  }
  const cannotGrantList = Array.isArray(config.cannotGrant) ? config.cannotGrant : [];
  const requiredCannotGrant = ['merge', 'production', 'standing-role', 'self-approval'];
  for (const grant of requiredCannotGrant) {
    if (!cannotGrantList.includes(grant)) {
      addError(errors, `cannotGrant must include ${grant}`);
    }
  }
  if (!Array.isArray(config.authorityChain)) {
    addError(errors, 'authorityChain must be an array');
  } else {
    for (const entry of config.authorityChain) {
      if (isBlank(entry)) addError(errors, 'authorityChain contains a placeholder or empty entry');
    }
  }
  if (config.cannotGrant != null && !Array.isArray(config.cannotGrant)) {
    addError(errors, 'cannotGrant must be an array');
  }
  if (repoRoot) {
    const authorityPaths = [
      config.roleMappingAuthority,
      ...(Array.isArray(config.authorityChain) ? config.authorityChain : [])
    ].filter(Boolean);
    for (const rel of authorityPaths) {
      const abs = path.join(repoRoot, rel);
      if (!fs.existsSync(abs)) {
        addError(errors, `authority reference does not exist: ${rel}`);
      }
    }
  }
  return {
    ok: errors.length === 0,
    errors,
    filePath: filePath || null,
    executable: errors.length === 0
  };
}

export function validateAssignmentEnvelope(envelope, { filePath } = {}) {
  const errors = [];
  const warnings = [];
  if (!envelope || typeof envelope !== 'object') {
    return { ok: false, errors: ['assignment envelope is missing'], executable: false };
  }
  if (envelope.schema !== 'assignment-envelope') {
    addError(errors, 'schema must be assignment-envelope');
  }
  for (const field of REQUIRED_ENVELOPE_FIELDS) {
    if (isBlank(envelope[field])) addError(errors, `missing required field ${field}`);
  }
  if (!Number.isInteger(envelope.sourceIssue) || envelope.sourceIssue < 1) {
    addError(errors, 'sourceIssue must be a positive integer');
  }
  if (
    envelope.implementer &&
    envelope.reviewer &&
    String(envelope.implementer).toLowerCase() === String(envelope.reviewer).toLowerCase()
  ) {
    addError(errors, 'implementer and reviewer must be different');
  }
  if (!Array.isArray(envelope.allowlist)) {
    addError(errors, 'allowlist must be an array');
  } else {
    for (const item of envelope.allowlist) {
      if (isBlank(item)) addError(errors, 'allowlist contains a placeholder or empty path');
    }
  }
  for (const key of FORBIDDEN_GRANT_KEYS) {
    if (envelope[key] != null) addError(errors, `envelope cannot grant ${key}`);
  }
  const VALID_IMPLEMENTATION_GO = ['recorded', 'required-on-source-issue', 'missing'];
  const executable = envelope.implementationGo === 'recorded';
  if (!VALID_IMPLEMENTATION_GO.includes(envelope.implementationGo)) {
    addError(errors, `implementationGo must be one of ${VALID_IMPLEMENTATION_GO.join(', ')}`);
  } else if (envelope.implementationGo === 'missing') {
    addError(errors, 'implementationGo is missing');
  } else if (envelope.implementationGo === 'required-on-source-issue') {
    warnings.push('package is valid but Codex must not edit until Bill records implementation Go on the source Issue');
  }
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    executable: errors.length === 0 && executable,
    filePath: filePath || null
  };
}

export function formatAcknowledgment({ config, envelope, validation }) {
  const lines = [
    'CONFIG ACK',
    `product: ${config?.product || 'missing'}`,
    `configVersion: ${config?.schemaVersion ?? 'missing'}`,
    `sourceIssue: #${envelope?.sourceIssue ?? 'missing'}`,
    `role: ${config?.durableRole || 'missing'}`,
    `branch: ${envelope?.branch || 'missing'}`,
    `startingSha: ${envelope?.startingShaRequired ? 'required' : 'not-required'}`,
    `allowlist: ${(envelope?.allowlist || []).join(', ') || 'missing'}`,
    `reviewer: ${envelope?.reviewer || 'missing'}`,
    `go: ${envelope?.implementationGo || 'missing'}`,
    `validation: ${validation?.ok ? 'pass' : 'fail'}`
  ];
  return lines.join('\n');
}

export function validateRepoTree(repoRoot = process.cwd()) {
  const errors = [];
  const results = [];
  const configPath = path.join(repoRoot, '.agents/configs/codex.json');
  if (!fs.existsSync(configPath)) {
    return {
      ok: true,
      skipped: true,
      errors: [],
      results,
      message: 'no Codex product config present; other agents unaffected'
    };
  }
  const config = readJson(configPath);
  const configResult = validateProductConfig(config, { repoRoot, filePath: configPath });
  results.push(configResult);
  errors.push(...configResult.errors);

  const pilotsDir = path.join(repoRoot, '.agents/pilots/codex');
  if (fs.existsSync(pilotsDir)) {
    for (const name of fs.readdirSync(pilotsDir)) {
      if (!name.endsWith('.json')) continue;
      const filePath = path.join(pilotsDir, name);
      const envelope = readJson(filePath);
      const envelopeResult = validateAssignmentEnvelope(envelope, { filePath });
      results.push(envelopeResult);
      errors.push(...envelopeResult.errors);
    }
  }

  const templatePath = path.join(repoRoot, '.agents/templates/assignment-envelope.template.json');
  if (fs.existsSync(templatePath)) {
    const template = readJson(templatePath);
    if (template.schema !== 'assignment-envelope') {
      errors.push('assignment envelope template has invalid schema');
    }
  }

  return {
    ok: errors.length === 0,
    skipped: false,
    errors,
    results
  };
}

function main() {
  const repoRoot = process.argv[2] || process.cwd();
  const result = validateRepoTree(repoRoot);
  if (result.skipped) {
    console.log(result.message);
    process.exit(0);
  }
  if (!result.ok) {
    console.error('agent-config validation failed:');
    for (const error of result.errors) console.error(`- ${error}`);
    process.exit(1);
  }
  const config = readJson(path.join(repoRoot, '.agents/configs/codex.json'));
  const envelopePath = path.join(repoRoot, '.agents/pilots/codex/3124-skeetersoft.json');
  const envelope = fs.existsSync(envelopePath) ? readJson(envelopePath) : null;
  console.log(formatAcknowledgment({ config, envelope, validation: result }));
}

const invoked = process.argv[1] && path.basename(process.argv[1]) === 'agent_config_validate.mjs';
if (invoked) main();
