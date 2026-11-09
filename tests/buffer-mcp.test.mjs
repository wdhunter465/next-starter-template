import { describe, expect, it } from 'vitest';
import { BufferMcp, findFirst, parseRpcBody, runCheck, toolResultData } from '../scripts/ops/buffer-mcp.mjs';

describe('buffer mcp client', () => {
  it('parses plain JSON and SSE bodies', () => {
    expect(parseRpcBody('{"jsonrpc":"2.0","id":1,"result":{"a":1}}', 'application/json').result.a).toBe(1);
    const sse = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{"b":2}}\n\n';
    expect(parseRpcBody(sse, 'text/event-stream').result.b).toBe(2);
    expect(parseRpcBody('', '')).toBeNull();
  });

  it('parses JSON tool text and leaves other text alone', () => {
    expect(toolResultData({ content: [{ text: '{"x":1}' }] })).toEqual({ x: 1 });
    expect(toolResultData({ content: [{ text: 'plain' }] })).toBe('plain');
  });

  it('finds a key nested in an object or array', () => {
    expect(findFirst({ data: { account: { organizations: [{ id: 'o' }] } } }, 'organizations')).toEqual([{ id: 'o' }]);
    expect(findFirst([{ a: 1 }, { b: { channels: [] } }], 'channels')).toEqual([]);
    expect(findFirst({ a: 1 }, 'channels')).toBeUndefined();
  });

  it('requires a key', () => {
    expect(() => new BufferMcp('')).toThrow(/BUFFER_API_KEY/);
  });

  it('runs the read-only check with a fake endpoint and never sends the key anywhere but the header', async () => {
    const seen = [];
    const fake = async (_url, init) => {
      const body = JSON.parse(init.body);
      seen.push({ auth: init.headers.Authorization, method: body.method });
      const reply = (result) =>
        new Response(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }), {
          status: 200,
          headers: { 'content-type': 'application/json', 'mcp-session-id': 's1' },
        });
      if (body.method === 'notifications/initialized') return new Response('', { status: 202 });
      if (body.method === 'initialize') return reply({ protocolVersion: '2025-03-26' });
      if (body.method === 'tools/list') {
        return reply({ tools: [{ name: 'get_account' }, { name: 'list_channels' }, { name: 'create_post', inputSchema: { properties: { text: {}, channelId: {} } } }] });
      }
      if (body.params.name === 'get_account') return reply({ content: [{ text: JSON.stringify({ organizations: [{ id: 'o1', name: 'Org' }] }) }] });
      return reply({ content: [{ text: JSON.stringify([{ id: 'c1', name: 'GehrigFanClub', service: 'twitter' }]) }] });
    };
    const report = await runCheck({ BUFFER_API_KEY: 'secret-key' }, fake);
    expect(report).toMatchObject({ ok: true, has_create_post: true, organizations: [{ id: 'o1' }], channels: [{ name: 'GehrigFanClub' }] });
    expect(report.create_post_input_properties).toEqual(['text', 'channelId']);
    expect(JSON.stringify(report)).not.toContain('secret-key');
    expect(seen.every((s) => s.auth === 'Bearer secret-key')).toBe(true);
  });
});
