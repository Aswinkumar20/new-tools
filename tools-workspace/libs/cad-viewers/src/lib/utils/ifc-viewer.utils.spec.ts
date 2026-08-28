import {
  IC_ASCII_SAMPLE,
  IC_CSV_SAMPLE,
  IC_JSON_SAMPLE,
  IC_MARKDOWN_SAMPLE,
  IC_STEP_SAMPLE
} from '../constants/ifc-viewer-sample.data';
import {
  buildSampleIcBytes,
  filterIcDisciplines,
  filterIcElements,
  filterIcProperties,
  filterIcRows,
  parseIcBytes,
  parseIcText
} from './ifc-viewer-parse.utils';
import {
  buildIcDisciplineMetadata,
  buildIcElementMetadata,
  buildIcMetadataRows,
  buildIcPropertyMetadata,
  canExportIc,
  createIcFileRecord,
  createSampleIcFile,
  exportIcRowsCsv,
  exportIcSchemaCsv,
  exportIcSummaryJson,
  filterValidIcFiles,
  resolveIcSuggestion
} from './ifc-viewer.utils';

describe('ifc-viewer-parse.utils', () => {
  it('parses the library IF01 sample', () => {
    const parsed = parseIcBytes(buildSampleIcBytes(), 'library-annex.ifc');
    expect(parsed.sourceKind).toBe('ifc');
    expect(parsed.name).toBe('Library Annex');
    expect(parsed.ifcVer).toBe('IFC4');
    expect(parsed.elements.some((e) => e.name === 'slab' && e.ifcType === 'IfcSlab')).toBe(true);
    expect(parsed.elements.some((e) => e.name === 'column' && e.kind === 'cylinder')).toBe(true);
    expect(parsed.disciplines.some((d) => d.name === 'Architecture')).toBe(true);
    expect(parsed.properties.some((p) => p.name === 'bay-width' && p.value === '24')).toBe(true);
    expect(parsed.properties.some((p) => p.value.includes('Library'))).toBe(true);
  });

  it('parses dump, STEP subset, JSON, CSV, and Markdown', () => {
    const ascii = parseIcText(IC_ASCII_SAMPLE, 'shop.ifc');
    expect(ascii.sourceKind).toBe('ifc');
    expect(ascii.elements.some((e) => e.kind === 'cylinder')).toBe(true);
    expect(ascii.properties.some((p) => p.name === 'title')).toBe(true);

    const step = parseIcText(IC_STEP_SAMPLE, 'shop.ifc');
    expect(step.sourceKind).toBe('ifc');
    expect(step.elements.some((e) => e.name === 'slab')).toBe(true);
    expect(step.elements.some((e) => e.name === 'column' && e.kind === 'cylinder')).toBe(true);
    expect(step.properties.some((p) => p.name === 'bay-width')).toBe(true);
    expect(step.properties.some((p) => p.value.includes('Library'))).toBe(true);

    const json = parseIcText(IC_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.elements.length).toBe(3);

    const csv = parseIcText(IC_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.elements.some((e) => e.ifcType === 'IfcColumn')).toBe(true);
    expect(csv.disciplines.some((d) => d.name === 'Structure')).toBe(true);

    const md = parseIcText(IC_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.elements.some((e) => e.name === 'slab')).toBe(true);
  });

  it('filters elements, properties, disciplines, and rows', () => {
    const parsed = parseIcBytes(buildSampleIcBytes(), 'library-annex.ifc');
    expect(filterIcElements(parsed.elements, 'kind:cylinder').length).toBe(1);
    expect(filterIcElements(parsed.elements, 'disc:Architecture').length).toBeGreaterThanOrEqual(1);
    expect(filterIcProperties(parsed.properties, 'prop:bay-width').length).toBe(1);
    expect(filterIcDisciplines(parsed.disciplines, 'disc:Structure').length).toBe(1);
    expect(filterIcRows(parsed.rows, 'name:column').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseIcText('')).toThrow(/empty/i);
    expect(() => parseIcText('hello world')).toThrow(/Not an IFC/i);
    expect(() => parseIcBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.ifc')).toThrow(/compress/i);
    expect(() => parseIcBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'model.ifc')).toThrow(/IFCZIP|ZIP/i);
  });
});

describe('ifc-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleIcFile();
    expect(file.name).toBe('library-annex.ifc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample IFC dump', () => {
    const file = createSampleIcFile();
    const record = createIcFileRecord(file, buildSampleIcBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.elements.some((e) => e.name === 'column')).toBe(true);
    expect(canExportIc(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseIcBytes(buildSampleIcBytes(), 'library-annex.ifc');
    const csv = exportIcSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,element,discipline,value');
    expect(csv).toContain('IfcSlab');
    expect(csv).toContain('bay-width');
    expect(csv.split('\n').length).toBe(parsed.elements.length + parsed.properties.length + parsed.disciplines.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleIcFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidIcFiles([
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

describe('canExportIc guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportIc({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportIc(null)).toBe(false);
  });
});

describe('ifc-viewer metadata + exports + suggestions', () => {
  it('builds dataset and entity metadata rows', () => {
    const parsed = parseIcBytes(buildSampleIcBytes(), 'library-annex.ifc');
    const rows = buildIcMetadataRows(parsed);
    expect(rows.some((r) => r.key === 'Name' && r.value === parsed.name)).toBe(true);
    expect(rows.some((r) => r.key === 'Elements')).toBe(true);

    expect(buildIcElementMetadata(parsed.elements[0]).some((r) => r.key === 'IFC type')).toBe(true);
    expect(buildIcPropertyMetadata(parsed.properties[0]).some((r) => r.key === 'Value')).toBe(true);
    expect(buildIcDisciplineMetadata(parsed.disciplines[0]).some((r) => r.key === 'Elements')).toBe(true);
  });

  it('exports summary json and rows csv', () => {
    const file = createIcFileRecord(createSampleIcFile(), buildSampleIcBytes());
    const summary = exportIcSummaryJson(file);
    expect(summary).toContain('"elements"');
    expect(summary).toContain(file.parsed!.name);

    const rowsCsv = exportIcRowsCsv(file.parsed!);
    expect(rowsCsv.split('\n').length).toBe(file.parsed!.rows.length + 1);
  });

  it('soft-fails empty parseable dumps without crashing export guard', () => {
    const payload = '{"name":"Empty","elements":[],"properties":[],"disciplines":[]}';
    const emptyJson = new File([payload], 'empty.json', { lastModified: 1 });
    const bytes = new TextEncoder().encode(payload);
    const record = createIcFileRecord(emptyJson, bytes);
    expect(record.softFail).toBe(true);
    expect(canExportIc(record)).toBe(false);
  });

  it('resolves upload and error suggestions', () => {
    expect(resolveIcSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveIcSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveIcSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
