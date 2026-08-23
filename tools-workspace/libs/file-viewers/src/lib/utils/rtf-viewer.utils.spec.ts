import { RT_ASCII_SAMPLE, RT_CSV_SAMPLE, RT_JSON_SAMPLE, RT_MARKDOWN_SAMPLE, RT_RTF_SAMPLE } from '../constants/rtf-viewer-sample.data';
import {
  buildSampleRtBytes,
  exportRtHtml,
  filterRtBlocks,
  filterRtRows,
  filterRtStyles,
  parseRtBytes,
  parseRtText
} from './rtf-viewer-parse.utils';
import { canExportRt, createRtFileRecord, createSampleRtFile, exportRtSchemaCsv, filterValidRtFiles } from './rtf-viewer.utils';

describe('rtf-viewer-parse.utils', () => {
  it('parses the shop ranker RT01 sample', () => {
    const parsed = parseRtBytes(buildSampleRtBytes(), 'sample-shop-ranker.rtf');
    expect(parsed.sourceKind).toBe('rtf');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.rtfVer).toBe('1.0');
    expect(parsed.styles.length).toBe(3);
    expect(parsed.blocks.length).toBe(3);
    expect(parsed.spans.length).toBe(4);
    expect(parsed.styles.some((s) => s.name === 'heading')).toBe(true);
    expect(parsed.spans.some((s) => /ShopRanker/i.test(s.text))).toBe(true);
  });

  it('parses dump, JSON, CSV, Markdown, and RTF subset', () => {
    const ascii = parseRtText(RT_ASCII_SAMPLE, 'shop.rtf');
    expect(ascii.sourceKind).toBe('rtf');
    expect(ascii.styles.some((s) => s.name === 'emphasis')).toBe(true);
    expect(ascii.author).toBe('EasyToolHub');
    expect(ascii.spans.some((s) => /Counter/i.test(s.text))).toBe(true);

    const json = parseRtText(RT_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.styles.length).toBe(3);

    const csv = parseRtText(RT_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.blocks.some((b) => b.name === 'title')).toBe(true);

    const md = parseRtText(RT_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.styles.some((s) => s.name === 'heading')).toBe(true);

    const rtf = parseRtText(RT_RTF_SAMPLE, 'shop.rtf');
    expect(rtf.sourceKind).toBe('rtf');
    expect(rtf.spans.some((s) => /ShopRanker/i.test(s.text))).toBe(true);
    expect(rtf.spans.some((s) => s.kind === 'bold' || s.kind === 'italic')).toBe(true);
  });

  it('filters styles, blocks, and rows', () => {
    const parsed = parseRtBytes(buildSampleRtBytes(), 'sample-shop-ranker.rtf');
    expect(filterRtStyles(parsed.styles, 'style:heading').length).toBe(1);
    expect(filterRtBlocks(parsed.blocks, 'block:title').length).toBe(1);
    expect(filterRtRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseRtText('')).toThrow(/empty/i);
    expect(() => parseRtText('hello world')).toThrow(/Not an RTF/i);
    expect(() => parseRtBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.rtf')).toThrow(/compress/i);
    expect(() => parseRtBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.rtf')).toThrow(/ZIP/i);
  });

  it('exports html snapshot', () => {
    const parsed = parseRtBytes(buildSampleRtBytes(), 'sample-shop-ranker.rtf');
    const html = exportRtHtml(parsed);
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('ShopRanker');
  });
});

describe('rtf-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleRtFile();
    expect(file.name).toBe('sample-shop-ranker.rtf');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample RTF dump', () => {
    const file = createSampleRtFile();
    const record = createRtFileRecord(file, buildSampleRtBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.styles.some((s) => s.name === 'heading')).toBe(true);
    expect(canExportRt(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseRtBytes(buildSampleRtBytes(), 'sample-shop-ranker.rtf');
    const csv = exportRtSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,style,block,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.styles.length + parsed.blocks.length + parsed.spans.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleRtFile();
    const { accepted, rejected } = filterValidRtFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'note.rtf.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
