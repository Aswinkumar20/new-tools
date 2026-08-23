import { PROCESS_MAP_CSV_SAMPLE, PROCESS_MAP_JSON_SAMPLE, PROCESS_MAP_XML_SAMPLE } from '../constants/process-map-sample.data';
import { filterProcessMapActivities, filterProcessMapVariants, parseProcessMapText } from './process-map-parse.utils';
import {
  canExportProcessMap,
  createProcessMapFileRecord,
  createSampleProcessMapFile,
  exportProcessMapVariantsCsv,
  filterValidProcessMapFiles
} from './process-map-viewer.utils';

describe('process-map-parse.utils', () => {
  it('parses the order fulfillment JSON sample', () => {
    const parsed = parseProcessMapText(PROCESS_MAP_JSON_SAMPLE);
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.name).toContain('Order');
    expect(parsed.cases).toBe(1200);
    expect(parsed.activities.length).toBe(7);
    expect(parsed.variants.length).toBe(3);
    expect(parsed.variants[0].cases).toBe(850);
    expect(parsed.variants[0].pct).toBe(70.8);
    expect(parsed.flows.some((f) => f.sourceName === 'Check credit' && f.targetName === 'Reject' && f.frequency === 220)).toBe(true);
  });

  it('parses process map XML and CSV', () => {
    const xml = parseProcessMapText(PROCESS_MAP_XML_SAMPLE, 'map.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.activities.length).toBe(4);
    expect(xml.variants.length).toBe(2);
    expect(xml.cases).toBe(1200);
    const csv = parseProcessMapText(PROCESS_MAP_CSV_SAMPLE, 'map.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.activities.length).toBe(4);
    expect(csv.variants.length).toBe(2);
    expect(csv.flows.length).toBe(3);
  });

  it('filters variants and frequent activities', () => {
    const parsed = parseProcessMapText(PROCESS_MAP_JSON_SAMPLE);
    expect(filterProcessMapVariants(parsed.variants, 'reject').every((v) => /reject/i.test(v.name + v.pathLabel))).toBe(true);
    expect(filterProcessMapActivities(parsed.activities, 'activity:Pack').length).toBe(1);
    expect(filterProcessMapActivities(parsed.activities, 'hot').every((a) => a.pct >= 70)).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseProcessMapText('')).toThrow(/empty/i);
    expect(() => parseProcessMapText('hello world')).toThrow(/No process map/i);
  });
});

describe('process-map-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleProcessMapFile();
    expect(file.name).toBe('sample-order-process-map.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample map', () => {
    const file = createSampleProcessMapFile();
    const record = createProcessMapFileRecord(file, new TextEncoder().encode(PROCESS_MAP_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.variants.length).toBe(3);
    expect(canExportProcessMap(record)).toBe(true);
  });

  it('exports variants csv', () => {
    const parsed = parseProcessMapText(PROCESS_MAP_JSON_SAMPLE);
    const csv = exportProcessMapVariantsCsv(parsed);
    expect(csv).toContain('index,name,cases,pct,path');
    expect(csv.split('\n').length).toBe(4);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleProcessMapFile();
    const { accepted, rejected } = filterValidProcessMapFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'map.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
