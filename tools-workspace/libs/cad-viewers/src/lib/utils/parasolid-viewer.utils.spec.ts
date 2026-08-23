import { PX_ASCII_SAMPLE, PX_CSV_SAMPLE, PX_JSON_SAMPLE, PX_MARKDOWN_SAMPLE } from '../constants/parasolid-viewer-sample.data';
import {
  buildSamplePxBytes,
  filterPxMeasurements,
  filterPxRows,
  filterPxSolids,
  parsePxBytes,
  parsePxText
} from './parasolid-viewer-parse.utils';
import {
  canExportPx,
  createPxFileRecord,
  createSamplePxFile,
  exportPxSchemaCsv,
  filterValidPxFiles
} from './parasolid-viewer.utils';

describe('parasolid-viewer-parse.utils', () => {
  it('parses the gearbox PX01 sample', () => {
    const parsed = parsePxBytes(buildSamplePxBytes(), 'gearbox-housing.x_t');
    expect(parsed.sourceKind).toBe('parasolid');
    expect(parsed.name).toBe('Gearbox Housing');
    expect(parsed.bodies.some((b) => b.name === 'GearboxHousing')).toBe(true);
    expect(parsed.solids.some((s) => s.name === 'cover' && s.kind === 'box')).toBe(true);
    expect(parsed.solids.some((s) => s.name === 'bore' && s.kind === 'cylinder')).toBe(true);
    expect(parsed.measurements.some((m) => m.name === 'case-width' && m.value === 6)).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII Parasolid', () => {
    const json = parsePxText(PX_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.solids.length).toBe(3);

    const csv = parsePxText(PX_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.solids.some((s) => s.kind === 'cylinder')).toBe(true);

    const md = parsePxText(PX_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.bodies.some((b) => b.name === 'GearboxHousing')).toBe(true);

    const ascii = parsePxText(PX_ASCII_SAMPLE, 'shop.x_t');
    expect(ascii.sourceKind).toBe('parasolid');
    expect(ascii.schema).toContain('PARASOLID');
    expect(ascii.bodies.some((b) => b.name === 'GearboxHousing')).toBe(true);
    expect(ascii.solids.some((s) => s.name === 'cover')).toBe(true);
    expect(ascii.solids.some((s) => s.name === 'bore' && s.kind === 'cylinder')).toBe(true);
  });

  it('filters solids, measurements, and rows', () => {
    const parsed = parsePxBytes(buildSamplePxBytes(), 'gearbox-housing.x_t');
    expect(filterPxSolids(parsed.solids, 'kind:cylinder').length).toBe(1);
    expect(filterPxMeasurements(parsed.measurements, 'meas:case-width').length).toBe(1);
    expect(filterPxRows(parsed.rows, 'name:cover').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parsePxText('')).toThrow(/empty/i);
    expect(() => parsePxText('hello world')).toThrow(/Not a Parasolid/i);
    expect(() => parsePxBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.x_t')).toThrow(/compress/i);
  });
});

describe('parasolid-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSamplePxFile();
    expect(file.name).toBe('gearbox-housing.x_t');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Parasolid dump', () => {
    const file = createSamplePxFile();
    const record = createPxFileRecord(file, buildSamplePxBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.measurements.some((m) => m.name === 'case-width' && m.value === 6)).toBe(true);
    expect(canExportPx(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parsePxBytes(buildSamplePxBytes(), 'gearbox-housing.x_t');
    const csv = exportPxSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,solid,length,value');
    expect(csv).toContain('case-width');
    expect(csv.split('\n').length).toBe(parsed.bodies.length + parsed.solids.length + parsed.measurements.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSamplePxFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidPxFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.x_t.gz', { lastModified: 2 }),
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

describe('canExportPx guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportPx({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportPx(null)).toBe(false);
  });
});
