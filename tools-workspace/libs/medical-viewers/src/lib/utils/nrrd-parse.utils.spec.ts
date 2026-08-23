import { createSampleNrrdFile, createNrrdFileRecord } from './nrrd-viewer.utils';
import { parseNrrdBytes } from './nrrd-parse.utils';
import { readFileBytes } from './medical-file.utils';
import { extractVolumeSlice, maxVolumeSliceIndex } from './volume-slice.utils';

describe('nrrd-parse.utils', () => {
  it('parses sample NRRD volume', async () => {
    const sample = createSampleNrrdFile();
    const bytes = await readFileBytes(sample);
    const parsed = parseNrrdBytes(bytes);
    expect(parsed.dims).toEqual([8, 8, 4]);
    expect(parsed.header.type).toBe('float');
    expect(parsed.data.length).toBe(8 * 8 * 4);
    expect(parsed.dataMin).toBeLessThan(parsed.dataMax);
  });

  it('parses explicit spacings from the NRRD header', () => {
    const header = [
      'NRRD0004',
      'type: float',
      'dimension: 3',
      'sizes: 2 2 1',
      'spacings: 0.5 1.25 2',
      'endian: little',
      'encoding: raw',
      '',
      ''
    ].join('\n');
    const headerBytes = new TextEncoder().encode(header);
    const data = new Uint8Array(2 * 2 * 1 * 4);
    const bytes = new Uint8Array(headerBytes.length + data.length);
    bytes.set(headerBytes, 0);
    bytes.set(data, headerBytes.length);
    const parsed = parseNrrdBytes(bytes);
    expect(parsed.header.spacings).toEqual([0.5, 1.25, 2]);
    expect(parsed.dims).toEqual([2, 2, 1]);
  });

  it('extracts axial slice', async () => {
    const sample = createSampleNrrdFile();
    const bytes = await readFileBytes(sample);
    const parsed = parseNrrdBytes(bytes);
    const slice = extractVolumeSlice(parsed.data, parsed.dims, 'axial', 0);
    expect(slice.width).toBe(8);
    expect(slice.height).toBe(8);
    expect(maxVolumeSliceIndex(parsed.dims, 'axial')).toBe(3);
  });

  it('creates file record with lastModified 0', async () => {
    const sample = createSampleNrrdFile();
    expect(sample.lastModified).toBe(0);
    const bytes = await readFileBytes(sample);
    const record = createNrrdFileRecord(sample, bytes);
    expect(record.parsed?.dims).toEqual([8, 8, 4]);
  });
});
