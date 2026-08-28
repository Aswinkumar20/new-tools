import { JN_CSV_SAMPLE, JN_JSONL_SAMPLE, JN_JSON_SAMPLE, JN_MARKDOWN_SAMPLE } from '../constants/json-viewer-sample.data';
import {
  buildSampleJsonBytes,
  filterJnNodes,
  filterJnRows,
  parseJsonBytes,
  parseJsonText
} from './json-viewer-parse.utils';
import {
  canExportJn,
  createJnFileRecord,
  createSampleJnFile,
  exportJnSchemaCsv,
  filterValidJnFiles,
  resolveJnSuggestion
} from './json-viewer.utils';

describe('json-viewer-parse.utils', () => {
  it('parses the API users JSON sample', () => {
    const parsed = parseJsonBytes(buildSampleJsonBytes(), 'api-users.json');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.rootType).toBe('object');
    expect(parsed.name).toBe('ApiUsers');
    expect(parsed.nodes.length).toBeGreaterThan(10);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.columns.some((c) => c.name === 'sku')).toBe(true);
    expect(parsed.nodes.some((n) => n.name === 'active' && n.type === 'boolean')).toBe(true);
    expect(parsed.nodes.some((n) => n.name === 'note' && n.type === 'null')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'USR-ADA')).toBe(true);
  });

  it('parses JSONL, CSV, and Markdown dumps', () => {
    const jsonl = parseJsonText(JN_JSONL_SAMPLE, 'users.jsonl');
    expect(jsonl.sourceKind).toBe('jsonl');
    expect(jsonl.rows.length).toBe(3);
    expect(jsonl.rootType).toBe('array');

    const csv = parseJsonText(JN_CSV_SAMPLE, 'users.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.columns.length).toBe(3);
    expect(csv.rows.length).toBe(2);

    const md = parseJsonText(JN_MARKDOWN_SAMPLE, 'users.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters nodes and rows', () => {
    const parsed = parseJsonBytes(buildSampleJsonBytes(), 'users.json');
    expect(filterJnNodes(parsed.nodes, 'name:sku').length).toBeGreaterThan(0);
    expect(filterJnNodes(parsed.nodes, 'type:boolean').length).toBe(1);
    expect(filterJnNodes(parsed.nodes, 'sku:USR-K').length).toBe(1);
    expect(filterJnRows(parsed.rows, 'sku:USR-K').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseJsonText('')).toThrow(/empty/i);
    expect(() => parseJsonText('hello world')).toThrow(/Not a JSON/i);
  });
});

describe('json-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleJnFile();
    expect(file.name).toBe('api-users.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample json', () => {
    const file = createSampleJnFile();
    const record = createJnFileRecord(file, buildSampleJsonBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportJn(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseJsonBytes(buildSampleJsonBytes(), 'users.json');
    const csv = exportJnSchemaCsv(parsed);
    expect(csv).toContain('path,name,type,nullable,childCount,sample');
    expect(csv.split('\n').length).toBe(parsed.schema.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleJnFile();
    const { accepted, rejected } = filterValidJnFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'users.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveJnSuggestion covers empty and error states', () => {
    expect(resolveJnSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveJnSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveJnSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode('hello world');
    const file = new File([payload], 'bad.txt', { lastModified: 9 });
    const record = createJnFileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportJn(record)).toBe(false);
    expect(canExportJn(null)).toBe(false);
  });
});

export { JN_JSON_SAMPLE };
