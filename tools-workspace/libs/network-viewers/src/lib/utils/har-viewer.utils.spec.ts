import { HAR_JSON_SAMPLE } from '../constants/har-sample.data';
import { parseHarText } from './har-parse.utils';
import {
  canExportHar,
  createHarFileRecord,
  createSampleHarFile,
  exportHarEntriesCsv,
  filterHarEntries,
  filterValidHarFiles
} from './har-viewer.utils';

describe('har-parse.utils', () => {
  it('parses the storefront HAR sample', () => {
    const parsed = parseHarText(HAR_JSON_SAMPLE);
    expect(parsed.pageTitle).toContain('Example');
    expect(parsed.entries.length).toBe(7);
    expect(parsed.entries[0].method).toBe('GET');
    expect(parsed.entries.some((e) => e.status === 404)).toBe(true);
    expect(parsed.entries.some((e) => e.method === 'POST')).toBe(true);
    expect(parsed.totalTimeMs).toBeGreaterThan(0);
  });

  it('filters entries by URL and status', () => {
    const parsed = parseHarText(HAR_JSON_SAMPLE);
    expect(filterHarEntries(parsed.entries, 'api').length).toBe(2);
    expect(filterHarEntries(parsed.entries, '404').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseHarText('')).toThrow(/empty/i);
    expect(() => parseHarText('not-json')).toThrow(/Invalid HAR/i);
    expect(() => parseHarText('{"foo":1}')).toThrow(/entries/i);
  });
});

describe('har-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleHarFile();
    expect(file.name).toBe('sample-storefront.har');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleHarFile();
    const record = createHarFileRecord(file, new TextEncoder().encode(HAR_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.entries.length).toBe(7);
    expect(canExportHar(record)).toBe(true);
  });

  it('exports entries csv', () => {
    const parsed = parseHarText(HAR_JSON_SAMPLE);
    const csv = exportHarEntriesCsv(parsed);
    expect(csv).toContain('index,method,status,url');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleHarFile();
    const { accepted, rejected } = filterValidHarFiles([
      sample,
      new File(['x'], 'trace.pcap', { lastModified: 1 }),
      new File(['x'], 'nav.har.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
