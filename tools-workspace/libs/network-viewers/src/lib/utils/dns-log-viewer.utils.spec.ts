import { DNS_CSV_SAMPLE, DNS_LOG_SAMPLE } from '../constants/dns-sample.data';
import { filterDnsQueries, parseDnsLogText } from './dns-log-parse.utils';
import {
  canExportDnsLog,
  createDnsLogFileRecord,
  createSampleDnsLogFile,
  exportDnsQueriesCsv,
  filterValidDnsLogFiles
} from './dns-log-viewer.utils';

describe('dns-log-parse.utils', () => {
  it('parses the resolver BIND/dnsmasq sample', () => {
    const parsed = parseDnsLogText(DNS_LOG_SAMPLE);
    expect(parsed.name).toContain('Edge');
    expect(parsed.sourceKind).toBe('log');
    expect(parsed.queries.length).toBe(7);
    expect(parsed.queries.some((q) => q.qtype === 'A')).toBe(true);
    expect(parsed.queries.some((q) => q.qtype === 'AAAA')).toBe(true);
    expect(parsed.queries.some((q) => q.qtype === 'MX' && q.rcode === 'NXDOMAIN')).toBe(true);
    expect(parsed.queries.some((q) => q.qtype === 'TXT' && /DMARC/i.test(q.answer))).toBe(true);
  });

  it('parses DNS CSV', () => {
    const parsed = parseDnsLogText(DNS_CSV_SAMPLE, 'dns.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.queries.length).toBe(3);
    expect(parsed.queries[0].qtype).toBe('A');
  });

  it('filters by type, rcode, and client', () => {
    const parsed = parseDnsLogText(DNS_LOG_SAMPLE);
    expect(filterDnsQueries(parsed.queries, 'aaaa').every((q) => q.qtype === 'AAAA')).toBe(true);
    expect(filterDnsQueries(parsed.queries, 'nxdomain').every((q) => q.rcode === 'NXDOMAIN')).toBe(true);
    expect(filterDnsQueries(parsed.queries, 'client:10.0.0.21').length).toBeGreaterThan(0);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDnsLogText('')).toThrow(/empty/i);
    expect(() => parseDnsLogText('hello world')).toThrow(/No DNS|queries/i);
  });
});

describe('dns-log-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDnsLogFile();
    expect(file.name).toBe('sample-dns-resolver.log');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleDnsLogFile();
    const record = createDnsLogFileRecord(file, new TextEncoder().encode(DNS_LOG_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.queries.length).toBe(7);
    expect(canExportDnsLog(record)).toBe(true);
  });

  it('exports queries csv', () => {
    const parsed = parseDnsLogText(DNS_LOG_SAMPLE);
    const csv = exportDnsQueriesCsv(parsed);
    expect(csv).toContain('index,time,client');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDnsLogFile();
    const { accepted, rejected } = filterValidDnsLogFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'dns.log.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
