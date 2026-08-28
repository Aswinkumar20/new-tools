import { FM_JSON_SAMPLE, FM_MARKDOWN_SAMPLE, FM_MM_SAMPLE } from '../constants/freemind-viewer-sample.data';
import { filterFmNodes, parseFreemindText, toggleFmCollapsed, visibleFmNodes } from './freemind-viewer-parse.utils';
import { canExportFm, createFmFileRecord, createSampleFmFile, exportFmNotesTxt, filterValidFmFiles, resolveFmSuggestion } from './freemind-viewer.utils';

describe('freemind-viewer-parse.utils', () => {
  it('parses the shop FreeMind sample', () => {
    const parsed = parseFreemindText(FM_MM_SAMPLE, 'sample-shop.mm');
    expect(parsed.sourceKind).toBe('mm');
    expect(parsed.version).toBe('1.0.1');
    expect(parsed.nodes.length).toBe(5);
    expect(parsed.nodes[0].label).toBe('Shop');
    expect(parsed.nodes.find((n) => n.label === 'Customer')?.parentId).toBe(parsed.rootId);
    expect(parsed.nodes.find((n) => n.label === 'Cart')?.parentId).toBe(parsed.nodes.find((n) => n.label === 'Customer')?.id);
    expect(parsed.nodes.find((n) => n.label === 'Customer')?.note).toMatch(/Loyalty/);
    expect(parsed.nodes.find((n) => n.label === 'Pay')?.note).toMatch(/Card/);
    expect(parsed.nodes.filter((n) => n.note).length).toBe(2);
  });

  it('parses JSON and markdown fence', () => {
    const json = parseFreemindText(FM_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(5);
    expect(json.nodes.some((n) => n.note.includes('Loyalty'))).toBe(true);

    const md = parseFreemindText(FM_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBe(3);
    expect(md.nodes.some((n) => n.note === 'VIP')).toBe(true);
  });

  it('filters notes and collapses tree', () => {
    const parsed = parseFreemindText(FM_MM_SAMPLE, 'shop.mm');
    expect(filterFmNodes(parsed.nodes, 'note:loyalty').some((n) => n.label === 'Customer')).toBe(true);
    expect(filterFmNodes(parsed.nodes, '', true).length).toBe(2);
    const customer = parsed.nodes.find((n) => n.label === 'Customer');
    const collapsed = toggleFmCollapsed(parsed, customer!.id);
    const visible = visibleFmNodes(collapsed.nodes);
    expect(visible.some((n) => n.label === 'Cart')).toBe(false);
    expect(visible.some((n) => n.label === 'Checkout')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseFreemindText('')).toThrow(/empty/i);
    expect(() => parseFreemindText('hello world')).toThrow(/Not a FreeMind/i);
  });
});

describe('freemind-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFmFile();
    expect(file.name).toBe('sample-shop.mm');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample FreeMind', () => {
    const file = createSampleFmFile();
    const record = createFmFileRecord(file, new TextEncoder().encode(FM_MM_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(5);
    expect(canExportFm(record)).toBe(true);
  });

  it('exports notes text', () => {
    const parsed = parseFreemindText(FM_MM_SAMPLE, 'shop.mm');
    const notes = exportFmNotesTxt(parsed);
    expect(notes).toContain('Customer');
    expect(notes).toContain('Loyalty shopper');
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleFmFile();
    const { accepted, rejected } = filterValidFmFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.mm.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveFmSuggestion covers empty and error states', () => {
    expect(resolveFmSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveFmSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveFmSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail unparseable text disables export', () => {
    const record = createFmFileRecord(new File(['hello world'], 'bad.txt', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportFm(record)).toBe(false);
  });

  it('canExportFm returns false for null', () => {
    expect(canExportFm(null)).toBe(false);
  });
});
