import {
  CDG_JSON_SAMPLE,
  CDG_MARKDOWN_SAMPLE,
  CDG_PUML_SAMPLE,
  CDG_XMI_SAMPLE
} from '../constants/class-diagram-viewer-sample.data';
import { filterCdgRelations, filterCdgTypes, parseClassDiagramText } from './class-diagram-viewer-parse.utils';
import { canExportCdg, createCdgFileRecord, createSampleCdgFile, exportCdgTypesCsv, filterValidCdgFiles } from './class-diagram-viewer.utils';

describe('class-diagram-viewer-parse.utils', () => {
  it('parses the catalog types sample', () => {
    const parsed = parseClassDiagramText(CDG_PUML_SAMPLE, 'sample-catalog-types.puml');
    expect(parsed.title).toBe('Catalog types');
    expect(parsed.types.length).toBe(5);
    expect(parsed.relations.length).toBe(3);
    expect(parsed.types.some((t) => t.kind === 'abstract' && t.name === 'Entity')).toBe(true);
    expect(parsed.types.some((t) => t.kind === 'interface' && t.name === 'Auditable')).toBe(true);
    expect(parsed.types.some((t) => t.kind === 'enum' && t.name === 'Status')).toBe(true);
    const product = parsed.types.find((t) => t.name === 'Product');
    expect(product?.attributes.some((m) => m.name === 'sku' && m.visibility === 'private')).toBe(true);
    expect(product?.operations.some((m) => m.name === 'price')).toBe(true);
    expect(parsed.relations.some((r) => r.style === 'inherit')).toBe(true);
    expect(parsed.relations.some((r) => r.style === 'realize')).toBe(true);
    const has = parsed.relations.find((r) => r.label === 'has');
    expect(has?.sourceCard).toBe('1');
    expect(has?.targetCard).toBe('*');
  });

  it('parses XMI, markdown fence, and JSON', () => {
    const xmi = parseClassDiagramText(CDG_XMI_SAMPLE, 'catalog.xmi');
    expect(xmi.sourceKind).toBe('xmi');
    expect(xmi.types.length).toBe(2);
    expect(xmi.types.some((t) => t.kind === 'abstract')).toBe(true);
    expect(xmi.relations.length).toBe(1);
    expect(xmi.relations[0].style).toBe('realize');

    const md = parseClassDiagramText(CDG_MARKDOWN_SAMPLE, 'cart.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.types.length).toBe(2);
    expect(md.relations.length).toBe(1);
    expect(md.relations[0].style).toBe('compose');

    const json = parseClassDiagramText(CDG_JSON_SAMPLE, 'catalog.json');
    expect(json.sourceKind).toBe('json');
    expect(json.types.length).toBe(2);
    expect(json.relations.length).toBe(1);
    expect(json.relations[0].style).toBe('inherit');
  });

  it('filters types and relations', () => {
    const parsed = parseClassDiagramText(CDG_PUML_SAMPLE, 'catalog.puml');
    expect(filterCdgTypes(parsed.types, 'kind:abstract').every((t) => t.kind === 'abstract')).toBe(true);
    expect(filterCdgTypes(parsed.types, 'vis:private').some((t) => t.name === 'Product')).toBe(true);
    expect(filterCdgRelations(parsed.relations, 'rel:has').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseClassDiagramText('')).toThrow(/empty/i);
    expect(() => parseClassDiagramText('hello world')).toThrow(/Not a class diagram/i);
  });
});

describe('class-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleCdgFile();
    expect(file.name).toBe('sample-catalog-types.puml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample types', () => {
    const file = createSampleCdgFile();
    const record = createCdgFileRecord(file, new TextEncoder().encode(CDG_PUML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.types.length).toBe(5);
    expect(canExportCdg(record)).toBe(true);
  });

  it('exports types csv', () => {
    const parsed = parseClassDiagramText(CDG_PUML_SAMPLE, 'catalog.puml');
    const csv = exportCdgTypesCsv(parsed);
    expect(csv).toContain('index,id,name,kind,stereotype,attributes,operations');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleCdgFile();
    const { accepted, rejected } = filterValidCdgFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'catalog.puml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
