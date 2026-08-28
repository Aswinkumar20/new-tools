import { DL_CSV_SAMPLE, DL_JSON_SAMPLE, DL_LOG_SAMPLE, DL_MARKDOWN_SAMPLE } from '../constants/delta-lake-viewer-sample.data';
import {
  buildSampleDeltaBytes,
  filterDlColumns,
  filterDlRows,
  filterDlVersions,
  parseDeltaBytes,
  parseDeltaText
} from './delta-lake-viewer-parse.utils';
import {
  canExportDl,
  createDlFileRecord,
  createSampleDlFile,
  exportDlSchemaCsv,
  filterValidDlFiles,
  resolveDlSuggestion
} from './delta-lake-viewer.utils';

describe('delta-lake-viewer-parse.utils', () => {
  it('parses the shop Delta sample', () => {
    const parsed = parseDeltaBytes(buildSampleDeltaBytes(), 'event-log.delta');
    expect(parsed.sourceKind).toBe('delta');
    expect(parsed.columns.length).toBe(4);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.numRows).toBe(3);
    expect(parsed.protocol).toBe('1/2');
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'LONG')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'sku' && c.type === 'STRING')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'EVT-01')).toBe(true);
    expect(parsed.versions.length).toBe(2);
  });

  it('parses JSON, delta log, CSV, and Markdown dumps', () => {
    const json = parseDeltaText(DL_JSON_SAMPLE, 'events.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);
    expect(json.versions.length).toBe(2);

    const log = parseDeltaText(DL_LOG_SAMPLE, '00000000000000000000.json');
    expect(log.sourceKind).toBe('delta');
    expect(log.columns.length).toBe(4);
    expect(log.versions.length).toBe(1);
    expect(log.protocol).toBe('1/2');

    const csv = parseDeltaText(DL_CSV_SAMPLE, 'events.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.columns.length).toBe(4);
    expect(csv.rows.length).toBe(2);

    const md = parseDeltaText(DL_MARKDOWN_SAMPLE, 'events.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters columns, rows, and versions', () => {
    const parsed = parseDeltaBytes(buildSampleDeltaBytes(), 'events.delta');
    expect(filterDlColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterDlColumns(parsed.columns, 'type:long').length).toBe(1);
    expect(filterDlRows(parsed.rows, 'sku:EVT-03').length).toBe(1);
    expect(filterDlVersions(parsed.versions, 'op:write').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDeltaText('')).toThrow(/empty/i);
    expect(() => parseDeltaText('hello world')).toThrow(/Not a Delta/i);
  });
});

describe('delta-lake-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDlFile();
    expect(file.name).toBe('event-log.delta');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample delta', () => {
    const file = createSampleDlFile();
    const record = createDlFileRecord(file, buildSampleDeltaBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(4);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportDl(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseDeltaBytes(buildSampleDeltaBytes(), 'events.delta');
    const csv = exportDlSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,nullable,path');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDlFile();
    const { accepted, rejected } = filterValidDlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'events.delta.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('disables export on soft-fail and null', () => {
    expect(canExportDl({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportDl(null)).toBe(false);
  });

  it('resolves suggestions for empty and error states', () => {
    expect(resolveDlSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveDlSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveDlSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
