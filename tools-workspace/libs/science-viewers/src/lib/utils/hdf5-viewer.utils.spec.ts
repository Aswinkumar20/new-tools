import { parseHdf5Bytes } from './hdf5-parse.utils';
import { base64ToUint8Array } from './science-file.utils';
import { HDF5_SAMPLE_BASE64 } from '../constants/hdf5-sample.data';
import {
  buildHdf5HistogramBars,
  buildHdf5MetadataRows,
  canExportHdf5,
  createHdf5FileRecord,
  createSampleHdf5File,
  defaultWindowForPreview,
  exportHdf5DatasetCsv,
  exportHdf5DatasetJson,
  exportHdf5SummaryJson,
  exportHdf5TreeJson,
  filterTreeNodes,
  filterValidHdf5Files,
  resolveHdf5Suggestion
} from './hdf5-viewer.utils';

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
    expect(canExportHdf5(record)).toBe(true);
  });

  it('rejects unsupported files', () => {
    const sample = createSampleHdf5File();
    const { accepted, rejected } = filterValidHdf5Files([
      sample,
      new File(['x'], 'data.nc', { type: 'application/octet-stream', lastModified: 1 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
  });

  it('soft-fails unparseable bytes and disables export', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bad.h5', { lastModified: 3 });
    const record = createHdf5FileRecord(file, new Uint8Array([1, 2, 3]));
    expect(record.softFail).toBe(true);
    expect(canExportHdf5(record)).toBe(false);
  });

  it('builds metadata, histogram, window, filters tree, and exports', () => {
    const file = createSampleHdf5File();
    const bytes = base64ToUint8Array(HDF5_SAMPLE_BASE64);
    const record = createHdf5FileRecord(file, bytes);
    const preview = record.parsed!.preview!;
    expect(buildHdf5MetadataRows(record.parsed!).some((r) => r.key === 'Datasets')).toBe(true);
    expect(buildHdf5HistogramBars(preview).length).toBeGreaterThan(0);
    expect(defaultWindowForPreview(preview).width).toBeGreaterThan(0);
    expect(filterTreeNodes(record.parsed!.tree, 'temperature').some((n) => n.path.includes('temperature'))).toBe(true);
    expect(exportHdf5SummaryJson(record)).toContain(file.name);
    expect(exportHdf5TreeJson(record)).toContain('temperature');
    expect(exportHdf5DatasetJson(preview)).toContain(preview.path);
    expect(exportHdf5DatasetCsv(preview).split('\n')[0]).toBe('index,value');
  });

  it('resolves upload and sample suggestions', () => {
    expect(resolveHdf5Suggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-h5');
    expect(resolveHdf5Suggestion({ hasFiles: false, hasError: true })?.id).toBe('try-sample');
    expect(resolveHdf5Suggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
