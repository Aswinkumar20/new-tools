import {
  BC_ASCII_SAMPLE,
  BC_CSV_SAMPLE,
  BC_JSON_SAMPLE,
  BC_MARKDOWN_SAMPLE,
  BC_XML_SAMPLE
} from '../constants/bim-clash-viewer-sample.data';
import {
  buildSampleBcBytes,
  filterBcClashes,
  filterBcItems,
  filterBcRows,
  filterBcTests,
  parseBcBytes,
  parseBcText
} from './bim-clash-viewer-parse.utils';
import {
  canExportBc,
  createBcFileRecord,
  createSampleBcFile,
  exportBcSchemaCsv,
  filterValidBcFiles,
  resolveBcSuggestion
} from './bim-clash-viewer.utils';

describe('bim-clash-viewer-parse.utils', () => {
  it('parses the duct-beam BC01 sample', () => {
    const parsed = parseBcBytes(buildSampleBcBytes(), 'duct-beam-clash.xml');
    expect(parsed.sourceKind).toBe('xml');
    expect(parsed.name).toBe('Duct-Beam Clash');
    expect(parsed.reportVer).toBe('1.0');
    expect(parsed.items.some((e) => e.name === 'slab' && e.kind === 'box')).toBe(true);
    expect(parsed.items.some((e) => e.name === 'column' && e.kind === 'cylinder')).toBe(true);
    expect(parsed.items.some((e) => e.name === 'duct')).toBe(true);
    expect(parsed.tests.some((d) => d.name === 'HVAC-Frame')).toBe(true);
    expect(parsed.clashes.some((c) => c.name === 'CL-01' && c.clashType === 'hard')).toBe(true);
    expect(parsed.clashes.some((c) => c.itemA === 'column' && c.itemB === 'duct')).toBe(true);
  });

  it('parses dump, XML, JSON, CSV, and Markdown', () => {
    const ascii = parseBcText(BC_ASCII_SAMPLE, 'shop.ifc');
    expect(ascii.sourceKind).toBe('clash');
    expect(ascii.items.some((e) => e.kind === 'cylinder')).toBe(true);
    expect(ascii.clashes.some((c) => c.name === 'CL-01')).toBe(true);
    expect(ascii.tests.some((d) => d.name === 'HVAC-Frame')).toBe(true);

    const xml = parseBcText(BC_XML_SAMPLE, 'shop.xml');
    expect(xml.sourceKind).toBe('xml');
    expect(xml.clashes.some((c) => c.name === 'CL-01' && c.clashType === 'hard')).toBe(true);
    expect(xml.items.some((e) => e.name === 'column' && e.kind === 'cylinder')).toBe(true);
    expect(xml.tests.some((d) => d.name === 'HVAC-Frame')).toBe(true);

    const json = parseBcText(BC_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.items.length).toBe(4);
    expect(json.clashes.length).toBe(2);

    const csv = parseBcText(BC_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.items.some((e) => e.kind === 'cylinder')).toBe(true);
    expect(csv.tests.some((d) => d.name === 'HVAC-Frame')).toBe(true);

    const md = parseBcText(BC_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.items.some((e) => e.name === 'slab')).toBe(true);
    expect(md.clashes.some((c) => c.name === 'CL-01')).toBe(true);
  });

  it('filters items, clashes, tests, and rows', () => {
    const parsed = parseBcBytes(buildSampleBcBytes(), 'duct-beam-clash.xml');
    expect(filterBcItems(parsed.items, 'kind:cylinder').length).toBe(1);
    expect(filterBcItems(parsed.items, 'focus:column').length).toBe(1);
    expect(filterBcClashes(parsed.clashes, 'clash:CL-01').length).toBe(1);
    expect(filterBcClashes(parsed.clashes, 'hard').length).toBe(1);
    expect(filterBcTests(parsed.tests, 'test:HVAC').length).toBe(1);
    expect(filterBcRows(parsed.rows, 'name:column').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseBcText('')).toThrow(/empty/i);
    expect(() => parseBcText('hello world')).toThrow(/Not a BIM clash/i);
    expect(() => parseBcBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.xml')).toThrow(/compress/i);
    expect(() => parseBcBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'report.xml')).toThrow(/Zip|IFC/i);
  });
});

describe('bim-clash-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleBcFile();
    expect(file.name).toBe('duct-beam-clash.xml');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample clash dump', () => {
    const file = createSampleBcFile();
    const record = createBcFileRecord(file, buildSampleBcBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.clashes.some((c) => c.name === 'CL-01')).toBe(true);
    expect(canExportBc(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseBcBytes(buildSampleBcBytes(), 'duct-beam-clash.xml');
    const csv = exportBcSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,test,clash,value');
    expect(csv).toContain('CL-01');
    expect(csv).toContain('HVAC-Frame');
    expect(csv.split('\n').length).toBe(parsed.items.length + parsed.clashes.length + parsed.tests.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleBcFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidBcFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.xml.gz', { lastModified: 2 }),
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

describe('canExportBc guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportBc({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportBc(null)).toBe(false);
  });
});

describe('resolveBcSuggestion', () => {
  it('returns sample-after-error, upload-or-sample, or null', () => {
    expect(resolveBcSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveBcSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveBcSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
