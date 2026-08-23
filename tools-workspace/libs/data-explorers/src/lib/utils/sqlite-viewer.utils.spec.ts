import { SQ_CSV_SAMPLE, SQ_JSON_SAMPLE, SQ_MARKDOWN_SAMPLE, SQ_SQL_SAMPLE } from '../constants/sqlite-viewer-sample.data';
import {
  buildSampleSqliteBytes,
  filterSqColumns,
  filterSqRows,
  filterSqTables,
  parseSqliteBytes,
  parseSqliteText
} from './sqlite-viewer-parse.utils';
import {
  canExportSq,
  createSampleSqFile,
  createSqFileRecord,
  exportSqSchemaCsv,
  filterValidSqFiles
} from './sqlite-viewer.utils';

describe('sqlite-viewer-parse.utils', () => {
  it('parses the library SQLite sample', () => {
    const parsed = parseSqliteBytes(buildSampleSqliteBytes(), 'library.sqlite');
    expect(parsed.sourceKind).toBe('sqlite');
    expect(parsed.tables.length).toBe(2);
    expect(parsed.pageSize).toBe(1024);
    expect(parsed.encoding).toBe('UTF-8');
    const orders = parsed.tables.find((t) => t.name === 'orders');
    expect(orders?.columns.length).toBe(4);
    expect(orders?.rows.length).toBe(3);
    expect(orders?.columns.some((c) => c.name === 'orderId' && c.type === 'INTEGER' && c.pk)).toBe(true);
    expect(orders?.rows.some((r) => r.sku === 'ISBN-01')).toBe(true);
    expect(parsed.tables.some((t) => t.name === 'products' && t.rows.length === 2)).toBe(true);
  });

  it('parses JSON, SQL, CSV, and Markdown dumps', () => {
    const json = parseSqliteText(SQ_JSON_SAMPLE, 'library.json');
    expect(json.sourceKind).toBe('json');
    expect(json.tables.length).toBe(1);
    expect(json.tables[0].columns.length).toBe(3);
    expect(json.tables[0].rows.length).toBe(2);

    const sql = parseSqliteText(SQ_SQL_SAMPLE, 'library.sql');
    expect(sql.sourceKind).toBe('sql');
    expect(sql.tables[0].columns.length).toBe(3);
    expect(sql.tables[0].rows.length).toBe(2);

    const csv = parseSqliteText(SQ_CSV_SAMPLE, 'library.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.tables[0].columns.length).toBe(4);
    expect(csv.tables[0].rows.length).toBe(2);

    const md = parseSqliteText(SQ_MARKDOWN_SAMPLE, 'library.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.tables[0].columns.length).toBeGreaterThanOrEqual(3);
    expect(md.tables[0].rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters tables, columns, and rows', () => {
    const parsed = parseSqliteBytes(buildSampleSqliteBytes(), 'library.sqlite');
    expect(filterSqTables(parsed.tables, 'tbl:prod').length).toBe(1);
    expect(filterSqColumns(parsed.tables[0].columns, 'name:sku').length).toBe(1);
    expect(filterSqRows(parsed.tables[0].rows, 'sku:ISBN-03').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseSqliteText('')).toThrow(/empty/i);
    expect(() => parseSqliteText('hello world')).toThrow(/Not a SQLite/i);
  });
});

describe('sqlite-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSqFile();
    expect(file.name).toBe('library.sqlite');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample sqlite', () => {
    const file = createSampleSqFile();
    const record = createSqFileRecord(file, buildSampleSqliteBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.tables.length).toBe(2);
    expect(canExportSq(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseSqliteBytes(buildSampleSqliteBytes(), 'library.sqlite');
    const csv = exportSqSchemaCsv(parsed);
    expect(csv).toContain('table,index,name,type,nullable,pk');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSqFile();
    const { accepted, rejected } = filterValidSqFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'library.sqlite.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
