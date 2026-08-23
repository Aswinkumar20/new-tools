import { PK_CSV_SAMPLE, PK_JSON_SAMPLE, PK_MARKDOWN_SAMPLE } from '../constants/pickle-viewer-sample.data';
import {
  buildDangerousPickleProto,
  buildSamplePickleProto,
  buildSamplePkBytes,
  filterPkRows,
  filterPkTypes,
  filterPkWarnings,
  parsePkBytes,
  parsePkText
} from './pickle-viewer-parse.utils';
import {
  canExportPk,
  createPkFileRecord,
  createSamplePkFile,
  exportPkSchemaCsv,
  filterValidPkFiles
} from './pickle-viewer.utils';

describe('pickle-viewer-parse.utils', () => {
  it('parses the shop ranker PI01 sample', () => {
    const parsed = parsePkBytes(buildSamplePkBytes(), 'sample-shop-ranker.pkl');
    expect(parsed.sourceKind).toBe('pkl');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.protocol).toBe('4');
    expect(parsed.types.length).toBe(4);
    expect(parsed.types.some((t) => t.name === 'ShopRanker' && t.kind === 'class')).toBe(true);
    expect(parsed.types.some((t) => t.name === 'ndarray' && t.module === 'numpy')).toBe(true);
    expect(parsed.types.some((t) => t.name === 'Linear' && t.module === 'torch.nn')).toBe(true);
    expect(parsed.warningItems.length).toBeGreaterThanOrEqual(1);
    expect(parsed.rows.length).toBe(4);
  });

  it('parses JSON, CSV, Markdown, and PROTO dumps', () => {
    const json = parsePkText(PK_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.types.length).toBe(4);

    const csv = parsePkText(PK_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.types.length).toBe(4);

    const md = parsePkText(PK_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.types.length).toBeGreaterThanOrEqual(4);

    const proto = parsePkBytes(buildSamplePickleProto(), 'shop.pkl');
    expect(proto.sourceKind).toBe('pkl');
    expect(proto.protocol).toBe('4');
    expect(proto.types.some((t) => t.name === 'ShopRanker')).toBe(true);
    expect(proto.types.some((t) => t.name === 'Linear')).toBe(true);

    const danger = parsePkBytes(buildDangerousPickleProto(), 'evil.pkl');
    expect(danger.warningItems.some((w) => w.level === 'danger' && /os\.system/i.test(w.message))).toBe(true);
  });

  it('filters types, warnings, and rows', () => {
    const parsed = parsePkBytes(buildSamplePkBytes(), 'sample-shop-ranker.pkl');
    expect(filterPkTypes(parsed.types, 'type:ndarray').length).toBe(1);
    expect(filterPkTypes(parsed.types, 'module:torch').length).toBe(1);
    expect(filterPkWarnings(parsed.warningItems, 'warn:executed').length).toBeGreaterThanOrEqual(1);
    expect(filterPkRows(parsed.rows, 'name:ShopRanker').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parsePkText('')).toThrow(/empty/i);
    expect(() => parsePkText('hello world')).toThrow(/Not a pickle/i);
    expect(() => parsePkBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.pkl')).toThrow(/compress/i);
  });
});

describe('pickle-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePkFile();
    expect(file.name).toBe('sample-shop-ranker.pkl');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample pickle', () => {
    const file = createSamplePkFile();
    const record = createPkFileRecord(file, buildSamplePkBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.types.some((t) => t.name === 'ShopRanker')).toBe(true);
    expect(canExportPk(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parsePkBytes(buildSamplePkBytes(), 'sample-shop-ranker.pkl');
    const csv = exportPkSchemaCsv(parsed);
    expect(csv).toContain('kind,name,module,type,warning');
    expect(csv.split('\n').length).toBe(parsed.types.length + parsed.warningItems.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePkFile();
    const { accepted, rejected } = filterValidPkFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.pkl.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
