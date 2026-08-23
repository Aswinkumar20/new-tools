import { buildSamplePcapBytes, buildSamplePcapngBytes } from './pcap-build.utils';
import { filterPcapPackets, parsePcapBytes } from './pcap-parse.utils';
import {
  canExportPcap,
  createPcapFileRecord,
  createSamplePcapFile,
  exportPcapPacketsCsv,
  filterValidPcapFiles
} from './pcap-viewer.utils';

describe('pcap-parse.utils', () => {
  it('parses the HTTP/DNS sample PCAP', () => {
    const parsed = parsePcapBytes(buildSamplePcapBytes());
    expect(parsed.format).toBe('pcap');
    expect(parsed.linkTypeName).toBe('Ethernet');
    expect(parsed.packets.length).toBe(8);
    expect(parsed.packets.some((p) => p.protocol === 'HTTP')).toBe(true);
    expect(parsed.packets.some((p) => p.protocol === 'DNS')).toBe(true);
    expect(parsed.packets.some((p) => p.protocol === 'ARP')).toBe(true);
    expect(parsed.streams.length).toBeGreaterThan(0);
  });

  it('parses a PCAPNG sample built from the same frames', () => {
    const parsed = parsePcapBytes(buildSamplePcapngBytes());
    expect(parsed.format).toBe('pcapng');
    expect(parsed.packets.length).toBe(8);
    expect(parsed.packets.some((p) => p.protocol === 'DNS')).toBe(true);
  });

  it('filters packets by protocol and port', () => {
    const parsed = parsePcapBytes(buildSamplePcapBytes());
    expect(filterPcapPackets(parsed.packets, 'dns').every((p) => p.protocol === 'DNS')).toBe(true);
    expect(filterPcapPackets(parsed.packets, 'port 80').length).toBeGreaterThan(0);
    expect(filterPcapPackets(parsed.packets, 'arp').length).toBe(1);
  });

  it('rejects empty or unknown bytes', () => {
    expect(() => parsePcapBytes(new Uint8Array(0))).toThrow(/empty/i);
    expect(() => parsePcapBytes(new Uint8Array([1, 2, 3, 4, 5]))).toThrow(/Unrecognized|PCAP/i);
  });
});

describe('pcap-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePcapFile();
    expect(file.name).toBe('sample-http-dns.pcap');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const bytes = buildSamplePcapBytes();
    const file = createSamplePcapFile();
    const record = createPcapFileRecord(file, bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.packets.length).toBe(8);
    expect(canExportPcap(record)).toBe(true);
  });

  it('exports packets csv', () => {
    const parsed = parsePcapBytes(buildSamplePcapBytes());
    const csv = exportPcapPacketsCsv(parsed);
    expect(csv).toContain('no,time_ms,protocol,src,dst');
    expect(csv.split('\n').length).toBe(9);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePcapFile();
    const { accepted, rejected } = filterValidPcapFiles([
      sample,
      new File(['x'], 'nav.har', { lastModified: 1 }),
      new File(['x'], 'trace.pcap.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
