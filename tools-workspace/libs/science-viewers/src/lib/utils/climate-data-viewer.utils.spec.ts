import { CLIMATE_CLIM_SAMPLE, CLIMATE_CSV_SAMPLE, CLIMATE_JSON_SAMPLE } from '../constants/climate-sample.data';
import { parseClimateText } from './climate-parse.utils';
import {
  canExportClimate,
  createClimateFileRecord,
  createSampleClimateFile,
  exportClimateSeriesCsv,
  filterValidClimateFiles,
  resolveClimateSuggestion
} from './climate-data-viewer.utils';

describe('climate-parse.utils', () => {
  it('parses the Ethiopia TAS JSON sample', () => {
    const parsed = parseClimateText(CLIMATE_JSON_SAMPLE);
    expect(parsed.name).toContain('Ethiopia');
    expect(parsed.nx).toBe(8);
    expect(parsed.ny).toBe(8);
    expect(parsed.nt).toBe(24);
    expect(parsed.stations.map((s) => s.id)).toEqual(['ADD', 'DIR', 'BIR']);
    expect(parsed.dataMax).toBeGreaterThan(parsed.dataMin);
  });

  it('parses climate CSV grids', () => {
    const parsed = parseClimateText(CLIMATE_CSV_SAMPLE, 'csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.nx).toBe(2);
    expect(parsed.ny).toBe(2);
    expect(parsed.nt).toBe(3);
  });

  it('parses .clim text', () => {
    const parsed = parseClimateText(CLIMATE_CLIM_SAMPLE, 'clim');
    expect(parsed.sourceKind).toBe('clim');
    expect(parsed.stations[0].id).toBe('ADD');
    expect(parsed.nt).toBe(3);
    expect(parsed.nx).toBe(2);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseClimateText('')).toThrow(/empty/i);
    expect(() => parseClimateText('hello world')).toThrow(/Unrecognized|climate/i);
  });
});

describe('climate-data-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleClimateFile();
    expect(file.name).toBe('sample-ethiopia-tas.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleClimateFile();
    const record = createClimateFileRecord(file, new TextEncoder().encode(CLIMATE_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.stations.length).toBe(3);
    expect(canExportClimate(record)).toBe(true);
  });

  it('exports series csv', () => {
    const parsed = parseClimateText(CLIMATE_JSON_SAMPLE);
    const csv = exportClimateSeriesCsv(parsed);
    expect(csv).toContain('time,spatial_mean,ADD,DIR,BIR');
    expect(csv.split('\n').length).toBe(25);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleClimateFile();
    const { accepted, rejected } = filterValidClimateFiles([
      sample,
      new File(['x'], 'field.sgy', { lastModified: 1 }),
      new File(['x'], 'tas.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('canExportClimate is false for null', () => {
    expect(canExportClimate(null)).toBe(false);
  });

  it('soft-fails unparseable text and disables export', () => {
    const file = new File(['hello world'], 'bad.json', { lastModified: 3 });
    const record = createClimateFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportClimate(record)).toBe(false);
    expect(record.warnings.length).toBeGreaterThan(0);
  });

  it('resolveClimateSuggestion returns upload when empty', () => {
    expect(resolveClimateSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolveClimateSuggestion returns sample after error', () => {
    expect(resolveClimateSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveClimateSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
