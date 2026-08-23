import { AR_CSV_SAMPLE, AR_JSON_SAMPLE, AR_MARKDOWN_SAMPLE } from '../constants/arrow-viewer-sample.data';
import { buildSampleArrowBytes, filterArColumns, filterArRows, parseArrowBytes, parseArrowText } from './arrow-viewer-parse.utils';
import {
  canExportAr,
  createArFileRecord,
  createSampleArFile,
  exportArSchemaCsv,
  filterValidArFiles
} from './arrow-viewer.utils';

describe('arrow-viewer-parse.utils', () => {
  it('parses the shop Arrow sample', () => {
    const parsed = parseArrowBytes(buildSampleArrowBytes(), 'telemetry.arrow');
    expect(parsed.sourceKind).toBe('arrow');
    expect(parsed.columns.length).toBe(4);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.numRows).toBe(3);
    expect(parsed.version).toBe('ipc');
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'INT64')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'sku' && c.type === 'UTF8')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'DEV-A1')).toBe(true);
    expect(parsed.batches.length).toBe(2);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseArrowText(AR_JSON_SAMPLE, 'telemetry.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);

    const csv = parseArrowText(AR_CSV_SAMPLE, 'telemetry.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.columns.length).toBe(4);
    expect(csv.rows.length).toBe(2);

    const md = parseArrowText(AR_MARKDOWN_SAMPLE, 'telemetry.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters columns and rows', () => {
    const parsed = parseArrowBytes(buildSampleArrowBytes(), 'telemetry.arrow');
    expect(filterArColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterArColumns(parsed.columns, 'type:int64').length).toBe(1);
    expect(filterArRows(parsed.rows, 'sku:DEV-C').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseArrowText('')).toThrow(/empty/i);
    expect(() => parseArrowText('hello world')).toThrow(/Not an Arrow/i);
  });
});

describe('arrow-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleArFile();
    expect(file.name).toBe('telemetry.arrow');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample arrow', () => {
    const file = createSampleArFile();
    const record = createArFileRecord(file, buildSampleArrowBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(4);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportAr(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseArrowBytes(buildSampleArrowBytes(), 'telemetry.arrow');
    const csv = exportArSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,path');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleArFile();
    const { accepted, rejected } = filterValidArFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'telemetry.arrow.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
