import { MF_CSV_SAMPLE, MF_JSON_SAMPLE, MF_MARKDOWN_SAMPLE, MF_MLMODEL_SAMPLE } from '../constants/mlflow-model-viewer-sample.data';
import {
  buildSampleMfBytes,
  filterMfFiles,
  filterMfRows,
  filterMfSignatures,
  parseMfBytes,
  parseMfText
} from './mlflow-model-viewer-parse.utils';
import {
  canExportMf,
  createMfFileRecord,
  createSampleMfFile,
  exportMfSchemaCsv,
  filterValidMfFiles
} from './mlflow-model-viewer.utils';

describe('mlflow-model-viewer-parse.utils', () => {
  it('parses the shop ranker MLflow ZIP sample', () => {
    const parsed = parseMfBytes(buildSampleMfBytes(), 'sample-shop-ranker.zip');
    expect(parsed.sourceKind).toBe('zip');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.flavor).toBe('keras');
    expect(parsed.mlflowVersion).toBe('2.16.0');
    expect(parsed.signatures.some((s) => s.name === 'features' && s.kind === 'input')).toBe(true);
    expect(parsed.signatures.some((s) => s.name === 'scores' && s.kind === 'output')).toBe(true);
    expect(parsed.files.some((f) => f.name === 'MLmodel' && f.role === 'manifest')).toBe(true);
    expect(parsed.files.some((f) => /model\.keras$/i.test(f.path) && f.role === 'model')).toBe(true);
    expect(parsed.rows.length).toBe(2);
  });

  it('parses JSON, MLmodel YAML, CSV, and Markdown dumps', () => {
    const json = parseMfText(MF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.signatures.length).toBe(2);
    expect(json.files.length).toBe(4);

    const yaml = parseMfText(MF_MLMODEL_SAMPLE, 'MLmodel');
    expect(yaml.sourceKind).toBe('mlmodel');
    expect(yaml.flavor).toBe('keras');
    expect(yaml.signatures.length).toBe(2);

    const csv = parseMfText(MF_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.signatures.length).toBe(2);

    const md = parseMfText(MF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.signatures.length).toBeGreaterThanOrEqual(2);
  });

  it('filters signatures, files, and rows', () => {
    const parsed = parseMfBytes(buildSampleMfBytes(), 'sample-shop-ranker.zip');
    expect(filterMfSignatures(parsed.signatures, 'sig:features').length).toBe(1);
    expect(filterMfFiles(parsed.files, 'file:MLmodel').length).toBe(1);
    expect(filterMfRows(parsed.rows, 'name:scores').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseMfText('')).toThrow(/empty/i);
    expect(() => parseMfText('hello world')).toThrow(/Not an MLflow/i);
    expect(() => parseMfBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.zip')).toThrow(/compress/i);
  });
});

describe('mlflow-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMfFile();
    expect(file.name).toBe('sample-shop-ranker.zip');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample zip', () => {
    const file = createSampleMfFile();
    const record = createMfFileRecord(file, buildSampleMfBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.flavor).toBe('keras');
    expect(canExportMf(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseMfBytes(buildSampleMfBytes(), 'sample-shop-ranker.zip');
    const csv = exportMfSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,dtype,shape,flavor');
    expect(csv.split('\n').length).toBe(parsed.signatures.length + parsed.files.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleMfFile();
    const { accepted, rejected } = filterValidMfFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.zip.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
