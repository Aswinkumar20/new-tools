import { TV_CSV_SAMPLE, TV_JSON_SAMPLE, TV_MARKDOWN_SAMPLE } from '../constants/tensor-visualization-viewer-sample.data';
import {
  buildSampleNpyBytes,
  buildSampleTvBytes,
  filterTvRows,
  filterTvShapes,
  filterTvStats,
  parseTvBytes,
  parseTvText
} from './tensor-visualization-viewer-parse.utils';
import {
  canExportTv,
  createSampleTvFile,
  createTvFileRecord,
  exportTvSchemaCsv,
  filterValidTvFiles
} from './tensor-visualization-viewer.utils';

describe('tensor-visualization-viewer-parse.utils', () => {
  it('parses the shop ranker TV01 sample', () => {
    const parsed = parseTvBytes(buildSampleTvBytes(), 'sample-shop-ranker.tensor');
    expect(parsed.sourceKind).toBe('tensor');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.framework).toBe('generic');
    expect(parsed.tensors.length).toBe(6);
    expect(parsed.tensors.some((t) => t.name === 'gemm1/kernel' && t.kind === 'weight')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'scores' && t.kind === 'output')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'gemm1/kernel' && t.max === '0.51')).toBe(true);
    expect(parsed.rows.length).toBe(6);
  });

  it('parses JSON, CSV, Markdown, and NPY dumps', () => {
    const json = parseTvText(TV_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.tensors.length).toBe(6);
    expect(json.tensors.filter((t) => t.kind === 'weight').length).toBe(2);

    const csv = parseTvText(TV_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.tensors.length).toBe(6);

    const md = parseTvText(TV_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.tensors.length).toBeGreaterThanOrEqual(6);

    const npy = parseTvBytes(buildSampleNpyBytes(), 'gemm1_kernel.npy');
    expect(npy.sourceKind).toBe('npy');
    expect(npy.tensors.length).toBe(1);
    expect(npy.tensors[0].dtype).toBe('float32');
    expect(npy.tensors[0].shape).toEqual([4, 8]);
  });

  it('filters tensors, stats, and rows', () => {
    const parsed = parseTvBytes(buildSampleTvBytes(), 'sample-shop-ranker.tensor');
    expect(filterTvShapes(parsed.tensors, 'kind:weight').length).toBe(2);
    expect(filterTvStats(parsed.tensors, 'stat:0.51').length).toBe(1);
    expect(filterTvRows(parsed.rows, 'name:scores').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseTvText('')).toThrow(/empty/i);
    expect(() => parseTvText('hello world')).toThrow(/Not a tensor/i);
    expect(() => parseTvBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.tensor')).toThrow(/compress/i);
  });
});

describe('tensor-visualization-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTvFile();
    expect(file.name).toBe('sample-shop-ranker.tensor');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample tensor dump', () => {
    const file = createSampleTvFile();
    const record = createTvFileRecord(file, buildSampleTvBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.tensors.some((t) => t.name === 'gemm1/kernel')).toBe(true);
    expect(canExportTv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseTvBytes(buildSampleTvBytes(), 'sample-shop-ranker.tensor');
    const csv = exportTvSchemaCsv(parsed);
    expect(csv).toContain('kind,name,dtype,shape,numel,stat');
    expect(csv.split('\n').length).toBe(parsed.tensors.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTvFile();
    const { accepted, rejected } = filterValidTvFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'tensors.tensor.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
