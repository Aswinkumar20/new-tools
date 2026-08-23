import { STRATIGRAPHY_SAMPLE, STRATIGRAPHY_STR_SAMPLE } from '../constants/stratigraphy-sample.data';
import { parseStratigraphyText } from './stratigraphy-parse.utils';
import {
  canExportStrat,
  createSampleStratFile,
  createStratFileRecord,
  exportStratUnitsCsv,
  filterStratUnits,
  filterValidStratFiles
} from './stratigraphy-viewer.utils';

describe('stratigraphy-parse.utils', () => {
  it('parses the sample multi-column JSON', () => {
    const parsed = parseStratigraphyText(STRATIGRAPHY_SAMPLE);
    expect(parsed.name).toContain('Western Basin');
    expect(parsed.columns.length).toBe(2);
    expect(parsed.columns[0].units.length).toBe(6);
    expect(parsed.markers.map((m) => m.name)).toEqual(['K-Pg', 'J-K', 'P-T']);
    expect(parsed.ageMax).toBeGreaterThan(parsed.ageMin);
  });

  it('parses STRATIGRAPHY text', () => {
    const parsed = parseStratigraphyText(STRATIGRAPHY_STR_SAMPLE);
    expect(parsed.sourceKind).toBe('str');
    expect(parsed.columns[0].units.length).toBe(3);
    expect(parsed.markers[0].name).toBe('K-Pg');
  });

  it('parses CSV units', () => {
    const parsed = parseStratigraphyText(
      'unit,lithology,period,age_top,age_base,thickness\nSand,Sandstone,Quaternary,0,2.6,40\nShale,Shale,Cretaceous,66,89,120\n'
    );
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.columns[0].units.map((u) => u.name)).toEqual(['Sand', 'Shale']);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseStratigraphyText('')).toThrow(/empty/i);
    expect(() => parseStratigraphyText('hello world')).toThrow(/Unrecognized|stratigraphy/i);
  });
});

describe('stratigraphy-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleStratFile();
    expect(file.name).toBe('sample-basin-strat.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleStratFile();
    const record = createStratFileRecord(file, new TextEncoder().encode(STRATIGRAPHY_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.columns.length).toBe(2);
    expect(canExportStrat(record)).toBe(true);
  });

  it('filters units and exports csv', () => {
    const parsed = parseStratigraphyText(STRATIGRAPHY_SAMPLE);
    expect(filterStratUnits(parsed.columns[0].units, 'shale').some((u) => /shale/i.test(u.name))).toBe(true);
    const csv = exportStratUnitsCsv(parsed);
    expect(csv).toContain('column,id,name');
    expect(csv.split('\n').length).toBe(13);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleStratFile();
    const { accepted, rejected } = filterValidStratFiles([
      sample,
      new File(['x'], 'col.sgy', { lastModified: 1 }),
      new File(['x'], 'col.json.gz', { lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });
});
