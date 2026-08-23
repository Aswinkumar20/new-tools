import { TF_ASCII_SAMPLE, TF_CSV_SAMPLE, TF_JSON_SAMPLE, TF_MARKDOWN_SAMPLE } from '../constants/tiff-viewer-sample.data';
import {
  buildSampleTfBytes,
  filterTfMetas,
  filterTfPages,
  filterTfRows,
  parseTfBytes,
  parseTfText
} from './tiff-viewer-parse.utils';
import { canExportTf, createSampleTfFile, createTfFileRecord, exportTfSchemaCsv, filterValidTfFiles } from './tiff-viewer.utils';

describe('tiff-viewer-parse.utils', () => {
  it('parses the shop floor TF01 sample', () => {
    const parsed = parseTfBytes(buildSampleTfBytes(), 'sample-shop-floor.tiff');
    expect(parsed.sourceKind).toBe('tiff');
    expect(parsed.name).toBe('ShopFloor');
    expect(parsed.tiffVer).toBe('1.0');
    expect(parsed.pages.length).toBe(2);
    expect(parsed.metas.length).toBe(4);
    expect(parsed.previews.length).toBe(6);
    expect(parsed.pages.some((p) => p.name === 'cover')).toBe(true);
    expect(parsed.metas.some((m) => m.name === 'compression' && m.value === 'LZW')).toBe(true);
    expect(parsed.previews.some((p) => /ShopRanker/i.test(p.text))).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseTfText(TF_ASCII_SAMPLE, 'shop.tiff');
    expect(ascii.sourceKind).toBe('tiff');
    expect(ascii.pages.some((p) => p.name === 'floor')).toBe(true);
    expect(ascii.compression).toBe('LZW');
    expect(ascii.previews.some((p) => p.name === 'column')).toBe(true);

    const json = parseTfText(TF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.pages.length).toBe(2);

    const csv = parseTfText(TF_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.metas.some((m) => m.name === 'software')).toBe(true);

    const md = parseTfText(TF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.pages.some((p) => p.name === 'cover')).toBe(true);
  });

  it('filters pages, metas, and rows', () => {
    const parsed = parseTfBytes(buildSampleTfBytes(), 'sample-shop-floor.tiff');
    expect(filterTfPages(parsed.pages, 'page:cover').length).toBe(1);
    expect(filterTfMetas(parsed.metas, 'meta:dpi').length).toBe(1);
    expect(filterTfRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, II*/MM*, or unknown text', () => {
    expect(() => parseTfText('')).toThrow(/empty/i);
    expect(() => parseTfText('hello world')).toThrow(/Not a TIFF/i);
    expect(() => parseTfBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.tiff')).toThrow(/compress/i);
    expect(() => parseTfBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.tiff')).toThrow(/ZIP/i);
    const le = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00]);
    expect(() => parseTfBytes(le, 'scan.tiff')).toThrow(/II\*|Binary TIFF/i);
    const be = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08]);
    expect(() => parseTfBytes(be, 'scan.tiff')).toThrow(/MM\*|Binary TIFF/i);
  });
});

describe('tiff-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTfFile();
    expect(file.name).toBe('sample-shop-floor.tiff');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample TIFF dump', () => {
    const file = createSampleTfFile();
    const record = createTfFileRecord(file, buildSampleTfBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.pages.some((p) => p.name === 'cover')).toBe(true);
    expect(canExportTf(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseTfBytes(buildSampleTfBytes(), 'sample-shop-floor.tiff');
    const csv = exportTfSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,page,meta,value');
    expect(csv).toContain('ShopScan');
    expect(csv.split('\n').length).toBe(parsed.pages.length + parsed.metas.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTfFile();
    const { accepted, rejected } = filterValidTfFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'scan.tiff.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
