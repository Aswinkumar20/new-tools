import { MA_CSV_SAMPLE, MA_JSON_SAMPLE, MA_MARKDOWN_SAMPLE } from '../constants/model-architecture-viewer-sample.data';
import {
  buildSampleMaBytes,
  filterMaBlocks,
  filterMaParams,
  filterMaRows,
  parseMaBytes,
  parseMaText
} from './model-architecture-viewer-parse.utils';
import {
  canExportMa,
  createMaFileRecord,
  createSampleMaFile,
  exportMaSchemaCsv,
  filterValidMaFiles
} from './model-architecture-viewer.utils';

describe('model-architecture-viewer-parse.utils', () => {
  it('parses the shop ranker MA01 sample', () => {
    const parsed = parseMaBytes(buildSampleMaBytes(), 'sample-shop-ranker.arch');
    expect(parsed.sourceKind).toBe('arch');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.family).toBe('mlp');
    expect(parsed.blocks.length).toBe(3);
    expect(parsed.blocks.some((b) => b.name === 'encoder' && b.role === 'encoder')).toBe(true);
    expect(parsed.params.length).toBe(4);
    expect(parsed.params.some((p) => p.name === 'encoder.weight' && p.kind === 'weight')).toBe(true);
    expect(parsed.rows.length).toBe(3);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseMaText(MA_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.blocks.length).toBe(3);
    expect(json.params.length).toBe(4);

    const csv = parseMaText(MA_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.blocks.length).toBe(3);
    expect(csv.params.length).toBeGreaterThanOrEqual(2);

    const md = parseMaText(MA_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.blocks.length).toBeGreaterThanOrEqual(3);
  });

  it('filters blocks, params, and rows', () => {
    const parsed = parseMaBytes(buildSampleMaBytes(), 'sample-shop-ranker.arch');
    expect(filterMaBlocks(parsed.blocks, 'role:encoder').length).toBe(1);
    expect(filterMaParams(parsed.params, 'param:encoder.weight').length).toBe(1);
    expect(filterMaRows(parsed.rows, 'name:head').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseMaText('')).toThrow(/empty/i);
    expect(() => parseMaText('hello world')).toThrow(/Not a model architecture/i);
    expect(() => parseMaBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.arch')).toThrow(/compress/i);
  });
});

describe('model-architecture-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMaFile();
    expect(file.name).toBe('sample-shop-ranker.arch');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample arch', () => {
    const file = createSampleMaFile();
    const record = createMaFileRecord(file, buildSampleMaBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.params.length).toBe(4);
    expect(canExportMa(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseMaBytes(buildSampleMaBytes(), 'sample-shop-ranker.arch');
    const csv = exportMaSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,shape,numel,block');
    expect(csv.split('\n').length).toBe(parsed.blocks.length + parsed.params.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleMaFile();
    const { accepted, rejected } = filterValidMaFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.arch.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
