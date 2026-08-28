import { ST_ASCII_SAMPLE, ST_CSV_SAMPLE, ST_JSON_SAMPLE, ST_MARKDOWN_SAMPLE } from '../constants/step-viewer-sample.data';
import {
  buildSampleStBytes,
  filterStMeasurements,
  filterStRows,
  filterStSolids,
  parseStBytes,
  parseStText
} from './step-viewer-parse.utils';
import {
  canExportSt,
  createSampleStFile,
  createStFileRecord,
  exportStSchemaCsv,
  filterValidStFiles,
  resolveStSuggestion
} from './step-viewer.utils';

describe('step-viewer-parse.utils', () => {
  it('parses the hinge leaf ST01 sample', () => {
    const parsed = parseStBytes(buildSampleStBytes(), 'hinge-leaf.step');
    expect(parsed.sourceKind).toBe('step');
    expect(parsed.name).toBe('Hinge Leaf');
    expect(parsed.products.some((p) => p.name === 'HingeLeaf')).toBe(true);
    expect(parsed.solids.some((s) => s.name === 'knuckle' && s.kind === 'box')).toBe(true);
    expect(parsed.solids.some((s) => s.name === 'pin' && s.kind === 'cylinder')).toBe(true);
    expect(parsed.measurements.some((m) => m.name === 'leaf-length' && m.value === 4)).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII STEP', () => {
    const json = parseStText(ST_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.solids.length).toBe(3);

    const csv = parseStText(ST_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.solids.some((s) => s.kind === 'cylinder')).toBe(true);

    const md = parseStText(ST_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.products.some((p) => p.name === 'HingeLeaf')).toBe(true);

    const ascii = parseStText(ST_ASCII_SAMPLE, 'shop.step');
    expect(ascii.sourceKind).toBe('step');
    expect(ascii.schema).toBe('AUTOMOTIVE_DESIGN');
    expect(ascii.products.some((p) => p.name === 'HingeLeaf')).toBe(true);
    expect(ascii.solids.some((s) => s.name === 'knuckle')).toBe(true);
    expect(ascii.solids.some((s) => s.name === 'pin')).toBe(true);
  });

  it('filters solids, measurements, and rows', () => {
    const parsed = parseStBytes(buildSampleStBytes(), 'hinge-leaf.step');
    expect(filterStSolids(parsed.solids, 'kind:cylinder').length).toBe(1);
    expect(filterStMeasurements(parsed.measurements, 'meas:leaf-length').length).toBe(1);
    expect(filterStRows(parsed.rows, 'name:knuckle').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseStText('')).toThrow(/empty/i);
    expect(() => parseStText('hello world')).toThrow(/Not a STEP/i);
    expect(() => parseStBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.step')).toThrow(/compress/i);
  });
});

describe('step-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleStFile();
    expect(file.name).toBe('hinge-leaf.step');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample STEP dump', () => {
    const file = createSampleStFile();
    const record = createStFileRecord(file, buildSampleStBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.measurements.some((m) => m.name === 'leaf-length' && m.value === 4)).toBe(true);
    expect(canExportSt(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseStBytes(buildSampleStBytes(), 'hinge-leaf.step');
    const csv = exportStSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,solid,length,value');
    expect(csv).toContain('leaf-length');
    expect(csv.split('\n').length).toBe(parsed.products.length + parsed.solids.length + parsed.measurements.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleStFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidStFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.step.gz', { lastModified: 2 }),
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

describe('canExportSt guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportSt({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportSt(null)).toBe(false);
  });
});

describe('resolveStSuggestion', () => {
  it('returns sample-after-error, upload-or-sample, or null', () => {
    expect(resolveStSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveStSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveStSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
