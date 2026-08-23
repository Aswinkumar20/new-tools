import { NESSUS_CSV_SAMPLE, NESSUS_XML_SAMPLE } from '../constants/nessus-sample.data';
import { filterNessusFindings, parseNessusText } from './nessus-report-parse.utils';
import {
  canExportNessus,
  createNessusFileRecord,
  createSampleNessusFile,
  exportNessusFindingsCsv,
  filterValidNessusFiles
} from './nessus-report-viewer.utils';

describe('nessus-report-parse.utils', () => {
  it('parses the lab Nessus XML sample', () => {
    const parsed = parseNessusText(NESSUS_XML_SAMPLE);
    expect(parsed.name).toContain('Lab');
    expect(parsed.sourceKind).toBe('nessus');
    expect(parsed.findings.length).toBe(6);
    expect(parsed.hosts.length).toBe(3);
    expect(parsed.findings.some((f) => f.severity === 'critical' && /Admin/i.test(f.pluginName))).toBe(true);
    expect(parsed.findings.some((f) => f.severity === 'high' && f.port === 80)).toBe(true);
    expect(parsed.findings.some((f) => f.cve.includes('CVE-2023-44487'))).toBe(true);
    expect(parsed.severities.some((s) => s.name === 'info')).toBe(true);
  });

  it('parses Nessus CSV', () => {
    const parsed = parseNessusText(NESSUS_CSV_SAMPLE, 'lab.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.findings.length).toBe(3);
    expect(parsed.findings[0].severity).toBe('medium');
  });

  it('filters by severity, host, and plugin', () => {
    const parsed = parseNessusText(NESSUS_XML_SAMPLE);
    expect(filterNessusFindings(parsed.findings, 'critical').every((f) => f.severity === 'critical')).toBe(true);
    expect(filterNessusFindings(parsed.findings, 'host:gw-01').length).toBe(3);
    expect(filterNessusFindings(parsed.findings, 'plugin:70658').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseNessusText('')).toThrow(/empty/i);
    expect(() => parseNessusText('hello world')).toThrow(/No Nessus|findings/i);
  });
});

describe('nessus-report-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleNessusFile();
    expect(file.name).toBe('sample-lab.nessus');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample xml', () => {
    const file = createSampleNessusFile();
    const record = createNessusFileRecord(file, new TextEncoder().encode(NESSUS_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.findings.length).toBe(6);
    expect(canExportNessus(record)).toBe(true);
  });

  it('exports findings csv', () => {
    const parsed = parseNessusText(NESSUS_XML_SAMPLE);
    const csv = exportNessusFindingsCsv(parsed);
    expect(csv).toContain('index,host,ip,port,protocol,severity');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleNessusFile();
    const { accepted, rejected } = filterValidNessusFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'lab.nessus.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
