import { describe, expect, it } from 'vitest';
import {
  createCsvRowParser,
  parseCsv,
  resolveMasterCsvZipUrl,
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
