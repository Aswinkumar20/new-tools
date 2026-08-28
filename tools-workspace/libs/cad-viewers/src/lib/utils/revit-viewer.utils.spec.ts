import { RV_ASCII_SAMPLE, RV_CSV_SAMPLE, RV_JSON_SAMPLE, RV_MARKDOWN_SAMPLE } from '../constants/revit-viewer-sample.data';
import {
  buildSampleRvBytes,
  filterRvFamilies,
  filterRvInstances,
  filterRvRows,
  filterRvTypes,
  parseRvBytes,
  parseRvText
} from './revit-viewer-parse.utils';
import { canExportRv, createRvFileRecord, createSampleRvFile, exportRvSchemaCsv, filterValidRvFiles, resolveRvSuggestion } from './revit-viewer.utils';

describe('revit-viewer-parse.utils', () => {
  it('parses the classroom RV01 sample', () => {
    const parsed = parseRvBytes(buildSampleRvBytes(), 'classroom-wing.rvt');
    expect(parsed.sourceKind).toBe('revit');
    expect(parsed.name).toBe('Classroom Wing');
    expect(parsed.revitVer).toBe('2024');
    expect(parsed.instances.some((inst) => inst.name === 'slab' && inst.kind === 'box')).toBe(true);
    expect(parsed.instances.some((inst) => inst.name === 'column' && inst.kind === 'cylinder')).toBe(true);
    expect(parsed.families.some((f) => f.name === 'TeacherDesk')).toBe(true);
    expect(parsed.types.some((t) => t.name === 'Floor')).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseRvText(RV_ASCII_SAMPLE, 'shop.rvt');
    expect(ascii.sourceKind).toBe('revit');
    expect(ascii.instances.some((inst) => inst.kind === 'cylinder')).toBe(true);
    expect(ascii.families.some((f) => f.name === 'TeacherDesk')).toBe(true);
    expect(ascii.types.some((t) => t.name === 'Mount')).toBe(true);

    const json = parseRvText(RV_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.instances.length).toBe(3);

    const csv = parseRvText(RV_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.instances.some((inst) => inst.kind === 'cylinder')).toBe(true);
    expect(csv.families.some((f) => f.name === 'TeacherDesk')).toBe(true);

    const md = parseRvText(RV_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.instances.some((inst) => inst.name === 'slab')).toBe(true);
  });

  it('filters instances, families, types, and rows', () => {
    const parsed = parseRvBytes(buildSampleRvBytes(), 'classroom-wing.rvt');
    expect(filterRvInstances(parsed.instances, 'kind:cylinder').length).toBe(1);
    expect(filterRvFamilies(parsed.families, 'fam:Teacher').length).toBe(1);
    expect(filterRvTypes(parsed.types, 'type:Floor').length).toBe(1);
    expect(filterRvRows(parsed.rows, 'name:column').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, OLE, or unknown text', () => {
    expect(() => parseRvText('')).toThrow(/empty/i);
    expect(() => parseRvText('hello world')).toThrow(/Not a Revit/i);
    expect(() => parseRvBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.rvt')).toThrow(/compress/i);
    expect(() => parseRvBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'model.rvt')).toThrow(/Binary Revit/i);
  });
});

describe('revit-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleRvFile();
    expect(file.name).toBe('classroom-wing.rvt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Revit dump', () => {
    const file = createSampleRvFile();
    const record = createRvFileRecord(file, buildSampleRvBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.instances.some((inst) => inst.name === 'column')).toBe(true);
    expect(canExportRv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseRvBytes(buildSampleRvBytes(), 'classroom-wing.rvt');
    const csv = exportRvSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,family,category,value');
    expect(csv).toContain('TeacherDesk');
    expect(csv.split('\n').length).toBe(parsed.instances.length + parsed.families.length + parsed.types.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleRvFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidRvFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.rvt.gz', { lastModified: 2 }),
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

describe('canExportRv guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportRv({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportRv(null)).toBe(false);
  });
});

describe('resolveRvSuggestion', () => {
  it('prefers error sample, then upload-or-sample when empty', () => {
    expect(resolveRvSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveRvSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveRvSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
