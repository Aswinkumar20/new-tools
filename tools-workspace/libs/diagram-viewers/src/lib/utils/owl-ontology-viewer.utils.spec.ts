import {
  OWL_JSON_SAMPLE,
  OWL_MARKDOWN_SAMPLE,
  OWL_SAMPLE,
  OWL_TURTLE_SAMPLE,
  OWL_XML_SAMPLE
} from '../constants/owl-ontology-viewer-sample.data';
import { filterOwlAxioms, filterOwlClasses, filterOwlProperties, parseOwlText } from './owl-ontology-viewer-parse.utils';
import {
  canExportOwl,
  createOwlFileRecord,
  createSampleOwlFile,
  exportOwlClassesCsv,
  filterValidOwlFiles
} from './owl-ontology-viewer.utils';

describe('owl-ontology-viewer-parse.utils', () => {
  it('parses the shop OWL sample', () => {
    const parsed = parseOwlText(OWL_SAMPLE, 'sample-shop.owl');
    expect(parsed.sourceKind).toBe('owl');
    expect(parsed.classes.length).toBe(3);
    expect(parsed.properties.length).toBe(2);
    expect(parsed.axioms.length).toBeGreaterThanOrEqual(2);
    expect(parsed.classes.some((c) => c.name === 'Book' && c.superClasses.includes('Product'))).toBe(true);
    expect(parsed.properties.some((p) => p.name === 'buys' && p.kind === 'object')).toBe(true);
    expect(parsed.properties.some((p) => p.name === 'price' && p.kind === 'datatype')).toBe(true);
    expect(parsed.axioms.some((a) => a.rel === 'subclass')).toBe(true);
  });

  it('parses markdown, JSON, XML, and Turtle', () => {
    const md = parseOwlText(OWL_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.classes.length).toBeGreaterThanOrEqual(2);
    expect(md.properties.length).toBe(1);
    expect(md.axioms.some((a) => a.rel === 'subclass')).toBe(true);

    const json = parseOwlText(OWL_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.classes.length).toBeGreaterThanOrEqual(2);
    expect(json.properties.length).toBe(1);

    const xml = parseOwlText(OWL_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.classes.length).toBeGreaterThanOrEqual(2);
    expect(xml.properties.length).toBe(1);

    const ttl = parseOwlText(OWL_TURTLE_SAMPLE, 'shop.ttl');
    expect(ttl.sourceKind).toBe('turtle');
    expect(ttl.classes.some((c) => c.name === 'Book')).toBe(true);
    expect(ttl.properties.some((p) => p.name === 'buys')).toBe(true);
  });

  it('filters classes, properties, and axioms', () => {
    const parsed = parseOwlText(OWL_SAMPLE, 'shop.owl');
    expect(filterOwlClasses(parsed.classes, 'class:Book').some((c) => c.name === 'Book')).toBe(true);
    expect(filterOwlProperties(parsed.properties, 'kind:object').every((p) => p.kind === 'object')).toBe(true);
    expect(filterOwlAxioms(parsed.axioms, 'rel:subclass').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseOwlText('')).toThrow(/empty/i);
    expect(() => parseOwlText('hello world')).toThrow(/Not an OWL/i);
  });
});

describe('owl-ontology-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleOwlFile();
    expect(file.name).toBe('sample-shop.owl');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample ontology', () => {
    const file = createSampleOwlFile();
    const record = createOwlFileRecord(file, new TextEncoder().encode(OWL_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.classes.length).toBe(3);
    expect(canExportOwl(record)).toBe(true);
  });

  it('exports classes csv', () => {
    const parsed = parseOwlText(OWL_SAMPLE, 'shop.owl');
    const csv = exportOwlClassesCsv(parsed);
    expect(csv).toContain('index,id,name,label,super');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleOwlFile();
    const { accepted, rejected } = filterValidOwlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.owl.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
