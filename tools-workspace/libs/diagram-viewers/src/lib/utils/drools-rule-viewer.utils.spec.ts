import {
  DRL_JSON_SAMPLE,
  DRL_MARKDOWN_SAMPLE,
  DRL_SAMPLE,
  DRL_XML_SAMPLE
} from '../constants/drools-rule-viewer-sample.data';
import { filterDrlConditions, filterDrlRules, parseDroolsText } from './drools-rule-viewer-parse.utils';
import {
  canExportDrl,
  createDrlFileRecord,
  createSampleDrlFile,
  exportDrlRulesCsv,
  filterValidDrlFiles
} from './drools-rule-viewer.utils';

describe('drools-rule-viewer-parse.utils', () => {
  it('parses the shop DRL sample', () => {
    const parsed = parseDroolsText(DRL_SAMPLE, 'sample-shop.drl');
    expect(parsed.sourceKind).toBe('drl');
    expect(parsed.packageName).toBe('com.shop');
    expect(parsed.rules.length).toBe(2);
    expect(parsed.conditions.length).toBeGreaterThanOrEqual(3);
    expect(parsed.rules.some((r) => r.name === 'Free shipping' && r.salience === '10')).toBe(true);
    expect(parsed.rules.some((r) => r.name === 'Express upgrade')).toBe(true);
    expect(parsed.conditions.some((c) => c.factType === 'Order' && /total\s*>=\s*50/.test(c.constraints))).toBe(true);
    expect(parsed.conditions.some((c) => c.factType === 'Customer')).toBe(true);
  });

  it('parses markdown, JSON, and XML', () => {
    const md = parseDroolsText(DRL_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rules.length).toBeGreaterThanOrEqual(1);
    expect(md.conditions.length).toBeGreaterThanOrEqual(1);
    expect(md.rules.some((r) => /free shipping/i.test(r.name))).toBe(true);

    const json = parseDroolsText(DRL_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.packageName).toBe('com.shop');
    expect(json.rules.length).toBe(1);
    expect(json.conditions.length).toBe(1);

    const xml = parseDroolsText(DRL_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.rules.length).toBe(1);
    expect(xml.conditions.length).toBe(1);
    expect(xml.packageName).toBe('com.shop');
  });

  it('filters rules and conditions', () => {
    const parsed = parseDroolsText(DRL_SAMPLE, 'shop.drl');
    expect(filterDrlRules(parsed.rules, 'rule:express').length).toBe(1);
    expect(filterDrlRules(parsed.rules, 'salience:10').length).toBe(1);
    expect(filterDrlConditions(parsed.conditions, 'fact:Customer').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseDroolsText('')).toThrow(/empty/i);
    expect(() => parseDroolsText('hello world')).toThrow(/Not a Drools/i);
  });
});

describe('drools-rule-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDrlFile();
    expect(file.name).toBe('sample-shop.drl');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample drl', () => {
    const file = createSampleDrlFile();
    const record = createDrlFileRecord(file, new TextEncoder().encode(DRL_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rules.length).toBe(2);
    expect(canExportDrl(record)).toBe(true);
  });

  it('exports rules csv', () => {
    const parsed = parseDroolsText(DRL_SAMPLE, 'shop.drl');
    const csv = exportDrlRulesCsv(parsed);
    expect(csv).toContain('index,id,name,salience,agenda');
    expect(csv.split('\n').length).toBe(3);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleDrlFile();
    const { accepted, rejected } = filterValidDrlFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'shop.drl.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
