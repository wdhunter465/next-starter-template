#!/usr/bin/env node
/**
 * Bridge Watch — classify live Bridge health and repository-to-host drift (#2814).
 * Healthy results stay quiet. Non-healthy results are deduplicated.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { loadConfig, bridgeHome, ensureDirs } from './lib/paths.mjs';
import { atomicWriteJson } from './lib/atomic-write.mjs';
import { collectStatus } from './lib/status.mjs';
import { evaluateHealth } from './watchdog.mjs';
import { readClaim, isClaimActive } from './lib/claim.mjs';
import { readInFlight } from './lib/launch-transaction.mjs';
import { readHeartbeat } from './lib/heartbeat.mjs';
import { freeDiskMb } from './lib/atomic-write.mjs';
import { cliAuthPreflight, resolveWorkspace } from './lib/launch.mjs';
import { appendAlert, appendBridgeLog, notifyLocal, postIssueComment } from './lib/notify.mjs';
import {
  comparePackageManifests,
  computeInstalledManifest,
  computeRepoManifest,
  defaultRepoRoot,
  readInstalledIdentity,
  secretSafeIdentity,
} from './lib/package-identity.mjs';

export const WATCH_CLASSIFICATIONS = Object.freeze([
  'healthy',
  'rebuild_required',
  'rebuild_deferred',
  'manual_review_required',
  'failed',
]);

export function maintenanceResultPath(config) {
  return path.join(bridgeHome(), config.maintenance?.resultPath || 'maintenance-result.json');
}

export function maintenanceAlertStatePath(config) {
  return path.join(bridgeHome(), config.maintenance?.alertStatePath || 'maintenance-alert-state.json');
}

export function readMaintenanceResult(config) {
  const p = maintenanceResultPath(config);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

export function readMaintenanceAlertState(config) {
  const p = maintenanceAlertStatePath(config);
  if (!fs.existsSync(p)) return { lastFingerprint: null, lastAlertAt: null };
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    return {
      lastFingerprint: typeof raw.lastFingerprint === 'string' ? raw.lastFingerprint : null,
      lastAlertAt: typeof raw.lastAlertAt === 'string' ? raw.lastAlertAt : null,
    };
  } catch {
    return { lastFingerprint: null, lastAlertAt: null };
  }
}

function writeMaintenanceAlertState(config, state) {
  atomicWriteJson(maintenanceAlertStatePath(config), state, 0o600);
}

function unitActive(unit) {
  const r = spawnSync('systemctl', ['--user', 'is-active', unit], { encoding: 'utf8' });
  return (r.stdout || '').trim() === 'active';
}

function timerActive(unit) {
  const r = spawnSync('systemctl', ['--user', 'is-active', unit], { encoding: 'utf8' });
  return (r.stdout || '').trim() === 'active';
}

function ghAuthOk() {
  const r = spawnSync('gh', ['auth', 'status'], { encoding: 'utf8' });
  return r.status === 0 && /Logged in to/i.test(`${r.stdout || ''}${r.stderr || ''}`);
}

/**
 * Detect protected active work that must defer rebuild/promotion.
 * @param {object} config
 * @param {{ claim?: object | null, inFlight?: object | null }} [opts]
 */
export function detectActiveWork(config, { claim = null, inFlight = null } = {}) {
  const ttl = config.claimTtlSeconds || 7200;
  const activeClaim = claim && isClaimActive(claim, ttl);
  const state = inFlight?.state || null;
  const protectedStates = new Set(['cli_spawned', 'accepted', 'running', 'claimed']);
  const inFlightActive = Boolean(state && protectedStates.has(state));
  if (!activeClaim && !inFlightActive) {
    return { active: false, reason: null, claim: null, inFlight: null };
  }
  const reasons = [];
  if (activeClaim) reasons.push('active_claim');
  if (inFlightActive) reasons.push(`in_flight:${state}`);
  return {
    active: true,
    reason: reasons.join(','),
    claim: activeClaim
      ? {
          issueNumber: claim.issueNumber,
          resumeCommentId: claim.resumeCommentId,
          acquiredAt: claim.acquiredAt,
        }
      : null,
    inFlight: inFlightActive
      ? {
          state,
          issueNumber: inFlight.issueNumber || null,
          resumeCommentId: inFlight.resumeCommentId || null,
        }
      : null,
  };
}

export function fingerprintWatchResult(result) {
  return [
    result.classification,
    (result.reasons || []).slice().sort().join('|'),
    result.sourceCommit || '',
    result.packageHash || '',
    result.activeWork?.reason || '',
  ].join('::');
}

/**
 * Pure classification helper for tests.
 */
