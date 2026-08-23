import { TF_CSV_SAMPLE, TF_JSON_SAMPLE, TF_MARKDOWN_SAMPLE } from '../constants/tensorflow-graph-viewer-sample.data';
import {
  buildSampleTfGraphBytes,
  filterTfNodes,
  filterTfRows,
  filterTfTensors,
  parseTfGraphBytes,
  parseTfGraphText
} from './tensorflow-graph-viewer-parse.utils';
import {
  canExportTf,
  createSampleTfFile,
  createTfFileRecord,
  exportTfSchemaCsv,
  filterValidTfFiles
} from './tensorflow-graph-viewer.utils';

describe('tensorflow-graph-viewer-parse.utils', () => {
  it('parses the shop ranker GraphDef sample', () => {
    const parsed = parseTfGraphBytes(buildSampleTfGraphBytes(), 'sample-shop-ranker.pb');
    expect(parsed.sourceKind).toBe('graphdef');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.producer).toBe('easytoolhub');
    expect(parsed.nodes.some((n) => n.name === 'relu1' && n.op === 'Relu')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'W1' && t.kind === 'constant')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'features' && t.kind === 'placeholder')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'scores' && t.kind === 'output')).toBe(true);
    expect(parsed.rows.length).toBe(parsed.nodes.length);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseTfGraphText(TF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.name).toBe('ShopRanker');
    expect(json.nodes.some((n) => n.name === 'relu1' && n.op === 'Relu')).toBe(true);
    expect(json.tensors.some((t) => t.name === 'W1' && t.kind === 'constant')).toBe(true);

    const csv = parseTfGraphText(TF_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.nodes.length).toBeGreaterThanOrEqual(4);

    const md = parseTfGraphText(TF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBeGreaterThanOrEqual(4);
  });

  it('filters nodes, tensors, and rows', () => {
    const parsed = parseTfGraphBytes(buildSampleTfGraphBytes(), 'sample-shop-ranker.pb');
    expect(filterTfNodes(parsed.nodes, 'op:Relu').length).toBe(1);
    expect(filterTfTensors(parsed.tensors, 'tensor:W1').length).toBe(1);
    expect(filterTfRows(parsed.rows, 'name:scores').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseTfGraphText('')).toThrow(/empty/i);
    expect(() => parseTfGraphText('hello world')).toThrow(/Not a TensorFlow/i);
    expect(() => parseTfGraphBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.pb')).toThrow(/compress/i);
  });
});

describe('tensorflow-graph-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTfFile();
    expect(file.name).toBe('sample-shop-ranker.pb');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample graph', () => {
    const file = createSampleTfFile();
    const record = createTfFileRecord(file, buildSampleTfGraphBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.some((n) => n.name === 'relu1')).toBe(true);
    expect(canExportTf(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseTfGraphBytes(buildSampleTfGraphBytes(), 'sample-shop-ranker.pb');
    const csv = exportTfSchemaCsv(parsed);
    expect(csv).toContain('kind,name,op,inputs,device,shape');
    expect(csv.split('\n').length).toBe(parsed.nodes.length + parsed.tensors.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTfFile();
    const { accepted, rejected } = filterValidTfFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'graph.pb.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
