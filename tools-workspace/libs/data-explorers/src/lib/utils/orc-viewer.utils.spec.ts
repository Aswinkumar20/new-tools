import { ORC_CSV_SAMPLE, ORC_JSON_SAMPLE, ORC_MARKDOWN_SAMPLE } from '../constants/orc-viewer-sample.data';
import { buildSampleOrcBytes, filterOrcColumns, filterOrcRows, parseOrcBytes, parseOrcText } from './orc-viewer-parse.utils';
import {
  canExportOrc,
  createOrcFileRecord,
  createSampleOrcFile,
  exportOrcSchemaCsv,
  filterValidOrcFiles,
  resolveOrcSuggestion
} from './orc-viewer.utils';

describe('orc-viewer-parse.utils', () => {
  it('parses the shop ORC sample', () => {
    const parsed = parseOrcBytes(buildSampleOrcBytes(), 'hive-facts.orc');
    expect(parsed.sourceKind).toBe('orc');
    expect(parsed.columns.length).toBe(4);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.numRows).toBe(3);
    expect(parsed.compression).toBe('NONE');
    expect(parsed.version).toBe('0.12');
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'LONG')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'sku' && c.type === 'STRING')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'FCT-01')).toBe(true);
    expect(parsed.stripes.length).toBe(1);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseOrcText(ORC_JSON_SAMPLE, 'hive.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);

    const csv = parseOrcText(ORC_CSV_SAMPLE, 'hive.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.columns.length).toBe(4);
    expect(csv.rows.length).toBe(2);

    const md = parseOrcText(ORC_MARKDOWN_SAMPLE, 'hive.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters columns and rows', () => {
    const parsed = parseOrcBytes(buildSampleOrcBytes(), 'hive.orc');
    expect(filterOrcColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterOrcColumns(parsed.columns, 'type:long').length).toBe(1);
    expect(filterOrcRows(parsed.rows, 'sku:FCT-03').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseOrcText('')).toThrow(/empty/i);
    expect(() => parseOrcText('hello world')).toThrow(/Not an ORC/i);
  });
});

describe('orc-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleOrcFile();
    expect(file.name).toBe('hive-facts.orc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample orc', () => {
    const file = createSampleOrcFile();
    const record = createOrcFileRecord(file, buildSampleOrcBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(4);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportOrc(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseOrcBytes(buildSampleOrcBytes(), 'hive.orc');
    const csv = exportOrcSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,path');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleOrcFile();
    const { accepted, rejected } = filterValidOrcFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'hive.orc.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveOrcSuggestion covers empty and error states', () => {
    expect(resolveOrcSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveOrcSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveOrcSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode(JSON.stringify({ columns: [], rows: [] }));
    const file = new File([payload], 'empty.json', { lastModified: 9 });
    const record = createOrcFileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(canExportOrc(record)).toBe(false);
    expect(canExportOrc(null)).toBe(false);
  });
});
