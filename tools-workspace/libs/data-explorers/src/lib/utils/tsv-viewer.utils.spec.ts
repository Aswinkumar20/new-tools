import { TV_JSON_SAMPLE, TV_MARKDOWN_SAMPLE, TV_TSV_SAMPLE } from '../constants/tsv-viewer-sample.data';
import {
  buildSampleTsvBytes,
  filterTvColumns,
  filterTvRows,
  parseTsvBytes,
  parseTsvText
} from './tsv-viewer-parse.utils';
import {
  canExportTv,
  createSampleTvFile,
  createTvFileRecord,
  exportTvSchemaCsv,
  filterValidTvFiles,
  resolveTvSuggestion
} from './tsv-viewer.utils';

describe('tsv-viewer-parse.utils', () => {
  it('parses the shop TSV sample', () => {
    const parsed = parseTsvBytes(buildSampleTsvBytes(), 'blast-hits.tsv');
    expect(parsed.sourceKind).toBe('tsv');
    expect(parsed.delimiter).toBe('\t');
    expect(parsed.hasHeader).toBe(true);
    expect(parsed.columns.length).toBe(5);
    expect(parsed.rows.length).toBe(4);
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'INTEGER')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'total' && c.type === 'REAL')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'BRCA1')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'EGFR' && r.note.includes('kinase'))).toBe(true);
    expect(parsed.columns.find((c) => c.name === 'note')?.nullCount).toBe(1);
  });

  it('parses JSON and Markdown dumps', () => {
    const json = parseTsvText(TV_JSON_SAMPLE, 'blast.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);

    const md = parseTsvText(TV_MARKDOWN_SAMPLE, 'blast.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters columns and rows', () => {
    const parsed = parseTsvBytes(buildSampleTsvBytes(), 'blast.tsv');
    expect(filterTvColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterTvColumns(parsed.columns, 'type:int').length).toBe(2);
    expect(filterTvRows(parsed.rows, 'sku:EGFR').length).toBe(1);
    expect(filterTvRows(parsed.rows, 'empty:note').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseTsvText('')).toThrow(/empty/i);
    expect(() => parseTsvText('hello world')).toThrow(/Not a TSV/i);
  });
});

describe('tsv-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTvFile();
    expect(file.name).toBe('blast-hits.tsv');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample tsv', () => {
    const file = createSampleTvFile();
    const record = createTvFileRecord(file, buildSampleTsvBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(5);
    expect(canExportTv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseTsvBytes(buildSampleTsvBytes(), 'blast.tsv');
    const csv = exportTvSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,nullable,nulls,distinct,min,max');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTvFile();
    const { accepted, rejected } = filterValidTvFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'blast.tsv.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveTvSuggestion covers empty and error states', () => {
    expect(resolveTvSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveTvSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveTvSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode('hello world');
    const file = new File([payload], 'bad.txt', { lastModified: 9 });
    const record = createTvFileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportTv(record)).toBe(false);
    expect(canExportTv(null)).toBe(false);
  });
});

export { TV_TSV_SAMPLE };
