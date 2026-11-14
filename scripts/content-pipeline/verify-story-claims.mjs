#!/usr/bin/env node
/**
 * #5224: check each story's factual claims against trusted sources. Read-only: it never writes to D1 or B2 and
 * does not change the batch file.
 *
 * Rule (Product Authority, 2026-11-13): a claim needs at least three distinct trusted sources that agree. Jonathan
 * Eig's Luckiest Man is a trusted source and the preferred tie-breaker when sources disagree. Automation does the
 * objective check and flags the rest; it does not decide a disputed fact.
 *
 * Usage: node scripts/content-pipeline/verify-story-claims.mjs data/stories/<batch>.json [--trusted data/stories/trusted-sources.json]
 * Exit code 1 when any story needs work.
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const MIN_AGREEING_SOURCES = 3;

export const CLAIM_STATUS = {
  VERIFIED: 'verified',
  CONFLICT: 'conflict',
  INSUFFICIENT: 'insufficient',
  INVALID: 'invalid',
};

function hostOf(url) {
  try {
    return new URL(String(url)).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Find the trusted-list entry a cited source belongs to, or null. Books match by author and title; web sources by domain. */
export function matchTrusted(source, trustedList) {
  if (!source || typeof source !== 'object') return null;
  const host = hostOf(source.url);
  const name = String(source.name || '').toLowerCase();
  const author = String(source.author || '').toLowerCase();
  for (const entry of trustedList.sources || []) {
    if (entry.type === 'book') {
      const sameTitle = name && name.includes(String(entry.name).toLowerCase());
      const sameAuthor = author && author.includes(String(entry.author || '').toLowerCase());
      if (sameTitle && sameAuthor) return entry;
      continue;
    }
    for (const domain of entry.domains || []) {
      if (host && (host === domain || host.endsWith(`.${domain}`))) return entry;
    }
  }
  return null;
}

/** Check one claim. Pure. Returns { claim, status, agreeing, disagreeing, untrusted, reasons }. */
export function checkClaim(claim, trustedList) {
  const text = claim && typeof claim.claim === 'string' ? claim.claim.trim() : '';
  const result = { claim: text, status: CLAIM_STATUS.INVALID, agreeing: [], disagreeing: [], untrusted: [], reasons: [] };
  if (!text) {
    result.reasons.push('the claim text is missing');
    return result;
  }
  if (!Array.isArray(claim.sources) || claim.sources.length === 0) {
    result.status = CLAIM_STATUS.INSUFFICIENT;
    result.reasons.push('no sources recorded');
    return result;
  }
  const agreeing = new Map();
  const disagreeing = new Map();
  let badSources = 0;
  for (const source of claim.sources) {
    const label = source && (source.name || source.url) ? String(source.name || source.url) : '(unnamed source)';
    if (!source || !['agree', 'disagree'].includes(source.supports)) {
      result.reasons.push(`source "${label}" must say supports: agree or disagree`);
      badSources += 1;
      continue;
    }
    const trusted = matchTrusted(source, trustedList);
    if (!trusted) {
      result.untrusted.push(label);
      continue;
    }
    if (source.supports === 'agree') agreeing.set(trusted.id, trusted);
    else disagreeing.set(trusted.id, { id: trusted.id, says: source.says ? String(source.says) : '' });
  }
  result.agreeing = [...agreeing.keys()];
  result.disagreeing = [...disagreeing.values()];

  // A source with no agree/disagree is a data-entry error: the claim cannot be judged until it is fixed.
  if (badSources > 0) {
    result.status = CLAIM_STATUS.INVALID;
    return result;
  }
  const eigAgrees = [...agreeing.values()].some((e) => e.preferred_tiebreaker);
  const eigDisagrees = disagreeing.has('eig-luckiest-man');
  if (disagreeing.size > 0) {
    if (agreeing.size >= MIN_AGREEING_SOURCES && eigAgrees && !eigDisagrees) {
      result.status = CLAIM_STATUS.VERIFIED;
      result.reasons.push(`verified on Eig's tie-break; dissent recorded from ${[...disagreeing.keys()].join(', ')}`);
    } else {
      result.status = CLAIM_STATUS.CONFLICT;
      result.reasons.push(`trusted sources disagree: ${[...agreeing.keys()].join(', ') || 'none'} agree; ${[...disagreeing.keys()].join(', ')} disagree`);
    }
    return result;
  }
  if (agreeing.size >= MIN_AGREEING_SOURCES) {
    result.status = CLAIM_STATUS.VERIFIED;
    return result;
  }
  result.status = CLAIM_STATUS.INSUFFICIENT;
  result.reasons.push(`${agreeing.size} of ${MIN_AGREEING_SOURCES} trusted sources agree${result.untrusted.length ? `; not on the trusted list: ${result.untrusted.join(', ')}` : ''}`);
  return result;
}

/** Check a whole batch. Returns { stories: [{ tag, status, claims, flags }], readyCount, needsWorkCount }. */
export function verifyBatch(batch, trustedList) {
  const stories = [];
  for (const [index, story] of (batch?.stories || []).entries()) {
    const tag = story?.tag || `stories[${index}]`;
    const flags = [];
    const claims = Array.isArray(story?.claims) ? story.claims.map((c) => checkClaim(c, trustedList)) : [];
    if (claims.length === 0) flags.push('no claims recorded: list every factual claim with its sources');
    for (const c of claims) {
      if (c.status !== CLAIM_STATUS.VERIFIED) flags.push(`${c.status}: ${c.claim || '(no claim text)'}: ${c.reasons.join('; ')}`);
    }
    const ready = claims.length > 0 && claims.every((c) => c.status === CLAIM_STATUS.VERIFIED);
    stories.push({ tag, status: ready ? 'verified_ready' : 'needs_work', claims, flags });
  }
  return {
    stories,
    readyCount: stories.filter((s) => s.status === 'verified_ready').length,
    needsWorkCount: stories.filter((s) => s.status === 'needs_work').length,
  };
}

export function renderReport(result) {
  const lines = [`Story claim check: ${result.readyCount} verified-ready, ${result.needsWorkCount} need work`, ''];
  for (const s of result.stories) {
    lines.push(`${s.status === 'verified_ready' ? 'READY ' : 'WORK  '} ${s.tag} (${s.claims.filter((c) => c.status === 'verified').length}/${s.claims.length} claims verified)`);
    for (const flag of s.flags) lines.push(`    - ${flag}`);
  }
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const batchPath = argv.find((a) => !a.startsWith('--'));
  const trustedIndex = argv.indexOf('--trusted');
  const trustedPath = trustedIndex > -1 ? argv[trustedIndex + 1] : path.join('data', 'stories', 'trusted-sources.json');
  if (!batchPath) {
    console.error('Usage: verify-story-claims.mjs <batch.json> [--trusted <trusted-sources.json>]');
    process.exit(2);
  }
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  const trusted = JSON.parse(fs.readFileSync(trustedPath, 'utf8'));
  const result = verifyBatch(batch, trusted);
  console.log(renderReport(result));
  if (result.needsWorkCount > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) main();
