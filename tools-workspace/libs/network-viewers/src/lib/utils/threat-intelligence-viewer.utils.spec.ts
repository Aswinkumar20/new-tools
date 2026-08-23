import { THREAT_CSV_SAMPLE, THREAT_JSON_SAMPLE, THREAT_XML_SAMPLE } from '../constants/threat-intel-sample.data';
import { filterThreatIndicators, filterThreatRelationships, parseThreatText } from './threat-intelligence-parse.utils';
import {
  canExportThreat,
  createSampleThreatFile,
  createThreatFileRecord,
  exportThreatIndicatorsCsv,
  filterValidThreatFiles
} from './threat-intelligence-viewer.utils';

describe('threat-intelligence-parse.utils', () => {
  it('parses the lab STIX 2.1 sample', () => {
    const parsed = parseThreatText(THREAT_JSON_SAMPLE);
    expect(parsed.sourceKind).toBe('stix');
    expect(parsed.version).toBe('2.1');
    expect(parsed.indicators.length).toBe(5);
    expect(parsed.relationships.length).toBe(5);
    expect(parsed.objects.length).toBe(4);
    expect(parsed.indicators.some((i) => i.type === 'domain' && i.value === 'c2.malware.example')).toBe(true);
    expect(parsed.indicators.some((i) => i.type === 'sha256')).toBe(true);
    expect(parsed.relationships.some((r) => r.type === 'indicates' && /LabStealer/i.test(r.targetName))).toBe(true);
    expect(parsed.objects.some((o) => o.kind === 'threat-actor' && o.name === 'APT-Lab')).toBe(true);
    expect(parsed.objects.some((o) => o.kind === 'attack-pattern' && /T1566/i.test(o.aliases))).toBe(true);
  });

  it('parses threat intel XML and CSV', () => {
    const xml = parseThreatText(THREAT_XML_SAMPLE, 'lab.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.indicators.length).toBe(2);
    expect(xml.objects.length).toBe(2);
    expect(xml.relationships.length).toBe(2);
    const csv = parseThreatText(THREAT_CSV_SAMPLE, 'lab.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.indicators.length).toBe(3);
    expect(csv.indicators[0].type).toBe('domain');
  });

  it('filters indicators by type and relationships by rel type', () => {
    const parsed = parseThreatText(THREAT_JSON_SAMPLE);
    expect(filterThreatIndicators(parsed.indicators, 'domain').every((i) => i.type === 'domain')).toBe(true);
    expect(filterThreatIndicators(parsed.indicators, 'type:ip').length).toBe(1);
    expect(filterThreatRelationships(parsed.relationships, 'rel:uses').length).toBe(2);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseThreatText('')).toThrow(/empty/i);
    expect(() => parseThreatText('hello world')).toThrow(/No threat|indicator/i);
  });
});

describe('threat-intelligence-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleThreatFile();
    expect(file.name).toBe('sample-threat-intel.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample stix', () => {
    const file = createSampleThreatFile();
    const record = createThreatFileRecord(file, new TextEncoder().encode(THREAT_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.indicators.length).toBe(5);
    expect(canExportThreat(record)).toBe(true);
  });

  it('exports indicators csv', () => {
    const parsed = parseThreatText(THREAT_JSON_SAMPLE);
    const csv = exportThreatIndicatorsCsv(parsed);
    expect(csv).toContain('index,type,value,name,labels,confidence');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleThreatFile();
    const { accepted, rejected } = filterValidThreatFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'lab.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
