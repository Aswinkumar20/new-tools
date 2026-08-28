import {
  KG_CSV_SAMPLE,
  KG_MARKDOWN_SAMPLE,
  KG_SAMPLE,
  KG_XML_SAMPLE
} from '../constants/knowledge-graph-viewer-sample.data';
import { filterKgEntities, filterKgLinks, parseKnowledgeGraphText } from './knowledge-graph-viewer-parse.utils';
import {
  canExportKg,
  createKgFileRecord,
  createSampleKgFile,
  exportKgEntitiesCsv,
  filterValidKgFiles,
  resolveKgSuggestion
} from './knowledge-graph-viewer.utils';

describe('knowledge-graph-viewer-parse.utils', () => {
  it('parses the shop knowledge graph sample', () => {
    const parsed = parseKnowledgeGraphText(KG_SAMPLE, 'sample-shop-kg.json');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.entities.length).toBe(4);
    expect(parsed.links.length).toBe(3);
    expect(parsed.entities.some((e) => e.name === 'Web' && e.type === 'Service')).toBe(true);
    expect(parsed.entities.some((e) => e.name === 'Customer' && e.type === 'Person')).toBe(true);
    expect(parsed.links.some((l) => l.rel === 'dependsOn' && l.targetName === 'Api')).toBe(true);
    expect(parsed.links.some((l) => l.rel === 'uses')).toBe(true);
  });

  it('parses markdown, XML, and CSV', () => {
    const md = parseKnowledgeGraphText(KG_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.entities.length).toBe(2);
    expect(md.links.length).toBe(1);

    const xml = parseKnowledgeGraphText(KG_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.entities.length).toBe(2);
    expect(xml.links.length).toBe(1);

    const csv = parseKnowledgeGraphText(KG_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.entities.length).toBe(2);
    expect(csv.links.length).toBe(1);
  });

  it('filters entities and links', () => {
    const parsed = parseKnowledgeGraphText(KG_SAMPLE, 'shop.json');
    expect(filterKgEntities(parsed.entities, 'type:Service').length).toBe(2);
    expect(filterKgEntities(parsed.entities, 'entity:Catalog').some((e) => e.name === 'Catalog')).toBe(true);
    expect(filterKgLinks(parsed.links, 'rel:reads').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseKnowledgeGraphText('')).toThrow(/empty/i);
    expect(() => parseKnowledgeGraphText('hello world')).toThrow(/Not a knowledge graph/i);
  });
});

describe('knowledge-graph-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleKgFile();
    expect(file.name).toBe('sample-shop-kg.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample graph', () => {
    const file = createSampleKgFile();
    const record = createKgFileRecord(file, new TextEncoder().encode(KG_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.entities.length).toBe(4);
    expect(canExportKg(record)).toBe(true);
  });

  it('exports entities csv', () => {
    const parsed = parseKnowledgeGraphText(KG_SAMPLE, 'shop.json');
    const csv = exportKgEntitiesCsv(parsed);
    expect(csv).toContain('index,id,name,type,label');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleKgFile();
    const { accepted, rejected } = filterValidKgFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveKgSuggestion covers empty and error states', () => {
    expect(resolveKgSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveKgSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveKgSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail unparseable text disables export', () => {
    const record = createKgFileRecord(new File(['hello world'], 'bad.txt', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportKg(record)).toBe(false);
  });

  it('canExportKg returns false for null', () => {
    expect(canExportKg(null)).toBe(false);
  });
});
