import {
  NW_ASCII_SAMPLE,
  NW_CSV_SAMPLE,
  NW_JSON_SAMPLE,
  NW_MARKDOWN_SAMPLE
} from '../constants/navisworks-viewer-sample.data';
import {
  buildSampleNwBytes,
  filterNwClashes,
  filterNwItems,
  filterNwModels,
  filterNwRows,
  parseNwBytes,
  parseNwText
} from './navisworks-viewer-parse.utils';
import { canExportNw, createNwFileRecord, createSampleNwFile, exportNwSchemaCsv, filterValidNwFiles } from './navisworks-viewer.utils';

describe('navisworks-viewer-parse.utils', () => {
  it('parses the campus NW01 sample', () => {
    const parsed = parseNwBytes(buildSampleNwBytes(), 'campus-fed.nwd');
    expect(parsed.sourceKind).toBe('navisworks');
    expect(parsed.name).toBe('Campus Fed');
    expect(parsed.navisVer).toBe('2024');
    expect(parsed.items.some((e) => e.name === 'slab' && e.kind === 'box')).toBe(true);
    expect(parsed.items.some((e) => e.name === 'column' && e.kind === 'cylinder')).toBe(true);
    expect(parsed.items.some((e) => e.name === 'duct' && e.model === 'MEP')).toBe(true);
    expect(parsed.models.some((d) => d.name === 'Architecture')).toBe(true);
    expect(parsed.clashes.some((c) => c.name === 'CL-01' && c.clashType === 'hard')).toBe(true);
    expect(parsed.clashes.some((c) => c.itemA === 'column' && c.itemB === 'duct')).toBe(true);
  });

  it('parses dump, JSON, CSV, and Markdown', () => {
    const ascii = parseNwText(NW_ASCII_SAMPLE, 'shop.nwd');
    expect(ascii.sourceKind).toBe('navisworks');
    expect(ascii.items.some((e) => e.kind === 'cylinder')).toBe(true);
    expect(ascii.clashes.some((c) => c.name === 'CL-01')).toBe(true);
    expect(ascii.models.some((d) => d.name === 'Structure')).toBe(true);

    const json = parseNwText(NW_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.items.length).toBe(4);
    expect(json.clashes.length).toBe(2);

    const csv = parseNwText(NW_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.items.some((e) => e.kind === 'cylinder')).toBe(true);
    expect(csv.models.some((d) => d.name === 'MEP')).toBe(true);

    const md = parseNwText(NW_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.items.some((e) => e.name === 'slab')).toBe(true);
    expect(md.clashes.some((c) => c.name === 'CL-01')).toBe(true);
  });

  it('filters items, clashes, models, and rows', () => {
    const parsed = parseNwBytes(buildSampleNwBytes(), 'campus-fed.nwd');
    expect(filterNwItems(parsed.items, 'kind:cylinder').length).toBe(1);
    expect(filterNwItems(parsed.items, 'model:Architecture').length).toBeGreaterThanOrEqual(1);
    expect(filterNwClashes(parsed.clashes, 'clash:CL-01').length).toBe(1);
    expect(filterNwClashes(parsed.clashes, 'hard').length).toBe(1);
    expect(filterNwModels(parsed.models, 'model:Structure').length).toBe(1);
    expect(filterNwRows(parsed.rows, 'name:column').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, OLE, or unknown text', () => {
    expect(() => parseNwText('')).toThrow(/empty/i);
    expect(() => parseNwText('hello world')).toThrow(/Not a Navisworks/i);
    expect(() => parseNwBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.nwd')).toThrow(/compress/i);
    expect(() => parseNwBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00]), 'model.nwd')).toThrow(/OLE|Binary/i);
  });
});

describe('navisworks-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleNwFile();
    expect(file.name).toBe('campus-fed.nwd');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Navisworks dump', () => {
    const file = createSampleNwFile();
    const record = createNwFileRecord(file, buildSampleNwBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.items.some((e) => e.name === 'column')).toBe(true);
    expect(canExportNw(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseNwBytes(buildSampleNwBytes(), 'campus-fed.nwd');
    const csv = exportNwSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,model,clash,value');
    expect(csv).toContain('CL-01');
    expect(csv).toContain('Architecture');
    expect(csv.split('\n').length).toBe(parsed.items.length + parsed.clashes.length + parsed.models.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleNwFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidNwFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.nwd.gz', { lastModified: 2 }),
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

describe('canExportNw guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportNw({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportNw(null)).toBe(false);
  });
});
