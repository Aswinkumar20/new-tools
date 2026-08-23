import { parseHdf5Bytes } from './hdf5-parse.utils';
import { base64ToUint8Array } from './science-file.utils';
import { HDF5_SAMPLE_BASE64 } from '../constants/hdf5-sample.data';
import { createHdf5FileRecord, createSampleHdf5File } from './hdf5-viewer.utils';

describe('hdf5-parse.utils', () => {
  it('parses the embedded sample HDF5 file', () => {
    const bytes = base64ToUint8Array(HDF5_SAMPLE_BASE64);
    const parsed = parseHdf5Bytes(bytes, 'sample-science.h5');
    const paths = parsed.datasets.map((d) => d.path).sort();
    expect(paths).toContain('temperature');
    expect(paths).toContain('metadata/profile');
    expect(parsed.datasets.length).toBeGreaterThanOrEqual(2);
    expect(parsed.preview?.path).toBe('temperature');
    expect(parsed.preview?.shape).toEqual([8, 8]);
  });
});

describe('hdf5-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleHdf5File();
    expect(file.name).toBe('sample-science.h5');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleHdf5File();
    const bytes = base64ToUint8Array(HDF5_SAMPLE_BASE64);
    const record = createHdf5FileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.datasets.length).toBeGreaterThan(0);
  });
});
