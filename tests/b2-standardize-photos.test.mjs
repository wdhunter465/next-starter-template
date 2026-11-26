import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { convertBuffer, d1CountSql, execRetry, jpgKeyFor, planFor, renderMarkdown, repointSql, run } from '../scripts/ops/b2-standardize-photos.mjs';

const keys = new Set(['a.png']);

describe('planFor', () => {
  it('leaves a compliant JPEG alone', () => {
    expect(planFor({ key: 'a.jpg', bytes: 1e6, format: 'jpeg', width: 4000, height: 3000, objectKeys: keys }).action).toBe('ok');
  });
  it('rewrites an oversized JPEG in place', () => {
    expect(planFor({ key: 'a.jpg', bytes: 1e6, format: 'jpeg', width: 4032, height: 3024, objectKeys: keys })).toEqual({ action: 'rewrite', newKey: 'a.jpg' });
  });
  it('converts a PNG to a new .jpg key', () => {
    expect(planFor({ key: 'bulk/b/x.png', bytes: 1e6, format: 'png', width: 100, height: 100, objectKeys: keys })).toEqual({ action: 'convert', newKey: 'bulk/b/x.jpg' });
  });
  it('flags when the target key exists', () => {
    expect(planFor({ key: 'a.png', bytes: 1, format: 'png', width: 1, height: 1, objectKeys: new Set(['a.jpg']) }).action).toBe('flag');
  });
  it('leaves objects with no D1 row alone', () => {
    expect(planFor({ key: 'a.png', bytes: 1, format: 'png', width: 1, height: 1, objectKeys: keys, d1Matched: false }).action).toBe('skip');
  });
});

describe('sql', () => {
  it('names the new key and avoids LIKE', () => {
    const sql = repointSql("a b/it's_1.png", "a b/it's_1.jpg");
    expect(sql).toContain("it''s_1.jpg");
    expect(sql).toContain('instr(');
    expect(sql).not.toContain('LIKE');
    expect(d1CountSql('x.jpg')).toContain("photo_id = 'x.jpg'");
  });
  it('jpgKeyFor handles dots in folders', () => {
    expect(jpgKeyFor('a.b/c.PNG')).toBe('a.b/c.jpg');
    expect(jpgKeyFor('a.b/c')).toBe('a.b/c.jpg');
  });
});

describe('execRetry', () => {
  it('retries, then reports the stderr tail', () => {
    let n = 0;
    const exec = () => { n++; const e = new Error('Command failed: aws ...'); e.stderr = 'x\nAn error occurred (NoSuchKey)'; throw e; };
    expect(() => execRetry(exec, 'aws', [])).toThrow('NoSuchKey');
    expect(n).toBe(3);
  });
});

describe('convertBuffer', () => {
  it('caps the long edge at 4000 px and returns a JPEG', async () => {
    const png = await sharp({ create: { width: 6000, height: 3000, channels: 3, background: '#336699' } }).png().toBuffer();
    const c = await convertBuffer(sharp, png);
    expect(c.format).toBe('png');
    expect(c.out.info.width).toBe(4000);
    expect(c.out.info.format).toBe('jpeg');
  });
});

describe('run (fake B2 and D1)', () => {
  it('dry run writes nothing; apply converts, repoints, then deletes', async () => {
    const png = await sharp({ create: { width: 5000, height: 2000, channels: 3, background: '#aa3333' } }).png().toBuffer();
    const jpgOk = await sharp({ create: { width: 800, height: 600, channels: 3, background: '#33aa33' } }).jpeg().toBuffer();
    const calls = [];
    const exec = (cmd, args) => {
      calls.push(args.join(' '));
      if (args[1] === 'list-objects-v2') return JSON.stringify({ Contents: [{ Key: 'p.png', Size: png.length }, { Key: 'ok.jpg', Size: jpgOk.length }], IsTruncated: false });
      if (args[1] === 'get-object') {
        writeFileSync(args[args.length - 1], args.includes('p.png') ? png : jpgOk);
        return '{}';
      }
      return '{}';
    };
    const dry = await run({ endpoint: 'https://s3.x', bucket: 'b', exec });
    expect(dry.rows.map((r) => r.action)).toEqual(['convert', 'ok']);
    expect(calls.some((c) => c.includes('put-object') || c.includes('delete-object'))).toBe(false);

    const sqls = [];
    let moved = false;
    const d1 = { count: () => (moved ? 1 : 1), run: (s) => { sqls.push(s); moved = true; } };
    const dir = mkdtempSync(join(tmpdir(), 'bk-'));
    const done = await run({ endpoint: 'https://s3.x', bucket: 'b', exec, apply: true, d1, backupDir: dir });
    expect(done.rows[0].applied).toBe(true);
    expect(sqls[0]).toContain("'p.jpg'");
    expect(readFileSync(join(dir, 'p.png')).length).toBe(png.length);
    const order = calls.filter((c) => c.includes('put-object') || c.includes('delete-object')).map((c) => (c.includes('put-object') ? 'put' : 'delete'));
    expect(order).toEqual(['put', 'delete']);
    expect(renderMarkdown(done)).toContain('p.jpg');
  });
});
