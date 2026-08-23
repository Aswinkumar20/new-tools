import { RW_ASCII_SAMPLE, RW_CSV_SAMPLE, RW_JSON_SAMPLE, RW_MARKDOWN_SAMPLE } from '../constants/raw-image-viewer-sample.data';
import {
  buildSampleRwBytes,
  filterRwChannels,
  filterRwExifs,
  filterRwRows,
  parseRwBytes,
  parseRwText
} from './raw-image-viewer-parse.utils';
import { canExportRw, createRwFileRecord, createSampleRwFile, exportRwSchemaCsv, filterValidRwFiles } from './raw-image-viewer.utils';

describe('raw-image-viewer-parse.utils', () => {
  it('parses the shop floor RW01 sample', () => {
    const parsed = parseRwBytes(buildSampleRwBytes(), 'sample-shop-floor.cr2');
    expect(parsed.sourceKind).toBe('cr2');
    expect(parsed.name).toBe('ShopFloor');
    expect(parsed.rawVer).toBe('1.0');
    expect(parsed.channels.length).toBe(3);
    expect(parsed.exifs.length).toBe(4);
    expect(parsed.previews.length).toBe(6);
    expect(parsed.channels.some((c) => c.name === 'red')).toBe(true);
    expect(parsed.exifs.some((e) => e.name === 'iso' && e.value === '200')).toBe(true);
    expect(parsed.previews.some((p) => /ShopRanker/i.test(p.text))).toBe(true);
    expect(parsed.make).toBe('Canon');
    expect(parsed.iso).toBe('200');
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseRwText(RW_ASCII_SAMPLE, 'shop.cr2');
    expect(ascii.sourceKind).toBe('raw');
    expect(ascii.channels.some((c) => c.name === 'green')).toBe(true);
    expect(ascii.make).toBe('Canon');
    expect(ascii.previews.some((p) => p.name === 'column')).toBe(true);

    const json = parseRwText(RW_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.channels.length).toBe(3);

    const csv = parseRwText(RW_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.exifs.some((e) => e.name === 'shutter')).toBe(true);

    const md = parseRwText(RW_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.channels.some((c) => c.name === 'red')).toBe(true);
  });

  it('filters channels, exifs, and rows', () => {
    const parsed = parseRwBytes(buildSampleRwBytes(), 'sample-shop-floor.cr2');
    expect(filterRwChannels(parsed.channels, 'channel:red').length).toBe(1);
    expect(filterRwExifs(parsed.exifs, 'exif:iso').length).toBe(1);
    expect(filterRwRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, TIFF magic, or unknown text', () => {
    expect(() => parseRwText('')).toThrow(/empty/i);
    expect(() => parseRwText('hello world')).toThrow(/Not a RAW/i);
    expect(() => parseRwBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.cr2')).toThrow(/compress/i);
    expect(() => parseRwBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.cr2')).toThrow(/ZIP/i);
    const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x10, 0x00, 0x00, 0x00]);
    expect(() => parseRwBytes(tiff, 'photo.cr2')).toThrow(/TIFF|demosaic|Binary/i);
  });
});

describe('raw-image-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleRwFile();
    expect(file.name).toBe('sample-shop-floor.cr2');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample RAW dump', () => {
    const file = createSampleRwFile();
    const record = createRwFileRecord(file, buildSampleRwBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.channels.some((c) => c.name === 'red')).toBe(true);
    expect(canExportRw(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseRwBytes(buildSampleRwBytes(), 'sample-shop-floor.cr2');
    const csv = exportRwSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,channel,exif,value');
    expect(csv).toContain('200');
    expect(csv).toContain('RGGB');
    expect(csv.split('\n').length).toBe(parsed.channels.length + parsed.exifs.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleRwFile();
    const { accepted, rejected } = filterValidRwFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'photo.cr2.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
