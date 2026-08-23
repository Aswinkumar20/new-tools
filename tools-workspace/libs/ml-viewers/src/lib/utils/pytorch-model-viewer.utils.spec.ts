import { PT_CSV_SAMPLE, PT_JSON_SAMPLE, PT_MARKDOWN_SAMPLE } from '../constants/pytorch-model-viewer-sample.data';
import {
  buildSamplePtBytes,
  filterPtLayers,
  filterPtParams,
  filterPtRows,
  parsePtBytes,
  parsePtText
} from './pytorch-model-viewer-parse.utils';
import {
  canExportPt,
  createPtFileRecord,
  createSamplePtFile,
  exportPtSchemaCsv,
  filterValidPtFiles
} from './pytorch-model-viewer.utils';

describe('pytorch-model-viewer-parse.utils', () => {
  it('parses the shop ranker PT01 sample', () => {
    const parsed = parsePtBytes(buildSamplePtBytes(), 'sample-shop-ranker.pt');
    expect(parsed.sourceKind).toBe('torch');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.torchVersion).toBe('2.4.0');
    expect(parsed.format).toBe('torch.nn');
    expect(parsed.layers.filter((l) => l.type === 'Linear').length).toBe(2);
    expect(parsed.layers.some((l) => l.name === 'relu1' && l.type === 'ReLU')).toBe(true);
    expect(parsed.params.length).toBe(4);
    expect(parsed.params.some((p) => p.name === 'gemm1.weight' && p.kind === 'weight')).toBe(true);
    expect(parsed.rows.length).toBe(4);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parsePtText(PT_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.length).toBe(4);
    expect(json.params.length).toBe(4);

    const csv = parsePtText(PT_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.layers.length).toBe(4);

    const md = parsePtText(PT_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.length).toBeGreaterThanOrEqual(4);
  });

  it('filters layers, params, and rows', () => {
    const parsed = parsePtBytes(buildSamplePtBytes(), 'sample-shop-ranker.pt');
    expect(filterPtLayers(parsed.layers, 'type:Linear').length).toBe(2);
    expect(filterPtParams(parsed.params, 'param:gemm1.weight').length).toBe(1);
    expect(filterPtRows(parsed.rows, 'name:softmax').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parsePtText('')).toThrow(/empty/i);
    expect(() => parsePtText('hello world')).toThrow(/Not a PyTorch/i);
    expect(() => parsePtBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.pt')).toThrow(/compress/i);
  });
});

describe('pytorch-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePtFile();
    expect(file.name).toBe('sample-shop-ranker.pt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample checkpoint', () => {
    const file = createSamplePtFile();
    const record = createPtFileRecord(file, buildSamplePtBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.filter((l) => l.type === 'Linear').length).toBe(2);
    expect(canExportPt(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parsePtBytes(buildSamplePtBytes(), 'sample-shop-ranker.pt');
    const csv = exportPtSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,shape,numel,layer');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.params.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePtFile();
    const { accepted, rejected } = filterValidPtFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.pt.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
