import {
  DT_CSV_SAMPLE,
  DT_JSON_SAMPLE,
  DT_MARKDOWN_SAMPLE,
  DT_SAMPLE,
  DT_XML_SAMPLE
} from '../constants/decision-tree-viewer-sample.data';
import { filterDtBranches, filterDtEdges, filterDtLeaves, parseDecisionTreeText } from './decision-tree-viewer-parse.utils';
import {
  canExportDt,
  createDtFileRecord,
  createSampleDtFile,
  exportDtBranchesCsv,
  filterValidDtFiles,
  resolveDtSuggestion
} from './decision-tree-viewer.utils';

describe('decision-tree-viewer-parse.utils', () => {
  it('parses the shop JSON sample', () => {
    const parsed = parseDecisionTreeText(DT_SAMPLE, 'sample-shop-tree.json');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.branches.length).toBe(2);
    expect(parsed.leaves.length).toBe(3);
    expect(parsed.edges.length).toBe(4);
    expect(parsed.root).toBe('n0');
    expect(parsed.branches.some((n) => n.id === 'n0' && n.kind === 'root' && n.feature === 'cartTotal')).toBe(true);
    expect(parsed.leaves.some((n) => n.value === 'standard')).toBe(true);
    expect(parsed.leaves.some((n) => n.value === 'priority')).toBe(true);
    expect(parsed.edges.some((e) => e.label === 'yes' && e.target === 'n1')).toBe(true);
  });

  it('parses markdown, nested JSON, XML, and CSV', () => {
    const md = parseDecisionTreeText(DT_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.branches.length).toBeGreaterThanOrEqual(1);
    expect(md.leaves.length).toBeGreaterThanOrEqual(2);
    expect(md.edges.length).toBeGreaterThanOrEqual(2);
    expect(md.leaves.some((n) => /standard/i.test(n.value || n.name))).toBe(true);

    const json = parseDecisionTreeText(DT_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.branches.length).toBe(1);
    expect(json.leaves.length).toBe(2);
    expect(json.edges.length).toBe(2);

    const xml = parseDecisionTreeText(DT_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.branches.length).toBe(1);
    expect(xml.leaves.length).toBe(2);
    expect(xml.edges.length).toBe(2);

    const csv = parseDecisionTreeText(DT_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.branches.length).toBe(1);
    expect(csv.leaves.length).toBe(2);
    expect(csv.edges.length).toBe(2);
  });

  it('filters branches, leaves, and edges', () => {
    const parsed = parseDecisionTreeText(DT_SAMPLE, 'shop.json');
    expect(filterDtBranches(parsed.branches, 'feature:itemCount').length).toBe(1);
    expect(filterDtBranches(parsed.branches, 'kind:root').some((n) => n.id === 'n0')).toBe(true);
    expect(filterDtLeaves(parsed.leaves, 'leaf:express').length).toBe(1);
    expect(filterDtEdges(parsed.edges, 'label:no').length).toBe(2);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDecisionTreeText('')).toThrow(/empty/i);
    expect(() => parseDecisionTreeText('hello world')).toThrow(/Not a decision tree/i);
  });
});

describe('decision-tree-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDtFile();
    expect(file.name).toBe('sample-shop-tree.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample json', () => {
    const file = createSampleDtFile();
    const record = createDtFileRecord(file, new TextEncoder().encode(DT_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.branches.length).toBe(2);
    expect(record.parsed?.leaves.length).toBe(3);
    expect(canExportDt(record)).toBe(true);
  });

  it('exports branches csv', () => {
    const parsed = parseDecisionTreeText(DT_SAMPLE, 'shop.json');
    const csv = exportDtBranchesCsv(parsed);
    expect(csv).toContain('index,id,name,kind,feature,operator,threshold');
    expect(csv.split('\n').length).toBe(3);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDtFile();
    const { accepted, rejected } = filterValidDtFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveDtSuggestion covers empty and error states', () => {
    expect(resolveDtSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveDtSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveDtSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail unparseable text disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createDtFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportDt(record)).toBe(false);
    expect(canExportDt(null)).toBe(false);
  });
});
