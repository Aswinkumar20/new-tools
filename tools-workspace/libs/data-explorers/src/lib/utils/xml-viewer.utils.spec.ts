import { XM_CSV_SAMPLE, XM_JSON_SAMPLE, XM_MARKDOWN_SAMPLE, XM_XML_SAMPLE } from '../constants/xml-viewer-sample.data';
import {
  buildSampleXmlBytes,
  filterXmAttributes,
  filterXmNodes,
  filterXmRows,
  parseXmlBytes,
  parseXmlText
} from './xml-viewer-parse.utils';
import {
  canExportXm,
  createSampleXmFile,
  createXmFileRecord,
  exportXmSchemaCsv,
  filterValidXmFiles
} from './xml-viewer.utils';

describe('xml-viewer-parse.utils', () => {
  it('parses the catalog XML sample', () => {
    const parsed = parseXmlBytes(buildSampleXmlBytes(), 'catalog-feed.xml');
    expect(parsed.sourceKind).toBe('xml');
    expect(parsed.rootName).toBe('catalog');
    expect(parsed.encoding).toBe('UTF-8');
    expect(parsed.nodes.some((n) => n.name === 'catalog')).toBe(true);
    expect(parsed.nodes.filter((n) => n.name === 'item').length).toBe(3);
    expect(parsed.attributes.some((a) => a.name === 'sku' && a.value === 'WB-100')).toBe(true);
    expect(parsed.rows.length).toBe(3);
    expect(parsed.rows.some((r) => r.sku === 'HOOD-03')).toBe(true);
    expect(parsed.nodes.some((n) => n.name === 'note' && n.text.includes('Canvas tote'))).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseXmlText(XM_JSON_SAMPLE, 'catalog.json');
    expect(json.sourceKind).toBe('json');
    expect(json.nodes.length).toBeGreaterThanOrEqual(3);
    expect(json.rows.length).toBe(2);

    const csv = parseXmlText(XM_CSV_SAMPLE, 'catalog.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.rows.length).toBe(2);

    const md = parseXmlText(XM_MARKDOWN_SAMPLE, 'catalog.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rows.length).toBeGreaterThanOrEqual(2);
  });

  it('filters nodes, attributes, and rows', () => {
    const parsed = parseXmlBytes(buildSampleXmlBytes(), 'catalog.xml');
    expect(filterXmNodes(parsed.nodes, 'name:item').length).toBeGreaterThanOrEqual(3);
    expect(filterXmAttributes(parsed.attributes, 'sku:HOOD').length).toBe(1);
    expect(filterXmRows(parsed.rows, 'sku:HOOD').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseXmlText('')).toThrow(/empty/i);
    expect(() => parseXmlText('hello world')).toThrow(/Not an XML/i);
  });
});

describe('xml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleXmFile();
    expect(file.name).toBe('catalog-feed.xml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample xml', () => {
    const file = createSampleXmFile();
    const record = createXmFileRecord(file, buildSampleXmlBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rows.length).toBe(3);
    expect(canExportXm(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseXmlBytes(buildSampleXmlBytes(), 'catalog.xml');
    const csv = exportXmSchemaCsv(parsed);
    expect(csv).toContain('path,name,attrCount,childCount,sample');
    expect(csv.split('\n').length).toBe(parsed.schema.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleXmFile();
    const { accepted, rejected } = filterValidXmFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'catalog.xml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});

export { XM_XML_SAMPLE };
