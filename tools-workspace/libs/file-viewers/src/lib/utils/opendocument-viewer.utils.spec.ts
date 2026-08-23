import { OD_ASCII_SAMPLE, OD_CSV_SAMPLE, OD_JSON_SAMPLE, OD_MARKDOWN_SAMPLE } from '../constants/opendocument-viewer-sample.data';
import {
  buildSampleOdBytes,
  filterOdPages,
  filterOdRows,
  filterOdSheets,
  parseOdBytes,
  parseOdText
} from './opendocument-viewer-parse.utils';
import { canExportOd, createOdFileRecord, createSampleOdFile, exportOdSchemaCsv, filterValidOdFiles } from './opendocument-viewer.utils';

describe('opendocument-viewer-parse.utils', () => {
  it('parses the shop ranker OD01 sample', () => {
    const parsed = parseOdBytes(buildSampleOdBytes(), 'sample-shop-ranker.odt');
    expect(parsed.sourceKind).toBe('odt');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.odfVer).toBe('1.0');
    expect(parsed.pages.length).toBe(2);
    expect(parsed.sheets.length).toBe(1);
    expect(parsed.blocks.length).toBe(3);
    expect(parsed.cells.length).toBe(8);
    expect(parsed.pages.some((p) => p.name === 'cover')).toBe(true);
    expect(parsed.sheets.some((s) => s.name === 'inventory')).toBe(true);
    expect(parsed.blocks.some((b) => /ShopRanker/i.test(b.text))).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseOdText(OD_ASCII_SAMPLE, 'shop.odt');
    expect(ascii.sourceKind).toBe('odt');
    expect(ascii.pages.some((p) => p.name === 'notes')).toBe(true);
    expect(ascii.author).toBe('EasyToolHub');
    expect(ascii.cells.some((c) => c.ref === 'A4' && c.value === 'column')).toBe(true);

    const json = parseOdText(OD_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.pages.length).toBe(2);

    const csv = parseOdText(OD_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.sheets.some((s) => s.name === 'inventory')).toBe(true);

    const md = parseOdText(OD_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.pages.some((p) => p.name === 'cover')).toBe(true);
  });

  it('filters pages, sheets, and rows', () => {
    const parsed = parseOdBytes(buildSampleOdBytes(), 'sample-shop-ranker.odt');
    expect(filterOdPages(parsed.pages, 'page:cover').length).toBe(1);
    expect(filterOdSheets(parsed.sheets, 'sheet:inventory').length).toBe(1);
    expect(filterOdRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseOdText('')).toThrow(/empty/i);
    expect(() => parseOdText('hello world')).toThrow(/Not an ODF/i);
    expect(() => parseOdBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.odt')).toThrow(/compress/i);
    expect(() => parseOdBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.odt')).toThrow(/ZIP|Binary ODT/i);
  });
});

describe('opendocument-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleOdFile();
    expect(file.name).toBe('sample-shop-ranker.odt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample ODF dump', () => {
    const file = createSampleOdFile();
    const record = createOdFileRecord(file, buildSampleOdBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.pages.some((p) => p.name === 'cover')).toBe(true);
    expect(canExportOd(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseOdBytes(buildSampleOdBytes(), 'sample-shop-ranker.odt');
    const csv = exportOdSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,page,sheet,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.pages.length + parsed.sheets.length + parsed.blocks.length + parsed.cells.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleOdFile();
    const { accepted, rejected } = filterValidOdFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'doc.odt.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
