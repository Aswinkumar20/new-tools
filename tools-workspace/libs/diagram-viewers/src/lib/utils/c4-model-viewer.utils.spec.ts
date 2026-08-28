import {
  C4_DSL_SAMPLE,
  C4_JSON_SAMPLE,
  C4_MARKDOWN_SAMPLE,
  C4_PUML_SAMPLE,
  C4_XML_SAMPLE
} from '../constants/c4-model-viewer-sample.data';
import { filterC4Elements, filterC4Relations, parseC4Text } from './c4-model-viewer-parse.utils';
import { canExportC4, createC4FileRecord, createSampleC4File, exportC4ElementsCsv, filterValidC4Files, resolveC4Suggestion } from './c4-model-viewer.utils';

describe('c4-model-viewer-parse.utils', () => {
  it('parses the shop C4 sample', () => {
    const parsed = parseC4Text(C4_PUML_SAMPLE, 'sample-shop-c4.puml');
    expect(parsed.title).toBe('Shop C4');
    expect(parsed.elements.length).toBe(5);
    expect(parsed.relations.length).toBe(4);
    expect(parsed.elements.some((e) => e.kind === 'person' && e.name === 'Customer')).toBe(true);
    expect(parsed.elements.some((e) => e.kind === 'container' && e.technology === 'SPA')).toBe(true);
    expect(parsed.elements.some((e) => e.kind === 'component' && e.name === 'Checkout')).toBe(true);
    expect(parsed.elements.some((e) => e.stereotype === 'external')).toBe(true);
    expect(parsed.warnings.some((w) => /include/i.test(w))).toBe(true);
  });

  it('parses Structurizr DSL, markdown, JSON, and XML', () => {
    const dsl = parseC4Text(C4_DSL_SAMPLE, 'shop.dsl');
    expect(dsl.sourceKind).toBe('dsl');
    expect(dsl.elements.length).toBe(6);
    expect(dsl.relations.length).toBe(2);
    expect(dsl.elements.some((e) => e.kind === 'component' && e.name === 'Checkout')).toBe(true);
    expect(dsl.elements.find((e) => e.id === 'web')?.parent).toBe('shop');

    const md = parseC4Text(C4_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.elements.length).toBe(2);
    expect(md.relations.length).toBe(1);

    const json = parseC4Text(C4_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.elements.length).toBe(4);
    expect(json.relations.length).toBe(2);

    const xml = parseC4Text(C4_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.elements.length).toBe(2);
    expect(xml.relations.length).toBe(1);
  });

  it('filters context, container, and component', () => {
    const parsed = parseC4Text(C4_PUML_SAMPLE, 'shop.puml');
    expect(filterC4Elements(parsed.elements, '', 'context').every((e) => e.kind === 'person' || e.kind === 'system' || e.kind === 'boundary')).toBe(true);
    expect(filterC4Elements(parsed.elements, '', 'container').every((e) => e.kind === 'container')).toBe(true);
    expect(filterC4Elements(parsed.elements, '', 'component').every((e) => e.kind === 'component')).toBe(true);
    expect(filterC4Relations(parsed.relations, 'rel:Charges').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseC4Text('')).toThrow(/empty/i);
    expect(() => parseC4Text('hello world')).toThrow(/Not a C4/i);
  });
});

describe('c4-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleC4File();
    expect(file.name).toBe('sample-shop-c4.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample C4', () => {
    const file = createSampleC4File();
    const record = createC4FileRecord(file, new TextEncoder().encode(C4_PUML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.elements.length).toBe(5);
    expect(canExportC4(record)).toBe(true);
  });

  it('exports elements csv', () => {
    const parsed = parseC4Text(C4_PUML_SAMPLE, 'shop.puml');
    const csv = exportC4ElementsCsv(parsed);
    expect(csv).toContain('index,id,name,kind,stereotype,technology,parent');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleC4File();
    const { accepted, rejected } = filterValidC4Files([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.c4.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveC4Suggestion covers empty and error states', () => {
    expect(resolveC4Suggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveC4Suggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveC4Suggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const payload = new TextEncoder().encode('hello world');
    const file = new File([payload], 'bad.txt', { lastModified: 9 });
    const record = createC4FileRecord(file, payload);
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportC4(record)).toBe(false);
    expect(canExportC4(null)).toBe(false);
  });
});
