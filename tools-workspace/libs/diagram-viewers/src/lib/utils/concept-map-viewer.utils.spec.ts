import {
  CMAP_CXL_SAMPLE,
  CMAP_DOT_SAMPLE,
  CMAP_JSON_SAMPLE,
  CMAP_MARKDOWN_SAMPLE,
  CMAP_XML_SAMPLE
} from '../constants/concept-map-viewer-sample.data';
import { filterCmapLinks, filterCmapNodes, parseConceptMapText } from './concept-map-viewer-parse.utils';
import {
  canExportCmap,
  createCmapFileRecord,
  createSampleCmapFile,
  exportCmapNodesCsv,
  filterValidCmapFiles
} from './concept-map-viewer.utils';

describe('concept-map-viewer-parse.utils', () => {
  it('parses the shop CXL sample', () => {
    const parsed = parseConceptMapText(CMAP_CXL_SAMPLE, 'sample-shop-concept.cxl');
    expect(parsed.title).toBe('Shop concept map');
    expect(parsed.nodes.length).toBe(4);
    expect(parsed.links.length).toBe(3);
    expect(parsed.nodes.some((n) => n.label === 'Customer')).toBe(true);
    expect(parsed.links.some((l) => l.label === 'uses' && l.sourceName === 'Customer' && l.targetName === 'Cart')).toBe(true);
    expect(parsed.links.some((l) => l.label === 'pays via')).toBe(true);
  });

  it('parses markdown, JSON, XML, and DOT', () => {
    const md = parseConceptMapText(CMAP_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nodes.length).toBe(5);
    expect(md.links.length).toBe(3);
    expect(md.links.some((l) => l.label === 'uses')).toBe(true);

    const json = parseConceptMapText(CMAP_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBe(3);
    expect(json.links.length).toBe(2);

    const xml = parseConceptMapText(CMAP_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.nodes.length).toBe(3);
    expect(xml.links.length).toBe(2);

    const dot = parseConceptMapText(CMAP_DOT_SAMPLE, 'shop.dot');
    expect(dot.sourceKind).toBe('dot');
    expect(dot.nodes.length).toBe(3);
    expect(dot.links.length).toBe(2);
  });

  it('filters nodes and links', () => {
    const parsed = parseConceptMapText(CMAP_CXL_SAMPLE, 'shop.cxl');
    expect(filterCmapNodes(parsed.nodes, 'node:Customer').every((n) => n.label.includes('Customer'))).toBe(true);
    expect(filterCmapLinks(parsed.links, 'rel:uses').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseConceptMapText('')).toThrow(/empty/i);
    expect(() => parseConceptMapText('hello world')).toThrow(/Not a concept map/i);
  });
});

describe('concept-map-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleCmapFile();
    expect(file.name).toBe('sample-shop-concept.cxl');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample concept map', () => {
    const file = createSampleCmapFile();
    const record = createCmapFileRecord(file, new TextEncoder().encode(CMAP_CXL_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.nodes.length).toBe(4);
    expect(canExportCmap(record)).toBe(true);
  });

  it('exports nodes csv', () => {
    const parsed = parseConceptMapText(CMAP_CXL_SAMPLE, 'shop.cxl');
    const csv = exportCmapNodesCsv(parsed);
    expect(csv).toContain('index,id,label,note');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleCmapFile();
    const { accepted, rejected } = filterValidCmapFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.cxl.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
