import {
  MB_ASCII_SAMPLE,
  MB_AZW_SAMPLE,
  MB_CSV_SAMPLE,
  MB_JSON_SAMPLE,
  MB_MARKDOWN_SAMPLE
} from '../constants/mobi-viewer-sample.data';
import {
  buildSampleMbBytes,
  filterMbChapters,
  filterMbRows,
  filterMbToc,
  parseMbBytes,
  parseMbText
} from './mobi-viewer-parse.utils';
import { canExportMb, createMbFileRecord, createSampleMbFile, exportMbSchemaCsv, filterValidMbFiles } from './mobi-viewer.utils';

describe('mobi-viewer-parse.utils', () => {
  it('parses the shop ranker MB01 sample', () => {
    const parsed = parseMbBytes(buildSampleMbBytes(), 'sample-shop-ranker.mobi');
    expect(parsed.sourceKind).toBe('mobi');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.mobiVer).toBe('6');
    expect(parsed.title).toBe('ShopRanker Handbook');
    expect(parsed.chapters.some((c) => c.name === 'ch1' && /ShopRanker/.test(c.text))).toBe(true);
    expect(parsed.chapters.some((c) => c.name === 'ch2')).toBe(true);
    expect(parsed.toc.some((t) => t.label === 'Introduction')).toBe(true);
    expect(parsed.meta.some((m) => m.name === 'creator' && m.value === 'EasyToolHub')).toBe(true);
  });

  it('parses dump, AZW dump, JSON, CSV, and Markdown', () => {
    const ascii = parseMbText(MB_ASCII_SAMPLE, 'shop.mobi');
    expect(ascii.sourceKind).toBe('mobi');
    expect(ascii.chapters.some((c) => c.name === 'ch2')).toBe(true);
    expect(ascii.toc.some((t) => /Shop floor/i.test(t.label))).toBe(true);

    const azw = parseMbText(MB_AZW_SAMPLE, 'shop.azw');
    expect(azw.sourceKind).toBe('mobi');
    expect(azw.mobiVer).toBe('8');
    expect(azw.chapters.some((c) => /column/i.test(c.text))).toBe(true);

    const json = parseMbText(MB_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.chapters.length).toBe(2);

    const csv = parseMbText(MB_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.chapters.some((c) => c.name === 'ch1')).toBe(true);

    const md = parseMbText(MB_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.toc.some((t) => /Introduction/i.test(t.label))).toBe(true);
  });

  it('filters chapters, toc, and rows', () => {
    const parsed = parseMbBytes(buildSampleMbBytes(), 'sample-shop-ranker.mobi');
    expect(filterMbChapters(parsed.chapters, 'ch:ch1').length).toBe(1);
    expect(filterMbToc(parsed.toc, 'toc:Introduction').length).toBe(1);
    expect(filterMbRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseMbText('')).toThrow(/empty/i);
    expect(() => parseMbText('hello world')).toThrow(/Not a MOBI/i);
    expect(() => parseMbBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.mobi')).toThrow(/compress/i);
    expect(() => parseMbBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'book.mobi')).toThrow(/ZIP|EPUB/i);
  });
});

describe('mobi-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMbFile();
    expect(file.name).toBe('sample-shop-ranker.mobi');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample MOBI dump', () => {
    const file = createSampleMbFile();
    const record = createMbFileRecord(file, buildSampleMbBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.chapters.some((c) => c.name === 'ch1')).toBe(true);
    expect(canExportMb(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseMbBytes(buildSampleMbBytes(), 'sample-shop-ranker.mobi');
    const csv = exportMbSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,chapter,toc,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.chapters.length + parsed.toc.length + parsed.meta.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleMbFile();
    const { accepted, rejected } = filterValidMbFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'book.mobi.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
