#!/usr/bin/env node
/**
 * social-post-x.mjs (#5157, design #5143)
 *
 * Posts the due, approved posts of the reviewed queue to X through Buffer, once each.
 * Order for each post: check the ledger, create the Buffer post, record the ledger row.
 * A post already 'posted' in the ledger is never sent again. Posts earlier than the queue's
 * automation_starts_at are left to the manual process. Dry run unless APPLY=true.
 *
 * Env: BUFFER_API_KEY, SCHEDULED_CONTENT_BRIDGE_TOKEN (ledger), BASE_URL (default the live site),
 *      BUFFER_CHANNEL_ID (default the X channel GehrigFanClub), APPLY, NOW (ISO, tests only)
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BufferMcp, findFirst } from './buffer-mcp.mjs';
import { DEFAULT_QUEUE, classifyPosts, validateQueue } from './social-post-queue.mjs';
import { appendToDay, buildEvidenceRecord, dayFilePath, latestRecords, newYorkDate, nextVersion } from './social-evidence.mjs';

export const X_CHANNEL_ID = '6ae896c3e29c69a1713866ba';
export const LIVE_BASE_URL = 'https://www.lougehrigfanclub.com';
export const EVIDENCE_JOB = 'GitHub job "Social Post to X"';

/** Width and height of a JPEG from its first start-of-frame marker, or null. */
export function jpegSize(bytes) {
  const b = Buffer.from(bytes);
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = b[i + 1];
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    }
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

