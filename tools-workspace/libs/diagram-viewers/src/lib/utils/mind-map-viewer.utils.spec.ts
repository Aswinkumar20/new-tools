import {
  MMAP_INDENTED_SAMPLE,
  MMAP_JSON_SAMPLE,
  MMAP_MARKDOWN_SAMPLE,
  MMAP_MERMAID_SAMPLE,
  MMAP_OPML_SAMPLE
} from '../constants/mind-map-viewer-sample.data';
import {
  filterMmapNodes,
  parseMindMapText,
  setMmapCollapsedAll,
  toggleMmapCollapsed,
  visibleMmapNodes
} from './mind-map-viewer-parse.utils';
import { canExportMmap, createMmapFileRecord, createSampleMmapFile, exportMmapOutlineTxt, filterValidMmapFiles } from './mind-map-viewer.utils';

describe('mind-map-viewer-parse.utils', () => {
  it('parses the shop markdown sample', () => {
    const parsed = parseMindMapText(MMAP_MARKDOWN_SAMPLE, 'sample-shop-mind.md');
    expect(parsed.sourceKind).toBe('markdown');
    expect(parsed.nodes.length).toBe(7);
    expect(parsed.nodes[0].label).toBe('Shop');
    expect(parsed.nodes.find((n) => n.label === 'Customer')?.parentId).toBe(parsed.rootId);
    expect(parsed.nodes.find((n) => n.label === 'Bank')?.depth).toBe(3);
    expect(parsed.nodes.find((n) => n.label === 'Cart')?.parentId).toBe(parsed.nodes.find((n) => n.label === 'Customer')?.id);
  });

  it('parses mermaid, opml, json, and indented text', () => {
    const mermaid = parseMindMapText(MMAP_MERMAID_SAMPLE, 'shop.mmd');
    expect(mermaid.sourceKind).toBe('mermaid');
    expect(mermaid.nodes.length).toBe(5);
    expect(mermaid.nodes[0].label).toBe('Shop');
    expect(mermaid.nodes.some((n) => n.label === 'Checkout')).toBe(true);

    const opml = parseMindMapText(MMAP_OPML_SAMPLE, 'shop.opml');
    expect(opml.sourceKind).toBe('opml');
    expect(opml.nodes.length).toBeGreaterThanOrEqual(4);
    expect(opml.nodes.some((n) => n.label === 'Checkout' && n.note === 'payment')).toBe(true);

    const json = parseMindMapText(MMAP_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(6);
    expect(json.nodes.some((n) => n.label === 'Wishlist')).toBe(true);

    const indented = parseMindMapText(MMAP_INDENTED_SAMPLE, 'shop.txt');
    expect(indented.sourceKind).toBe('txt');
    expect(indented.nodes.length).toBe(5);
    expect(indented.nodes.find((n) => n.label === 'Pay')?.depth).toBe(2);
  });

  it('collapses branches and searches topics', () => {
    const parsed = parseMindMapText(MMAP_MARKDOWN_SAMPLE, 'shop.md');
    const customer = parsed.nodes.find((n) => n.label === 'Customer');
    expect(customer).toBeTruthy();
    const collapsed = toggleMmapCollapsed(parsed, customer!.id);
    const visible = visibleMmapNodes(collapsed.nodes);
    expect(visible.some((n) => n.label === 'Cart')).toBe(false);
    expect(visible.some((n) => n.label === 'Wishlist')).toBe(false);
    expect(visible.some((n) => n.label === 'Checkout')).toBe(true);
    expect(filterMmapNodes(parsed.nodes, 'node:Pay').some((n) => n.label === 'Pay')).toBe(true);
    expect(filterMmapNodes(parsed.nodes, 'depth:3').some((n) => n.label === 'Bank')).toBe(true);
    const allCollapsed = setMmapCollapsedAll(parsed, true);
    expect(allCollapsed.nodes.filter((n) => n.childIds.length && n.id !== allCollapsed.rootId).every((n) => n.collapsed)).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseMindMapText('')).toThrow(/empty/i);
    expect(() => parseMindMapText('hello world')).toThrow(/Not a mind map/i);
  });
});

describe('mind-map-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMmapFile();
    expect(file.name).toBe('sample-shop-mind.md');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample mind map', () => {
    const file = createSampleMmapFile();
    const record = createMmapFileRecord(file, new TextEncoder().encode(MMAP_MARKDOWN_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(7);
    expect(canExportMmap(record)).toBe(true);
  });

  it('exports outline text', () => {
    const parsed = parseMindMapText(MMAP_MARKDOWN_SAMPLE, 'shop.md');
    const outline = exportMmapOutlineTxt(parsed);
    expect(outline).toContain('Shop');
    expect(outline).toContain('  Customer');
    expect(outline).toContain('    Cart');
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleMmapFile();
    const { accepted, rejected } = filterValidMmapFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.md.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