export function classifyWatchOutcome({
  health,
  drift,
  activeWork,
  identityAmbiguous = false,
  schemaIncompatible = false,
}) {
  if (schemaIncompatible || identityAmbiguous) {
    return {
      classification: 'manual_review_required',
      reasons: [
        ...(schemaIncompatible ? ['incompatible_schema'] : []),
        ...(identityAmbiguous ? ['ambiguous_package_identity'] : []),
      ],
    };
  }
  if (!health?.healthy && health?.failures?.length) {
    const restartable = health.restartNeeded;
    if (restartable && activeWork?.active) {
      return {
        classification: 'rebuild_deferred',
        reasons: [`runtime_unhealthy:${health.failures.join(',')}`, `active_work:${activeWork.reason}`],
      };
    }
    if (restartable || health.failures.some((f) => /service_inactive|heartbeat_/.test(f))) {
      return {
        classification: 'failed',
        reasons: health.failures.slice(),
      };
    }
  }
  if (drift?.classification === 'manual_review_required') {
    return {
      classification: 'manual_review_required',
      reasons: [drift.reason || 'ambiguous_package_identity'],
    };
  }
  if (drift?.classification === 'rebuild_required' || (drift && !drift.match)) {
    if (activeWork?.active) {
      return {
        classification: 'rebuild_deferred',
        reasons: ['repository_to_host_drift', `active_work:${activeWork.reason}`],
      };
    }
    return {
      classification: 'rebuild_required',
      reasons: ['repository_to_host_drift', ...(drift.drifted || []).slice(0, 8)],
    };
  }
  if (!health?.healthy) {
    return {
      classification: 'failed',
      reasons: health.failures?.slice() || ['runtime_unhealthy'],
    };
  }
  return { classification: 'healthy', reasons: [] };
}

