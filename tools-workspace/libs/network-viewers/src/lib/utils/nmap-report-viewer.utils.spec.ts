import { NMAP_CSV_SAMPLE, NMAP_GNMAP_SAMPLE, NMAP_XML_SAMPLE } from '../constants/nmap-sample.data';
import { filterNmapPorts, parseNmapText } from './nmap-report-parse.utils';
import {
  canExportNmap,
  createNmapFileRecord,
  createSampleNmapFile,
  exportNmapPortsCsv,
  filterValidNmapFiles
} from './nmap-report-viewer.utils';

describe('nmap-report-parse.utils', () => {
  it('parses the lab Nmap XML sample', () => {
    const parsed = parseNmapText(NMAP_XML_SAMPLE);
    expect(parsed.name).toContain('nmap');
    expect(parsed.sourceKind).toBe('xml');
    expect(parsed.hosts.length).toBe(3);
    expect(parsed.ports.length).toBe(10);
    expect(parsed.hosts.some((h) => h.hostname === 'gw-01.lab' && h.openCount === 3)).toBe(true);
    expect(parsed.ports.some((p) => p.port === 22 && p.service === 'ssh' && p.state === 'open')).toBe(true);
    expect(parsed.ports.some((p) => p.port === 445 && p.state === 'filtered')).toBe(true);
    expect(parsed.ports.some((p) => p.protocol === 'udp' && p.port === 53)).toBe(true);
  });

  it('parses gnmap and CSV', () => {
    const gnmap = parseNmapText(NMAP_GNMAP_SAMPLE, 'lab.gnmap');
    expect(gnmap.sourceKind).toBe('gnmap');
    expect(gnmap.hosts.length).toBe(1);
    expect(gnmap.ports.length).toBe(2);
    const csv = parseNmapText(NMAP_CSV_SAMPLE, 'lab.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.hosts.length).toBe(2);
    expect(csv.ports[0].service).toBe('ssh');
  });

  it('filters by state, protocol, and port', () => {
    const parsed = parseNmapText(NMAP_XML_SAMPLE);
    expect(filterNmapPorts(parsed.ports, 'open').every((p) => p.state === 'open')).toBe(true);
    expect(filterNmapPorts(parsed.ports, 'udp').every((p) => p.protocol === 'udp')).toBe(true);
    expect(filterNmapPorts(parsed.ports, 'port 22').length).toBeGreaterThan(0);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseNmapText('')).toThrow(/empty/i);
    expect(() => parseNmapText('hello world')).toThrow(/No Nmap|hosts/i);
  });
});

describe('nmap-report-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleNmapFile();
    expect(file.name).toBe('sample-lab-nmap.xml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample xml', () => {
    const file = createSampleNmapFile();
    const record = createNmapFileRecord(file, new TextEncoder().encode(NMAP_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.hosts.length).toBe(3);
    expect(canExportNmap(record)).toBe(true);
  });

  it('exports ports csv', () => {
    const parsed = parseNmapText(NMAP_XML_SAMPLE);
    const csv = exportNmapPortsCsv(parsed);
    expect(csv).toContain('ip,hostname,port,protocol,state');
    expect(csv.split('\n').length).toBe(11);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleNmapFile();
    const { accepted, rejected } = filterValidNmapFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'scan.xml.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
