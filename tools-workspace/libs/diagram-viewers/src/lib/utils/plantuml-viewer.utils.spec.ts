import { PUML_C4_SAMPLE, PUML_CLASS_SAMPLE, PUML_JSON_SAMPLE, PUML_MARKDOWN_SAMPLE } from '../constants/plantuml-viewer-sample.data';
import { filterPumlElements, parsePlantUmlText } from './plantuml-viewer-parse.utils';
import {
  canExportPuml,
  createPumlFileRecord,
  createSamplePumlFile,
  exportPumlElementsCsv,
  filterValidPumlFiles,
  resolvePumlSuggestion
} from './plantuml-viewer.utils';

describe('plantuml-viewer-parse.utils', () => {
  it('parses the shop class sample', () => {
    const parsed = parsePlantUmlText(PUML_CLASS_SAMPLE, 'sample-shop-classes.puml');
    expect(parsed.kind).toBe('uml');
    expect(parsed.title).toBe('Shop domain');
    expect(parsed.elements.length).toBe(4);
    expect(parsed.relations.length).toBe(3);
    expect(parsed.elements.some((e) => e.kind === 'interface')).toBe(true);
    expect(parsed.relations.some((r) => r.style === 'compose')).toBe(true);
  });

  it('parses C4, markdown fence, and JSON', () => {
    const c4 = parsePlantUmlText(PUML_C4_SAMPLE, 'shop.c4.puml');
    expect(c4.kind).toBe('c4');
    expect(c4.elements.length).toBe(3);
    expect(c4.relations.length).toBe(2);
    expect(c4.warnings.some((w) => /include/i.test(w))).toBe(true);
    const md = parsePlantUmlText(PUML_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.elements.length).toBe(2);
    const json = parsePlantUmlText(PUML_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.kind).toBe('c4');
    expect(json.relations.length).toBe(2);
  });

  it('filters uml vs c4 elements', () => {
    const parsed = parsePlantUmlText(PUML_CLASS_SAMPLE, 'shop.puml');
    expect(filterPumlElements(parsed.elements, 'kind:class').every((e) => e.kind === 'class')).toBe(true);
    expect(filterPumlElements(parsed.elements, '', 'uml').length).toBe(4);
    expect(filterPumlElements(parsed.elements, '', 'c4').length).toBe(0);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parsePlantUmlText('')).toThrow(/empty/i);
    expect(() => parsePlantUmlText('hello world')).toThrow(/Not a PlantUML/i);
  });
});

describe('plantuml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePumlFile();
    expect(file.name).toBe('sample-shop-classes.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample classes', () => {
    const file = createSamplePumlFile();
    const record = createPumlFileRecord(file, new TextEncoder().encode(PUML_CLASS_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.elements.length).toBe(4);
    expect(canExportPuml(record)).toBe(true);
  });

  it('exports elements csv', () => {
    const parsed = parsePlantUmlText(PUML_CLASS_SAMPLE, 'shop.puml');
    const csv = exportPumlElementsCsv(parsed);
    expect(csv).toContain('index,id,name,kind,stereotype,members');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePumlFile();
    const { accepted, rejected } = filterValidPumlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.puml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolvePumlSuggestion returns upload-or-sample, sample-after-error, or null', () => {
    expect(resolvePumlSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolvePumlSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolvePumlSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fails unparseable text and disables export', () => {
    const file = new File(['hello world'], 'bad.puml', { lastModified: 9 });
    const record = createPumlFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(record.warnings.length).toBeGreaterThan(0);
    expect(canExportPuml(record)).toBe(false);
  });

  it('canExportPuml returns false for null', () => {
    expect(canExportPuml(null)).toBe(false);
  });
});
