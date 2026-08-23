import { base64ToUint8Array } from './science-file.utils';
import { buildSampleMatV5Bytes } from './mat-build.utils';
import { parseMatBytes } from './mat-parse.utils';
import { MAT_SAMPLE_BASE64 } from '../constants/mat-sample.data';
import { createMatFileRecord, createSampleMatFile } from './matlab-mat-viewer.utils';

describe('mat-parse.utils', () => {
  it('parses a built sample MAT v5 file', () => {
    const bytes = buildSampleMatV5Bytes();
    const parsed = parseMatBytes(bytes);
    expect(parsed.format).toBe('mat-v5');
    expect(parsed.variables.length).toBe(2);
    expect(parsed.preview?.shape).toEqual([8, 8]);
    expect(parsed.variableData['series']?.length).toBe(16);
  });

  it('parses the embedded sample base64', () => {
    const bytes = base64ToUint8Array(MAT_SAMPLE_BASE64);
    const parsed = parseMatBytes(bytes);
    expect(parsed.variables.map((v) => v.name)).toContain('grid');
  });
});

describe('matlab-mat-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMatFile();
    expect(file.name).toBe('sample-lab.mat');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleMatFile();
    const bytes = base64ToUint8Array(MAT_SAMPLE_BASE64);
    const record = createMatFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.variables.length).toBeGreaterThan(0);
  });
});
