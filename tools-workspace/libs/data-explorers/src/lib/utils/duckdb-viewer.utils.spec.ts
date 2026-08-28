import { DK_CSV_SAMPLE, DK_JSON_SAMPLE, DK_MARKDOWN_SAMPLE, DK_SQL_SAMPLE } from '../constants/duckdb-viewer-sample.data';
import {
  buildSampleDuckdbBytes,
  filterDkColumns,
  filterDkRows,
  filterDkTables,
  parseDuckdbBytes,
  parseDuckdbText
} from './duckdb-viewer-parse.utils';
import {
  canExportDk,
  createDkFileRecord,
  createSampleDkFile,
  exportDkSchemaCsv,
  filterValidDkFiles,
  resolveDkSuggestion
} from './duckdb-viewer.utils';

describe('duckdb-viewer-parse.utils', () => {
  it('parses the analytics DuckDB sample', () => {
    const parsed = parseDuckdbBytes(buildSampleDuckdbBytes(), 'analytics.duckdb');
    expect(parsed.sourceKind).toBe('duckdb');
    expect(parsed.tables.length).toBe(2);
    expect(parsed.storageVersion).toBe('64');
    const orders = parsed.tables.find((t) => t.name === 'orders');
    expect(orders?.columns.length).toBe(4);
    expect(orders?.rows.length).toBe(3);
    expect(orders?.columns.some((c) => c.name === 'orderId' && c.type === 'BIGINT')).toBe(true);
    expect(orders?.rows.some((r) => r.sku === 'SESS-01')).toBe(true);
    expect(parsed.tables.some((t) => t.name === 'products' && t.rows.length === 2)).toBe(true);
  });

  it('parses JSON, SQL, CSV, and Markdown dumps', () => {
    const json = parseDuckdbText(DK_JSON_SAMPLE, 'analytics.json');
    expect(json.sourceKind).toBe('json');
    expect(json.tables.length).toBe(1);
    expect(json.tables[0].columns.length).toBe(3);
    expect(json.tables[0].rows.length).toBe(2);

    const sql = parseDuckdbText(DK_SQL_SAMPLE, 'analytics.sql');
    expect(sql.sourceKind).toBe('sql');
    expect(sql.tables[0].columns.length).toBe(3);
    expect(sql.tables[0].rows.length).toBe(2);

    const csv = parseDuckdbText(DK_CSV_SAMPLE, 'analytics.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.tables[0].columns.length).toBe(4);
    expect(csv.tables[0].rows.length).toBe(2);

    const md = parseDuckdbText(DK_MARKDOWN_SAMPLE, 'analytics.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.tables[0].columns.length).toBeGreaterThanOrEqual(3);
    expect(md.tables[0].rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters tables, columns, and rows', () => {
    const parsed = parseDuckdbBytes(buildSampleDuckdbBytes(), 'analytics.duckdb');
    expect(filterDkTables(parsed.tables, 'tbl:prod').length).toBe(1);
    expect(filterDkColumns(parsed.tables[0].columns, 'name:sku').length).toBe(1);
    expect(filterDkRows(parsed.tables[0].rows, 'sku:SESS-03').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDuckdbText('')).toThrow(/empty/i);
    expect(() => parseDuckdbText('hello world')).toThrow(/Not a DuckDB/i);
  });
});

describe('duckdb-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDkFile();
    expect(file.name).toBe('analytics.duckdb');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample duckdb', () => {
    const file = createSampleDkFile();
    const record = createDkFileRecord(file, buildSampleDuckdbBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.tables.length).toBe(2);
    expect(canExportDk(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseDuckdbBytes(buildSampleDuckdbBytes(), 'analytics.duckdb');
    const csv = exportDkSchemaCsv(parsed);
    expect(csv).toContain('table,index,name,type,nullable');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDkFile();
    const { accepted, rejected } = filterValidDkFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'analytics.duckdb.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('disables export on soft-fail and null', () => {
    expect(canExportDk({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportDk(null)).toBe(false);
  });

  it('resolves suggestions for empty and error states', () => {
    expect(resolveDkSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveDkSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveDkSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
