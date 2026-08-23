import { buildSamplePcapBytes } from './pcap-build.utils';
import { dissectPacket, parseHexDumpText } from './packet-dissect.utils';
import { parsePacketAnalyzerBytes } from './packet-analyzer-parse.utils';
import {
  canExportPacketAnalyzer,
  createPacketAnalyzerFileRecord,
  createSamplePacketAnalyzerFile,
  exportPacketAnalyzerCsv,
  filterValidPacketAnalyzerFiles
} from './packet-analyzer.utils';
import { parsePcapBytes } from './pcap-parse.utils';

describe('packet-dissect.utils', () => {
  it('builds Ethernet/IPv4/TCP/HTTP layers for the sample GET', () => {
    const parsed = parsePcapBytes(buildSamplePcapBytes());
    const http = parsed.packets.find((p) => p.protocol === 'HTTP');
    expect(http).toBeTruthy();
    const layers = dissectPacket(http!, parsed.linkType);
    expect(layers.map((l) => l.name)).toEqual(expect.arrayContaining(['Frame', 'Ethernet', 'IPv4', 'TCP', 'HTTP']));
    expect(layers.some((l) => /GET \//.test(l.summary))).toBe(true);
  });

  it('parses a hex dump frame', () => {
    const parsed = parsePcapBytes(buildSamplePcapBytes());
    const frame = parsed.packets[0].bytes;
    const hex = Array.from(frame)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join(' ');
    const dump = `0000  ${hex}`;
    const restored = parseHexDumpText(dump);
    expect(restored.length).toBe(frame.length);
    expect(Array.from(restored.slice(0, 14))).toEqual(Array.from(frame.slice(0, 14)));
  });
});

describe('packet-analyzer-parse.utils', () => {
  it('parses the DPI sample PCAP with layer trees', () => {
    const parsed = parsePacketAnalyzerBytes(buildSamplePcapBytes(), 'sample-dpi.pcap');
    expect(parsed.format).toBe('pcap');
    expect(parsed.packets.length).toBe(8);
    expect(parsed.packets.some((p) => p.layers.some((l) => l.name === 'DNS'))).toBe(true);
    expect(parsed.packets.some((p) => p.layers.some((l) => l.name === 'ARP'))).toBe(true);
  });
});

describe('packet-analyzer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePacketAnalyzerFile();
    expect(file.name).toBe('sample-dpi.pcap');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const bytes = buildSamplePcapBytes();
    const record = createPacketAnalyzerFileRecord(createSamplePacketAnalyzerFile(), bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.packets.length).toBe(8);
    expect(canExportPacketAnalyzer(record)).toBe(true);
  });

  it('exports packets csv with layer names', () => {
    const parsed = parsePacketAnalyzerBytes(buildSamplePcapBytes(), 'sample-dpi.pcap');
    const csv = exportPacketAnalyzerCsv(parsed);
    expect(csv).toContain('no,time_ms,protocol,src,dst');
    expect(csv).toContain('HTTP');
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePacketAnalyzerFile();
    const { accepted, rejected } = filterValidPacketAnalyzerFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'trace.pcap.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
