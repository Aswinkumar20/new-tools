import { buildSampleGrib2Bytes } from './grib2-build.utils';
import { parseGribBytes } from './grib2-parse.utils';
import { base64ToUint8Array } from './science-file.utils';
import { GRIB_SAMPLE_BASE64 } from '../constants/grib-sample.data';
import {
  buildGribHistogramBars,
  buildGribMetadataRows,
  canExportGrib,
  createGribFileRecord,
  createSampleGribFile,
  defaultWindowForField,
  exportGribFieldCsv,
  exportGribMessagesJson,
  exportGribSummaryJson,
  filterValidGribFiles,
  resolveGribSuggestion
} from './grib-viewer.utils';

describe('grib2-parse.utils', () => {
  it('parses a built sample GRIB2 message', () => {
    const bytes = buildSampleGrib2Bytes();
    const parsed = parseGribBytes(bytes);
    expect(parsed.messages.length).toBe(1);
    expect(parsed.preview?.shape).toEqual([8, 8]);
    expect(parsed.preview?.data.length).toBe(64);
    expect(parsed.preview?.parameterName).toBe('Temperature');
  });

  it('parses the embedded sample base64', () => {
    const bytes = base64ToUint8Array(GRIB_SAMPLE_BASE64);
    const parsed = parseGribBytes(bytes);
    expect(parsed.messages.length).toBeGreaterThan(0);
  });
});

describe('grib-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGribFile();
    expect(file.name).toBe('sample-weather.grib2');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const file = createSampleGribFile();
    const bytes = base64ToUint8Array(GRIB_SAMPLE_BASE64);
    const record = createGribFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.messages.length).toBeGreaterThan(0);
    expect(canExportGrib(record)).toBe(true);
  });

  it('rejects unsupported files', () => {
    const sample = createSampleGribFile();
    const { accepted, rejected } = filterValidGribFiles([
      sample,
      new File(['x'], 'weather.nc', { type: 'application/octet-stream', lastModified: 1 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
  });

  it('soft-fails unparseable bytes and disables export', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'bad.grib2', { lastModified: 3 });
    const record = createGribFileRecord(file, new Uint8Array([1, 2, 3]));
    expect(record.softFail).toBe(true);
    expect(canExportGrib(record)).toBe(false);
  });

  it('builds metadata, histogram, window, and exports', () => {
    const file = createSampleGribFile();
    const bytes = base64ToUint8Array(GRIB_SAMPLE_BASE64);
    const record = createGribFileRecord(file, bytes);
    const field = record.parsed!.messages[0];
    expect(buildGribMetadataRows(field).some((r) => r.key === 'Parameter')).toBe(true);
    expect(buildGribHistogramBars(field).length).toBeGreaterThan(0);
    const win = defaultWindowForField(field);
    expect(win.width).toBeGreaterThan(0);
    expect(exportGribSummaryJson(record)).toContain(file.name);
    expect(exportGribMessagesJson(record)).toContain(field.parameterName);
    expect(exportGribFieldCsv(field).split('\n')[0]).toBe('i,j,value');
  });

  it('resolves upload and sample suggestions', () => {
    expect(resolveGribSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-grib');
    expect(resolveGribSuggestion({ hasFiles: false, hasError: true })?.id).toBe('try-sample');
    expect(resolveGribSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
