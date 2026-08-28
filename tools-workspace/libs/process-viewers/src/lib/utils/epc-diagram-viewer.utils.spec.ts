import { EPC_CSV_SAMPLE, EPC_JSON_SAMPLE, EPC_XML_SAMPLE } from '../constants/epc-sample.data';
import { filterEpcNodes, parseEpcText } from './epc-parse.utils';
import {
  canExportEpc,
  createEpcFileRecord,
  createSampleEpcFile,
  exportEpcEventsCsv,
  filterValidEpcFiles,
  resolveEpcSuggestion
} from './epc-diagram-viewer.utils';

describe('epc-parse.utils', () => {
  it('parses the order fulfillment EPML sample', () => {
    const parsed = parseEpcText(EPC_XML_SAMPLE);
    expect(parsed.sourceKind).toBe('epc');
    expect(parsed.name).toContain('Order');
    expect(parsed.events.length).toBe(7);
    expect(parsed.functions.length).toBe(6);
    expect(parsed.connectors.some((c) => c.kind === 'xor')).toBe(true);
    expect(parsed.connectors.some((c) => c.kind === 'and')).toBe(true);
    expect(parsed.flows.length).toBe(16);
    expect(parsed.nodes.some((n) => /Check credit/i.test(n.name))).toBe(true);
    expect(parsed.flows.some((f) => f.label === 'yes')).toBe(true);
  });

  it('parses EPC JSON and CSV', () => {
    const json = parseEpcText(EPC_JSON_SAMPLE, 'order.json');
    expect(json.sourceKind).toBe('json');
    expect(json.events.length).toBe(3);
    expect(json.functions.length).toBe(1);
    expect(json.flows.length).toBe(4);
    const csv = parseEpcText(EPC_CSV_SAMPLE, 'order.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.events.length).toBe(3);
    expect(csv.flows.length).toBeGreaterThanOrEqual(3);
  });

  it('filters events and functions', () => {
    const parsed = parseEpcText(EPC_XML_SAMPLE);
    expect(filterEpcNodes(parsed.nodes, 'event').every((n) => n.kind === 'event')).toBe(true);
    expect(filterEpcNodes(parsed.nodes, 'kind:xor').every((n) => n.kind === 'xor')).toBe(true);
    expect(filterEpcNodes(parsed.nodes, 'node:credit').some((n) => /credit/i.test(n.name))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseEpcText('')).toThrow(/empty/i);
    expect(() => parseEpcText('hello world')).toThrow(/No EPC/i);
  });
});

describe('epc-diagram-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleEpcFile();
    expect(file.name).toBe('sample-order-fulfillment.epc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample epc', () => {
    const file = createSampleEpcFile();
    const record = createEpcFileRecord(file, new TextEncoder().encode(EPC_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.events.length).toBe(7);
    expect(canExportEpc(record)).toBe(true);
  });

  it('exports events csv', () => {
    const parsed = parseEpcText(EPC_XML_SAMPLE);
    const csv = exportEpcEventsCsv(parsed);
    expect(csv).toContain('index,kind,id,name,incoming,outgoing');
    expect(csv.split('\n').length).toBe(parsed.nodes.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleEpcFile();
    const { accepted, rejected } = filterValidEpcFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'order.epc.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveEpcSuggestion returns upload-or-sample when empty', () => {
    expect(resolveEpcSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolveEpcSuggestion returns sample-after-error when hasError', () => {
    expect(resolveEpcSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportEpc returns false for null', () => {
    expect(canExportEpc(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createEpcFileRecord(new File(['hello world'], 'bad.epc', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportEpc(record)).toBe(false);
  });
});
