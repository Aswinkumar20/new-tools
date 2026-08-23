import { PQ_CSV_SAMPLE, PQ_JSON_SAMPLE, PQ_MARKDOWN_SAMPLE } from '../constants/parquet-viewer-sample.data';
import { buildSampleParquetBytes, filterPqColumns, filterPqRows, parseParquetBytes, parseParquetText } from './parquet-viewer-parse.utils';
import {
  canExportPq,
  createPqFileRecord,
  createSamplePqFile,
  exportPqSchemaCsv,
  filterValidPqFiles
} from './parquet-viewer.utils';

describe('parquet-viewer-parse.utils', () => {
  it('parses the taxi Parquet sample', () => {
    const parsed = parseParquetBytes(buildSampleParquetBytes(), 'nyc-taxi.parquet');
    expect(parsed.sourceKind).toBe('parquet');
    expect(parsed.columns.length).toBe(4);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.numRows).toBe(3);
    expect(parsed.createdBy).toContain('easytoolhub');
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'INT64')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'sku' && c.convertedType === 'UTF8')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'VND-1')).toBe(true);
    expect(parsed.profiles.some((p) => p.column === 'total' && p.distinct >= 2)).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseParquetText(PQ_JSON_SAMPLE, 'taxi.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);

    const csv = parseParquetText(PQ_CSV_SAMPLE, 'taxi.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.columns.length).toBe(4);
    expect(csv.rows.length).toBe(2);

    const md = parseParquetText(PQ_MARKDOWN_SAMPLE, 'taxi.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters columns and rows', () => {
    const parsed = parseParquetBytes(buildSampleParquetBytes(), 'taxi.parquet');
    expect(filterPqColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterPqColumns(parsed.columns, 'type:int64').length).toBe(1);
    expect(filterPqRows(parsed.rows, 'sku:VND-3').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseParquetText('')).toThrow(/empty/i);
    expect(() => parseParquetText('hello world')).toThrow(/Not a Parquet/i);
  });
});

describe('parquet-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePqFile();
    expect(file.name).toBe('nyc-taxi.parquet');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample parquet', () => {
    const file = createSamplePqFile();
    const record = createPqFileRecord(file, buildSampleParquetBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(4);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportPq(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseParquetBytes(buildSampleParquetBytes(), 'taxi.parquet');
    const csv = exportPqSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,logical,repetition');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePqFile();
    const { accepted, rejected } = filterValidPqFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'taxi.parquet.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
