import { DECISION_MODEL_CSV_SAMPLE, DECISION_MODEL_JSON_SAMPLE } from '../constants/decision-model-sample.data';
import { DMN_XML_SAMPLE } from '../constants/dmn-sample.data';
import { filterDecisionModelDecisions, filterDecisionModelDependencies, parseDecisionModelText } from './decision-model-parse.utils';
import {
  canExportDecisionModel,
  createDecisionModelFileRecord,
  createSampleDecisionModelFile,
  exportDecisionModelRulesCsv,
  filterValidDecisionModelFiles,
  resolveDecisionModelSuggestion
} from './decision-model-viewer.utils';

describe('decision-model-parse.utils', () => {
  it('parses the order pricing JSON sample', () => {
    const parsed = parseDecisionModelText(DECISION_MODEL_JSON_SAMPLE);
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.name).toContain('pricing');
    expect(parsed.decisions.length).toBe(4);
    expect(parsed.rules.length).toBe(10);
    expect(parsed.dependencies.length).toBe(3);
    expect(parsed.decisions.some((d) => d.id === 'D_Price' && d.kind === 'expression')).toBe(true);
    expect(parsed.decisions.some((d) => d.hitPolicy === 'COLLECT')).toBe(true);
    expect(parsed.dependencies.some((d) => /Discount/i.test(d.sourceName) && /Price/i.test(d.targetName))).toBe(true);
  });

  it('parses DMN XML and CSV as a decision model', () => {
    const dmn = parseDecisionModelText(DMN_XML_SAMPLE, 'loan.dmn');
    expect(dmn.sourceKind).toBe('dmn');
    expect(dmn.decisions.length).toBe(2);
    expect(dmn.rules.length).toBe(6);
    expect(dmn.dependencies.length).toBeGreaterThan(0);
    const csv = parseDecisionModelText(DECISION_MODEL_CSV_SAMPLE, 'pricing.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.rules.length).toBe(3);
  });

  it('filters decisions by kind and dependencies by type', () => {
    const parsed = parseDecisionModelText(DECISION_MODEL_JSON_SAMPLE);
    expect(filterDecisionModelDecisions(parsed.decisions, 'expression').every((d) => d.kind === 'expression')).toBe(true);
    expect(filterDecisionModelDependencies(parsed.dependencies, 'information').every((d) => d.type === 'information')).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDecisionModelText('')).toThrow(/empty/i);
    expect(() => parseDecisionModelText('hello world')).toThrow(/No decision model/i);
  });
});

describe('decision-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDecisionModelFile();
    expect(file.name).toBe('sample-pricing-model.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample json', () => {
    const file = createSampleDecisionModelFile();
    const record = createDecisionModelFileRecord(file, new TextEncoder().encode(DECISION_MODEL_JSON_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.decisions.length).toBe(4);
    expect(canExportDecisionModel(record)).toBe(true);
  });

  it('exports rules csv', () => {
    const parsed = parseDecisionModelText(DECISION_MODEL_JSON_SAMPLE);
    const csv = exportDecisionModelRulesCsv(parsed);
    expect(csv).toContain('index,decision,when,then,annotation');
    expect(csv.split('\n').length).toBe(11);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDecisionModelFile();
    const { accepted, rejected } = filterValidDecisionModelFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'model.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveDecisionModelSuggestion returns upload-or-sample when empty', () => {
    expect(resolveDecisionModelSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
  });

  it('resolveDecisionModelSuggestion returns sample-after-error when hasError', () => {
    expect(resolveDecisionModelSuggestion({ hasFiles: true, hasError: true })?.id).toBe('sample-after-error');
  });

  it('canExportDecisionModel returns false for null', () => {
    expect(canExportDecisionModel(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createDecisionModelFileRecord(new File(['hello world'], 'bad.json', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportDecisionModel(record)).toBe(false);
  });
});
