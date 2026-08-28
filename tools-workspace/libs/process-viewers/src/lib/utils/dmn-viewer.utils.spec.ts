import { DMN_CSV_SAMPLE, DMN_JSON_SAMPLE, DMN_XML_SAMPLE } from '../constants/dmn-sample.data';
import { filterDmnRules, filterDmnTables, parseDmnText } from './dmn-parse.utils';
import { canExportDmn, createDmnFileRecord, createSampleDmnFile, exportDmnRulesCsv, filterValidDmnFiles, resolveDmnSuggestion } from './dmn-viewer.utils';

describe('dmn-parse.utils', () => {
  it('parses the loan approval DMN XML sample', () => {
    const parsed = parseDmnText(DMN_XML_SAMPLE);
    expect(parsed.sourceKind).toBe('dmn');
    expect(parsed.name).toContain('Loan');
    expect(parsed.tables.length).toBe(2);
    expect(parsed.rules.length).toBe(6);
    expect(parsed.nodes.some((n) => n.kind === 'decision' && n.name === 'Eligibility')).toBe(true);
    expect(parsed.nodes.some((n) => n.kind === 'input' && /FICO/i.test(n.name))).toBe(true);
    expect(parsed.nodes.some((n) => n.kind === 'knowledge')).toBe(true);
    expect(parsed.tables.some((t) => t.hitPolicy === 'UNIQUE' && t.ruleCount === 3)).toBe(true);
    expect(parsed.tables.some((t) => t.hitPolicy === 'FIRST')).toBe(true);
    expect(parsed.edges.some((e) => e.type === 'information')).toBe(true);
    expect(parsed.rules.some((r) => r.outputs.some((o) => /Excellent/i.test(o)))).toBe(true);
  });

  it('parses DMN JSON and CSV', () => {
    const json = parseDmnText(DMN_JSON_SAMPLE, 'loan.json');
    expect(json.sourceKind).toBe('json');
    expect(json.tables.length).toBe(1);
    expect(json.rules.length).toBe(3);
    const csv = parseDmnText(DMN_CSV_SAMPLE, 'loan.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.rules.length).toBe(3);
  });

  it('filters tables by hit policy and rules by table', () => {
    const parsed = parseDmnText(DMN_XML_SAMPLE);
    expect(filterDmnTables(parsed.tables, 'unique').every((t) => t.hitPolicy === 'UNIQUE')).toBe(true);
    expect(filterDmnRules(parsed.rules, 'table:Eligibility').every((r) => /Eligibility/i.test(r.tableName))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDmnText('')).toThrow(/empty/i);
    expect(() => parseDmnText('hello world')).toThrow(/No DMN/i);
  });
});

describe('dmn-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDmnFile();
    expect(file.name).toBe('sample-loan-approval.dmn');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample dmn', () => {
    const file = createSampleDmnFile();
    const record = createDmnFileRecord(file, new TextEncoder().encode(DMN_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.tables.length).toBe(2);
    expect(canExportDmn(record)).toBe(true);
  });

  it('exports rules csv', () => {
    const parsed = parseDmnText(DMN_XML_SAMPLE);
    const csv = exportDmnRulesCsv(parsed);
    expect(csv).toContain('index,table,hit_policy,when,then');
    expect(csv.split('\n').length).toBe(7);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDmnFile();
    const { accepted, rejected } = filterValidDmnFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'loan.dmn.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveDmnSuggestion returns upload-or-sample when empty', () => {
    expect(resolveDmnSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolveDmnSuggestion returns sample-after-error when hasError', () => {
    expect(resolveDmnSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportDmn returns false for null', () => {
    expect(canExportDmn(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createDmnFileRecord(new File(['hello world'], 'bad.dmn', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportDmn(record)).toBe(false);
  });
});
