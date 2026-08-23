import { KS_CSV_SAMPLE, KS_JSON_SAMPLE, KS_KERAS_CONFIG_SAMPLE, KS_MARKDOWN_SAMPLE } from '../constants/keras-model-viewer-sample.data';
import {
  buildSampleKsBytes,
  filterKsLayers,
  filterKsRows,
  filterKsShapes,
  parseKsBytes,
  parseKsText
} from './keras-model-viewer-parse.utils';
import {
  canExportKs,
  createKsFileRecord,
  createSampleKsFile,
  exportKsSchemaCsv,
  filterValidKsFiles
} from './keras-model-viewer.utils';

describe('keras-model-viewer-parse.utils', () => {
  it('parses the shop ranker Keras ZIP sample', () => {
    const parsed = parseKsBytes(buildSampleKsBytes(), 'sample-shop-ranker.keras');
    expect(parsed.sourceKind).toBe('keras');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.className).toBe('Sequential');
    expect(parsed.kerasVersion).toBe('3.5.0');
    expect(parsed.layers.filter((l) => l.type === 'Dense').length).toBe(2);
    expect(parsed.layers.some((l) => l.name === 'relu1' && l.type === 'ReLU')).toBe(true);
    expect(parsed.shapes.some((s) => s.name === 'features' && s.kind === 'input')).toBe(true);
    expect(parsed.shapes.some((s) => s.name === 'gemm1/kernel' && s.kind === 'weight')).toBe(true);
    expect(parsed.shapes.some((s) => s.name === 'scores' && s.kind === 'output')).toBe(true);
    expect(parsed.rows.length).toBe(5);
  });

  it('parses JSON, native config, CSV, and Markdown dumps', () => {
    const json = parseKsText(KS_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.length).toBe(5);
    expect(json.shapes.length).toBeGreaterThanOrEqual(6);

    const cfg = parseKsText(KS_KERAS_CONFIG_SAMPLE, 'config.json');
    expect(cfg.layers.filter((l) => l.type === 'Dense').length).toBe(2);

    const csv = parseKsText(KS_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.layers.length).toBe(5);

    const md = parseKsText(KS_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.length).toBeGreaterThanOrEqual(5);
  });

  it('filters layers, shapes, and rows', () => {
    const parsed = parseKsBytes(buildSampleKsBytes(), 'sample-shop-ranker.keras');
    expect(filterKsLayers(parsed.layers, 'type:Dense').length).toBe(2);
    expect(filterKsShapes(parsed.shapes, 'shape:gemm1/kernel').length).toBe(1);
    expect(filterKsRows(parsed.rows, 'name:scores').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseKsText('')).toThrow(/empty/i);
    expect(() => parseKsText('hello world')).toThrow(/Not a Keras/i);
    expect(() => parseKsBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.keras')).toThrow(/compress/i);
  });
});

describe('keras-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleKsFile();
    expect(file.name).toBe('sample-shop-ranker.keras');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample keras', () => {
    const file = createSampleKsFile();
    const record = createKsFileRecord(file, buildSampleKsBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.filter((l) => l.type === 'Dense').length).toBe(2);
    expect(canExportKs(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseKsBytes(buildSampleKsBytes(), 'sample-shop-ranker.keras');
    const csv = exportKsSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,activation,units,shape');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.shapes.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleKsFile();
    const { accepted, rejected } = filterValidKsFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.keras.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
