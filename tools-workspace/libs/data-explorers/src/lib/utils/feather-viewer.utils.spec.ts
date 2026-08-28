import { FT_CSV_SAMPLE, FT_JSON_SAMPLE, FT_MARKDOWN_SAMPLE } from '../constants/feather-viewer-sample.data';
import { buildSampleFeatherBytes, filterFtColumns, filterFtRows, parseFeatherBytes, parseFeatherText } from './feather-viewer-parse.utils';
import {
  canExportFt,
  createFtFileRecord,
  createSampleFtFile,
  exportFtSchemaCsv,
  filterValidFtFiles,
  resolveFtSuggestion
} from './feather-viewer.utils';

describe('feather-viewer-parse.utils', () => {
  it('parses the shop Feather sample', () => {
    const parsed = parseFeatherBytes(buildSampleFeatherBytes(), 'pandas-metrics.feather');
    expect(parsed.sourceKind).toBe('feather');
    expect(parsed.columns.length).toBe(4);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.numRows).toBe(3);
    expect(parsed.columns.some((c) => c.name === 'orderId' && c.type === 'INT64')).toBe(true);
    expect(parsed.columns.some((c) => c.name === 'sku' && c.type === 'UTF8')).toBe(true);
    expect(parsed.rows.some((r) => r.sku === 'MET-CPU')).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseFeatherText(FT_JSON_SAMPLE, 'metrics.json');
    expect(json.sourceKind).toBe('json');
    expect(json.columns.length).toBe(3);
    expect(json.rows.length).toBe(2);

    const csv = parseFeatherText(FT_CSV_SAMPLE, 'metrics.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.columns.length).toBe(4);
    expect(csv.rows.length).toBe(2);

    const md = parseFeatherText(FT_MARKDOWN_SAMPLE, 'metrics.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.columns.length).toBeGreaterThanOrEqual(3);
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters columns and rows', () => {
    const parsed = parseFeatherBytes(buildSampleFeatherBytes(), 'metrics.feather');
    expect(filterFtColumns(parsed.columns, 'name:sku').length).toBe(1);
    expect(filterFtColumns(parsed.columns, 'type:int64').length).toBe(1);
    expect(filterFtRows(parsed.rows, 'sku:MET-D').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseFeatherText('')).toThrow(/empty/i);
    expect(() => parseFeatherText('hello world')).toThrow(/Not a Feather/i);
  });
});

describe('feather-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFtFile();
    expect(file.name).toBe('pandas-metrics.feather');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample feather', () => {
    const file = createSampleFtFile();
    const record = createFtFileRecord(file, buildSampleFeatherBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(4);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportFt(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseFeatherBytes(buildSampleFeatherBytes(), 'metrics.feather');
    const csv = exportFtSchemaCsv(parsed);
    expect(csv).toContain('index,name,type,offset,bytes');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleFtFile();
    const { accepted, rejected } = filterValidFtFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'metrics.feather.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('disables export on soft-fail and null', () => {
    expect(canExportFt({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportFt(null)).toBe(false);
  });

  it('resolves suggestions for empty and error states', () => {
    expect(resolveFtSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveFtSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveFtSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
