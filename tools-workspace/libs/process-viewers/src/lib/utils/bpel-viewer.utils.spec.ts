import { BPEL_CSV_SAMPLE, BPEL_JSON_SAMPLE, BPEL_XML_SAMPLE } from '../constants/bpel-sample.data';
import { filterBpelActivities, filterBpelPartners, parseBpelText } from './bpel-parse.utils';
import {
  canExportBpel,
  createBpelFileRecord,
  createSampleBpelFile,
  exportBpelActivitiesCsv,
  filterValidBpelFiles
} from './bpel-viewer.utils';

describe('bpel-parse.utils', () => {
  it('parses the loan approval BPEL sample', () => {
    const parsed = parseBpelText(BPEL_XML_SAMPLE);
    expect(parsed.sourceKind).toBe('bpel');
    expect(parsed.name).toBe('LoanApproval');
    expect(parsed.partners.length).toBe(3);
    expect(parsed.variables.length).toBe(4);
    expect(parsed.activities.some((a) => a.kind === 'receive' && a.createInstance)).toBe(true);
    expect(parsed.activities.some((a) => a.kind === 'invoke' && /Assessor/i.test(a.name))).toBe(true);
    expect(parsed.activities.some((a) => a.kind === 'invoke' && /Credit/i.test(a.name))).toBe(true);
    expect(parsed.activities.some((a) => a.kind === 'reply')).toBe(true);
    expect(parsed.activities.some((a) => a.kind === 'throw')).toBe(true);
    expect(parsed.partners.some((p) => p.name === 'customer' && p.activityCount > 0)).toBe(true);
  });

  it('parses BPEL JSON and CSV', () => {
    const json = parseBpelText(BPEL_JSON_SAMPLE, 'loan.json');
    expect(json.sourceKind).toBe('json');
    expect(json.partners.length).toBe(2);
    expect(json.activities.length).toBe(3);
    const csv = parseBpelText(BPEL_CSV_SAMPLE, 'loan.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.activities.length).toBe(4);
    expect(csv.partners.length).toBe(3);
  });

  it('filters invokes and partners', () => {
    const parsed = parseBpelText(BPEL_XML_SAMPLE);
    expect(filterBpelActivities(parsed.activities, 'invoke').every((a) => a.kind === 'invoke')).toBe(true);
    expect(filterBpelActivities(parsed.activities, 'partner:assessor').every((a) => /assessor/i.test(a.partner))).toBe(true);
    expect(filterBpelPartners(parsed.partners, 'partner:credit').length).toBe(1);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseBpelText('')).toThrow(/empty/i);
    expect(() => parseBpelText('hello world')).toThrow(/No BPEL/i);
  });
});

describe('bpel-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleBpelFile();
    expect(file.name).toBe('sample-loan-approval.bpel');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample bpel', () => {
    const file = createSampleBpelFile();
    const record = createBpelFileRecord(file, new TextEncoder().encode(BPEL_XML_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.partners.length).toBe(3);
    expect(canExportBpel(record)).toBe(true);
  });

  it('exports activities csv', () => {
    const parsed = parseBpelText(BPEL_XML_SAMPLE);
    const csv = exportBpelActivitiesCsv(parsed);
    expect(csv).toContain('index,kind,name,partner,operation,parent');
    expect(csv.split('\n').length).toBe(parsed.activities.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleBpelFile();
    const { accepted, rejected } = filterValidBpelFiles([
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'loan.bpel.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
