import {
  GD_ASCII_SAMPLE,
  GD_CSV_SAMPLE,
  GD_JSON_SAMPLE,
  GD_MARKDOWN_SAMPLE,
  GD_STREAM_SAMPLE
} from '../constants/gdsii-layout-viewer-sample.data';
import {
  buildSampleGdBytes,
  filterGdCells,
  filterGdFeatures,
  filterGdLayers,
  filterGdRows,
  parseGdBytes,
  parseGdText
} from './gdsii-layout-viewer-parse.utils';
import {
  canExportGd,
  createGdFileRecord,
  createSampleGdFile,
  exportGdSchemaCsv,
  filterValidGdFiles
} from './gdsii-layout-viewer.utils';

describe('gdsii-layout-viewer-parse.utils', () => {
  it('parses the NAND2_X1 GDSII dump sample', () => {
    const parsed = parseGdBytes(buildSampleGdBytes(), 'nand2-x1.gds');
    expect(parsed.sourceKind).toBe('gdsii');
    expect(parsed.name).toBe('NAND2_X1');
    expect(parsed.gdsVer).toBe('5.0');
    expect(parsed.layers.some((l) => l.name === '1' && l.function === 'metal')).toBe(true);
    expect(parsed.layers.some((l) => l.function === 'poly')).toBe(true);
    expect(parsed.cells.some((c) => c.name === 'TOP')).toBe(true);
    expect(parsed.cells.some((c) => c.name === 'NAND2_X1')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'boundary')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'path')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'box')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'sref' && f.name === 'NAND2_X1')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'text' && f.text === 'NAND2_X1')).toBe(true);
  });

  it('parses stream ASCII, JSON, CSV, and Markdown dumps', () => {
    const stream = parseGdText(GD_STREAM_SAMPLE, 'shop.gds');
    expect(stream.sourceKind).toBe('gdsii');
    expect(stream.features.some((f) => f.type === 'boundary')).toBe(true);
    expect(stream.features.some((f) => f.type === 'path')).toBe(true);
    expect(stream.features.some((f) => f.type === 'text' && f.text === 'NAND2_X1')).toBe(true);
    expect(stream.layers.some((l) => l.name === '1')).toBe(true);

    const json = parseGdText(GD_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === '1')).toBe(true);
    expect(json.features.some((f) => f.name === 'via1' && f.type === 'box')).toBe(true);
    expect(json.cells.some((c) => c.name === 'TOP')).toBe(true);

    const csv = parseGdText(GD_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.features.some((f) => f.type === 'boundary')).toBe(true);
    expect(csv.cells.some((c) => c.name === 'TOP')).toBe(true);

    const md = parseGdText(GD_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.cells.some((c) => c.name === 'TOP')).toBe(true);

    const ascii = parseGdText(GD_ASCII_SAMPLE, 'shop.gds');
    expect(ascii.sourceKind).toBe('gdsii');
    expect(ascii.features.some((f) => f.type === 'boundary' && f.points.length >= 4)).toBe(true);
  });

  it('filters layers, cells, features, and rows', () => {
    const parsed = parseGdBytes(buildSampleGdBytes(), 'nand2-x1.gds');
    expect(filterGdLayers(parsed.layers, 'func:metal').length).toBe(1);
    expect(filterGdCells(parsed.cells, 'cell:TOP').length).toBe(1);
    expect(filterGdFeatures(parsed.features, 'type:box').length).toBe(1);
    expect(filterGdRows(parsed.rows, 'cell:TOP').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseGdText('')).toThrow(/empty/i);
    expect(() => parseGdText('hello world')).toThrow(/Not a GDSII/i);
    expect(() => parseGdBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.gds')).toThrow(/compress/i);
    expect(() => parseGdBytes(new Uint8Array([0x00, 0x06, 0x00, 0x02, 0x00]), 'chip.gds')).toThrow(/binary|ASCII/i);
  });
});

describe('gdsii-layout-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGdFile();
    expect(file.name).toBe('nand2-x1.gds');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample GDSII dump', () => {
    const file = createSampleGdFile();
    const record = createGdFileRecord(file, buildSampleGdBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.function === 'metal')).toBe(true);
    expect(record.parsed?.features.some((f) => f.type === 'sref')).toBe(true);
    expect(canExportGd(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseGdBytes(buildSampleGdBytes(), 'nand2-x1.gds');
    const csv = exportGdSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,cell,x');
    expect(csv).toContain('TOP');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.cells.length + parsed.features.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleGdFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidGdFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.gds.gz', { lastModified: 2 }),
      empty,
      huge
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
    expect(rejected.some((item) => /empty/i.test(item.reason))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('too large'))).toBe(true);
  });
});

describe('canExportGd guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportGd({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportGd(null)).toBe(false);
  });
});
