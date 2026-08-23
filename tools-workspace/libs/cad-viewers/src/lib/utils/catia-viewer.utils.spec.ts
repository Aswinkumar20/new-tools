import { CT_ASCII_SAMPLE, CT_CSV_SAMPLE, CT_JSON_SAMPLE, CT_MARKDOWN_SAMPLE } from '../constants/catia-viewer-sample.data';
import {
  buildSampleCtBytes,
  filterCtAssemblies,
  filterCtParts,
  filterCtRows,
  parseCtBytes,
  parseCtText
} from './catia-viewer-parse.utils';
import {
  canExportCt,
  createCtFileRecord,
  createSampleCtFile,
  exportCtSchemaCsv,
  filterValidCtFiles
} from './catia-viewer.utils';

describe('catia-viewer-parse.utils', () => {
  it('parses the wing rib CT01 sample', () => {
    const parsed = parseCtBytes(buildSampleCtBytes(), 'wing-rib.catpart');
    expect(parsed.sourceKind).toBe('catia');
    expect(parsed.name).toBe('Wing Rib');
    expect(parsed.parts.some((p) => p.name === 'web' && p.kind === 'box')).toBe(true);
    expect(parsed.parts.some((p) => p.name === 'lightener' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.assemblies.some((a) => a.name === 'WingRib')).toBe(true);
    expect(parsed.instances.some((inst) => inst.part === 'lightener')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII CATIA', () => {
    const json = parseCtText(CT_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.parts.length).toBe(3);

    const csv = parseCtText(CT_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.assemblies.some((a) => a.name === 'WingRib')).toBe(true);

    const md = parseCtText(CT_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.parts.some((p) => p.name === 'web')).toBe(true);

    const ascii = parseCtText(CT_ASCII_SAMPLE, 'shop.catpart');
    expect(ascii.sourceKind).toBe('catia');
    expect(ascii.version).toContain('V5');
    expect(ascii.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.assemblies.some((a) => a.name === 'WingRib')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'web-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseCtBytes(buildSampleCtBytes(), 'wing-rib.catpart');
    expect(filterCtParts(parsed.parts, 'kind:cylinder').length).toBe(1);
    expect(filterCtAssemblies(parsed.assemblies, 'assy:WingRib').length).toBe(1);
    expect(filterCtRows(parsed.rows, 'name:lightener').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseCtText('')).toThrow(/empty/i);
    expect(() => parseCtText('hello world')).toThrow(/Not a CATIA/i);
    expect(() => parseCtBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.catpart')).toThrow(/compress/i);
    expect(() => parseCtBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.catpart')).toThrow(/Binary CATIA/i);
  });
});

describe('catia-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleCtFile();
    expect(file.name).toBe('wing-rib.catpart');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample CATIA dump', () => {
    const file = createSampleCtFile();
    const record = createCtFileRecord(file, buildSampleCtBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.parts.some((p) => p.name === 'lightener')).toBe(true);
    expect(canExportCt(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseCtBytes(buildSampleCtBytes(), 'wing-rib.catpart');
    const csv = exportCtSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,part,assembly,value');
    expect(csv).toContain('WingRib');
    expect(csv.split('\n').length).toBe(parsed.parts.length + parsed.assemblies.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleCtFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidCtFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.catpart.gz', { lastModified: 2 }),
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

describe('canExportCt guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportCt({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportCt(null)).toBe(false);
  });
});
