import { FP_JSON_SAMPLE, FP_MARKDOWN_SAMPLE, FP_MM_SAMPLE } from '../constants/freeplane-viewer-sample.data';
import { filterFpNodes, parseFreeplaneText } from './freeplane-viewer-parse.utils';
import { canExportFp, createFpFileRecord, createSampleFpFile, exportFpIconsCsv, filterValidFpFiles } from './freeplane-viewer.utils';

describe('freeplane-viewer-parse.utils', () => {
  it('parses the shop Freeplane sample', () => {
    const parsed = parseFreeplaneText(FP_MM_SAMPLE, 'sample-shop-freeplane.mm');
    expect(parsed.sourceKind).toBe('mm');
    expect(parsed.version).toMatch(/freeplane/i);
    expect(parsed.nodes.length).toBe(4);
    expect(parsed.nodes[0].label).toBe('Shop');
    expect(parsed.nodes[0].icons).toContain('folder');
    expect(parsed.nodes.find((n) => n.label === 'Customer')?.icons).toContain('male1');
    expect(parsed.nodes.find((n) => n.label === 'Customer')?.attributes.some((a) => a.name === 'segment' && a.value === 'retail')).toBe(true);
    expect(parsed.nodes.find((n) => n.label === 'Checkout')?.icons).toEqual(expect.arrayContaining(['idea', 'flag-yellow']));
    expect(parsed.icons.length).toBe(5);
    expect(parsed.warnings.some((w) => /note/i.test(w))).toBe(true);
  });

  it('parses JSON and markdown fence', () => {
    const json = parseFreeplaneText(FP_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(4);
    expect(json.nodes.some((n) => n.icons.includes('idea'))).toBe(true);

    const md = parseFreeplaneText(FP_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBe(2);
    expect(md.icons.some((i) => i.name === 'folder')).toBe(true);
  });

  it('filters by icon and attribute', () => {
    const parsed = parseFreeplaneText(FP_MM_SAMPLE, 'shop.mm');
    expect(filterFpNodes(parsed.nodes, 'icon:idea').some((n) => n.label === 'Checkout')).toBe(true);
    expect(filterFpNodes(parsed.nodes, 'attr:retail').some((n) => n.label === 'Customer')).toBe(true);
    expect(filterFpNodes(parsed.nodes, '', 'folder').some((n) => n.label === 'Shop')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseFreeplaneText('')).toThrow(/empty/i);
    expect(() => parseFreeplaneText('hello world')).toThrow(/Not a Freeplane/i);
  });
});

describe('freeplane-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFpFile();
    expect(file.name).toBe('sample-shop-freeplane.mm');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Freeplane', () => {
    const file = createSampleFpFile();
    const record = createFpFileRecord(file, new TextEncoder().encode(FP_MM_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(4);
    expect(canExportFp(record)).toBe(true);
  });

  it('exports icons csv', () => {
    const parsed = parseFreeplaneText(FP_MM_SAMPLE, 'shop.mm');
    const csv = exportFpIconsCsv(parsed);
    expect(csv).toContain('index,icon,count,nodes');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleFpFile();
    const { accepted, rejected } = filterValidFpFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.mm.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
