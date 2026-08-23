import { SARIF_CSV_SAMPLE, SARIF_JSON_SAMPLE } from '../constants/sarif-sample.data';
import { filterSarifResults, parseSarifText } from './sarif-report-parse.utils';
import {
  canExportSarif,
  createSampleSarifFile,
  createSarifFileRecord,
  exportSarifResultsCsv,
  filterValidSarifFiles
} from './sarif-report-viewer.utils';

describe('sarif-report-parse.utils', () => {
  it('parses the EasyLint SARIF 2.1 sample', () => {
    const parsed = parseSarifText(SARIF_JSON_SAMPLE);
    expect(parsed.tool).toBe('EasyLint');
    expect(parsed.sourceKind).toBe('sarif');
    expect(parsed.version).toBe('2.1.0');
    expect(parsed.results.length).toBe(5);
    expect(parsed.rules.length).toBe(3);
    expect(parsed.locations.length).toBe(4);
    expect(parsed.results.filter((r) => r.ruleId === 'SEC001' && r.level === 'error').length).toBe(2);
    expect(parsed.results.some((r) => r.ruleId === 'SEC014' && /SQL/i.test(r.message))).toBe(true);
    expect(parsed.results.some((r) => r.level === 'note' && r.file.includes('util.ts'))).toBe(true);
    expect(parsed.levels.some((l) => l.name === 'error' && l.count === 2)).toBe(true);
  });

  it('parses SARIF CSV', () => {
    const parsed = parseSarifText(SARIF_CSV_SAMPLE, 'app.csv');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.results.length).toBe(3);
    expect(parsed.results[0].level).toBe('error');
    expect(parsed.results[0].file).toContain('token.ts');
  });

  it('filters by level, rule, and file', () => {
    const parsed = parseSarifText(SARIF_JSON_SAMPLE);
    expect(filterSarifResults(parsed.results, 'error').every((r) => r.level === 'error')).toBe(true);
    expect(filterSarifResults(parsed.results, 'rule:SEC014').length).toBe(2);
    expect(filterSarifResults(parsed.results, 'file:db.ts').length).toBe(2);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseSarifText('')).toThrow(/empty/i);
    expect(() => parseSarifText('hello world')).toThrow(/No SARIF|results/i);
  });
});

describe('sarif-report-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSarifFile();
    expect(file.name).toBe('sample-app.sarif');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample sarif', () => {
    const file = createSampleSarifFile();
    const record = createSarifFileRecord(file, new TextEncoder().encode(SARIF_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.results.length).toBe(5);
    expect(canExportSarif(record)).toBe(true);
  });

  it('exports results csv', () => {
    const parsed = parseSarifText(SARIF_JSON_SAMPLE);
    const csv = exportSarifResultsCsv(parsed);
    expect(csv).toContain('index,rule_id,rule_name,level,file');
    expect(csv.split('\n').length).toBe(6);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleSarifFile();
    const { accepted, rejected } = filterValidSarifFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'app.sarif.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
