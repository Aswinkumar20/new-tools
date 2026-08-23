import { DG_CSV_SAMPLE, DG_JSON_SAMPLE, DG_MARKDOWN_SAMPLE } from '../constants/dgn-viewer-sample.data';
import {
  buildSampleDgBytes,
  filterDgCivil,
  filterDgEntities,
  filterDgLayers,
  filterDgRows,
  parseDgBytes,
  parseDgText
} from './dgn-viewer-parse.utils';
import {
  canExportDg,
  createDgFileRecord,
  createSampleDgFile,
  exportDgSchemaCsv,
  filterValidDgFiles
} from './dgn-viewer.utils';

describe('dgn-viewer-parse.utils', () => {
  it('parses the corridor DG01 sample', () => {
    const parsed = parseDgBytes(buildSampleDgBytes(), 'site-corridor.dgn');
    expect(parsed.sourceKind).toBe('dgn');
    expect(parsed.name).toBe('Site Corridor');
    expect(parsed.layers.some((l) => l.name === 'ROW')).toBe(true);
    expect(parsed.layers.some((l) => l.name === 'CIVIL')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'line' && e.level === 'ROW')).toBe(true);
    expect(parsed.entities.some((e) => e.name === 'manhole' && e.type === 'circle')).toBe(true);
    expect(parsed.civil.some((c) => c.name === 'centerline' && c.type === 'alignment')).toBe(true);
    expect(parsed.civil.some((c) => c.type === 'contour' && c.elevation === 1.5)).toBe(true);
  });

  it('parses JSON, CSV, and Markdown dumps', () => {
    const json = parseDgText(DG_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.civil.some((c) => c.type === 'station')).toBe(true);

    const csv = parseDgText(DG_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.layers.some((l) => l.name === 'CIVIL')).toBe(true);
    expect(csv.civil.some((c) => c.type === 'alignment')).toBe(true);

    const md = parseDgText(DG_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'ROW')).toBe(true);
  });

  it('filters levels, civil, entities, and rows', () => {
    const parsed = parseDgBytes(buildSampleDgBytes(), 'site-corridor.dgn');
    expect(filterDgLayers(parsed.layers, 'level:CIVIL').length).toBe(1);
    expect(filterDgCivil(parsed.civil, 'type:alignment').length).toBe(1);
    expect(filterDgEntities(parsed.entities, 'type:circle').length).toBe(1);
    expect(filterDgRows(parsed.rows, 'name:centerline').length).toBe(1);
  });

  it('rejects empty, gzip, unknown text, OLE V8, and binary DGN', () => {
    expect(() => parseDgText('')).toThrow(/empty/i);
    expect(() => parseDgText('hello world')).toThrow(/Not a DGN/i);
    expect(() => parseDgBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.dgn')).toThrow(/compress/i);
    expect(() => parseDgBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00]), 'v8.dgn')).toThrow(/V8|compound/i);
    const bin = new Uint8Array(32);
    bin[0] = 0x08;
    bin[1] = 0x09;
    bin[2] = 0xfe;
    expect(() => parseDgBytes(bin, 'old.dgn')).toThrow(/Binary DGN/i);
  });
});

describe('dgn-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDgFile();
    expect(file.name).toBe('site-corridor.dgn');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample DGN dump', () => {
    const file = createSampleDgFile();
    const record = createDgFileRecord(file, buildSampleDgBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.civil.some((c) => c.name === 'centerline')).toBe(true);
    expect(canExportDg(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseDgBytes(buildSampleDgBytes(), 'site-corridor.dgn');
    const csv = exportDgSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,level,x,y');
    expect(csv).toContain('centerline');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.entities.length + parsed.civil.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleDgFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidDgFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.dgn.gz', { lastModified: 2 }),
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

describe('canExportDg guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportDg({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportDg(null)).toBe(false);
  });
});
