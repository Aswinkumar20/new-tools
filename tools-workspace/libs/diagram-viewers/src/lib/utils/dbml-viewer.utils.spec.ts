import {
  DBML_JSON_SAMPLE,
  DBML_MARKDOWN_SAMPLE,
  DBML_SAMPLE,
  DBML_XML_SAMPLE
} from '../constants/dbml-viewer-sample.data';
import { filterDbmlRefs, filterDbmlTables, parseDbmlText } from './dbml-viewer-parse.utils';
import {
  canExportDbml,
  createDbmlFileRecord,
  createSampleDbmlFile,
  exportDbmlTablesCsv,
  filterValidDbmlFiles
} from './dbml-viewer.utils';

describe('dbml-viewer-parse.utils', () => {
  it('parses the shop DBML sample', () => {
    const parsed = parseDbmlText(DBML_SAMPLE, 'sample-shop.dbml');
    expect(parsed.title).toBe('Shop');
    expect(parsed.databaseType).toBe('PostgreSQL');
    expect(parsed.tables.length).toBe(3);
    expect(parsed.refs.length).toBe(2);
    expect(parsed.tables.some((t) => t.name === 'Customer' && t.columns.some((c) => c.pk && c.name === 'id'))).toBe(true);
    expect(parsed.tables.some((t) => t.name === 'Order' && t.columns.some((c) => c.fk && c.name === 'customer_id'))).toBe(true);
    expect(parsed.refs.some((r) => r.source === 'Order' && r.target === 'Customer' && r.rel === '>')).toBe(true);
    expect(parsed.refs.some((r) => r.name === 'items' && r.target === 'Product')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseDbmlText(DBML_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.tables.length).toBe(2);
    expect(md.refs.length).toBe(1);

    const json = parseDbmlText(DBML_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.tables.length).toBe(2);
    expect(json.refs.length).toBe(1);

    const xml = parseDbmlText(DBML_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.tables.length).toBe(2);
    expect(xml.refs.length).toBe(1);
  });

  it('filters tables and refs', () => {
    const parsed = parseDbmlText(DBML_SAMPLE, 'shop.dbml');
    expect(filterDbmlTables(parsed.tables, 'table:Customer').every((t) => t.name === 'Customer')).toBe(true);
    expect(filterDbmlRefs(parsed.refs, 'from:Order').length).toBe(2);
    expect(filterDbmlTables(parsed.tables, 'col:email').some((t) => t.name === 'Customer')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDbmlText('')).toThrow(/empty/i);
    expect(() => parseDbmlText('hello world')).toThrow(/Not a DBML/i);
  });
});

describe('dbml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDbmlFile();
    expect(file.name).toBe('sample-shop.dbml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample DBML', () => {
    const file = createSampleDbmlFile();
    const record = createDbmlFileRecord(file, new TextEncoder().encode(DBML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.tables.length).toBe(3);
    expect(canExportDbml(record)).toBe(true);
  });

  it('exports tables csv', () => {
    const parsed = parseDbmlText(DBML_SAMPLE, 'shop.dbml');
    const csv = exportDbmlTablesCsv(parsed);
    expect(csv).toContain('index,id,name,columns,pk,fk');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDbmlFile();
    const { accepted, rejected } = filterValidDbmlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.dbml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
