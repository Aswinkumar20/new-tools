import { GVZ_DOT_SAMPLE, GVZ_JSON_SAMPLE, GVZ_MARKDOWN_SAMPLE, GVZ_NEATO_SAMPLE } from '../constants/graphviz-dot-viewer-sample.data';
import { applyGvzLayout, filterGvzEdges, parseDotText } from './graphviz-dot-parse.utils';
import { exportGvzSvg } from './graphviz-dot-render.utils';
import {
  canExportGvz,
  createGvzFileRecord,
  createSampleGvzFile,
  exportGvzNodesCsv,
  filterValidGvzFiles,
  resolveGvzSuggestion
} from './graphviz-dot-viewer.utils';

describe('graphviz-dot-parse.utils', () => {
  it('parses the checkout DOT sample', () => {
    const parsed = parseDotText(GVZ_DOT_SAMPLE, 'sample-checkout.dot');
    expect(parsed.directed).toBe(true);
    expect(parsed.layout).toBe('dot');
    expect(parsed.rankdir).toBe('LR');
    expect(parsed.nodes.length).toBe(5);
    expect(parsed.edges.length).toBe(5);
    expect(parsed.edges.some((e) => e.label === 'checkout')).toBe(true);
  });

  it('parses undirected neato, markdown fence, and JSON', () => {
    const neato = parseDotText(GVZ_NEATO_SAMPLE, 'mesh.gv');
    expect(neato.directed).toBe(false);
    expect(neato.layout).toBe('neato');
    expect(neato.nodes.length).toBe(4);
    expect(neato.edges.length).toBe(4);
    const md = parseDotText(GVZ_MARKDOWN_SAMPLE, 'pay.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rankdir).toBe('TB');
    expect(md.nodes.length).toBe(3);
    const json = parseDotText(GVZ_JSON_SAMPLE, 'checkout.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layout).toBe('dot');
    expect(json.nodes.length).toBe(3);
  });

  it('re-layouts without losing nodes and filters edges', () => {
    const parsed = parseDotText(GVZ_DOT_SAMPLE, 'checkout.dot');
    applyGvzLayout(parsed.nodes, parsed.edges, 'circo', parsed.rankdir);
    expect(parsed.nodes.length).toBe(5);
    expect(filterGvzEdges(parsed.edges, 'label:ok').every((e) => e.label === 'ok')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDotText('')).toThrow(/empty/i);
    expect(() => parseDotText('hello world')).toThrow(/Not a Graphviz/i);
  });
});

describe('graphviz-dot-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGvzFile();
    expect(file.name).toBe('sample-checkout.dot');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record and SVG export', () => {
    const file = createSampleGvzFile();
    const record = createGvzFileRecord(file, new TextEncoder().encode(GVZ_DOT_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(5);
    expect(canExportGvz(record)).toBe(true);
    const svg = exportGvzSvg(record.parsed!.nodes, record.parsed!.edges);
    expect(svg).toContain('<svg');
    expect(svg).toContain('Cart');
  });

  it('exports nodes csv', () => {
    const parsed = parseDotText(GVZ_DOT_SAMPLE, 'checkout.dot');
    const csv = exportGvzNodesCsv(parsed);
    expect(csv).toContain('index,id,name,shape,group');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleGvzFile();
    const { accepted, rejected } = filterValidGvzFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'graph.dot.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveGvzSuggestion covers empty and error states', () => {
    expect(resolveGvzSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveGvzSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveGvzSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail unparseable text disables export', () => {
    const record = createGvzFileRecord(new File(['hello world'], 'bad.txt', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportGvz(record)).toBe(false);
  });

  it('canExportGvz returns false for null', () => {
    expect(canExportGvz(null)).toBe(false);
  });
});
