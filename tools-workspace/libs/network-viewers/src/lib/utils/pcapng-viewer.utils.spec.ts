import { buildSamplePcapngBytes } from './pcap-build.utils';
import { filterPcapngPackets, parsePcapngBytes } from './pcapng-parse.utils';
import {
  canExportPcapng,
  createPcapngFileRecord,
  createSamplePcapngFile,
  exportPcapngInterfacesCsv,
  filterValidPcapngFiles
} from './pcapng-viewer.utils';

describe('pcapng-parse.utils', () => {
  it('parses dual-interface sample with SHB/IDB/ISB', () => {
    const parsed = parsePcapngBytes(buildSamplePcapngBytes());
    expect(parsed.interfaces.length).toBe(2);
    expect(parsed.interfaces.map((i) => i.name)).toEqual(['eth0', 'wlan0']);
    expect(parsed.section.application).toContain('pcapng-sample');
    expect(parsed.packets.length).toBe(8);
    expect(parsed.interfaces[0].packets).toBe(5);
    expect(parsed.interfaces[1].packets).toBe(3);
    expect(parsed.interfaces[0].received).toBe(5);
    expect(parsed.packets.some((p) => p.interfaceName === 'wlan0' && p.protocol === 'DNS')).toBe(true);
  });

  it('filters packets by interface name', () => {
    const parsed = parsePcapngBytes(buildSamplePcapngBytes());
    expect(filterPcapngPackets(parsed.packets, '', 0).every((p) => p.interfaceId === 0)).toBe(true);
    expect(filterPcapngPackets(parsed.packets, 'dns', null).every((p) => p.protocol === 'DNS')).toBe(true);
    expect(filterPcapngPackets(parsed.packets, 'port 80', null).length).toBeGreaterThan(0);
  });

  it('rejects empty or classic pcap bytes', () => {
    expect(() => parsePcapngBytes(new Uint8Array(0))).toThrow(/empty/i);
    expect(() => parsePcapngBytes(new Uint8Array([0xd4, 0xc3, 0xb2, 0xa1]))).toThrow(/PCAPNG/i);
  });
});

describe('pcapng-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePcapngFile();
    expect(file.name).toBe('sample-dual-iface.pcapng');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bytes', () => {
    const bytes = buildSamplePcapngBytes();
    const record = createPcapngFileRecord(createSamplePcapngFile(), bytes);
    expect(record.softFail).toBe(false);
    expect(record.parsed?.interfaces.length).toBe(2);
    expect(canExportPcapng(record)).toBe(true);
  });

  it('exports interfaces csv', () => {
    const parsed = parsePcapngBytes(buildSamplePcapngBytes());
    const csv = exportPcapngInterfacesCsv(parsed);
    expect(csv).toContain('id,name,description,link');
    expect(csv).toContain('eth0');
    expect(csv).toContain('wlan0');
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSamplePcapngFile();
    const { accepted, rejected } = filterValidPcapngFiles([
      sample,
      new File(['x'], 'trace.pcap', { lastModified: 1 }),
      new File(['x'], 'cap.pcapng.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
