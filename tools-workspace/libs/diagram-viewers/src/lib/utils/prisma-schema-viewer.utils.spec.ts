import {
  PRM_JSON_SAMPLE,
  PRM_MARKDOWN_SAMPLE,
  PRM_SAMPLE,
  PRM_XML_SAMPLE
} from '../constants/prisma-schema-viewer-sample.data';
import { filterPrmModels, filterPrmRelations, parsePrismaSchemaText } from './prisma-schema-viewer-parse.utils';
import {
  canExportPrm,
  createPrmFileRecord,
  createSamplePrmFile,
  exportPrmModelsCsv,
  filterValidPrmFiles
} from './prisma-schema-viewer.utils';

describe('prisma-schema-viewer-parse.utils', () => {
  it('parses the shop Prisma sample', () => {
    const parsed = parsePrismaSchemaText(PRM_SAMPLE, 'sample-shop.prisma');
    expect(parsed.provider).toBe('postgresql');
    expect(parsed.models.length).toBe(4);
    expect(parsed.relations.length).toBe(3);
    expect(parsed.models.some((m) => m.name === 'Customer' && m.fields.some((f) => f.isId && f.name === 'id'))).toBe(true);
    expect(parsed.models.some((m) => m.name === 'OrderItem' && m.fields.filter((f) => f.isId).length === 2)).toBe(true);
    expect(parsed.relations.some((r) => r.source === 'Order' && r.target === 'Customer' && r.kind === '1-n')).toBe(true);
    expect(parsed.relations.some((r) => r.source === 'OrderItem' && r.target === 'Product')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parsePrismaSchemaText(PRM_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.models.length).toBe(2);
    expect(md.relations.length).toBe(1);

    const json = parsePrismaSchemaText(PRM_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.models.length).toBe(2);
    expect(json.relations.length).toBe(1);

    const xml = parsePrismaSchemaText(PRM_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.models.length).toBe(2);
    expect(xml.relations.length).toBe(1);
  });

  it('filters models and relations', () => {
    const parsed = parsePrismaSchemaText(PRM_SAMPLE, 'shop.prisma');
    expect(filterPrmModels(parsed.models, 'model:Customer').every((m) => m.name === 'Customer')).toBe(true);
    expect(filterPrmRelations(parsed.relations, 'from:OrderItem').length).toBe(2);
    expect(filterPrmModels(parsed.models, 'field:email').some((m) => m.name === 'Customer')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parsePrismaSchemaText('')).toThrow(/empty/i);
    expect(() => parsePrismaSchemaText('hello world')).toThrow(/Not a Prisma/i);
  });
});

describe('prisma-schema-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePrmFile();
    expect(file.name).toBe('sample-shop.prisma');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Prisma', () => {
    const file = createSamplePrmFile();
    const record = createPrmFileRecord(file, new TextEncoder().encode(PRM_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.models.length).toBe(4);
    expect(canExportPrm(record)).toBe(true);
  });

  it('exports models csv', () => {
    const parsed = parsePrismaSchemaText(PRM_SAMPLE, 'shop.prisma');
    const csv = exportPrmModelsCsv(parsed);
    expect(csv).toContain('index,id,name,kind,fields,ids');
    expect(csv.split('\n').length).toBe(5);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePrmFile();
    const { accepted, rejected } = filterValidPrmFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'schema.prisma.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
