import { spawnSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { appendBridgeLog } from './notify.mjs';

export function resolveAgentBinary(config) {
  const candidates = config.cliBinaryCandidates || ['agent', 'cursor'];
  for (const name of candidates) {
    if (name === 'cursor') {
      const r = spawnSync('cursor', ['agent', 'status'], { encoding: 'utf8' });
      // status may be non-zero when not logged in, but binary exists if no ENOENT
      if (!r.error) return { kind: 'cursor-agent', bin: 'cursor' };
    } else {
      const r = spawnSync(name, ['status'], { encoding: 'utf8' });
      if (!r.error) return { kind: 'agent', bin: name };
    }
  }
  return null;
}

export function cliAuthPreflight(config) {
  const resolved = resolveAgentBinary(config);
  if (!resolved) {
    return { ok: false, reason: 'cli_binary_missing' };
  }
  const args = resolved.kind === 'cursor-agent' ? ['agent', 'status'] : ['status'];
  const r = spawnSync(resolved.bin, args, {
    encoding: 'utf8',
    env: process.env,
  });
  const out = `${r.stdout || ''}${r.stderr || ''}`.trim();
  if (/not logged in/i.test(out) || /unauthorized/i.test(out)) {
    return { ok: false, reason: 'cli_not_authenticated', detail: out.slice(0, 200), resolved };
  }
  if (r.error) {
    return { ok: false, reason: 'cli_exec_error', detail: String(r.error), resolved };
  }
  // Some versions exit non-zero when not logged in already handled; accept 0 or ambiguous success text
  if (r.status !== 0 && !/logged in|email|@/i.test(out)) {
    return { ok: false, reason: 'cli_auth_check_failed', detail: out.slice(0, 200), resolved };
  }
  return { ok: true, resolved, detail: out.slice(0, 200) };
}

function truncate(text, max) {
  const s = String(text || '');
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…[truncated]`;
}

function formatComments(comments = [], limit = 12) {
  const sorted = [...comments].sort(
    (a, b) => new Date(a.createdAt || a.created_at) - new Date(b.createdAt || b.created_at),
  );
  const recent = sorted.slice(-limit);
  return recent
    .map((c) => {
      const id = c.id || c.databaseId || '?';
      const at = c.createdAt || c.created_at || '';
      const author = c.author || c.user?.login || 'unknown';
      const body = truncate(c.body || c.bodyText || '', 1200);
      return `--- comment ${id} by ${author} at ${at} ---\n${body}`;
    })
    .join('\n\n');
}

/**
 * Label- and status-driven launch prompt: Cursor was assigned this Issue
 * because it carries `agent:cursor` + `handoff:ready` (mechanical Bridge
 * gates already passed on that basis alone). Cursor reads the live Issue
 * body/comments for what to actually do, then decides act / hold /
 * correction-needed / no-action. There is no resume/response comment
 * marker for the Bridge to resolve or for Cursor to look for — the label
 * pair and the Issue content are the complete handoff.
 */
export function buildPrompt({
  issueNumber,
  issue,
  comments = [],
  semanticFindings = [],
  workspace,
}) {
  const labels = (issue?.labels || [])
    .map((l) => (typeof l === 'string' ? l : l.name))
    .filter(Boolean)
    .join(', ');
  const findingsBlock =
    semanticFindings.length > 0
      ? semanticFindings.map((f) => `- ${f}`).join('\n')
      : '- (none)';

  return [
    'MODE: IMPLEMENTATION (label- and status-driven Bridge launch)',
    'Runtime: local',
    `Source Issue: #${issueNumber}`,
    `Issue title: ${issue?.title || '(unknown)'}`,
    `Issue state: ${issue?.state || '(unknown)'}`,
    `Issue labels: ${labels || '(none)'}`,
    `Issue URL: ${issue?.url || `(https://github.com/wdhunter465/next-starter-template/issues/${issueNumber})`}`,
    'Read Agent.md and the mandatory documentation chain before any repo work.',
    'Bridge role: secure transport + mechanical safety only (Issue open, `agent:cursor` + `handoff:ready` present, no stale handoff, no active claim). You own semantic task-readiness evaluation.',
    'You were assigned this Issue by its labels alone — there is no separate resume/response comment to look for. Read the Issue body and comments below for full context.',
    'Bridge informational findings (do not treat as Bridge rejection):',
    findingsBlock,
    'Required disposition after evaluating live Issue + comments + governance:',
    '- act: execute one bounded authorized action; set Issue status to status:implementation while working; on finish post IMPLEMENTATION HANDOFF and set status:review;',
    '- hold: post a Cursor-authored hold explaining the blocker and set the matching canonical Issue status;',
    '- correction-needed: post what is missing or ambiguous and set the matching canonical Issue status;',
    '- no-action: report that no executable work is authorized, set matching status, and stop.',
    'Shared lifecycle: Issue status transitions + your handoff/disposition. Bridge does not post ACK/STARTED/COMPLETED telemetry.',
    'Do not broaden scope. Do not self-approve or merge protected work.',
    'Issue body (truncated):',
    truncate(issue?.body || '', 4000),
    'Recent Issue comments (truncated):',
    formatComments(comments),
    `Workspace: ${workspace}`,
  ].join('\n');
}

export function resolveWorkspace(config) {
  if (process.env.LGFC_CURSOR_BRIDGE_WORKSPACE) {
    return process.env.LGFC_CURSOR_BRIDGE_WORKSPACE;
  }
  const hint = config.defaultWorkspaceHint || 'next-starter-template/next-starter-template';
  const home = os.homedir();
  const candidate = path.join(home, hint);
  if (fs.existsSync(candidate)) return candidate;
  const alt = path.join(home, 'next-starter-template');
  if (fs.existsSync(alt)) return alt;
  return process.cwd();
}

/**
 * Launch local Cursor Agent in non-interactive print mode with structured lifecycle output.
 * A successful spawn is not agent acceptance; bridge.mjs waits for system/init.
 */
export function launchLocalAgent(
  config,
  { issueNumber, issue, comments, semanticFindings },
) {
  const pre = cliAuthPreflight(config);
  if (!pre.ok) return { error: pre.reason, detail: pre.detail };

  const workspace = resolveWorkspace(config);
  const prompt = buildPrompt({
    issueNumber,
    issue,
    comments,
    semanticFindings,
    workspace,
  });

  const resolved = pre.resolved;
  const commonArgs = [
    '-p',
    prompt,
    '--output-format',
    'stream-json',
    '--workspace',
    workspace,
    '--trust',
  ];
  const args = resolved.kind === 'cursor-agent' ? ['agent', ...commonArgs] : commonArgs;

  if (config.prohibitYolo !== false) {
    // never add --yolo / --force
  }

  appendBridgeLog(
    config,
    `launch ${resolved.bin} ${args.filter((a) => a !== prompt).join(' ')} prompt_len=${prompt.length}`,
  );

  const child = spawn(resolved.bin, args, {
    cwd: workspace,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return { child, workspace, prompt, resolved };
}
