import { PNML_CSV_SAMPLE, PNML_JSON_SAMPLE, PNML_XML_SAMPLE } from '../constants/pnml-sample.data';
import { filterPnmlPlaces, filterPnmlTransitions, parsePnmlText } from './pnml-parse.utils';
import {
  canExportPnml,
  createPnmlFileRecord,
  createSamplePnmlFile,
  exportPnmlPlacesCsv,
  filterValidPnmlFiles,
  resolvePnmlSuggestion
} from './pnml-viewer.utils';

describe('pnml-parse.utils', () => {
  it('parses the order fulfillment PNML sample', () => {
    const parsed = parsePnmlText(PNML_XML_SAMPLE);
    expect(parsed.sourceKind).toBe('pnml');
    expect(parsed.name).toContain('Order');
    expect(parsed.places.length).toBe(7);
    expect(parsed.transitions.length).toBe(6);
    expect(parsed.arcs.length).toBe(12);
    expect(parsed.tokenTotal).toBe(4);
    expect(parsed.places.some((p) => /Incoming/i.test(p.name) && p.tokens === 3)).toBe(true);
    expect(parsed.transitions.some((t) => t.enabled && /Accept/i.test(t.name))).toBe(true);
    expect(parsed.transitions.some((t) => t.enabled && /Pack/i.test(t.name))).toBe(true);
  });

  it('parses PNML JSON and CSV', () => {
    const json = parsePnmlText(PNML_JSON_SAMPLE, 'order.json');
    expect(json.sourceKind).toBe('json');
    expect(json.places.length).toBe(3);
    expect(json.transitions.length).toBe(3);
    expect(json.tokenTotal).toBe(4);
    const csv = parsePnmlText(PNML_CSV_SAMPLE, 'order.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.places.length).toBe(3);
    expect(csv.arcs.length).toBe(4);
  });

  it('filters marked places and enabled transitions', () => {
    const parsed = parsePnmlText(PNML_XML_SAMPLE);
    expect(filterPnmlPlaces(parsed.places, 'marked').every((p) => p.tokens > 0)).toBe(true);
    expect(filterPnmlTransitions(parsed.transitions, 'enabled').every((t) => t.enabled)).toBe(true);
    expect(filterPnmlPlaces(parsed.places, 'place:Incoming').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parsePnmlText('')).toThrow(/empty/i);
    expect(() => parsePnmlText('hello world')).toThrow(/No PNML/i);
  });
});

describe('pnml-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePnmlFile();
    expect(file.name).toBe('sample-order-net.pnml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample pnml', () => {
    const file = createSamplePnmlFile();
    const record = createPnmlFileRecord(file, new TextEncoder().encode(PNML_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.places.length).toBe(7);
    expect(canExportPnml(record)).toBe(true);
  });

  it('exports places csv', () => {
    const parsed = parsePnmlText(PNML_XML_SAMPLE);
    const csv = exportPnmlPlacesCsv(parsed);
    expect(csv).toContain('index,id,name,tokens,incoming,outgoing');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePnmlFile();
    const { accepted, rejected } = filterValidPnmlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'net.pnml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolvePnmlSuggestion returns upload-or-sample when empty', () => {
    expect(resolvePnmlSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolvePnmlSuggestion returns sample-after-error when hasError', () => {
    expect(resolvePnmlSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportPnml returns false for null', () => {
    expect(canExportPnml(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createPnmlFileRecord(new File(['hello world'], 'bad.pnml', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportPnml(record)).toBe(false);
  });
});
