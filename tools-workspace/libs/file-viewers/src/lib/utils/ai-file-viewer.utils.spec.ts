import { AI_ASCII_SAMPLE, AI_CSV_SAMPLE, AI_JSON_SAMPLE, AI_MARKDOWN_SAMPLE } from '../constants/ai-file-viewer-sample.data';
import {
  buildSampleAiBytes,
  filterAiArtboards,
  filterAiLayers,
  filterAiPaths,
  filterAiRows,
  parseAiBytes,
  parseAiText
} from './ai-file-viewer-parse.utils';
import { canExportAi, createAiFileRecord, createSampleAiFile, exportAiSchemaCsv, filterValidAiFiles } from './ai-file-viewer.utils';

describe('ai-file-viewer-parse.utils', () => {
  it('parses the shop floor AI01 sample', () => {
    const parsed = parseAiBytes(buildSampleAiBytes(), 'sample-shop-floor.ai');
    expect(parsed.sourceKind).toBe('ai');
    expect(parsed.name).toBe('ShopFloor');
    expect(parsed.aiVer).toBe('1.0');
    expect(parsed.artboards.length).toBe(1);
    expect(parsed.layers.length).toBe(3);
    expect(parsed.paths.length).toBe(6);
    expect(parsed.paths.some((p) => p.name === 'slab' && p.kind === 'rect')).toBe(true);
    expect(parsed.paths.some((p) => p.name === 'column' && p.kind === 'circle')).toBe(true);
    expect(parsed.paths.some((p) => /ShopRanker/i.test(p.text))).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseAiText(AI_ASCII_SAMPLE, 'shop.ai');
    expect(ascii.sourceKind).toBe('ai');
    expect(ascii.paths.some((p) => p.name === 'column')).toBe(true);
    expect(ascii.artboards.some((a) => a.name === 'ShopFloor')).toBe(true);

    const json = parseAiText(AI_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.paths.length).toBe(6);

    const csv = parseAiText(AI_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.paths.some((p) => p.name === 'counter')).toBe(true);

    const md = parseAiText(AI_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.paths.some((p) => p.name === 'column')).toBe(true);
  });

  it('filters artboards, layers, paths, and rows', () => {
    const parsed = parseAiBytes(buildSampleAiBytes(), 'sample-shop-floor.ai');
    expect(filterAiArtboards(parsed.artboards, 'artboard:ShopFloor').length).toBe(1);
    expect(filterAiLayers(parsed.layers, 'layer:furniture').length).toBe(1);
    expect(filterAiPaths(parsed.paths, 'path:column').length).toBe(1);
    expect(filterAiRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, pdf, or unknown text', () => {
    expect(() => parseAiText('')).toThrow(/empty/i);
    expect(() => parseAiText('hello world')).toThrow(/Not an AI/i);
    expect(() => parseAiBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.ai')).toThrow(/compress/i);
    expect(() => parseAiBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.ai')).toThrow(/ZIP/i);
    expect(() => parseAiBytes(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]), 'art.ai')).toThrow(/PDF|Illustrator/i);
  });
});

describe('ai-file-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleAiFile();
    expect(file.name).toBe('sample-shop-floor.ai');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample AI dump', () => {
    const file = createSampleAiFile();
    const record = createAiFileRecord(file, buildSampleAiBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.paths.some((p) => p.name === 'slab')).toBe(true);
    expect(canExportAi(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseAiBytes(buildSampleAiBytes(), 'sample-shop-floor.ai');
    const csv = exportAiSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,artboard,layer,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.artboards.length + parsed.layers.length + parsed.paths.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleAiFile();
    const { accepted, rejected } = filterValidAiFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'art.ai.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
