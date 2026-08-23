import { FU_ASCII_SAMPLE, FU_CSV_SAMPLE, FU_JSON_SAMPLE, FU_MARKDOWN_SAMPLE } from '../constants/fusion-360-viewer-sample.data';
import {
  buildSampleFuBytes,
  filterFuComponents,
  filterFuBodies,
  filterFuRows,
  parseFuBytes,
  parseFuText
} from './fusion-360-viewer-parse.utils';
import {
  canExportFu,
  createFuFileRecord,
  createSampleFuFile,
  exportFuSchemaCsv,
  filterValidFuFiles
} from './fusion-360-viewer.utils';

describe('fusion-360-viewer-parse.utils', () => {
  it('parses the enclosure lid FU01 sample', () => {
    const parsed = parseFuBytes(buildSampleFuBytes(), 'enclosure-lid.f3d');
    expect(parsed.sourceKind).toBe('fusion');
    expect(parsed.name).toBe('Enclosure Lid');
    expect(parsed.bodies.some((p) => p.name === 'lid' && p.kind === 'box')).toBe(true);
    expect(parsed.bodies.some((p) => p.name === 'standoff' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.components.some((a) => a.name === 'EnclosureLid')).toBe(true);
    expect(parsed.instances.some((inst) => inst.body === 'standoff')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII Fusion', () => {
    const json = parseFuText(FU_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.bodies.length).toBe(3);

    const csv = parseFuText(FU_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.bodies.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.components.some((a) => a.name === 'EnclosureLid')).toBe(true);

    const md = parseFuText(FU_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.bodies.some((p) => p.name === 'lid')).toBe(true);

    const ascii = parseFuText(FU_ASCII_SAMPLE, 'shop.f3d');
    expect(ascii.sourceKind).toBe('fusion');
    expect(ascii.version).toContain('2.0');
    expect(ascii.bodies.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.components.some((a) => a.name === 'EnclosureLid')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'lid-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseFuBytes(buildSampleFuBytes(), 'enclosure-lid.f3d');
    expect(filterFuBodies(parsed.bodies, 'kind:cylinder').length).toBe(1);
    expect(filterFuComponents(parsed.components, 'comp:EnclosureLid').length).toBe(1);
    expect(filterFuRows(parsed.rows, 'name:standoff').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseFuText('')).toThrow(/empty/i);
    expect(() => parseFuText('hello world')).toThrow(/Not a Fusion/i);
    expect(() => parseFuBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.f3d')).toThrow(/compress/i);
    expect(() => parseFuBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.f3d')).toThrow(/Binary Fusion/i);
    expect(() => parseFuBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), 'part.f3d')).toThrow(/Binary Fusion/i);
  });
});

describe('fusion-360-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleFuFile();
    expect(file.name).toBe('enclosure-lid.f3d');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Fusion dump', () => {
    const file = createSampleFuFile();
    const record = createFuFileRecord(file, buildSampleFuBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.bodies.some((p) => p.name === 'standoff')).toBe(true);
    expect(canExportFu(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseFuBytes(buildSampleFuBytes(), 'enclosure-lid.f3d');
    const csv = exportFuSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,body,component,value');
    expect(csv).toContain('EnclosureLid');
    expect(csv.split('\n').length).toBe(parsed.bodies.length + parsed.components.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleFuFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidFuFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.f3d.gz', { lastModified: 2 }),
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

describe('canExportFu guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportFu({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportFu(null)).toBe(false);
  });
});