function resolveSourceCommit(explicit, repoRoot) {
  if (explicit && /^[0-9a-f]{40}$/i.test(explicit)) return explicit.toLowerCase();
  if (explicit && /^[0-9a-f]{7,40}$/i.test(explicit)) {
    const r = spawnSync('git', ['-C', repoRoot, 'rev-parse', explicit], { encoding: 'utf8' });
    if (r.status === 0) return (r.stdout || '').trim().toLowerCase();
  }
  const r = spawnSync('git', ['-C', repoRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' });
  if (r.status === 0) return (r.stdout || '').trim().toLowerCase();
  return null;
}

/**
 * Run Bridge Watch. deps may inject status/health/manifests for tests.
 */
export function runBridgeWatch(config, opts = {}) {
  const dirs = ensureDirs(config);
  const repoRoot = opts.repoRoot || defaultRepoRoot();
  const sourceCommit =
    opts.sourceCommit ||
    resolveSourceCommit(opts.sourceCommitHint || process.env.LGFC_BRIDGE_SOURCE_COMMIT, repoRoot);

  const claim = opts.claim !== undefined ? opts.claim : readClaim(config);
  const inFlight = opts.inFlight !== undefined ? opts.inFlight : readInFlight(config);
  const activeWork = opts.activeWork || detectActiveWork(config, { claim, inFlight });

  const heartbeat = opts.heartbeat !== undefined ? opts.heartbeat : readHeartbeat(config);
  const workspace = opts.workspacePath || resolveWorkspace(config);
  const cursor = opts.cursorAuth || cliAuthPreflight(config);

  let queueRw = false;
  try {
    fs.accessSync(dirs.queue, fs.constants.R_OK | fs.constants.W_OK);
    queueRw = true;
  } catch {
    queueRw = false;
  }

  const bridgeUnit = config.watchdog?.bridgeUnit || 'lgfc-cursor-bridge.service';
  const watchdogTimer = config.maintenance?.watchdogTimerUnit || 'lgfc-cursor-bridge-watchdog.timer';

  const health =
    opts.health ||
    evaluateHealth(config, {
      serviceActive: opts.serviceActive ?? unitActive(bridgeUnit),
      heartbeat,
      queueReadableWritable: queueRw,
      workspacePresent: fs.existsSync(workspace),
      ghAuthOk: opts.ghAuthOk ?? ghAuthOk(),
      cursorAuthOk: cursor.ok,
      claim,
      diskMb: opts.diskMb ?? freeDiskMb(dirs.home),
    });

  const timerOk = opts.watchdogTimerActive ?? timerActive(watchdogTimer);
  if (!timerOk) {
    health.healthy = false;
    health.failures = [...(health.failures || []), `watchdog_timer_inactive:${watchdogTimer}`];
  }

  let schemaIncompatible = false;
  try {
    const cfgPath = path.join(dirs.home, 'bridge.json');
    if (fs.existsSync(cfgPath)) {
      const installedCfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
      if (installedCfg.schemaVersion !== config.schemaVersion) schemaIncompatible = true;
    }
  } catch {
    schemaIncompatible = true;
  }

  const expected =
    opts.expectedManifest || computeRepoManifest(repoRoot, sourceCommit);
  const actual =
    opts.actualManifest || computeInstalledManifest(dirs.home, readInstalledIdentity(config)?.sourceCommit || null);
  const drift = opts.drift || comparePackageManifests(expected, actual);

  const identityAmbiguous =
    !expected.ok ||
    !actual.ok ||
    drift.classification === 'manual_review_required' ||
    !sourceCommit;

  const classified = classifyWatchOutcome({
    health,
    drift,
    activeWork,
    identityAmbiguous: identityAmbiguous && drift.classification !== 'rebuild_required',
    schemaIncompatible,
  });

  const quiet = classified.classification === 'healthy';
  const result = {
    schemaVersion: 1,
    kind: 'bridge_watch',
    classification: classified.classification,
    timestamp: new Date().toISOString(),
    quiet,
    deduplicated: false,
    sourceCommit,
    packageHash: expected.packageHash || actual.packageHash || null,
    installedIdentity: secretSafeIdentity(readInstalledIdentity(config)),
    reasons: classified.reasons,
    activeWork: activeWork.active ? activeWork : null,
    drift: {
      match: Boolean(drift.match),
      classification: drift.classification,
      reason: drift.reason || null,
      drifted: (drift.drifted || []).slice(0, 20),
    },
    health: {
      healthy: Boolean(health.healthy),
      failures: health.failures || [],
      restartNeeded: Boolean(health.restartNeeded),
    },
    dispatch: null,
    alert: { active: !quiet, posted: false, deduplicated: false },
  };

  const prev = readMaintenanceAlertState(config);
  const fp = fingerprintWatchResult(result);
  if (!quiet) {
    if (prev.lastFingerprint === fp) {
      result.deduplicated = true;
      result.alert.deduplicated = true;
    } else {
      appendAlert(config, `bridge-watch: ${result.classification} ${result.reasons.join(',')}`);
      appendBridgeLog(config, `bridge-watch ${result.classification}: ${result.reasons.join(',')}`);
      notifyLocal(
        config,
        'LGFC Bridge Watch',
        `${result.classification}: ${result.reasons.slice(0, 3).join(', ') || 'see maintenance-result.json'}`,
      );
      const opsIssue = config.maintenance?.opsFaultIssueNumber ?? config.watchdog?.opsFaultIssueNumber;
      if (opsIssue && (result.classification === 'failed' || result.classification === 'manual_review_required')) {
        try {
          postIssueComment(
            opsIssue,
            `CURSOR BRIDGE WATCH\nclassification: ${result.classification}\nreasons: ${result.reasons.join(', ')}\nsourceCommit: ${sourceCommit || 'unknown'}\n\nHealthy intervals remain local-only.`,
          );
          result.alert.posted = true;
        } catch (err) {
          appendBridgeLog(config, `bridge-watch github alert failed: ${err.message}`);
        }
      }
      writeMaintenanceAlertState(config, {
        lastFingerprint: fp,
        lastAlertAt: result.timestamp,
        lastClassification: result.classification,
      });
    }
  } else if (prev.lastFingerprint) {
    writeMaintenanceAlertState(config, {
      lastFingerprint: null,
      lastAlertAt: null,
      lastClassification: 'healthy',
    });
  }

  if (
    result.classification === 'rebuild_required' &&
    opts.dispatchBuild &&
    typeof opts.dispatchBuild === 'function' &&
    !activeWork.active
  ) {
    result.dispatch = opts.dispatchBuild({
      sourceCommit,
      packageHash: result.packageHash,
      reasons: result.reasons,
    });
  }

  atomicWriteJson(maintenanceResultPath(config), result, 0o600);

  if (opts.includeStatus) {
    result.status = collectStatus(config, { skipSystemd: opts.skipSystemd });
  }

  return result;
}

function main() {
  const config = loadConfig();
  const mode = process.argv[2] || 'check';
  if (mode === 'status') {
    const last = readMaintenanceResult(config);
    console.log(JSON.stringify(last || { classification: 'unknown' }, null, 2));
    return;
  }

  const sourceCommitHint = process.env.LGFC_BRIDGE_SOURCE_COMMIT || null;
  const dispatch =
    process.env.LGFC_BRIDGE_WATCH_DISPATCH === '1'
      ? ({ sourceCommit }) => {
          const wf = config.maintenance?.buildWorkflow || 'cursor-bridge-build.yml';
          const r = spawnSync(
            'gh',
            [
              'workflow',
              'run',
              wf,
              '--repo',
              'wdhunter465/next-starter-template',
              '-f',
              `source_commit=${sourceCommit}`,
            ],
            { encoding: 'utf8' },
          );
          return {
            attempted: true,
            ok: r.status === 0,
            detail: `${r.stdout || ''}${r.stderr || ''}`.trim().slice(0, 300),
          };
        }
      : null;

  const result = runBridgeWatch(config, {
    sourceCommitHint,
    dispatchBuild: dispatch || undefined,
  });
  if (result.quiet) {
    if (process.env.LGFC_BRIDGE_WATCH_VERBOSE === '1') {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exitCode = 0;
    return;
  }
  console.log(JSON.stringify(result, null, 2));
  process.exitCode =
    result.classification === 'failed' || result.classification === 'manual_review_required' ? 2 : 0;
}

const invokedDirectly =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (invokedDirectly) {
  try {
    main();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
