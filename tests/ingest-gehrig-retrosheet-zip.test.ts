import { describe, expect, it } from 'vitest';
import { resolveMasterCsvZipUrl } from '../scripts/ingest-gehrig-retrosheet-data.mjs';

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
