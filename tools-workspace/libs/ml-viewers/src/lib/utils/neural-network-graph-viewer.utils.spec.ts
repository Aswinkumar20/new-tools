import { NN_CSV_SAMPLE, NN_JSON_SAMPLE, NN_MARKDOWN_SAMPLE } from '../constants/neural-network-graph-viewer-sample.data';
import {
  buildSampleNnBytes,
  filterNnConnections,
  filterNnLayers,
  filterNnRows,
  parseNnBytes,
  parseNnText
} from './neural-network-graph-viewer-parse.utils';
import {
  canExportNn,
  createNnFileRecord,
  createSampleNnFile,
  exportNnSchemaCsv,
  filterValidNnFiles
} from './neural-network-graph-viewer.utils';

describe('neural-network-graph-viewer-parse.utils', () => {
  it('parses the shop ranker NN01 sample', () => {
    const parsed = parseNnBytes(buildSampleNnBytes(), 'sample-shop-ranker.nn');
    expect(parsed.sourceKind).toBe('nn');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.framework).toBe('generic');
    expect(parsed.layers.length).toBe(5);
    expect(parsed.layers.some((l) => l.name === 'relu1' && l.type === 'ReLU')).toBe(true);
    expect(parsed.connections.length).toBe(4);
    expect(parsed.connections.some((c) => c.source === 'features' && c.target === 'gemm1')).toBe(true);
    expect(parsed.rows.length).toBe(5);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseNnText(NN_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.length).toBe(5);
    expect(json.connections.length).toBe(4);

    const csv = parseNnText(NN_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.layers.length).toBe(5);
    expect(csv.connections.length).toBe(4);

    const md = parseNnText(NN_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.length).toBeGreaterThanOrEqual(5);
  });

  it('filters layers, connections, and rows', () => {
    const parsed = parseNnBytes(buildSampleNnBytes(), 'sample-shop-ranker.nn');
    expect(filterNnLayers(parsed.layers, 'type:ReLU').length).toBe(1);
    expect(filterNnConnections(parsed.connections, 'from:features').length).toBe(1);
    expect(filterNnRows(parsed.rows, 'name:scores').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseNnText('')).toThrow(/empty/i);
    expect(() => parseNnText('hello world')).toThrow(/Not a neural network/i);
    expect(() => parseNnBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.nn')).toThrow(/compress/i);
  });
});

describe('neural-network-graph-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleNnFile();
    expect(file.name).toBe('sample-shop-ranker.nn');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample nn', () => {
    const file = createSampleNnFile();
    const record = createNnFileRecord(file, buildSampleNnBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.name === 'relu1')).toBe(true);
    expect(canExportNn(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseNnBytes(buildSampleNnBytes(), 'sample-shop-ranker.nn');
    const csv = exportNnSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,source,target,units');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.connections.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleNnFile();
    const { accepted, rejected } = filterValidNnFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'graph.nn.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
