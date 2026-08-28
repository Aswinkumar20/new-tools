import {
  MMD_FLOWCHART_SAMPLE,
  MMD_JSON_SAMPLE,
  MMD_MARKDOWN_SAMPLE,
  MMD_SEQUENCE_SAMPLE
} from '../constants/mermaid-diagram-viewer-sample.data';
import { filterMmdEdges, filterMmdNodes, parseMermaidText } from './mermaid-diagram-parse.utils';
import {
  canExportMmd,
  createMmdFileRecord,
  createSampleMmdFile,
  exportMmdNodesCsv,
  filterValidMmdFiles,
  resolveMmdSuggestion
} from './mermaid-diagram-viewer.utils';

describe('mermaid-diagram-parse.utils', () => {
  it('parses the checkout flowchart sample', () => {
    const parsed = parseMermaidText(MMD_FLOWCHART_SAMPLE, 'sample-checkout-flow.mmd');
    expect(parsed.kind).toBe('flowchart');
    expect(parsed.direction).toBe('TD');
    expect(parsed.nodes.length).toBe(5);
    expect(parsed.edges.length).toBe(5);
    expect(parsed.nodes.some((n) => n.shape === 'diamond')).toBe(true);
    expect(parsed.edges.some((e) => e.label === 'yes')).toBe(true);
  });

  it('parses sequence, markdown fence, and JSON', () => {
    const seq = parseMermaidText(MMD_SEQUENCE_SAMPLE, 'checkout.mmd');
    expect(seq.kind).toBe('sequence');
    expect(seq.nodes.length).toBe(2);
    expect(seq.edges.length).toBe(2);
    const md = parseMermaidText(MMD_MARKDOWN_SAMPLE, 'checkout.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.direction).toBe('LR');
    expect(md.nodes.length).toBe(4);
    const json = parseMermaidText(MMD_JSON_SAMPLE, 'checkout.json');
    expect(json.sourceKind).toBe('json');
    expect(json.kind).toBe('sequence');
    expect(json.edges[0].style).toBe('message');
  });

  it('filters nodes and edges', () => {
    const parsed = parseMermaidText(MMD_FLOWCHART_SAMPLE, 'flow.mmd');
    expect(filterMmdNodes(parsed.nodes, 'shape:diamond').every((n) => n.shape === 'diamond')).toBe(true);
    expect(filterMmdEdges(parsed.edges, 'label:yes').every((e) => e.label === 'yes')).toBe(true);
    expect(filterMmdNodes(parsed.nodes, 'node:Cart').some((n) => /cart/i.test(n.name))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseMermaidText('')).toThrow(/empty/i);
    expect(() => parseMermaidText('hello world')).toThrow(/Not a Mermaid/i);
  });
});

describe('mermaid-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMmdFile();
    expect(file.name).toBe('sample-checkout-flow.mmd');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample flowchart', () => {
    const file = createSampleMmdFile();
    const record = createMmdFileRecord(file, new TextEncoder().encode(MMD_FLOWCHART_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(5);
    expect(canExportMmd(record)).toBe(true);
  });

  it('exports nodes csv', () => {
    const parsed = parseMermaidText(MMD_FLOWCHART_SAMPLE, 'flow.mmd');
    const csv = exportMmdNodesCsv(parsed);
    expect(csv).toContain('index,id,name,shape,group');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleMmdFile();
    const { accepted, rejected } = filterValidMmdFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'flow.mmd.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveMmdSuggestion returns upload-or-sample, sample-after-error, or null', () => {
    expect(resolveMmdSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveMmdSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveMmdSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fails unparseable text and disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createMmdFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(record.warnings.length).toBeGreaterThan(0);
    expect(canExportMmd(record)).toBe(false);
  });

  it('canExportMmd returns false for null', () => {
    expect(canExportMmd(null)).toBe(false);
  });
});
