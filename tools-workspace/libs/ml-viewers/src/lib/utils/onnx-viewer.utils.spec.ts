import { OX_CSV_SAMPLE, OX_JSON_SAMPLE, OX_MARKDOWN_SAMPLE } from '../constants/onnx-viewer-sample.data';
import {
  buildSampleOnnxBytes,
  filterOxNodes,
  filterOxRows,
  filterOxTensors,
  parseOnnxBytes,
  parseOnnxText
} from './onnx-viewer-parse.utils';
import {
  canExportOx,
  createOxFileRecord,
  createSampleOxFile,
  exportOxSchemaCsv,
  filterValidOxFiles
} from './onnx-viewer.utils';

describe('onnx-viewer-parse.utils', () => {
  it('parses the shop ranker ONNX sample', () => {
    const parsed = parseOnnxBytes(buildSampleOnnxBytes(), 'sample-shop-ranker.onnx');
    expect(parsed.sourceKind).toBe('onnx');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.irVersion).toBe('8');
    expect(parsed.producerName).toBe('easytoolhub');
    expect(parsed.opset).toBe('18');
    expect(parsed.nodes.length).toBe(4);
    expect(parsed.nodes.some((n) => n.name === 'relu1' && n.opType === 'Relu')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'W1' && t.kind === 'initializer')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'features' && t.kind === 'input')).toBe(true);
    expect(parsed.tensors.some((t) => t.name === 'scores' && t.kind === 'output')).toBe(true);
    expect(parsed.rows.length).toBe(4);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseOnnxText(OX_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(4);
    expect(json.tensors.length).toBeGreaterThanOrEqual(6);

    const csv = parseOnnxText(OX_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.nodes.length).toBe(4);

    const md = parseOnnxText(OX_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBeGreaterThanOrEqual(4);
  });

  it('filters ops, tensors, and rows', () => {
    const parsed = parseOnnxBytes(buildSampleOnnxBytes(), 'shop.onnx');
    expect(filterOxNodes(parsed.nodes, 'op:Relu').length).toBe(1);
    expect(filterOxTensors(parsed.tensors, 'tensor:W1').length).toBe(1);
    expect(filterOxRows(parsed.rows, 'name:softmax').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseOnnxText('')).toThrow(/empty/i);
    expect(() => parseOnnxText('hello world')).toThrow(/Not an ONNX/i);
  });
});

describe('onnx-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleOxFile();
    expect(file.name).toBe('sample-shop-ranker.onnx');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample onnx', () => {
    const file = createSampleOxFile();
    const record = createOxFileRecord(file, buildSampleOnnxBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(4);
    expect(canExportOx(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseOnnxBytes(buildSampleOnnxBytes(), 'shop.onnx');
    const csv = exportOxSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,inputs,outputs,shape');
    expect(csv.split('\n').length).toBe(parsed.nodes.length + parsed.tensors.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleOxFile();
    const { accepted, rejected } = filterValidOxFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.onnx.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
