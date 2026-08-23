import { API_HTTP_SAMPLE, API_JSON_SAMPLE } from '../constants/api-request-sample.data';
import { HAR_JSON_SAMPLE } from '../constants/har-sample.data';
import { filterApiCalls, parseApiRequestText, prettyBody } from './api-request-parse.utils';
import {
  canExportApiRequest,
  createApiRequestFileRecord,
  createSampleApiRequestFile,
  exportApiRequestsCsv,
  filterValidApiRequestFiles
} from './api-request-viewer.utils';

describe('api-request-parse.utils', () => {
  it('parses the Orders API JSON sample', () => {
    const parsed = parseApiRequestText(API_JSON_SAMPLE);
    expect(parsed.name).toContain('Orders API');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.calls.length).toBe(6);
    expect(parsed.calls.some((c) => c.method === 'POST' && c.status === 201)).toBe(true);
    expect(parsed.calls.some((c) => c.status === 401)).toBe(true);
    expect(parsed.calls.some((c) => c.method === 'DELETE' && c.status === 204)).toBe(true);
    expect(prettyBody(parsed.calls[0].responseBody)).toContain('orders');
  });

  it('parses a .http collection', () => {
    const parsed = parseApiRequestText(API_HTTP_SAMPLE, 'orders.http');
    expect(parsed.sourceKind).toBe('http');
    expect(parsed.calls.length).toBe(2);
    expect(parsed.calls[0].name).toContain('List orders');
    expect(parsed.calls[1].method).toBe('POST');
  });

  it('parses HAR as API calls', () => {
    const parsed = parseApiRequestText(HAR_JSON_SAMPLE, 'store.har');
    expect(parsed.sourceKind).toBe('har');
    expect(parsed.calls.length).toBe(7);
  });

  it('filters by method and status', () => {
    const parsed = parseApiRequestText(API_JSON_SAMPLE);
    expect(filterApiCalls(parsed.calls, 'patch').every((c) => c.method === 'PATCH')).toBe(true);
    expect(filterApiCalls(parsed.calls, '401').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseApiRequestText('')).toThrow(/empty/i);
    expect(() => parseApiRequestText('{"foo":1}')).toThrow(/requests/i);
  });
});

describe('api-request-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleApiRequestFile();
    expect(file.name).toBe('sample-orders-api.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleApiRequestFile();
    const record = createApiRequestFileRecord(file, new TextEncoder().encode(API_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.calls.length).toBe(6);
    expect(canExportApiRequest(record)).toBe(true);
  });

  it('exports requests csv', () => {
    const parsed = parseApiRequestText(API_JSON_SAMPLE);
    const csv = exportApiRequestsCsv(parsed);
    expect(csv).toContain('index,name,method,status,url');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleApiRequestFile();
    const { accepted, rejected } = filterValidApiRequestFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'api.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
