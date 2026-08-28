import { DW_CSV_SAMPLE, DW_JSON_SAMPLE, DW_MARKDOWN_SAMPLE } from '../constants/dwg-viewer-sample.data';
import {
  buildSampleDwBytes,
  filterDwEntities,
  filterDwLayers,
  filterDwMeasurements,
  filterDwRows,
  parseDwBytes,
  parseDwText
} from './dwg-viewer-parse.utils';
import {
  canExportDw,
  createDwFileRecord,
  createSampleDwFile,
  exportDwSchemaCsv,
  filterValidDwFiles,
  resolveDwSuggestion
} from './dwg-viewer.utils';

describe('dwg-viewer-parse.utils', () => {
  it('parses the office DW01 sample', () => {
    const parsed = parseDwBytes(buildSampleDwBytes(), 'office-l2.dwg');
    expect(parsed.sourceKind).toBe('dwg');
    expect(parsed.name).toBe('Office L2');
    expect(parsed.layers.length).toBeGreaterThanOrEqual(3);
    expect(parsed.layers.some((l) => l.name === 'A-WALL')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'line' && e.layer === 'A-WALL')).toBe(true);
    expect(parsed.entities.some((e) => e.name === 'column' && e.type === 'circle')).toBe(true);
    expect(parsed.measurements.some((m) => m.name === 'bay-width' && m.value === 18)).toBe(true);
    expect(parsed.units).toBe('m');
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseDwText(DW_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'A-WALL')).toBe(true);
    expect(json.measurements.some((m) => m.name === 'bay-width')).toBe(true);

    const csv = parseDwText(DW_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.entities.some((e) => e.type === 'line')).toBe(true);

    const md = parseDwText(DW_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'A-WALL')).toBe(true);
  });

  it('filters layers, measurements, entities, and rows', () => {
    const parsed = parseDwBytes(buildSampleDwBytes(), 'office-l2.dwg');
    expect(filterDwLayers(parsed.layers, 'layer:A-WALL').length).toBe(1);
    expect(filterDwMeasurements(parsed.measurements, 'meas:bay-width').length).toBe(1);
    expect(filterDwEntities(parsed.entities, 'type:circle').length).toBe(1);
    expect(filterDwRows(parsed.rows, 'name:south-wall').length).toBe(1);
  });

  it('rejects empty, gzip, unknown text, and binary AC10xx DWG', () => {
    expect(() => parseDwText('')).toThrow(/empty/i);
    expect(() => parseDwText('hello world')).toThrow(/Not a DWG/i);
    expect(() => parseDwBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.dwg')).toThrow(/compress/i);
    const ac = new TextEncoder().encode('AC1027');
    const padded = new Uint8Array(32);
    padded.set(ac);
    expect(() => parseDwBytes(padded, 'real.dwg')).toThrow(/Binary DWG/i);
  });
});

describe('dwg-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDwFile();
    expect(file.name).toBe('office-l2.dwg');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample DWG dump', () => {
    const file = createSampleDwFile();
    const record = createDwFileRecord(file, buildSampleDwBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.measurements.some((m) => m.name === 'bay-width' && m.value === 18)).toBe(true);
    expect(canExportDw(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseDwBytes(buildSampleDwBytes(), 'office-l2.dwg');
    const csv = exportDwSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,length,value');
    expect(csv).toContain('bay-width');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.entities.length + parsed.measurements.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleDwFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidDwFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.dwg.gz', { lastModified: 2 }),
      empty,
      huge
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
    expect(rejected.some((item) => /empty/i.test(item.reason))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('too large'))).toBe(true);
  });
});

describe('canExportDw guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportDw({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportDw(null)).toBe(false);
  });
});

describe('resolveDwSuggestion', () => {
  it('returns upload-or-sample, sample-after-error, or null', () => {
    expect(resolveDwSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveDwSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveDwSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
