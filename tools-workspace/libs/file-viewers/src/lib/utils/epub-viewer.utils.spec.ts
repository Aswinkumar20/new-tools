import {
  EP_ASCII_SAMPLE,
  EP_CSV_SAMPLE,
  EP_JSON_SAMPLE,
  EP_MARKDOWN_SAMPLE
} from '../constants/epub-viewer-sample.data';
import {
  buildSampleEpBytes,
  buildSampleEpZip,
  filterEpChapters,
  filterEpRows,
  filterEpToc,
  parseEpBytes,
  parseEpText
} from './epub-viewer-parse.utils';
import { canExportEp, createEpFileRecord, createSampleEpFile, exportEpSchemaCsv, filterValidEpFiles } from './epub-viewer.utils';

describe('epub-viewer-parse.utils', () => {
  it('parses the shop ranker EP01 sample', () => {
    const parsed = parseEpBytes(buildSampleEpBytes(), 'sample-shop-ranker.epub');
    expect(parsed.sourceKind).toBe('epub');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.epubVer).toBe('3.0');
    expect(parsed.title).toBe('ShopRanker Handbook');
    expect(parsed.chapters.some((c) => c.name === 'ch1' && /ShopRanker/.test(c.text))).toBe(true);
    expect(parsed.chapters.some((c) => c.name === 'ch2')).toBe(true);
    expect(parsed.toc.some((t) => t.label === 'Introduction')).toBe(true);
    expect(parsed.meta.some((m) => m.name === 'creator' && m.value === 'EasyToolHub')).toBe(true);
  });

  it('parses dump, store ZIP, JSON, CSV, and Markdown', () => {
    const ascii = parseEpText(EP_ASCII_SAMPLE, 'shop.epub');
    expect(ascii.sourceKind).toBe('epub');
    expect(ascii.chapters.some((c) => c.name === 'ch2')).toBe(true);
    expect(ascii.toc.some((t) => /Shop floor/i.test(t.label))).toBe(true);

    const zip = parseEpBytes(buildSampleEpZip(), 'shop.epub');
    expect(zip.sourceKind).toBe('epub');
    expect(zip.title).toBe('ShopRanker Handbook');
    expect(zip.chapters.some((c) => /column/i.test(c.text))).toBe(true);
    expect(zip.toc.some((t) => t.label === 'Shop floor')).toBe(true);

    const json = parseEpText(EP_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.chapters.length).toBe(2);

    const csv = parseEpText(EP_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.chapters.some((c) => c.name === 'ch1')).toBe(true);

    const md = parseEpText(EP_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.toc.some((t) => /Introduction/i.test(t.label))).toBe(true);
  });

  it('filters chapters, toc, and rows', () => {
    const parsed = parseEpBytes(buildSampleEpBytes(), 'sample-shop-ranker.epub');
    expect(filterEpChapters(parsed.chapters, 'ch:ch1').length).toBe(1);
    expect(filterEpToc(parsed.toc, 'toc:Introduction').length).toBe(1);
    expect(filterEpRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseEpText('')).toThrow(/empty/i);
    expect(() => parseEpText('hello world')).toThrow(/Not an EPUB/i);
    expect(() => parseEpBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.epub')).toThrow(/compress/i);
  });
});

describe('epub-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleEpFile();
    expect(file.name).toBe('sample-shop-ranker.epub');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample EPUB dump', () => {
    const file = createSampleEpFile();
    const record = createEpFileRecord(file, buildSampleEpBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.chapters.some((c) => c.name === 'ch1')).toBe(true);
    expect(canExportEp(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseEpBytes(buildSampleEpBytes(), 'sample-shop-ranker.epub');
    const csv = exportEpSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,chapter,toc,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.chapters.length + parsed.toc.length + parsed.meta.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleEpFile();
    const { accepted, rejected } = filterValidEpFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'book.epub.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
