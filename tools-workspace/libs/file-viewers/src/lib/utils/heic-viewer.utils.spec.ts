import { HC_ASCII_SAMPLE, HC_CSV_SAMPLE, HC_JSON_SAMPLE, HC_MARKDOWN_SAMPLE } from '../constants/heic-viewer-sample.data';
import {
  buildSampleHcBytes,
  filterHcFrames,
  filterHcMetas,
  filterHcRows,
  parseHcBytes,
  parseHcText
} from './heic-viewer-parse.utils';
import { canExportHc, createHcFileRecord, createSampleHcFile, exportHcSchemaCsv, filterValidHcFiles } from './heic-viewer.utils';

describe('heic-viewer-parse.utils', () => {
  it('parses the shop floor HE01 sample', () => {
    const parsed = parseHcBytes(buildSampleHcBytes(), 'sample-shop-floor.heic');
    expect(parsed.sourceKind).toBe('heic');
    expect(parsed.name).toBe('ShopFloor');
    expect(parsed.heicVer).toBe('1.0');
    expect(parsed.frames.length).toBe(2);
    expect(parsed.metas.length).toBe(4);
    expect(parsed.previews.length).toBe(6);
    expect(parsed.frames.some((f) => f.name === 'primary')).toBe(true);
    expect(parsed.metas.some((m) => m.name === 'iso' && m.group === 'exif')).toBe(true);
    expect(parsed.previews.some((p) => /ShopRanker/i.test(p.text))).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseHcText(HC_ASCII_SAMPLE, 'shop.heic');
    expect(ascii.sourceKind).toBe('heic');
    expect(ascii.frames.some((f) => f.name === 'thumbnail')).toBe(true);
    expect(ascii.make).toBe('Apple');
    expect(ascii.previews.some((p) => p.name === 'column')).toBe(true);

    const json = parseHcText(HC_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.frames.length).toBe(2);

    const csv = parseHcText(HC_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.metas.some((m) => m.name === 'model')).toBe(true);

    const md = parseHcText(HC_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.frames.some((f) => f.name === 'primary')).toBe(true);
  });

  it('filters frames, metas, and rows', () => {
    const parsed = parseHcBytes(buildSampleHcBytes(), 'sample-shop-floor.heic');
    expect(filterHcFrames(parsed.frames, 'frame:primary').length).toBe(1);
    expect(filterHcMetas(parsed.metas, 'exif:iso').length).toBe(1);
    expect(filterHcRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, ftyp, or unknown text', () => {
    expect(() => parseHcText('')).toThrow(/empty/i);
    expect(() => parseHcText('hello world')).toThrow(/Not a HEIC/i);
    expect(() => parseHcBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.heic')).toThrow(/compress/i);
    expect(() => parseHcBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.heic')).toThrow(/ZIP/i);
    const ftyp = new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]);
    expect(() => parseHcBytes(ftyp, 'photo.heic')).toThrow(/ftyp|Binary HEIC/i);
  });
});

describe('heic-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleHcFile();
    expect(file.name).toBe('sample-shop-floor.heic');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample HEIC dump', () => {
    const file = createSampleHcFile();
    const record = createHcFileRecord(file, buildSampleHcBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.frames.some((f) => f.name === 'primary')).toBe(true);
    expect(canExportHc(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseHcBytes(buildSampleHcBytes(), 'sample-shop-floor.heic');
    const csv = exportHcSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,frame,meta,value');
    expect(csv).toContain('ShopCam');
    expect(csv.split('\n').length).toBe(parsed.frames.length + parsed.metas.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleHcFile();
    const { accepted, rejected } = filterValidHcFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'photo.heic.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
