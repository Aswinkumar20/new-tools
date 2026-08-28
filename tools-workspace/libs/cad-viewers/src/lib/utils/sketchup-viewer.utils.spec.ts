import { SK_ASCII_SAMPLE, SK_CSV_SAMPLE, SK_JSON_SAMPLE, SK_MARKDOWN_SAMPLE } from '../constants/sketchup-viewer-sample.data';
import {
  buildSampleSkBytes,
  filterSkComponents,
  filterSkGroups,
  filterSkRows,
  parseSkBytes,
  parseSkText
} from './sketchup-viewer-parse.utils';
import {
  canExportSk,
  createSkFileRecord,
  createSampleSkFile,
  exportSkSchemaCsv,
  filterValidSkFiles,
  resolveSkSuggestion
} from './sketchup-viewer.utils';

describe('sketchup-viewer-parse.utils', () => {
  it('parses the cabin SK01 sample', () => {
    const parsed = parseSkBytes(buildSampleSkBytes(), 'cabin-massing.skp');
    expect(parsed.sourceKind).toBe('sketchup');
    expect(parsed.name).toBe('Cabin Massing');
    expect(parsed.groups.some((p) => p.name === 'slab' && p.kind === 'box')).toBe(true);
    expect(parsed.groups.some((p) => p.name === 'chimney' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.components.some((a) => a.name === 'CabinMassing')).toBe(true);
    expect(parsed.instances.some((inst) => inst.group === 'chimney')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII SketchUp', () => {
    const json = parseSkText(SK_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.groups.length).toBe(3);

    const csv = parseSkText(SK_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.groups.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.components.some((a) => a.name === 'CabinMassing')).toBe(true);

    const md = parseSkText(SK_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.groups.some((p) => p.name === 'slab')).toBe(true);

    const ascii = parseSkText(SK_ASCII_SAMPLE, 'shop.skp');
    expect(ascii.sourceKind).toBe('sketchup');
    expect(ascii.version).toContain('2024');
    expect(ascii.groups.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.components.some((a) => a.name === 'CabinMassing')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'slab-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseSkBytes(buildSampleSkBytes(), 'cabin-massing.skp');
    expect(filterSkGroups(parsed.groups, 'kind:cylinder').length).toBe(1);
    expect(filterSkComponents(parsed.components, 'comp:CabinMassing').length).toBe(1);
    expect(filterSkRows(parsed.rows, 'name:chimney').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseSkText('')).toThrow(/empty/i);
    expect(() => parseSkText('hello world')).toThrow(/Not a SketchUp/i);
    expect(() => parseSkBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.skp')).toThrow(/compress/i);
    expect(() => parseSkBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.skp')).toThrow(/Binary SketchUp/i);
  });
});

describe('sketchup-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSkFile();
    expect(file.name).toBe('cabin-massing.skp');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample SketchUp dump', () => {
    const file = createSampleSkFile();
    const record = createSkFileRecord(file, buildSampleSkBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.groups.some((p) => p.name === 'chimney')).toBe(true);
    expect(canExportSk(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseSkBytes(buildSampleSkBytes(), 'cabin-massing.skp');
    const csv = exportSkSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,group,component,value');
    expect(csv).toContain('CabinMassing');
    expect(csv.split('\n').length).toBe(parsed.groups.length + parsed.components.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleSkFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidSkFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.skp.gz', { lastModified: 2 }),
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

describe('canExportSk guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportSk({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportSk(null)).toBe(false);
  });
});

describe('resolveSkSuggestion', () => {
  it('prefers error sample, then upload-or-sample when empty', () => {
    expect(resolveSkSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveSkSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveSkSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
