import { IN_CSV_SAMPLE, IN_JSON_SAMPLE, IN_MARKDOWN_SAMPLE } from '../constants/ini-viewer-sample.data';
import {
  buildSampleIniBytes,
  filterInKeys,
  filterInRows,
  filterInSections,
  parseIniBytes,
  parseIniText
} from './ini-viewer-parse.utils';
import {
  canExportIn,
  createSampleInFile,
  createInFileRecord,
  exportInSchemaCsv,
  filterValidInFiles,
  resolveInSuggestion
} from './ini-viewer.utils';

describe('ini-viewer-parse.utils', () => {
  it('parses the app INI sample', () => {
    const parsed = parseIniBytes(buildSampleIniBytes(), 'app-config.ini');
    expect(parsed.sourceKind).toBe('ini');
    expect(parsed.name).toBe('AppConfig');
    expect(parsed.sections.some((s) => s.name === 'meta' && s.kind === 'section')).toBe(true);
    expect(parsed.sections.some((s) => s.name === 'orders' && s.kind === 'group' && s.numRows === 3)).toBe(true);
    expect(parsed.keys.some((k) => k.name === 'region' && k.value === 'US')).toBe(true);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.rows.some((r) => r.sku === 'DB-MAIN')).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseIniText(IN_JSON_SAMPLE, 'app.json');
    expect(json.sourceKind).toBe('json');
    expect(json.rows.length).toBe(2);

    const csv = parseIniText(IN_CSV_SAMPLE, 'app.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.rows.length).toBe(2);

    const md = parseIniText(IN_MARKDOWN_SAMPLE, 'app.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters sections, keys, and rows', () => {
    const parsed = parseIniBytes(buildSampleIniBytes(), 'app.ini');
    expect(filterInSections(parsed.sections, 'sec:ord').length).toBeGreaterThanOrEqual(1);
    expect(filterInKeys(parsed.keys, 'name:sku').length).toBeGreaterThanOrEqual(1);
    expect(filterInRows(parsed.rows, 'sku:DB-C').length).toBe(1);
  });

  it('warns on duplicate keys', () => {
    const parsed = parseIniText('[shop]\nactive=true\nactive=false\n', 'dup.ini');
    expect(parsed.warnings.some((w) => /duplicate key/i.test(w))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseIniText('')).toThrow(/empty/i);
    expect(() => parseIniText('hello world')).toThrow(/Not an INI/i);
  });
});

describe('ini-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleInFile();
    expect(file.name).toBe('app-config.ini');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample ini', () => {
    const file = createSampleInFile();
    const record = createInFileRecord(file, buildSampleIniBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportIn(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseIniBytes(buildSampleIniBytes(), 'app.ini');
    const csv = exportInSchemaCsv(parsed);
    expect(csv).toContain('section,path,name,type,value');
    expect(csv.split('\n').length).toBe(parsed.keys.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleInFile();
    const { accepted, rejected } = filterValidInFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'app.ini.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveInSuggestion covers empty and error states', () => {
    expect(resolveInSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveInSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveInSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode('hello world');
    const file = new File([payload], 'bad.txt', { lastModified: 9 });
    const record = createInFileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportIn(record)).toBe(false);
    expect(canExportIn(null)).toBe(false);
  });
});
