import {
  SQLS_JSON_SAMPLE,
  SQLS_MARKDOWN_SAMPLE,
  SQLS_SAMPLE,
  SQLS_XML_SAMPLE
} from '../constants/sql-schema-viewer-sample.data';
import { filterSqlsFks, filterSqlsTables, parseSqlSchemaText } from './sql-schema-viewer-parse.utils';
import {
  canExportSqls,
  createSampleSqlsFile,
  createSqlsFileRecord,
  exportSqlsTablesCsv,
  filterValidSqlsFiles,
  resolveSqlsSuggestion
} from './sql-schema-viewer.utils';

describe('sql-schema-viewer-parse.utils', () => {
  it('parses the shop SQL sample', () => {
    const parsed = parseSqlSchemaText(SQLS_SAMPLE, 'sample-shop-schema.sql');
    expect(parsed.tables.length).toBe(4);
    expect(parsed.fks.length).toBe(3);
    expect(parsed.tables.some((t) => t.name === 'customer' && t.columns.some((c) => c.pk && c.name === 'id'))).toBe(true);
    expect(parsed.tables.some((t) => t.name === 'shop_order' && t.columns.some((c) => c.fk && c.name === 'customer_id'))).toBe(true);
    expect(parsed.tables.some((t) => t.name === 'order_item' && t.columns.filter((c) => c.pk).length === 2)).toBe(true);
    expect(parsed.fks.some((fk) => fk.source === 'shop_order' && fk.target === 'customer')).toBe(true);
    expect(parsed.fks.some((fk) => fk.name === 'fk_item_order' && fk.target === 'shop_order')).toBe(true);
    expect(parsed.fks.some((fk) => fk.name === 'fk_item_product' && fk.target === 'product')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseSqlSchemaText(SQLS_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.tables.length).toBe(2);
    expect(md.fks.length).toBe(1);

    const json = parseSqlSchemaText(SQLS_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.tables.length).toBe(2);
    expect(json.fks.length).toBe(1);

    const xml = parseSqlSchemaText(SQLS_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.tables.length).toBe(2);
    expect(xml.fks.length).toBe(1);
  });

  it('filters tables and fks', () => {
    const parsed = parseSqlSchemaText(SQLS_SAMPLE, 'shop.sql');
    expect(filterSqlsTables(parsed.tables, 'table:customer').every((t) => t.name === 'customer')).toBe(true);
    expect(filterSqlsFks(parsed.fks, 'fk:order').length).toBeGreaterThan(0);
    expect(filterSqlsTables(parsed.tables, 'col:email').some((t) => t.name === 'customer')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseSqlSchemaText('')).toThrow(/empty/i);
    expect(() => parseSqlSchemaText('hello world')).toThrow(/Not a SQL/i);
  });
});

describe('sql-schema-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSqlsFile();
    expect(file.name).toBe('sample-shop-schema.sql');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample SQL', () => {
    const file = createSampleSqlsFile();
    const record = createSqlsFileRecord(file, new TextEncoder().encode(SQLS_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.tables.length).toBe(4);
    expect(canExportSqls(record)).toBe(true);
  });

  it('exports tables csv', () => {
    const parsed = parseSqlSchemaText(SQLS_SAMPLE, 'shop.sql');
    const csv = exportSqlsTablesCsv(parsed);
    expect(csv).toContain('index,id,name,columns,pk,fk');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSqlsFile();
    const { accepted, rejected } = filterValidSqlsFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.sql.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveSqlsSuggestion returns upload-or-sample and sample-after-error', () => {
    expect(resolveSqlsSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveSqlsSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveSqlsSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createSqlsFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportSqls(record)).toBe(false);
  });

  it('canExportSqls returns false for null', () => {
    expect(canExportSqls(null)).toBe(false);
  });
});
