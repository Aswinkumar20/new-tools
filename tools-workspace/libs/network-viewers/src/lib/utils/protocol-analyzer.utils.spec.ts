import { PROTOCOL_JSON_SAMPLE } from '../constants/protocol-sample.data';
import { buildSamplePcapBytes, buildSamplePcapngBytes } from './pcap-build.utils';
import { parseProtocolAnalyzerBytes, parseProtocolJson } from './protocol-analyzer-parse.utils';
import {
  canExportProtocolAnalyzer,
  createProtocolAnalyzerFileRecord,
  createSampleProtocolAnalyzerFile,
  exportProtocolDissectorsCsv,
  filterValidProtocolAnalyzerFiles
} from './protocol-analyzer.utils';

describe('protocol-analyzer-parse.utils', () => {
  it('parses the lab protocol JSON sample', () => {
    const parsed = parseProtocolJson(PROTOCOL_JSON_SAMPLE);
    expect(parsed.name).toContain('Lab protocol');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.dissectors.some((d) => d.name === 'HTTP')).toBe(true);
    expect(parsed.dissectors.some((d) => d.name === 'DNS')).toBe(true);
  });

  it('builds dissectors from a PCAP capture', () => {
    const parsed = parseProtocolAnalyzerBytes(buildSamplePcapBytes(), 'sample-protocol-mix.pcap');
    expect(parsed.sourceKind).toBe('pcap');
    expect(parsed.packets.length).toBe(8);
    expect(parsed.dissectors.some((d) => d.name === 'HTTP')).toBe(true);
    expect(parsed.dissectors.some((d) => d.name === 'TCP')).toBe(true);
    expect(parsed.dissectors.some((d) => d.name === 'ARP')).toBe(true);
  });

  it('builds dissectors from a PCAPNG capture', () => {
    const parsed = parseProtocolAnalyzerBytes(buildSamplePcapngBytes(), 'mix.pcapng');
    expect(parsed.sourceKind).toBe('pcapng');
    expect(parsed.dissectors.some((d) => d.name === 'DNS')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseProtocolAnalyzerBytes(new Uint8Array(0), 'x.json')).toThrow(/empty/i);
    expect(() => parseProtocolJson('hello')).toThrow(/Invalid|JSON/i);
  });
});

describe('protocol-analyzer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleProtocolAnalyzerFile();
    expect(file.name).toBe('sample-protocol-mix.pcap');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const record = createProtocolAnalyzerFileRecord(createSampleProtocolAnalyzerFile(), buildSamplePcapBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.dissectors.length).toBeGreaterThan(3);
    expect(canExportProtocolAnalyzer(record)).toBe(true);
  });

  it('exports dissectors csv', () => {
    const parsed = parseProtocolAnalyzerBytes(buildSamplePcapBytes(), 'sample.pcap');
    const csv = exportProtocolDissectorsCsv(parsed);
    expect(csv).toContain('name,packets,bytes,conversations');
    expect(csv).toContain('HTTP');
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleProtocolAnalyzerFile();
    const { accepted, rejected } = filterValidProtocolAnalyzerFiles([
      sample,
      new File(['x'], 'note.txt', { lastModified: 1 }),
      new File(['x'], 'mix.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
