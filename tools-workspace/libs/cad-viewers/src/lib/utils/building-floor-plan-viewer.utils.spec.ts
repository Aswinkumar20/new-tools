import {
  FP_ASCII_SAMPLE,
  FP_CSV_SAMPLE,
  FP_JSON_SAMPLE,
  FP_MARKDOWN_SAMPLE,
  FP_STEP_SAMPLE
} from '../constants/building-floor-plan-viewer-sample.data';
import {
  buildSampleFpBytes,
  filterFpLevels,
  filterFpRooms,
  filterFpRows,
  filterFpSpaces,
  parseFpBytes,
  parseFpText
} from './building-floor-plan-viewer-parse.utils';
import { canExportFp, createFpFileRecord, createSampleFpFile, exportFpSchemaCsv, filterValidFpFiles } from './building-floor-plan-viewer.utils';

describe('building-floor-plan-viewer-parse.utils', () => {
  it('parses the hotel FP01 sample', () => {
    const parsed = parseFpBytes(buildSampleFpBytes(), 'hotel-l3.ifc');
    expect(parsed.sourceKind).toBe('plan');
    expect(parsed.name).toBe('Hotel L3');
    expect(parsed.planVer).toBe('1.0');
    expect(parsed.rooms.some((r) => r.name === 'Lobby' && r.level === 'Ground')).toBe(true);
    expect(parsed.rooms.some((r) => r.name === 'Guest')).toBe(true);
    expect(parsed.spaces.some((s) => s.name === 'col1' && s.kind === 'column')).toBe(true);
    expect(parsed.spaces.some((s) => s.name === 'Lobby' && s.kind === 'text')).toBe(true);
    expect(parsed.levels.some((d) => d.name === 'Ground')).toBe(true);
  });

  it('parses dump, STEP subset, JSON, CSV, and Markdown', () => {
    const ascii = parseFpText(FP_ASCII_SAMPLE, 'shop.ifc');
    expect(ascii.sourceKind).toBe('plan');
    expect(ascii.rooms.some((r) => r.name === 'Housekeeping')).toBe(true);
    expect(ascii.spaces.some((s) => s.kind === 'column')).toBe(true);
    expect(ascii.spaces.some((s) => s.name === 'Lobby')).toBe(true);

    const step = parseFpText(FP_STEP_SAMPLE, 'shop.ifc');
    expect(step.sourceKind).toBe('plan');
    expect(step.levels.some((d) => d.name === 'Ground')).toBe(true);
    expect(step.rooms.some((r) => r.name === 'Lobby')).toBe(true);
    expect(step.spaces.some((s) => s.name === 'col1' && s.kind === 'column')).toBe(true);

    const json = parseFpText(FP_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.rooms.length).toBe(3);

    const csv = parseFpText(FP_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.levels.some((d) => d.name === 'Mezzanine')).toBe(true);
    expect(csv.rooms.some((r) => r.name === 'Guest')).toBe(true);

    const md = parseFpText(FP_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.rooms.some((r) => r.name === 'Lobby')).toBe(true);
  });

  it('filters spaces, rooms, levels, and rows', () => {
    const parsed = parseFpBytes(buildSampleFpBytes(), 'hotel-l3.ifc');
    expect(filterFpSpaces(parsed.spaces, 'kind:column').length).toBe(1);
    expect(filterFpRooms(parsed.rooms, 'room:Guest').length).toBe(1);
    expect(filterFpLevels(parsed.levels, 'level:Ground').length).toBe(1);
    expect(filterFpRows(parsed.rows, 'name:Lobby').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseFpText('')).toThrow(/empty/i);
    expect(() => parseFpText('hello world')).toThrow(/Not a floor plan/i);
    expect(() => parseFpBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.ifc')).toThrow(/compress/i);
    expect(() => parseFpBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'plan.ifc')).toThrow(/IFCZIP|ZIP/i);
  });
});

describe('building-floor-plan-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFpFile();
    expect(file.name).toBe('hotel-l3.ifc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample floor-plan dump', () => {
    const file = createSampleFpFile();
    const record = createFpFileRecord(file, buildSampleFpBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.rooms.some((r) => r.name === 'Lobby')).toBe(true);
    expect(canExportFp(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseFpBytes(buildSampleFpBytes(), 'hotel-l3.ifc');
    const csv = exportFpSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,level,room,x');
    expect(csv).toContain('Lobby');
    expect(csv).toContain('Ground');
    expect(csv.split('\n').length).toBe(parsed.levels.length + parsed.rooms.length + parsed.spaces.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleFpFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidFpFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.ifc.gz', { lastModified: 2 }),
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

describe('canExportFp guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportFp({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportFp(null)).toBe(false);
  });
});
