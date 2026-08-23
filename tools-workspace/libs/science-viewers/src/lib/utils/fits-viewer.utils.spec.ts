import { parseFitsBytes } from './fits-parse.utils';
import { base64ToUint8Array } from './science-file.utils';
import { FITS_SAMPLE_BASE64 } from '../constants/fits-sample.data';
import { createFitsFileRecord, createSampleFitsFile } from './fits-viewer.utils';

describe('fits-parse.utils', () => {
  it('parses the embedded sample FITS image', () => {
    const bytes = base64ToUint8Array(FITS_SAMPLE_BASE64);
    const parsed = parseFitsBytes(bytes);
    expect(parsed.hdus.length).toBeGreaterThan(0);
    expect(parsed.preview?.shape).toEqual([8, 8]);
    expect(parsed.preview?.data.length).toBe(64);
    const cards = parsed.hdus[0].cards.map((c) => c.keyword);
    expect(cards).toContain('OBJECT');
    expect(cards).toContain('CTYPE1');
  });
});

describe('fits-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFitsFile();
    expect(file.name).toBe('sample-starfield.fits');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleFitsFile();
    const bytes = base64ToUint8Array(FITS_SAMPLE_BASE64);
    const record = createFitsFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.preview?.shape).toEqual([8, 8]);
  });
});
