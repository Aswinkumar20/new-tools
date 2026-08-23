import {
  SV_ASCII_SAMPLE,
  SV_CSV_SAMPLE,
  SV_JSON_SAMPLE,
  SV_MARKDOWN_SAMPLE,
  SV_XML_SAMPLE
} from '../constants/svg-viewer-sample.data';
import {
  buildSampleSvBytes,
  filterSvLayers,
  filterSvRows,
  filterSvShapes,
  parseSvBytes,
  parseSvText
} from './svg-viewer-parse.utils';
import { canExportSv, createSampleSvFile, createSvFileRecord, exportSvSchemaCsv, filterValidSvFiles } from './svg-viewer.utils';

describe('svg-viewer-parse.utils', () => {
  it('parses the shop floor SV01 sample', () => {
    const parsed = parseSvBytes(buildSampleSvBytes(), 'sample-shop-floor.svg');
    expect(parsed.sourceKind).toBe('svg');
    expect(parsed.name).toBe('ShopFloor');
    expect(parsed.svgVer).toBe('1.1');
    expect(parsed.shapes.length).toBe(6);
    expect(parsed.layers.length).toBe(3);
    expect(parsed.shapes.some((s) => s.name === 'slab' && s.kind === 'rect')).toBe(true);
    expect(parsed.shapes.some((s) => s.name === 'column' && s.kind === 'circle')).toBe(true);
    expect(parsed.shapes.some((s) => /ShopRanker/i.test(s.text))).toBe(true);
    expect(parsed.shapes.some((s) => s.name === 'counter')).toBe(true);
  });

  it('parses dump, SVG XML, JSON, CSV, and Markdown', () => {
    const ascii = parseSvText(SV_ASCII_SAMPLE, 'shop.svg');
    expect(ascii.sourceKind).toBe('svg');
    expect(ascii.shapes.some((s) => s.name === 'column')).toBe(true);
    expect(ascii.shapes.some((s) => /ShopRanker/i.test(s.text))).toBe(true);

    const xml = parseSvText(SV_XML_SAMPLE, 'shop.svg');
    expect(xml.sourceKind).toBe('svg');
    expect(xml.shapes.some((s) => s.name === 'slab')).toBe(true);
    expect(xml.shapes.some((s) => s.name === 'column')).toBe(true);
    expect(xml.shapes.some((s) => /ShopRanker/i.test(s.text))).toBe(true);

    const json = parseSvText(SV_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.shapes.length).toBe(6);

    const csv = parseSvText(SV_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.shapes.some((s) => s.name === 'counter')).toBe(true);

    const md = parseSvText(SV_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.shapes.some((s) => s.name === 'column')).toBe(true);
  });

  it('filters shapes, layers, and rows', () => {
    const parsed = parseSvBytes(buildSampleSvBytes(), 'sample-shop-floor.svg');
    expect(filterSvShapes(parsed.shapes, 'shape:column').length).toBe(1);
    expect(filterSvShapes(parsed.shapes, 'circle').length).toBe(1);
    expect(filterSvLayers(parsed.layers, 'layer:furniture').length).toBe(1);
    expect(filterSvRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseSvText('')).toThrow(/empty/i);
    expect(() => parseSvText('hello world')).toThrow(/Not an SVG/i);
    expect(() => parseSvBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.svg')).toThrow(/compress/i);
    expect(() => parseSvBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.svg')).toThrow(/ZIP/i);
  });
});

describe('svg-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSvFile();
    expect(file.name).toBe('sample-shop-floor.svg');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample SVG dump', () => {
    const file = createSampleSvFile();
    const record = createSvFileRecord(file, buildSampleSvBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.shapes.some((s) => s.name === 'slab')).toBe(true);
    expect(canExportSv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseSvBytes(buildSampleSvBytes(), 'sample-shop-floor.svg');
    const csv = exportSvSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,shape,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.shapes.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSvFile();
    const { accepted, rejected } = filterValidSvFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.svg.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
