import { CV_CSV_SAMPLE, CV_JSON_SAMPLE, CV_MARKDOWN_SAMPLE, CV_SEMICOLON_SAMPLE } from '../constants/csv-viewer-sample.data';
import {
  buildSampleCsvBytes,
  filterCvColumns,
  filterCvRows,
  parseCsvBytes,
  parseCsvText
} from './csv-viewer-parse.utils';
import {
  canExportCv,
  createCvFileRecord,
  createSampleCvFile,
  exportCvSchemaCsv,
  filterValidCvFiles,
  resolveCvSuggestion
} from './csv-viewer.utils';

describe('csv-viewer-parse.utils', () => {
  it('parses the bakery CSV sample', () => {
    const parsed = parseCsvBytes(buildSampleCsvBytes(), 'bakery-invoices.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.delimiter).toBe(',');
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.columns.length).toBe(5);
    expect(parsed.rows.length).toBe(4);
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'INTEGER')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'total' && c.type === 'REAL')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'CROIS-01' && r.note.includes('Butter croissant'))).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'BAGUETTE' && r.note.includes('baguette'))).toBe(true);
    expect(parsed.columns.find((c) => c.name === 'note')?.nullCount).toBe(1);
  });

  it('parses JSON, Markdown, and semicolon dumps', () => {
    const json = parseCsvText(CV_JSON_SAMPLE, 'bakery.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);

    const md = parseCsvText(CV_MARKDOWN_SAMPLE, 'bakery.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);

    const semi = parseCsvText(CV_SEMICOLON_SAMPLE, 'bakery.csv');
    expect(semi.delimiter).toBe(';');
    expect(semi.columns.length).toBe(3);
    expect(semi.rows.length).toBe(2);
  });

  it('parses quoted newlines', () => {
    const parsed = parseCsvText('orderId,note\n1001,"hello\nworld"\n', 'notes.csv');
    expect(parsed.rows.length).toBe(1);
    expect(parsed.rows[0].note).toContain('hello');
    expect(parsed.rows[0].note).toContain('world');
  });

  it('filters columns and rows', () => {
    const parsed = parseCsvBytes(buildSampleCsvBytes(), 'bakery.csv');
    expect(filterCvColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterCvColumns(parsed.columns, 'type:int').length).toBe(2);
    expect(filterCvRows(parsed.rows, 'sku:BAGU').length).toBe(1);
    expect(filterCvRows(parsed.rows, 'empty:note').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseCsvText('')).toThrow(/empty/i);
    expect(() => parseCsvText('hello world')).toThrow(/Not a CSV/i);
  });
});

describe('csv-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleCvFile();
    expect(file.name).toBe('bakery-invoices.csv');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample csv', () => {
    const file = createSampleCvFile();
    const record = createCvFileRecord(file, buildSampleCsvBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(5);
    expect(canExportCv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseCsvBytes(buildSampleCsvBytes(), 'bakery.csv');
    const csv = exportCvSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,nullable,nulls,distinct,min,max');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleCvFile();
    const { accepted, rejected } = filterValidCvFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'bakery.csv.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('disables export on soft-fail and null', () => {
    expect(canExportCv({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportCv(null)).toBe(false);
  });

  it('resolves suggestions for empty and error states', () => {
    expect(resolveCvSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveCvSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveCvSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});

export { CV_CSV_SAMPLE };
