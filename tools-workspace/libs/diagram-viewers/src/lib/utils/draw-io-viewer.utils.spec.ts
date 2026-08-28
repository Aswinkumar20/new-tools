import {
  DIO_JSON_SAMPLE,
  DIO_MARKDOWN_SAMPLE,
  DIO_SAMPLE,
  DIO_XML_SAMPLE
} from '../constants/draw-io-viewer-sample.data';
import { filterDioConnectors, filterDioPages, filterDioShapes, parseDrawioText } from './draw-io-viewer-parse.utils';
import {
  canExportDio,
  createDioFileRecord,
  createSampleDioFile,
  exportDioShapesCsv,
  filterValidDioFiles,
  resolveDioSuggestion
} from './draw-io-viewer.utils';

describe('draw-io-viewer-parse.utils', () => {
  it('parses the shop draw.io sample with pages', () => {
    const parsed = parseDrawioText(DIO_SAMPLE, 'sample-shop.drawio');
    expect(parsed.pages.length).toBe(2);
    expect(parsed.shapes.length).toBe(5);
    expect(parsed.connectors.length).toBe(3);
    expect(parsed.pages.some((p) => p.name === 'Shop' && p.shapeCount === 3)).toBe(true);
    expect(parsed.pages.some((p) => p.name === 'Payments' && p.connectorCount === 1)).toBe(true);
    expect(parsed.shapes.some((s) => s.label === 'Customer' && s.pageName === 'Shop')).toBe(true);
    expect(parsed.connectors.some((c) => c.label === 'charge' && c.targetName === 'Bank')).toBe(true);
  });

  it('parses markdown, JSON, and simple XML', () => {
    const md = parseDrawioText(DIO_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.pages.length).toBe(1);
    expect(md.shapes.length).toBe(2);
    expect(md.connectors.length).toBe(1);

    const json = parseDrawioText(DIO_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.pages.length).toBe(1);
    expect(json.shapes.length).toBe(2);
    expect(json.connectors.length).toBe(1);

    const xml = parseDrawioText(DIO_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.pages.length).toBe(1);
    expect(xml.shapes.length).toBe(2);
    expect(xml.connectors.length).toBe(1);
  });

  it('filters pages, shapes, and connectors', () => {
    const parsed = parseDrawioText(DIO_SAMPLE, 'shop.drawio');
    expect(filterDioPages(parsed.pages, 'page:Pay').every((p) => p.name.includes('Pay'))).toBe(true);
    expect(filterDioShapes(parsed.shapes, 'shape:Customer').some((s) => s.label === 'Customer')).toBe(true);
    expect(filterDioConnectors(parsed.connectors, 'rel:uses').length).toBe(1);
    expect(filterDioShapes(parsed.shapes, '', parsed.pages.find((p) => p.name === 'Payments')?.id || '').length).toBe(2);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDrawioText('')).toThrow(/empty/i);
    expect(() => parseDrawioText('hello world')).toThrow(/Not a draw.io/i);
  });

  it('warns on compressed page body', () => {
    const xml = `<mxfile><diagram name="Zip">${'A'.repeat(80)}</diagram></mxfile>`;
    const parsed = parseDrawioText(xml, 'zip.drawio');
    expect(parsed.pages.length).toBe(1);
    expect(parsed.shapes.length).toBe(0);
    expect(parsed.warnings.some((w) => /uncompressed/i.test(w))).toBe(true);
  });
});

describe('draw-io-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDioFile();
    expect(file.name).toBe('sample-shop.drawio');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample draw.io', () => {
    const file = createSampleDioFile();
    const record = createDioFileRecord(file, new TextEncoder().encode(DIO_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.pages.length).toBe(2);
    expect(canExportDio(record)).toBe(true);
  });

  it('exports shapes csv', () => {
    const parsed = parseDrawioText(DIO_SAMPLE, 'shop.drawio');
    const csv = exportDioShapesCsv(parsed);
    expect(csv).toContain('index,id,label,page,x,y,width,height');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDioFile();
    const { accepted, rejected } = filterValidDioFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.drawio.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveDioSuggestion covers empty and error states', () => {
    expect(resolveDioSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveDioSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveDioSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });

  it('soft-fail unparseable text disables export', () => {
    const record = createDioFileRecord(new File(['hello world'], 'bad.txt', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(canExportDio(record)).toBe(false);
  });

  it('canExportDio returns false for null', () => {
    expect(canExportDio(null)).toBe(false);
  });
});
