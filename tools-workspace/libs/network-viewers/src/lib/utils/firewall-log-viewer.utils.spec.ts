import { FIREWALL_CSV_SAMPLE, FIREWALL_LOG_SAMPLE } from '../constants/firewall-sample.data';
import { filterFirewallEvents, parseFirewallText } from './firewall-log-parse.utils';
import {
  canExportFirewall,
  createFirewallFileRecord,
  createSampleFirewallFile,
  exportFirewallEventsCsv,
  filterValidFirewallFiles
} from './firewall-log-viewer.utils';

describe('firewall-log-parse.utils', () => {
  it('parses the edge UFW sample', () => {
    const parsed = parseFirewallText(FIREWALL_LOG_SAMPLE);
    expect(parsed.name).toContain('Edge');
    expect(parsed.sourceKind).toBe('log');
    expect(parsed.events.length).toBe(10);
    expect(parsed.actions.some((a) => a.name === 'allow')).toBe(true);
    expect(parsed.events.filter((e) => e.action === 'deny').length).toBeGreaterThan(2);
    expect(parsed.events.some((e) => e.dstPort === 22 && e.protocol === 'TCP')).toBe(true);
  });

  it('parses firewall CSV', () => {
    const parsed = parseFirewallText(FIREWALL_CSV_SAMPLE, 'fw.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.events.length).toBe(3);
    expect(parsed.events[0].action).toBe('allow');
  });

  it('filters by action and port', () => {
    const parsed = parseFirewallText(FIREWALL_LOG_SAMPLE);
    expect(filterFirewallEvents(parsed.events, 'deny').every((e) => e.action === 'deny')).toBe(true);
    expect(filterFirewallEvents(parsed.events, 'port 22').length).toBeGreaterThan(0);
    expect(filterFirewallEvents(parsed.events, 'udp').every((e) => e.protocol === 'UDP')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseFirewallText('')).toThrow(/empty/i);
    expect(() => parseFirewallText('hello world')).toThrow(/No firewall|events/i);
  });
});

describe('firewall-log-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFirewallFile();
    expect(file.name).toBe('sample-edge-fw.log');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleFirewallFile();
    const record = createFirewallFileRecord(file, new TextEncoder().encode(FIREWALL_LOG_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.events.length).toBe(10);
    expect(canExportFirewall(record)).toBe(true);
  });

  it('exports events csv', () => {
    const parsed = parseFirewallText(FIREWALL_LOG_SAMPLE);
    const csv = exportFirewallEventsCsv(parsed);
    expect(csv).toContain('index,time,action,src');
    expect(csv.split('\n').length).toBe(11);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleFirewallFile();
    const { accepted, rejected } = filterValidFirewallFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'fw.log.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
