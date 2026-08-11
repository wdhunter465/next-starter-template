/**
 * Persistent watermark / dedupe state for lgfc-event-wake (#3340).
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export function defaultStateDir() {
  return (
    process.env.LGFC_EVENT_WAKE_STATE_DIR ||
    path.join(os.homedir(), '.lgfc-event-wake')
  );
}

export function defaultStatePath(stateDir = defaultStateDir()) {
  return path.join(stateDir, 'state.json');
}

/**
 * @returns {{ version: number, seenWakeKeys: string[], lastPollAt: string | null }}
 */
export function emptyState() {
  return {
    version: 1,
    seenWakeKeys: [],
    lastPollAt: null,
  };
}

/**
 * @param {string} statePath
 */
export function loadState(statePath) {
  try {
    const raw = fs.readFileSync(statePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return emptyState();
    return {
      version: 1,
      seenWakeKeys: Array.isArray(parsed.seenWakeKeys)
        ? parsed.seenWakeKeys.map(String)
        : [],
      lastPollAt: parsed.lastPollAt ? String(parsed.lastPollAt) : null,
    };
  } catch (error) {
    if (error && error.code === 'ENOENT') return emptyState();
    throw error;
  }
}

/**
 * @param {string} statePath
 * @param {{ version: number, seenWakeKeys: string[], lastPollAt: string | null }} state
 * @param {{ maxSeen?: number }} [options]
 */
export function saveState(statePath, state, options = {}) {
  const maxSeen = options.maxSeen ?? 500;
  const seenWakeKeys = [...state.seenWakeKeys].slice(-maxSeen);
  const dir = path.dirname(statePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${statePath}.${process.pid}.tmp`;
  const payload = JSON.stringify(
    {
      version: 1,
      seenWakeKeys,
      lastPollAt: state.lastPollAt,
    },
    null,
    2,
  );
  fs.writeFileSync(tmp, `${payload}\n`, 'utf8');
  fs.renameSync(tmp, statePath);
}

/**
 * @param {string[]} seenWakeKeys
 * @param {string} key
 */
export function alreadySeen(seenWakeKeys, key) {
  return seenWakeKeys.includes(key);
}
