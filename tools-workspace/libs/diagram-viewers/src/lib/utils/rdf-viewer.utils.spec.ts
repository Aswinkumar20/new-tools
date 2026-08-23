import {
  RDF_JSON_SAMPLE,
  RDF_MARKDOWN_SAMPLE,
  RDF_SAMPLE,
  RDF_XML_SAMPLE
} from '../constants/rdf-viewer-sample.data';
import { filterRdfNodes, filterRdfTriples, parseRdfText } from './rdf-viewer-parse.utils';
import {
  canExportRdf,
  createRdfFileRecord,
  createSampleRdfFile,
  exportRdfTriplesCsv,
  filterValidRdfFiles
} from './rdf-viewer.utils';

describe('rdf-viewer-parse.utils', () => {
  it('parses the shop Turtle sample', () => {
    const parsed = parseRdfText(RDF_SAMPLE, 'sample-shop.ttl');
    expect(parsed.sourceKind).toBe('turtle');
    expect(parsed.prefixes.length).toBeGreaterThanOrEqual(3);
    expect(parsed.triples.length).toBeGreaterThanOrEqual(8);
    expect(parsed.nodes.length).toBeGreaterThanOrEqual(5);
    expect(parsed.nodes.some((n) => n.name === 'shop:Web' || n.name === 'Web')).toBe(true);
    expect(parsed.triples.some((t) => t.predicateName.includes('dependsOn') && (t.objectName.includes('Api') || t.object.includes('Api')))).toBe(true);
    expect(parsed.triples.some((t) => t.literal)).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseRdfText(RDF_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.triples.length).toBe(1);
    expect(md.nodes.length).toBe(2);

    const json = parseRdfText(RDF_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.triples.length).toBe(2);
    expect(json.nodes.length).toBeGreaterThanOrEqual(3);

    const xml = parseRdfText(RDF_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.triples.length).toBe(2);
    expect(xml.nodes.length).toBeGreaterThanOrEqual(3);
  });

  it('filters nodes and triples', () => {
    const parsed = parseRdfText(RDF_SAMPLE, 'shop.ttl');
    expect(filterRdfTriples(parsed.triples, 'pred:dependsOn').length).toBeGreaterThanOrEqual(2);
    expect(filterRdfNodes(parsed.nodes, 'node:Web').length).toBeGreaterThanOrEqual(1);
    expect(filterRdfTriples(parsed.triples, 'sub:Catalog').some((t) => t.subjectName.includes('Catalog'))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseRdfText('')).toThrow(/empty/i);
    expect(() => parseRdfText('hello world')).toThrow(/Not an RDF/i);
  });
});

describe('rdf-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleRdfFile();
    expect(file.name).toBe('sample-shop.ttl');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample turtle', () => {
    const file = createSampleRdfFile();
    const record = createRdfFileRecord(file, new TextEncoder().encode(RDF_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.triples.length).toBeGreaterThanOrEqual(8);
    expect(canExportRdf(record)).toBe(true);
  });

  it('exports triples csv', () => {
    const parsed = parseRdfText(RDF_SAMPLE, 'shop.ttl');
    const csv = exportRdfTriplesCsv(parsed);
    expect(csv).toContain('index,subject,predicate,object,literal');
    expect(csv.split('\n').length).toBe(parsed.triples.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleRdfFile();
    const { accepted, rejected } = filterValidRdfFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.ttl.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
