#!/usr/bin/env node
/**
 * buffer-mcp.mjs (#5157, design #5143)
 *
 * Small client for Buffer's MCP endpoint (https://mcp.buffer.com/mcp, Authorization: Bearer
 * <API key>). Used by the scheduled social posting job to send the X post, and by the read-only
 * check to prove the key works. Never prints the key.
 *
 * Usage: node scripts/ops/buffer-mcp.mjs check     (read-only: lists tools, account, channels)
 * Env:   BUFFER_API_KEY
 */

import { pathToFileURL } from 'node:url';

export const BUFFER_MCP_URL = 'https://mcp.buffer.com/mcp';

/** Reads the JSON-RPC result from a plain JSON or an SSE (text/event-stream) response body. */
export function parseRpcBody(text, contentType = '') {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return null;
  if (contentType.includes('text/event-stream') || trimmed.startsWith('event:') || trimmed.startsWith('data:')) {
    const datas = trimmed
      .split(/\r?\n/)
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);
    for (const d of datas.reverse()) {
      try {
        return JSON.parse(d);
      } catch {
        /* keep looking */
      }
    }
    return null;
  }
  return JSON.parse(trimmed);
}

/** The text content of an MCP tool result, parsed as JSON when possible. */
export function toolResultData(result) {
  const text = (result?.content ?? []).map((c) => c?.text ?? '').join('\n');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Hides anything that looks like an email address before text is printed. */
export function maskEmails(text) {
  return String(text ?? '').replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]');
}

/** First value stored under `key` anywhere in a nested object or array, or undefined. */
export function findFirst(node, key) {
  if (!node || typeof node !== 'object') return undefined;
  if (!Array.isArray(node) && key in node) return node[key];
  for (const child of Array.isArray(node) ? node : Object.values(node)) {
    const found = findFirst(child, key);
    if (found !== undefined) return found;
  }
  return undefined;
}

export class BufferMcp {
  constructor(apiKey, fetchImpl = fetch) {
    if (!apiKey) throw new Error('BUFFER_API_KEY is required');
    this.apiKey = apiKey;
    this.fetch = fetchImpl;
    this.sessionId = null;
    this.nextId = 1;
  }

  async rpc(method, params, { notification = false } = {}) {
    const body = { jsonrpc: '2.0', method, ...(params ? { params } : {}), ...(notification ? {} : { id: this.nextId++ }) };
    const res = await this.fetch(BUFFER_MCP_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
      },
      body: JSON.stringify(body),
    });
    const sid = res.headers.get('mcp-session-id');
    if (sid) this.sessionId = sid;
    const text = await res.text();
    if (!res.ok) throw new Error(`Buffer MCP ${method} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
    if (notification) return null;
    const parsed = parseRpcBody(text, res.headers.get('content-type') ?? '');
    if (parsed?.error) throw new Error(`Buffer MCP ${method} error: ${JSON.stringify(parsed.error).slice(0, 300)}`);
    return parsed?.result ?? null;
  }

  async initialize() {
    await this.rpc('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'lgfc-social-post-job', version: '1' },
    });
    await this.rpc('notifications/initialized', undefined, { notification: true });
  }

  listTools() {
    return this.rpc('tools/list', {});
  }

  async callTool(name, args = {}) {
    const result = await this.rpc('tools/call', { name, arguments: args });
    if (result?.isError) throw new Error(`Buffer tool ${name} failed: ${String(toolResultData(result)).slice(0, 300)}`);
    return toolResultData(result);
  }
}

export async function runCheck(env = process.env, fetchImpl = fetch) {
  const client = new BufferMcp(String(env.BUFFER_API_KEY ?? '').trim(), fetchImpl);
  await client.initialize();
  const tools = await client.listTools();
  const names = (tools?.tools ?? []).map((t) => t.name);
  const report = { ok: true, tool_count: names.length, has_create_post: names.includes('create_post'), tools: names };
  const account = await client.callTool('get_account', {});
  report.account_top_level_keys = account && typeof account === 'object' ? Object.keys(account) : typeof account;
  if (typeof account === 'string') report.account_text = maskEmails(account).slice(0, 1500);
  const orgs = findFirst(account, 'organizations') ?? [];
  report.organizations = (Array.isArray(orgs) ? orgs : []).map((o) => ({ id: o.id, name: o.name }));
  const orgId = report.organizations[0]?.id;
  if (orgId) {
    const channels = await client.callTool('list_channels', { organizationId: orgId });
    report.channels_top_level_keys = channels && typeof channels === 'object' ? Object.keys(channels) : typeof channels;
    if (typeof channels === 'string') report.channels_text = maskEmails(channels).slice(0, 2500);
    const list = Array.isArray(channels) ? channels : (findFirst(channels, 'channels') ?? []);
    report.channels = (Array.isArray(list) ? list : []).map((c) => ({
      id: c.id,
      name: c.name,
      service: c.service,
      is_disconnected: c.isDisconnected ?? null,
    }));
  }
  const createPost = (tools?.tools ?? []).find((t) => t.name === 'create_post');
  report.create_post_input_properties = Object.keys(createPost?.inputSchema?.properties ?? {});
  return report;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv[2] !== 'check') {
    console.error('usage: buffer-mcp.mjs check');
    process.exit(2);
  }
  runCheck()
    .then((r) => console.log(JSON.stringify(r, null, 2)))
    .catch((e) => {
      console.error(`ERROR: ${String(e?.message ?? e).replaceAll(process.env.BUFFER_API_KEY ?? '\u0000', '[redacted]')}`);
      process.exit(1);
    });
}
