import {
  SR_ASCII_SAMPLE,
  SR_CSV_SAMPLE,
  SR_JSON_SAMPLE,
  SR_MARKDOWN_SAMPLE,
  SR_STEP_SAMPLE
} from '../constants/structural-model-viewer-sample.data';
import {
  buildSampleSrBytes,
  filterSrMembers,
  filterSrProperties,
  filterSrRows,
  filterSrSections,
  parseSrBytes,
  parseSrText
} from './structural-model-viewer-parse.utils';
import {
  canExportSr,
  createSampleSrFile,
  createSrFileRecord,
  exportSrSchemaCsv,
  filterValidSrFiles,
  resolveSrSuggestion
} from './structural-model-viewer.utils';

describe('structural-model-viewer-parse.utils', () => {
  it('parses the parking SM01 sample', () => {
    const parsed = parseSrBytes(buildSampleSrBytes(), 'parking-frame.ifc');
    expect(parsed.sourceKind).toBe('structural');
    expect(parsed.name).toBe('Parking Frame');
    expect(parsed.structVer).toBe('1.0');
    expect(parsed.members.some((m) => m.name === 'slab' && m.memberType === 'Slab')).toBe(true);
    expect(parsed.members.some((m) => m.name === 'column' && m.section === 'Columns')).toBe(true);
    expect(parsed.members.some((m) => m.name === 'beam' && m.memberType === 'Beam')).toBe(true);
    expect(parsed.members.some((m) => m.name === 'footing')).toBe(true);
    expect(parsed.properties.some((p) => p.name === 'bay-width' && p.value === '28')).toBe(true);
    expect(parsed.properties.some((p) => p.value === 'Parking')).toBe(true);
    expect(parsed.sections.some((s) => s.name === 'Beams')).toBe(true);
  });

  it('parses dump, STEP subset, JSON, CSV, and Markdown', () => {
    const ascii = parseSrText(SR_ASCII_SAMPLE, 'shop.ifc');
    expect(ascii.sourceKind).toBe('structural');
    expect(ascii.members.some((m) => m.name === 'beam')).toBe(true);
    expect(ascii.properties.some((p) => p.name === 'title')).toBe(true);

    const step = parseSrText(SR_STEP_SAMPLE, 'shop.ifc');
    expect(step.sourceKind).toBe('structural');
    expect(step.members.some((m) => m.name === 'beam')).toBe(true);
    expect(step.members.some((m) => m.name === 'column')).toBe(true);
    expect(step.properties.some((p) => p.name === 'bay-width')).toBe(true);

    const json = parseSrText(SR_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.members.length).toBe(4);

    const csv = parseSrText(SR_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.members.some((m) => m.name === 'footing')).toBe(true);
    expect(csv.sections.some((s) => s.name === 'Columns')).toBe(true);

    const md = parseSrText(SR_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.members.some((m) => m.name === 'column')).toBe(true);
  });

  it('filters members, properties, sections, and rows', () => {
    const parsed = parseSrBytes(buildSampleSrBytes(), 'parking-frame.ifc');
    expect(filterSrMembers(parsed.members, 'sec:Beams').length).toBeGreaterThanOrEqual(1);
    expect(filterSrMembers(parsed.members, 'mem:column').length).toBe(1);
    expect(filterSrProperties(parsed.properties, 'prop:bay-width').length).toBe(1);
    expect(filterSrSections(parsed.sections, 'sec:Slabs').length).toBe(1);
    expect(filterSrRows(parsed.rows, 'name:Parking').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseSrText('')).toThrow(/empty/i);
    expect(() => parseSrText('hello world')).toThrow(/Not a Structural/i);
    expect(() => parseSrBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.ifc')).toThrow(/compress/i);
    expect(() => parseSrBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'model.ifc')).toThrow(/IFCZIP|ZIP/i);
  });
});

describe('structural-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSrFile();
    expect(file.name).toBe('parking-frame.ifc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample structural dump', () => {
    const file = createSampleSrFile();
    const record = createSrFileRecord(file, buildSampleSrBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.members.some((m) => m.name === 'beam')).toBe(true);
    expect(canExportSr(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseSrBytes(buildSampleSrBytes(), 'parking-frame.ifc');
    const csv = exportSrSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,section,member,value');
    expect(csv).toContain('Beams');
    expect(csv).toContain('Parking');
    expect(csv.split('\n').length).toBe(parsed.members.length + parsed.properties.length + parsed.sections.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleSrFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidSrFiles([
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

describe('canExportSr guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportSr({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportSr(null)).toBe(false);
  });
});

describe('resolveSrSuggestion', () => {
  it('returns sample-after-error, upload-or-sample, or null', () => {
    expect(resolveSrSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveSrSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveSrSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
