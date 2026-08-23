import {
  LX_ASCII_SAMPLE,
  LX_CSV_SAMPLE,
  LX_JSON_SAMPLE,
  LX_MARKDOWN_SAMPLE,
  LX_TEX_SAMPLE
} from '../constants/latex-viewer-sample.data';
import {
  buildSampleLxBytes,
  filterLxCommands,
  filterLxEnvs,
  filterLxRows,
  filterLxSections,
  parseLxBytes,
  parseLxText
} from './latex-viewer-parse.utils';
import { canExportLx, createLxFileRecord, createSampleLxFile, exportLxSchemaCsv, filterValidLxFiles } from './latex-viewer.utils';

describe('latex-viewer-parse.utils', () => {
  it('parses the shop ranker LX01 sample', () => {
    const parsed = parseLxBytes(buildSampleLxBytes(), 'sample-shop-ranker.tex');
    expect(parsed.sourceKind).toBe('latex');
    expect(parsed.name).toBe('ShopRanker');
    expect(parsed.latexVer).toBe('1.0');
    expect(parsed.title).toBe('ShopRanker Handbook');
    expect(parsed.sections.some((s) => s.name === 'sec1' && /ShopRanker/.test(s.text))).toBe(true);
    expect(parsed.sections.some((s) => s.title === 'Shop floor')).toBe(true);
    expect(parsed.commands.some((c) => c.name === 'usepackage' && c.value === 'graphicx')).toBe(true);
    expect(parsed.envs.some((e) => e.kind === 'figure' && /Shop floor plan/i.test(e.body))).toBe(true);
  });

  it('parses dump, TeX source, JSON, CSV, and Markdown', () => {
    const ascii = parseLxText(LX_ASCII_SAMPLE, 'shop.tex');
    expect(ascii.sourceKind).toBe('latex');
    expect(ascii.sections.some((s) => s.name === 'sec2')).toBe(true);
    expect(ascii.envs.some((e) => e.kind === 'equation')).toBe(true);

    const tex = parseLxText(LX_TEX_SAMPLE, 'shop.tex');
    expect(tex.sourceKind).toBe('latex');
    expect(tex.docClass).toBe('article');
    expect(tex.sections.some((s) => /column/i.test(s.text))).toBe(true);
    expect(tex.envs.some((e) => e.kind === 'figure')).toBe(true);

    const json = parseLxText(LX_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.sections.length).toBe(2);

    const csv = parseLxText(LX_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.sections.some((s) => s.name === 'sec1')).toBe(true);

    const md = parseLxText(LX_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.sections.some((s) => s.name === 'sec2')).toBe(true);
  });

  it('filters sections, commands, envs, and rows', () => {
    const parsed = parseLxBytes(buildSampleLxBytes(), 'sample-shop-ranker.tex');
    expect(filterLxSections(parsed.sections, 'sec:sec1').length).toBe(1);
    expect(filterLxCommands(parsed.commands, 'cmd:title').length).toBe(1);
    expect(filterLxEnvs(parsed.envs, 'env:figure').length).toBe(1);
    expect(filterLxRows(parsed.rows, 'name:ShopRanker').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseLxText('')).toThrow(/empty/i);
    expect(() => parseLxText('hello world')).toThrow(/Not a LaTeX/i);
    expect(() => parseLxBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.tex')).toThrow(/compress/i);
    expect(() => parseLxBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'doc.tex')).toThrow(/ZIP/i);
  });
});

describe('latex-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleLxFile();
    expect(file.name).toBe('sample-shop-ranker.tex');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample LaTeX dump', () => {
    const file = createSampleLxFile();
    const record = createLxFileRecord(file, buildSampleLxBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.sections.some((s) => s.name === 'sec1')).toBe(true);
    expect(canExportLx(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseLxBytes(buildSampleLxBytes(), 'sample-shop-ranker.tex');
    const csv = exportLxSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,section,command,value');
    expect(csv).toContain('ShopRanker');
    expect(csv.split('\n').length).toBe(parsed.sections.length + parsed.commands.length + parsed.envs.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleLxFile();
    const { accepted, rejected } = filterValidLxFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'paper.tex.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
