import { SIEM_CEF_SAMPLE, SIEM_JSON_SAMPLE } from '../constants/siem-sample.data';
import { filterSiemEvents, parseSiemText } from './siem-log-parse.utils';
import {
  canExportSiem,
  createSampleSiemFile,
  createSiemFileRecord,
  exportSiemCorrelationsCsv,
  filterValidSiemFiles
} from './siem-log-viewer.utils';

describe('siem-log-parse.utils', () => {
  it('parses the SOC JSON sample with correlations', () => {
    const parsed = parseSiemText(SIEM_JSON_SAMPLE);
    expect(parsed.name).toContain('SOC');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.events.length).toBe(8);
    expect(parsed.events.some((e) => e.severity === 'critical')).toBe(true);
    expect(parsed.correlations.length).toBeGreaterThan(1);
    expect(parsed.correlations.some((c) => /Brute force/i.test(c.label))).toBe(true);
  });

  it('parses CEF lines', () => {
    const parsed = parseSiemText(SIEM_CEF_SAMPLE, 'export.cef');
    expect(parsed.sourceKind).toBe('cef');
    expect(parsed.events.length).toBe(3);
    expect(parsed.events[0].rule).toContain('Brute force');
  });

  it('filters by severity and technique', () => {
    const parsed = parseSiemText(SIEM_JSON_SAMPLE);
    expect(filterSiemEvents(parsed.events, 'critical').every((e) => e.severity === 'critical')).toBe(true);
    expect(filterSiemEvents(parsed.events, 'T1110').length).toBeGreaterThan(0);
  });

  it('rejects empty or unknown JSON', () => {
    expect(() => parseSiemText('')).toThrow(/empty/i);
    expect(() => parseSiemText('{"foo":1}')).toThrow(/events/i);
  });
});

describe('siem-log-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSiemFile();
    expect(file.name).toBe('sample-siem-export.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleSiemFile();
    const record = createSiemFileRecord(file, new TextEncoder().encode(SIEM_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.events.length).toBe(8);
    expect(canExportSiem(record)).toBe(true);
  });

  it('exports correlations csv', () => {
    const parsed = parseSiemText(SIEM_JSON_SAMPLE);
    const csv = exportSiemCorrelationsCsv(parsed);
    expect(csv).toContain('label,severity,events');
    expect(csv.split('\n').length).toBeGreaterThan(2);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSiemFile();
    const { accepted, rejected } = filterValidSiemFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'siem.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
