import {
  ER_JSON_SAMPLE,
  ER_MARKDOWN_SAMPLE,
  ER_MERMAID_SAMPLE,
  ER_PUML_SAMPLE,
  ER_XML_SAMPLE
} from '../constants/er-diagram-viewer-sample.data';
import { filterErEntities, filterErKeys, parseErDiagramText } from './er-diagram-viewer-parse.utils';
import {
  canExportEr,
  createErFileRecord,
  createSampleErFile,
  exportErEntitiesCsv,
  filterValidErFiles
} from './er-diagram-viewer.utils';

describe('er-diagram-viewer-parse.utils', () => {
  it('parses the shop PlantUML ER sample', () => {
    const parsed = parseErDiagramText(ER_PUML_SAMPLE, 'sample-shop-er.puml');
    expect(parsed.title).toBe('Shop ER');
    expect(parsed.entities.length).toBe(3);
    expect(parsed.relations.length).toBe(2);
    expect(parsed.entities.some((e) => e.name === 'Customer' && e.columns.some((c) => c.pk && c.name === 'id'))).toBe(true);
    expect(parsed.entities.some((e) => e.name === 'Order' && e.columns.some((c) => c.fk && c.name === 'customer_id'))).toBe(true);
    expect(parsed.keys.some((k) => k.kind === 'pk' && k.entityName === 'Product')).toBe(true);
    expect(parsed.keys.some((k) => k.kind === 'fk' && k.column === 'customer_id' && k.refEntity === 'Customer')).toBe(true);
    expect(parsed.relations.some((r) => r.label === 'places' && r.sourceCard === '||' && r.targetCard === 'o{')).toBe(true);
  });

  it('parses mermaid, markdown fence, JSON, and XML', () => {
    const mermaid = parseErDiagramText(ER_MERMAID_SAMPLE, 'shop.mmd');
    expect(mermaid.sourceKind).toBe('mermaid');
    expect(mermaid.entities.length).toBe(3);
    expect(mermaid.relations.length).toBe(2);
    expect(mermaid.entities.some((e) => e.columns.some((c) => c.pk))).toBe(true);

    const md = parseErDiagramText(ER_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.entities.length).toBe(2);
    expect(md.relations.length).toBe(1);

    const json = parseErDiagramText(ER_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.entities.length).toBe(2);
    expect(json.relations.length).toBe(1);

    const xml = parseErDiagramText(ER_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.entities.length).toBe(2);
    expect(xml.relations.length).toBe(1);
  });

  it('filters entities and keys', () => {
    const parsed = parseErDiagramText(ER_PUML_SAMPLE, 'shop.puml');
    expect(filterErEntities(parsed.entities, 'entity:Customer').every((e) => e.name === 'Customer')).toBe(true);
    expect(filterErKeys(parsed.keys, 'key:pk').every((k) => k.kind === 'pk')).toBe(true);
    expect(filterErEntities(parsed.entities, 'attr:email').some((e) => e.name === 'Customer')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseErDiagramText('')).toThrow(/empty/i);
    expect(() => parseErDiagramText('hello world')).toThrow(/Not an ER/i);
  });
});

describe('er-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleErFile();
    expect(file.name).toBe('sample-shop-er.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample ER', () => {
    const file = createSampleErFile();
    const record = createErFileRecord(file, new TextEncoder().encode(ER_PUML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.entities.length).toBe(3);
    expect(canExportEr(record)).toBe(true);
  });

  it('exports entities csv', () => {
    const parsed = parseErDiagramText(ER_PUML_SAMPLE, 'shop.puml');
    const csv = exportErEntitiesCsv(parsed);
    expect(csv).toContain('index,id,name,columns,pk,fk');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleErFile();
    const { accepted, rejected } = filterValidErFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.puml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
