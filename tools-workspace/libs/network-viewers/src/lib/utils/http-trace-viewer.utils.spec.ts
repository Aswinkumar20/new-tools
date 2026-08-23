import { HTTP_TRACE_TEXT_SAMPLE } from '../constants/http-trace-sample.data';
import { HAR_JSON_SAMPLE } from '../constants/har-sample.data';
import { filterHttpExchanges, parseHttpTraceText } from './http-trace-parse.utils';
import {
  canExportHttpTrace,
  createHttpTraceFileRecord,
  createSampleHttpTraceFile,
  exportHttpTraceCsv,
  filterValidHttpTraceFiles
} from './http-trace-viewer.utils';

describe('http-trace-parse.utils', () => {
  it('parses the checkout trace sample', () => {
    const parsed = parseHttpTraceText(HTTP_TRACE_TEXT_SAMPLE);
    expect(parsed.name).toContain('Checkout');
    expect(parsed.sourceKind).toBe('trace');
    expect(parsed.exchanges.length).toBe(6);
    expect(parsed.exchanges[0].method).toBe('GET');
    expect(parsed.exchanges.some((e) => e.method === 'POST' && e.status === 201)).toBe(true);
    expect(parsed.exchanges.some((e) => e.status === 404)).toBe(true);
    expect(parsed.exchanges.some((e) => e.method === 'PATCH')).toBe(true);
  });

  it('parses a HAR capture as an HTTP trace', () => {
    const parsed = parseHttpTraceText(HAR_JSON_SAMPLE);
    expect(parsed.sourceKind).toBe('har');
    expect(parsed.exchanges.length).toBe(7);
  });

  it('filters by method and status', () => {
    const parsed = parseHttpTraceText(HTTP_TRACE_TEXT_SAMPLE);
    expect(filterHttpExchanges(parsed.exchanges, 'post').every((e) => e.method === 'POST')).toBe(true);
    expect(filterHttpExchanges(parsed.exchanges, '404').length).toBe(1);
    expect(filterHttpExchanges(parsed.exchanges, '2xx').every((e) => e.status >= 200 && e.status < 300)).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseHttpTraceText('')).toThrow(/empty/i);
    expect(() => parseHttpTraceText('hello world')).toThrow(/No HTTP|pairs/i);
  });
});

describe('http-trace-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleHttpTraceFile();
    expect(file.name).toBe('sample-checkout.trace');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleHttpTraceFile();
    const record = createHttpTraceFileRecord(file, new TextEncoder().encode(HTTP_TRACE_TEXT_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.exchanges.length).toBe(6);
    expect(canExportHttpTrace(record)).toBe(true);
  });

  it('exports requests csv', () => {
    const parsed = parseHttpTraceText(HTTP_TRACE_TEXT_SAMPLE);
    const csv = exportHttpTraceCsv(parsed);
    expect(csv).toContain('index,method,status,host,path');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleHttpTraceFile();
    const { accepted, rejected } = filterValidHttpTraceFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'nav.har.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
