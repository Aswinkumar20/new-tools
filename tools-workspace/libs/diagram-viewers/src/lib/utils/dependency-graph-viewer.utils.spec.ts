import {
  DEP_JSON_SAMPLE,
  DEP_MARKDOWN_SAMPLE,
  DEP_SAMPLE,
  DEP_XML_SAMPLE,
  DEP_YARN_SAMPLE
} from '../constants/dependency-graph-viewer-sample.data';
import { filterDepCycles, filterDepEdges, filterDepPackages, parseDependencyGraphText } from './dependency-graph-viewer-parse.utils';
import {
  canExportDep,
  createDepFileRecord,
  createSampleDepFile,
  exportDepPackagesCsv,
  filterValidDepFiles
} from './dependency-graph-viewer.utils';

describe('dependency-graph-viewer-parse.utils', () => {
  it('parses the shop package-lock sample with a cycle', () => {
    const parsed = parseDependencyGraphText(DEP_SAMPLE, 'sample-shop-lock.json');
    expect(parsed.packages.length).toBe(7);
    expect(parsed.edges.length).toBe(7);
    expect(parsed.cycles.length).toBeGreaterThanOrEqual(1);
    expect(parsed.tree.length).toBeGreaterThan(0);
    expect(parsed.packages.some((p) => p.id === 'shop' && p.kind === 'root')).toBe(true);
    expect(parsed.packages.some((p) => p.id === 'express' && p.kind === 'direct')).toBe(true);
    expect(parsed.edges.some((e) => e.source === 'lib-a' && e.target === 'lib-b')).toBe(true);
    expect(parsed.cycles.some((c) => c.path.includes('lib-a') && c.path.includes('lib-b'))).toBe(true);
  });

  it('parses markdown, JSON, XML, and yarn.lock', () => {
    const md = parseDependencyGraphText(DEP_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.packages.length).toBe(3);
    expect(md.edges.length).toBe(2);

    const json = parseDependencyGraphText(DEP_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.packages.length).toBe(2);
    expect(json.edges.length).toBe(1);

    const xml = parseDependencyGraphText(DEP_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.packages.length).toBe(2);
    expect(xml.edges.length).toBe(1);

    const yarn = parseDependencyGraphText(DEP_YARN_SAMPLE, 'yarn.lock');
    expect(yarn.sourceKind).toBe('lock');
    expect(yarn.packages.length).toBeGreaterThanOrEqual(3);
    expect(yarn.edges.some((e) => e.source === 'express' && e.target === 'debug')).toBe(true);
  });

  it('filters packages, edges, and cycles', () => {
    const parsed = parseDependencyGraphText(DEP_SAMPLE, 'package-lock.json');
    expect(filterDepPackages(parsed.packages, 'kind:direct').every((p) => p.kind === 'direct')).toBe(true);
    expect(filterDepEdges(parsed.edges, 'from:express').length).toBe(2);
    expect(filterDepCycles(parsed.cycles, 'lib-a').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDependencyGraphText('')).toThrow(/empty/i);
    expect(() => parseDependencyGraphText('hello world')).toThrow(/Not a dependency/i);
  });
});

describe('dependency-graph-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDepFile();
    expect(file.name).toBe('sample-shop-lock.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample lockfile', () => {
    const file = createSampleDepFile();
    const record = createDepFileRecord(file, new TextEncoder().encode(DEP_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.packages.length).toBe(7);
    expect(canExportDep(record)).toBe(true);
  });

  it('exports packages csv', () => {
    const parsed = parseDependencyGraphText(DEP_SAMPLE, 'package-lock.json');
    const csv = exportDepPackagesCsv(parsed);
    expect(csv).toContain('index,id,name,version,kind');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDepFile();
    const { accepted, rejected } = filterValidDepFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'package-lock.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
