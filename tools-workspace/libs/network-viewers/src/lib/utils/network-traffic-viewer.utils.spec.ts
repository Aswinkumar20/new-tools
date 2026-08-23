import { TRAFFIC_CSV_SAMPLE, TRAFFIC_FLOW_SAMPLE, TRAFFIC_JSON_SAMPLE } from '../constants/traffic-sample.data';
import { buildSamplePcapBytes, buildSamplePcapngBytes } from './pcap-build.utils';
import { filterTrafficFlows, parseTrafficBytes, parseTrafficText } from './traffic-parse.utils';
import {
  canExportTraffic,
  createSampleTrafficFile,
  createTrafficFileRecord,
  exportTrafficFlowsCsv,
  filterValidTrafficFiles
} from './network-traffic-viewer.utils';

describe('traffic-parse.utils', () => {
  it('parses the office LAN JSON sample', () => {
    const parsed = parseTrafficText(TRAFFIC_JSON_SAMPLE);
    expect(parsed.name).toContain('Office LAN');
    expect(parsed.flows.length).toBe(7);
    expect(parsed.protocols.some((p) => p.name === 'HTTP')).toBe(true);
    expect(parsed.talkers.length).toBeGreaterThan(2);
    expect(parsed.totalPackets).toBeGreaterThan(0);
  });

  it('parses CSV and .flow text', () => {
    const csv = parseTrafficText(TRAFFIC_CSV_SAMPLE, 'csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.flows.length).toBe(3);
    const flow = parseTrafficText(TRAFFIC_FLOW_SAMPLE, 'flow');
    expect(flow.sourceKind).toBe('flow');
    expect(flow.flows[0].protocol).toBe('HTTP');
  });

  it('aggregates flows from a PCAP capture', () => {
    const parsed = parseTrafficBytes(buildSamplePcapBytes(), 'sample.pcap');
    expect(parsed.sourceKind).toBe('pcap');
    expect(parsed.flows.length).toBeGreaterThan(0);
    expect(parsed.protocols.some((p) => p.name === 'HTTP' || p.name === 'TCP')).toBe(true);
  });

  it('aggregates flows from a PCAPNG capture', () => {
    const parsed = parseTrafficBytes(buildSamplePcapngBytes(), 'sample.pcapng');
    expect(parsed.sourceKind).toBe('pcapng');
    expect(parsed.flows.length).toBeGreaterThan(0);
    expect(filterTrafficFlows(parsed.flows, 'http').every((f) => f.protocol === 'HTTP')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseTrafficText('')).toThrow(/empty/i);
    expect(() => parseTrafficText('hello world')).toThrow(/Unrecognized|traffic/i);
  });
});

describe('network-traffic-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleTrafficFile();
    expect(file.name).toBe('sample-office-lan.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleTrafficFile();
    const record = createTrafficFileRecord(file, new TextEncoder().encode(TRAFFIC_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.flows.length).toBe(7);
    expect(canExportTraffic(record)).toBe(true);
  });

  it('exports flows csv', () => {
    const parsed = parseTrafficText(TRAFFIC_JSON_SAMPLE);
    const csv = exportTrafficFlowsCsv(parsed);
    expect(csv).toContain('protocol,src,src_port,dst');
    expect(csv.split('\n').length).toBe(8);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleTrafficFile();
    const { accepted, rejected } = filterValidTrafficFiles([
      sample,
      new File(['x'], 'note.txt', { lastModified: 1 }),
      new File(['x'], 'lan.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
