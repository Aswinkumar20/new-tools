import {
  VSD_JSON_SAMPLE,
  VSD_MARKDOWN_SAMPLE,
  VSD_SAMPLE,
  VSD_XML_SAMPLE
} from '../constants/visio-viewer-sample.data';
import { filterVsdConnectors, filterVsdPages, filterVsdShapes, parseVisioBytes, parseVisioText } from './visio-viewer-parse.utils';
import {
  canExportVsd,
  createSampleVsdFile,
  createVsdFileRecord,
  exportVsdShapesCsv,
  filterValidVsdFiles,
  resolveVsdSuggestion
} from './visio-viewer.utils';

describe('visio-viewer-parse.utils', () => {
  it('parses the shop Visio sample with pages and shapes', () => {
    const parsed = parseVisioText(VSD_SAMPLE, 'sample-shop.vdx');
    expect(parsed.pages.length).toBe(2);
    expect(parsed.shapes.length).toBe(5);
    expect(parsed.connectors.length).toBe(3);
    expect(parsed.pages.some((p) => p.name === 'Shop' && p.shapeCount === 3)).toBe(true);
    expect(parsed.pages.some((p) => p.name === 'Payments' && p.connectorCount === 1)).toBe(true);
    expect(parsed.shapes.some((s) => s.label === 'Customer' && s.pageName === 'Shop')).toBe(true);
    expect(parsed.connectors.some((c) => c.label === 'charge' && c.targetName === 'Bank')).toBe(true);
  });

  it('parses markdown, JSON, and simple XML', () => {
    const md = parseVisioText(VSD_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.pages.length).toBe(1);
    expect(md.shapes.length).toBe(2);
    expect(md.connectors.length).toBe(1);

    const json = parseVisioText(VSD_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.pages.length).toBe(1);
    expect(json.shapes.length).toBe(2);
    expect(json.connectors.length).toBe(1);

    const xml = parseVisioText(VSD_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.pages.length).toBe(1);
    expect(xml.shapes.length).toBe(2);
    expect(xml.connectors.length).toBe(1);
  });

  it('filters pages, shapes, and connectors', () => {
    const parsed = parseVisioText(VSD_SAMPLE, 'shop.vdx');
    expect(filterVsdPages(parsed.pages, 'page:Pay').every((p) => p.name.includes('Pay'))).toBe(true);
    expect(filterVsdShapes(parsed.shapes, 'shape:Customer').some((s) => s.label === 'Customer')).toBe(true);
    expect(filterVsdConnectors(parsed.connectors, 'rel:uses').length).toBe(1);
    expect(filterVsdShapes(parsed.shapes, '', parsed.pages.find((p) => p.name === 'Payments')?.id || '').length).toBe(2);
  });

  it('rejects empty, unknown, and compressed vsdx zip', () => {
    expect(() => parseVisioText('')).toThrow(/empty/i);
    expect(() => parseVisioText('hello world')).toThrow(/Not a Visio/i);
    const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0, 0, 0, 8, 0]);
    expect(() => parseVisioBytes(zip, 'shop.vsdx')).toThrow(/vdx|zip/i);
  });
});

describe('visio-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleVsdFile();
    expect(file.name).toBe('sample-shop.vdx');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Visio', () => {
    const file = createSampleVsdFile();
    const record = createVsdFileRecord(file, new TextEncoder().encode(VSD_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.pages.length).toBe(2);
    expect(canExportVsd(record)).toBe(true);
  });

  it('exports shapes csv', () => {
    const parsed = parseVisioText(VSD_SAMPLE, 'shop.vdx');
    const csv = exportVsdShapesCsv(parsed);
    expect(csv).toContain('index,id,label,page,master,x,y,width,height');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleVsdFile();
    const { accepted, rejected } = filterValidVsdFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.vdx.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveVsdSuggestion returns upload-or-sample and sample-after-error', () => {
    expect(resolveVsdSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveVsdSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveVsdSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail record disables export', () => {
    const file = new File(['hello world'], 'bad.txt', { lastModified: 9 });
    const record = createVsdFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportVsd(record)).toBe(false);
  });

  it('canExportVsd returns false for null', () => {
    expect(canExportVsd(null)).toBe(false);
  });
});
