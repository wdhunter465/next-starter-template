#!/usr/bin/env node
/**
 * Before the hand-off job opens an Instagram or Facebook Issue, make sure the padded variant of the post's photo
 * exists in the bucket (#5196). Fetches the original from the site (only possible once the post is
 * public), pads it (never crops), and uploads it to social-variants/instagram/<photo id>.jpg.
 * Additive only: it never overwrites an existing variant and never deletes anything.
 * Dry run (APPLY not true) reports what it would build and uploads nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { selectDispatchPosts } from './social-post-dispatch.mjs';
import { renderInstagramVariant, variantKey } from './social-pad-variant.mjs';

const DEFAULT_QUEUE = new URL('../../data/social-post-queue.json', import.meta.url);
const LIVE_BASE_URL = 'https://www.lougehrigfanclub.com';

/** Photos that need a variant: the cleared photo of each due post that lists Instagram or Facebook, once each. */
export function photosNeedingVariant(queue, now) {
  const seen = new Map();
  for (const post of selectDispatchPosts(queue, now)) {
    if ((post.platforms?.includes('instagram') || post.platforms?.includes('facebook')) && !seen.has(post.photo_id)) seen.set(post.photo_id, post.id);
  }
  return [...seen].map(([photoId, postId]) => ({ photoId, postId }));
}

function awsExists(bucket, key, endpoint, exec) {
  try {
    exec('aws', ['s3api', 'head-object', '--bucket', bucket, '--key', key, '--endpoint-url', endpoint]);
    return true;
  } catch {
    return false;
  }
}

export async function run(env = process.env, deps = {}) {
  const fetchImpl = deps.fetch ?? fetch;
  const exec = deps.exec ?? ((cmd, args) => execFileSync(cmd, args, { stdio: 'pipe' }));
  const render = deps.render ?? renderInstagramVariant;
  const queue = deps.queue ?? JSON.parse(readFileSync(DEFAULT_QUEUE, 'utf8'));
  const apply = String(env.APPLY ?? 'false').toLowerCase() === 'true';
  const now = env.NOW ? Date.parse(env.NOW) : Date.now();
  const baseUrl = String(env.BASE_URL ?? LIVE_BASE_URL).replace(/\/$/, '');
  const bucket = String(env.B2_BUCKET ?? '').trim();
  const endpoint = String(env.B2_ENDPOINT ?? '').trim();
  const report = { mode: apply ? 'apply' : 'dry-run', built: [], existing: [], would_build: [], failed: [] };

  for (const { photoId, postId } of photosNeedingVariant(queue, now)) {
    const key = variantKey('instagram', photoId);
    if (apply && (!bucket || !endpoint)) throw new Error('B2_BUCKET and B2_ENDPOINT are required to apply');
    if (apply && awsExists(bucket, key, endpoint, exec)) {
      report.existing.push({ photo_id: photoId, key });
      continue;
    }
    if (!apply) {
      report.would_build.push({ photo_id: photoId, post_id: postId, key });
      continue;
    }
    try {
      const res = await fetchImpl(`${baseUrl}/api/social/image/${postId}`);
      if (!res.ok) throw new Error(`original fetch ${res.status}`);
      const { buffer, geometry } = await render(Buffer.from(await res.arrayBuffer()));
      const tmp = `${env.RUNNER_TEMP ?? '/tmp'}/ig-${photoId}.jpg`;
      (deps.write ?? writeFileSync)(tmp, buffer);
      exec('aws', ['s3', 'cp', tmp, `s3://${bucket}/${key}`, '--endpoint-url', endpoint, '--content-type', 'image/jpeg']);
      report.built.push({ photo_id: photoId, key, frame: geometry.frame, padded: geometry.padded });
    } catch (error) {
      report.failed.push({ photo_id: photoId, key, error: String(error?.message ?? error) });
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
      console.error(`ERROR: ${String(error?.message ?? error)}`);
      process.exit(1);
    });
}
