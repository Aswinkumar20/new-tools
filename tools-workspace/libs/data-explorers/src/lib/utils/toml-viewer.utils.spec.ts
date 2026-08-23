import { TM_CSV_SAMPLE, TM_JSON_SAMPLE, TM_MARKDOWN_SAMPLE } from '../constants/toml-viewer-sample.data';
import {
  buildSampleTomlBytes,
  filterTmKeys,
  filterTmRows,
  filterTmTables,
  parseTomlBytes,
  parseTomlText
} from './toml-viewer-parse.utils';
import {
  canExportTm,
  createSampleTmFile,
  createTmFileRecord,
  exportTmSchemaCsv,
  filterValidTmFiles
} from './toml-viewer.utils';

describe('toml-viewer-parse.utils', () => {
  it('parses the shop TOML sample', () => {
    const parsed = parseTomlBytes(buildSampleTomlBytes(), 'cargo-config.toml');
    expect(parsed.sourceKind).toBe('toml');
    expect(parsed.name).toBe('CargoConfig');
    expect(parsed.tables.some((t) => t.name === 'meta' && t.kind === 'table')).toBe(true);
    expect(parsed.tables.some((t) => t.name === 'orders' && t.kind === 'array-table' && t.numRows === 3)).toBe(true);
    expect(parsed.keys.some((k) => k.name === 'region' && k.value === 'US')).toBe(true);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.rows.some((r) => r.sku === 'serde')).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseTomlText(TM_JSON_SAMPLE, 'cargo.json');
    expect(json.sourceKind).toBe('json');
    expect(json.rows.length).toBe(2);

    const csv = parseTomlText(TM_CSV_SAMPLE, 'cargo.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.rows.length).toBe(2);

    const md = parseTomlText(TM_MARKDOWN_SAMPLE, 'cargo.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters tables, keys, and rows', () => {
    const parsed = parseTomlBytes(buildSampleTomlBytes(), 'cargo.toml');
    expect(filterTmTables(parsed.tables, 'tbl:ord').length).toBe(1);
    expect(filterTmKeys(parsed.keys, 'name:sku').length).toBe(1);
    expect(filterTmRows(parsed.rows, 'sku:clap').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseTomlText('')).toThrow(/empty/i);
    expect(() => parseTomlText('hello world')).toThrow(/Not a TOML/i);
  });
});

describe('toml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTmFile();
    expect(file.name).toBe('cargo-config.toml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample toml', () => {
    const file = createSampleTmFile();
    const record = createTmFileRecord(file, buildSampleTomlBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportTm(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseTomlBytes(buildSampleTomlBytes(), 'cargo.toml');
    const csv = exportTmSchemaCsv(parsed);
    expect(csv).toContain('table,path,name,type,value');
    expect(csv.split('\n').length).toBe(parsed.keys.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTmFile();
    const { accepted, rejected } = filterValidTmFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'cargo.toml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
