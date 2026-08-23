import { createSampleMincFile, createMincFileRecord, buildMincMetadataRows } from './minc-viewer.utils';
import { parseMincBytes } from './minc-parse.utils';
import { readFileBytes } from './medical-file.utils';
import { extractVolumeSlice } from './volume-slice.utils';

describe('minc-parse.utils', () => {
  it('parses sample MINC volume', async () => {
    const sample = createSampleMincFile();
    const bytes = await readFileBytes(sample);
    const parsed = parseMincBytes(bytes);
    expect(parsed.dims).toEqual([8, 8, 4]);
    expect(parsed.header.variableName).toBe('image');
    expect(parsed.data.length).toBe(8 * 8 * 4);
  });

  it('extracts coronal slice and metadata rows', async () => {
    const sample = createSampleMincFile();
    const bytes = await readFileBytes(sample);
    const parsed = parseMincBytes(bytes);
    const slice = extractVolumeSlice(parsed.data, parsed.dims, 'coronal', 1);
    expect(slice.width).toBe(8);
    expect(slice.height).toBe(4);
    const rows = buildMincMetadataRows(parsed);
    expect(rows.some((r) => r.key === 'Variable')).toBe(true);
  });

  it('creates file record with lastModified 0', async () => {
    const sample = createSampleMincFile();
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = createMincFileRecord(sample, bytes);
    expect(record.parsed?.header.variableName).toBe('image');
  });
});
