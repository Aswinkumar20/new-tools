import { BOREHOLE_BHL_SAMPLE, BOREHOLE_SAMPLE } from '../constants/borehole-sample.data';
import { computeTrajectory, parseBoreholeText } from './borehole-parse.utils';
import {
  canExportBorehole,
  createBoreholeFileRecord,
  createSampleBoreholeFile,
  exportBoreholeSurveyCsv,
  filterValidBoreholeFiles,
  resolveBoreholeSuggestion
} from './borehole-viewer.utils';

describe('borehole-parse.utils', () => {
  it('computes a vertical well with minimum curvature', () => {
    const rows = computeTrajectory([
      { md: 0, inc: 0, azi: 0 },
      { md: 100, inc: 0, azi: 0 }
    ]);
    expect(rows.length).toBe(2);
    expect(rows[1].tvd).toBeCloseTo(100, 5);
    expect(rows[1].north).toBeCloseTo(0, 5);
    expect(rows[1].east).toBeCloseTo(0, 5);
  });

  it('parses the sample JSON borehole', () => {
    const parsed = parseBoreholeText(BOREHOLE_SAMPLE);
    expect(parsed.well).toBe('ETH-1');
    expect(parsed.survey.length).toBe(13);
    expect(parsed.lithology.length).toBe(6);
    expect(parsed.td).toBe(1320);
    expect(parsed.tvd).toBeGreaterThan(700);
    expect(parsed.displacement).toBeGreaterThan(100);
    expect(parsed.maxDls).toBeGreaterThan(0);
  });

  it('parses BOREHOLE text', () => {
    const parsed = parseBoreholeText(BOREHOLE_BHL_SAMPLE);
    expect(parsed.sourceKind).toBe('bhl');
    expect(parsed.survey.length).toBe(5);
    expect(parsed.lithology.length).toBe(3);
    expect(parsed.markers[0].name).toContain('Cretaceous');
  });

  it('parses CSV deviation surveys', () => {
    const parsed = parseBoreholeText('md,inc,azi\n0,0,0\n100,10,90\n200,20,90\n');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.survey.length).toBe(3);
    expect(parsed.survey[2].east).toBeGreaterThan(0);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseBoreholeText('')).toThrow(/empty/i);
    expect(() => parseBoreholeText('hello')).toThrow(/Unrecognized|borehole/i);
  });
});

describe('borehole-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleBoreholeFile();
    expect(file.name).toBe('sample-eth1.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleBoreholeFile();
    const record = createBoreholeFileRecord(file, new TextEncoder().encode(BOREHOLE_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.survey.length).toBe(13);
    expect(canExportBorehole(record)).toBe(true);
  });

  it('exports survey csv', () => {
    const parsed = parseBoreholeText(BOREHOLE_SAMPLE);
    const csv = exportBoreholeSurveyCsv(parsed);
    expect(csv.split('\n')[0]).toContain('md,inc,azi');
    expect(csv.split('\n').length).toBe(parsed.survey.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleBoreholeFile();
    const { accepted, rejected } = filterValidBoreholeFiles([
      sample,
      new File(['x'], 'well.sgy', { lastModified: 1 }),
      new File(['x'], 'well.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('resolveBoreholeSuggestion returns upload-bhl when empty', () => {
    expect(resolveBoreholeSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-bhl');
  });

  it('resolveBoreholeSuggestion returns try-sample when hasError', () => {
    expect(resolveBoreholeSuggestion({ hasFiles: true, hasError: true })?.id).toBe('try-sample');
  });

  it('canExportBorehole returns false for null', () => {
    expect(canExportBorehole(null)).toBe(false);
  });

  it('soft-fail record has parsed null and disables export', () => {
    const record = createBoreholeFileRecord(new File(['hello world'], 'bad.json', { lastModified: 9 }), new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportBorehole(record)).toBe(false);
  });
});
