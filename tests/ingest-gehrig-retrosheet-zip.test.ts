import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  createCsvRowParser,
  D1_EXECUTE_CHUNK_SIZE,
  d1ExecuteChunkCount,
  parseCsv,
  resolveColumn,
  resolveMasterCsvZipUrl,
  splitSqlFileIntoChunks,
} from '../scripts/ingest-gehrig-retrosheet-data.mjs';

describe('Retrosheet master CSV zip selection (#4263)', () => {
  it('selects csvdownloads.zip instead of allplayers.zip', () => {
    const hrefs = [
      'https://retrosheet.org/downloads/allplayers.zip',
      'https://retrosheet.org/downloads/gameinfo.zip',
      'https://www.retrosheet.org/downloads/csvdownloads.zip',
      'https://www.retrosheet.org/downloads/basiccsvs.zip',
    ];
    expect(resolveMasterCsvZipUrl(hrefs, 'https://www.retrosheet.org/downloads/csvdownloads.html')).toBe(
      'https://www.retrosheet.org/downloads/csvdownloads.zip',
    );
  });

  it('maps Retrosheet gameinfo vruns/hruns to visitor and home scores', () => {
    const header = [
      'gid',
      'visteam',
      'hometeam',
      'site',
      'date',
      'number',
      'daynight',
      'vruns',
      'hruns',
    ];
    expect(resolveColumn(header, ['visscore', 'vis_score', 'awayscore', 'vruns', 'visruns', 'vis_runs', 'v_score'], 'gameinfo.csv')).toBe(
      'vruns',
    );
    expect(resolveColumn(header, ['homescore', 'home_score', 'hruns', 'h_score'], 'gameinfo.csv')).toBe(
      'hruns',
    );
  });

  it('maps Retrosheet batting.csv b_lp as batting order', () => {
    const header = [
      'gid',
      'id',
      'team',
      'b_lp',
      'b_seq',
      'stattype',
      'b_ab',
      'b_r',
      'b_h',
      'b_hr',
      'b_rbi',
    ];
    expect(
      resolveColumn(header, ['battingorder', 'batting_order', 'bat_order', 'batting', 'b_lp', 'lp'], 'batting.csv'),
    ).toBe('b_lp');
    expect(resolveColumn(header, ['playerid', 'player_id', 'id'], 'batting.csv')).toBe('id');
  });

  it('fails closed when the main bundle is missing', () => {
    expect(() =>
      resolveMasterCsvZipUrl(
        ['https://retrosheet.org/downloads/allplayers.zip'],
        'https://www.retrosheet.org/downloads/csvdownloads.html',
      ),
    ).toThrow(/csvdownloads\.zip/);
  });
});

describe('Retrosheet CSV streaming parser (#4263)', () => {
  it('parses quoted commas', () => {
    const { header, records } = parseCsv('gid,team\n"NYA,1927",NYA\n');
    expect(header).toEqual(['gid', 'team']);
    expect(records[0]).toEqual({ gid: 'NYA,1927', team: 'NYA' });
  });

  it('resumes across chunk boundaries in the middle of a quoted field', () => {
    const rows: string[][] = [];
    const parser = createCsvRowParser((row: string[]) => rows.push(row));
    parser.feed('gid,note\nG1,"hel');
    parser.feed('lo, world"\n');
    parser.end();
    expect(rows[1]).toEqual(['G1', 'hello, world']);
  });

  it('treats a closing quote at EOF as end of field, not a parse error', () => {
    const { records } = parseCsv('gid,note\nG1,"hello"');
    expect(records[0]).toEqual({ gid: 'G1', note: 'hello' });
    const rows: string[][] = [];
    const parser = createCsvRowParser((row: string[]) => rows.push(row));
    parser.feed('gid,note\nG1,"hel');
    parser.feed('lo"');
    parser.end();
    expect(rows[1]).toEqual(['G1', 'hello']);
  });

  it('fails closed when EOF is inside an unclosed quoted field', () => {
    expect(() => parseCsv('gid,note\nG1,"hello')).toThrow(/quoted field/);
  });
});

describe('D1 execute chunking (#4263)', () => {
  it('counts chunks for empty, exact, and remainder sizes', () => {
    expect(d1ExecuteChunkCount(0)).toBe(0);
    expect(d1ExecuteChunkCount(D1_EXECUTE_CHUNK_SIZE)).toBe(1);
    expect(d1ExecuteChunkCount(D1_EXECUTE_CHUNK_SIZE + 1)).toBe(2);
    expect(d1ExecuteChunkCount(2164 * 29, 80)).toBe(Math.ceil((2164 * 29) / 80));
  });

  it('splits a statement-per-line SQL file into sized chunk files', async () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'd1-chunks-'));
    try {
      const src = path.join(tmp, 'all.sql');
      writeFileSync(src, 'INSERT 0;\nINSERT 1;\nINSERT 2;\nINSERT 3;\nINSERT 4;\n');
      const dest = path.join(tmp, 'out');
      const chunks = await splitSqlFileIntoChunks(src, dest, 2);
      expect(chunks).toHaveLength(3);
      expect(readFileSync(chunks[0], 'utf8')).toBe('INSERT 0;\nINSERT 1;\n');
      expect(readFileSync(chunks[1], 'utf8')).toBe('INSERT 2;\nINSERT 3;\n');
      expect(readFileSync(chunks[2], 'utf8')).toBe('INSERT 4;\n');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
