import {
  PD_ASCII_SAMPLE,
  PD_CSV_SAMPLE,
  PD_JSON_SAMPLE,
  PD_MARKDOWN_SAMPLE
} from '../constants/psd-viewer-sample.data';
import {
  buildSamplePdBytes,
  filterPdEffects,
  filterPdLayers,
  filterPdRows,
  parsePdBytes,
  parsePdText
} from './psd-viewer-parse.utils';
import { canExportPd, createPdFileRecord, createSamplePdFile, exportPdSchemaCsv, filterValidPdFiles } from './psd-viewer.utils';

describe('psd-viewer-parse.utils', () => {
  it('parses the shop floor PD01 sample', () => {
    const parsed = parsePdBytes(buildSamplePdBytes(), 'sample-shop-floor.psd');
    expect(parsed.sourceKind).toBe('psd');
    expect(parsed.name).toBe('ShopFloor');
    expect(parsed.psdVer).toBe('1.0');
    expect(parsed.layers.length).toBe(6);
    expect(parsed.effects.length).toBe(2);
    expect(parsed.channels.length).toBe(2);
    expect(parsed.layers.some((l) => l.name === 'slab' && l.kind === 'rect')).toBe(true);
    expect(parsed.layers.some((l) => l.name === 'column' && l.kind === 'circle')).toBe(true);
    expect(parsed.layers.some((l) => /ShopRanker/i.test(l.text))).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parsePdText(PD_ASCII_SAMPLE, 'shop.psd');
    expect(ascii.sourceKind).toBe('psd');
    expect(ascii.layers.some((l) => l.name === 'column')).toBe(true);
    expect(ascii.effects.some((e) => e.name === 'drop-shadow')).toBe(true);

    const json = parsePdText(PD_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.length).toBe(6);

    const csv = parsePdText(PD_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.layers.some((l) => l.name === 'counter')).toBe(true);

    const md = parsePdText(PD_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'column')).toBe(true);
  });

  it('filters layers, effects, and rows', () => {
    const parsed = parsePdBytes(buildSamplePdBytes(), 'sample-shop-floor.psd');
    expect(filterPdLayers(parsed.layers, 'layer:column').length).toBe(1);
    expect(filterPdEffects(parsed.effects, 'fx:drop-shadow').length).toBe(1);
    expect(filterPdRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, 8BPS, or unknown text', () => {
    expect(() => parsePdText('')).toThrow(/empty/i);
    expect(() => parsePdText('hello world')).toThrow(/Not a PSD/i);
    expect(() => parsePdBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.psd')).toThrow(/compress/i);
    expect(() => parsePdBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.psd')).toThrow(/ZIP/i);
    expect(() => parsePdBytes(new Uint8Array([0x38, 0x42, 0x50, 0x53, 0x00]), 'photo.psd')).toThrow(/8BPS/i);
  });
});

describe('psd-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePdFile();
    expect(file.name).toBe('sample-shop-floor.psd');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample PSD dump', () => {
    const file = createSamplePdFile();
    const record = createPdFileRecord(file, buildSamplePdBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.name === 'slab')).toBe(true);
    expect(canExportPd(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parsePdBytes(buildSamplePdBytes(), 'sample-shop-floor.psd');
    const csv = exportPdSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,effect,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.channels.length + parsed.layers.length + parsed.effects.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePdFile();
    const { accepted, rejected } = filterValidPdFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'art.psd.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