/** Width and height of a PNG from its header, or null. */
export function pngSize(bytes) {
  const b = Buffer.from(bytes);
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (b.length < 24 || signature.some((v, i) => b[i] !== v)) return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function auditDayPath(auditDir, date) {
  return path.join(auditDir, dayFilePath(date));
}

function readAuditDay(auditDir, date) {
  const file = auditDayPath(auditDir, date);
  return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
}

function writeAuditDay(auditDir, date, doc) {
  const file = auditDayPath(auditDir, date);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`);
}

/** The post node of a Buffer get_post reply (the reply may wrap it as { post }). */
function postNode(result) {
  return result?.post ?? result ?? {};
}

/** Reads a Buffer post back until it is sent or failed, or the tries run out. */
export async function readBackBufferPost(client, postId, { tries = 5, waitMs = 2000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let node = {};
  for (let i = 0; i < tries; i += 1) {
    node = postNode(await client.callTool('get_post', { postId }));
    if (node.status === 'sent' || node.status === 'error') return node;
    if (i < tries - 1) await sleep(waitMs);
  }
  return node;
}

async function fetchImageFacts(fetchImpl, baseUrl, postId, node) {
  const res = await fetchImpl(`${baseUrl}/api/social/image/${postId}`);
  if (!res.ok) throw new Error(`image address returned HTTP ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const asset = (node?.assets ?? [])[0]?.image ?? {};
  const size = jpegSize(bytes) ?? pngSize(bytes) ?? { width: asset.width, height: asset.height };
  if (!size.width || !size.height) throw new Error('image width and height are unknown');
  return {
    image_url: `${baseUrl}/api/social/image/${postId}`,
    image_sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes,
    width: size.width,
    height: size.height,
  };
}

/**
 * Appends one evidence record for an X post to the day file in auditDir (#5202). A retry adds an
 * attempt to the next version; an earlier version is never changed. Throws when the record cannot
 * be written, so the caller can fail loudly without posting again.
 */
export async function recordXEvidence({ auditDir, post, status, attempt, bufferPostId, node, fetchImpl, baseUrl, nowMs, note }) {
  const date = newYorkDate(post.publish_at);
  const day = readAuditDay(auditDir, date);
  const previous = latestRecords(day).find((r) => r.post_id === post.id && r.platform === 'x');
  const facts = await fetchImageFacts(fetchImpl, baseUrl, post.id, node);
  const sentAt = node?.sentAt ? new Date(node.sentAt).toISOString() : null;
  const record = buildEvidenceRecord({
    post,
    platform: 'x',
    status,
    attempts: [...(previous?.attempts ?? []), attempt],
    platformRecord: bufferPostId ? { post_id: bufferPostId, url: null, ...(status === 'confirmed' && sentAt ? { created_at_utc: sentAt } : {}) } : null,
    photo: { image_url: facts.image_url, image_sha256: facts.image_sha256, image_bytes: facts.bytes.length, width: facts.width, height: facts.height },
    verified: { on: newYorkDate(new Date(nowMs).toISOString()), by: EVIDENCE_JOB, method: 'Buffer get_post after create_post' },
    version: nextVersion(day, post.id, 'x'),
    note,
  });
  writeAuditDay(auditDir, date, appendToDay(day, record));
  return { status: record.status, version: record.version };
}

function evidenceStatusFor(node) {
  if (node?.status === 'sent' && node?.sentAt) return 'confirmed';
  if (node?.status === 'error') return 'failed';
  return 'handed_off';
}

/** Due posts for X that automation owns: approved, on X, time arrived, inside the window, after the start date. */
export function selectXPosts(queue, now) {
  const start = queue.automation_starts_at ? Date.parse(queue.automation_starts_at) : 0;
  return classifyPosts(queue, now).due.filter((p) => p.platforms.includes('x') && Date.parse(p.publish_at) >= start);
}

export function buildCreatePostArgs(post, channelId, baseUrl) {
  return {
    channelId,
    schedulingType: 'automatic',
    mode: 'shareNow',
    text: post.text,
    assets: [{ image: { url: `${baseUrl}/api/social/image/${post.id}`, metadata: { altText: post.alt_text } } }],
  };
}

async function ledgerRequest(fetchImpl, baseUrl, token, path, init = {}) {
  const res = await fetchImpl(`${baseUrl}/api/social/ledger${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

export async function recordLedger(fetchImpl, baseUrl, token, row, attempts = 3) {
  let last;
  for (let i = 0; i < attempts; i += 1) {
    last = await ledgerRequest(fetchImpl, baseUrl, token, '', { method: 'POST', body: JSON.stringify(row) });
    if (last.status === 200 || last.status === 201 || last.status === 409) return last;
  }
  return last;
}

export async function run(env = process.env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const queue = deps.queue ?? JSON.parse(readFileSync(DEFAULT_QUEUE, 'utf8'));
  const problems = validateQueue(queue);
  if (problems.length > 0) throw new Error(`queue is invalid: ${problems.join('; ')}`);

  const apply = String(env.APPLY ?? 'false').toLowerCase() === 'true';
  const now = env.NOW ? Date.parse(env.NOW) : Date.now();
  const baseUrl = String(env.BASE_URL ?? LIVE_BASE_URL).replace(/\/$/, '');
  const channelId = String(env.BUFFER_CHANNEL_ID ?? X_CHANNEL_ID);
  const token = String(env.SCHEDULED_CONTENT_BRIDGE_TOKEN ?? '').trim();
  if (!token) throw new Error('SCHEDULED_CONTENT_BRIDGE_TOKEN is required (ledger)');

  const auditDir = String(env.AUDIT_DIR ?? '').trim();
  const report = { mode: apply ? 'apply' : 'dry-run', considered: [], posted: [], skipped: [], failed: [], evidence: [] };
  const candidates = selectXPosts(queue, now);
  report.considered = candidates.map((p) => p.id);

  let client = null;
  const getClient = async () => {
    client ??= deps.client ?? new BufferMcp(String(env.BUFFER_API_KEY ?? '').trim(), fetchImpl);
    if (!deps.client) await client.initialize();
    return client;
  };
  const nowIso = () => new Date(now).toISOString();

  // Same-day evidence (#5202): one record per attempt, appended to the day file in auditDir.
  const captureEvidence = async (post, bufferPostId, node, attemptDetail, note, reportFailure = true) => {
    const status = evidenceStatusFor(node);
    const attempt = {
      at_utc: nowIso(),
      by: EVIDENCE_JOB,
      outcome: status === 'confirmed' ? 'ok' : status === 'failed' ? 'error' : 'handed_off',
      detail: attemptDetail ?? (status === 'confirmed' ? `Buffer reports the post sent at ${node.sentAt}` : status === 'failed' ? `Buffer error: ${node.error ?? 'unknown'}` : `Buffer accepted the post; status ${node?.status ?? 'unknown'} after read-back`),
    };
    const result = await recordXEvidence({ auditDir, post, status, attempt, bufferPostId, node, fetchImpl, baseUrl, nowMs: now, note });
    report.evidence.push({ id: post.id, ...result });
    if (status === 'failed' && reportFailure) report.failed.push({ id: post.id, step: 'buffer-send', error: String(node?.error ?? 'unknown').slice(0, 300) });
    return result;
  };

  for (const post of candidates) {
    const ledger = await ledgerRequest(fetchImpl, baseUrl, token, `?post_id=${encodeURIComponent(post.id)}`);
    if (ledger.status !== 200) {
      report.failed.push({ id: post.id, step: 'ledger-read', status: ledger.status });
      continue;
    }
    if ((ledger.body.rows ?? []).some((r) => r.platform === 'x' && r.status === 'posted')) {
      report.skipped.push({ id: post.id, reason: 'already posted' });
      if (apply && auditDir) {
        // A post Buffer was still sending at the last read is checked again on the next tick.
        try {
          const day = readAuditDay(auditDir, newYorkDate(post.publish_at));
          const previous = latestRecords(day).find((r) => r.post_id === post.id && r.platform === 'x');
          if (previous?.status === 'handed_off' && previous.platform_record?.post_id) {
            const node = await readBackBufferPost(await getClient(), previous.platform_record.post_id, { tries: 1, sleep: deps.sleep });
            if (evidenceStatusFor(node) !== 'handed_off') await captureEvidence(post, previous.platform_record.post_id, node);
          }
        } catch (error) {
          report.failed.push({ id: post.id, step: 'audit-write', error: String(error?.message ?? error).slice(0, 300) });
        }
      }
      continue;
    }
    if (!apply) {
      report.skipped.push({
        id: post.id,
        reason: 'dry run',
        would_post: buildCreatePostArgs(post, channelId, baseUrl),
        would_record: { file: dayFilePath(newYorkDate(post.publish_at)), status: 'confirmed, failed or handed_off, from the Buffer read-back' },
      });
      continue;
    }
    let created = null;
    try {
      await getClient();
      const result = await client.callTool('create_post', buildCreatePostArgs(post, channelId, baseUrl));
      const platformPostId = String(findFirst(result, 'id') ?? '').slice(0, 200) || null;
      created = { platformPostId };
      const recorded = await recordLedger(fetchImpl, baseUrl, token, {
        post_id: post.id,
        platform: 'x',
        status: 'posted',
        platform_post_id: platformPostId,
      });
      if (![200, 201, 409].includes(recorded.status)) {
        report.failed.push({ id: post.id, step: 'ledger-write-after-post', status: recorded.status, platform_post_id: platformPostId });
      } else {
        report.posted.push({ id: post.id, platform_post_id: platformPostId });
      }
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 400);
      await recordLedger(fetchImpl, baseUrl, token, { post_id: post.id, platform: 'x', status: 'failed', error: message });
      report.failed.push({ id: post.id, step: 'buffer', error: message });
      if (auditDir && !created) {
        try {
          await captureEvidence(post, null, { status: 'error', error: message }, `Buffer call failed: ${message}`, undefined, false);
        } catch (auditError) {
          report.failed.push({ id: post.id, step: 'audit-write', error: String(auditError?.message ?? auditError).slice(0, 300) });
        }
      }
    }
    if (auditDir && created) {
      try {
        let node = {};
        let note;
        if (created.platformPostId) {
          try {
            node = await readBackBufferPost(client, created.platformPostId, { sleep: deps.sleep });
          } catch (readError) {
            note = `Buffer read-back failed: ${String(readError?.message ?? readError).slice(0, 200)}`;
          }
        } else {
          note = 'Buffer did not return a post id.';
        }
        await captureEvidence(post, created.platformPostId, node, undefined, note);
      } catch (auditError) {
        report.failed.push({ id: post.id, step: 'audit-write', error: String(auditError?.message ?? auditError).slice(0, 300) });
      }
    }
  }
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.failed.length > 0) process.exit(1);
    })
    .catch((error) => {
      console.error(`ERROR: ${String(error?.message ?? error).replaceAll(process.env.BUFFER_API_KEY || '\u0000', '[redacted]')}`);
      process.exit(1);
    });
}
