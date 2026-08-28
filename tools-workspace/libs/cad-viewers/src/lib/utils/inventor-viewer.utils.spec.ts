import { IV_ASCII_SAMPLE, IV_CSV_SAMPLE, IV_JSON_SAMPLE, IV_MARKDOWN_SAMPLE } from '../constants/inventor-viewer-sample.data';
import {
  buildSampleIvBytes,
  filterIvAssemblies,
  filterIvParts,
  filterIvRows,
  parseIvBytes,
  parseIvText
} from './inventor-viewer-parse.utils';
import {
  buildIvAssemblyMetadata,
  buildIvMetadataRows,
  buildIvPartMetadata,
  canExportIv,
  createIvFileRecord,
  createSampleIvFile,
  exportIvRowsCsv,
  exportIvSchemaCsv,
  exportIvSummaryJson,
  filterValidIvFiles,
  resolveIvSuggestion
} from './inventor-viewer.utils';

describe('inventor-viewer-parse.utils', () => {
  it('parses the shaft collar IV01 sample', () => {
    const parsed = parseIvBytes(buildSampleIvBytes(), 'shaft-collar.ipt');
    expect(parsed.sourceKind).toBe('inventor');
    expect(parsed.name).toBe('Shaft Collar');
    expect(parsed.parts.some((p) => p.name === 'collar' && p.kind === 'box')).toBe(true);
    expect(parsed.parts.some((p) => p.name === 'bore' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.assemblies.some((a) => a.name === 'ShaftCollar')).toBe(true);
    expect(parsed.instances.some((inst) => inst.part === 'bore')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII Inventor', () => {
    const json = parseIvText(IV_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.parts.length).toBe(3);

    const csv = parseIvText(IV_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.assemblies.some((a) => a.name === 'ShaftCollar')).toBe(true);

    const md = parseIvText(IV_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.parts.some((p) => p.name === 'collar')).toBe(true);

    const ascii = parseIvText(IV_ASCII_SAMPLE, 'shop.ipt');
    expect(ascii.sourceKind).toBe('inventor');
    expect(ascii.version).toContain('2025');
    expect(ascii.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.assemblies.some((a) => a.name === 'ShaftCollar')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'collar-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseIvBytes(buildSampleIvBytes(), 'shaft-collar.ipt');
    expect(filterIvParts(parsed.parts, 'kind:cylinder').length).toBe(1);
    expect(filterIvAssemblies(parsed.assemblies, 'assy:ShaftCollar').length).toBe(1);
    expect(filterIvRows(parsed.rows, 'name:bore').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseIvText('')).toThrow(/empty/i);
    expect(() => parseIvText('hello world')).toThrow(/Not an Inventor/i);
    expect(() => parseIvBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.ipt')).toThrow(/compress/i);
    expect(() => parseIvBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.ipt')).toThrow(/Binary Inventor/i);
  });
});

describe('inventor-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleIvFile();
    expect(file.name).toBe('shaft-collar.ipt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Inventor dump', () => {
    const file = createSampleIvFile();
    const record = createIvFileRecord(file, buildSampleIvBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.parts.some((p) => p.name === 'bore')).toBe(true);
    expect(canExportIv(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseIvBytes(buildSampleIvBytes(), 'shaft-collar.ipt');
    const csv = exportIvSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,part,assembly,value');
    expect(csv).toContain('ShaftCollar');
    expect(csv.split('\n').length).toBe(parsed.parts.length + parsed.assemblies.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleIvFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidIvFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.ipt.gz', { lastModified: 2 }),
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

describe('canExportIv guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportIv({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportIv(null)).toBe(false);
  });
});

describe('inventor-viewer metadata + exports + suggestions', () => {
  it('builds dataset and part/assembly metadata rows', () => {
    const parsed = parseIvBytes(buildSampleIvBytes(), 'shaft-collar.ipt');
    const rows = buildIvMetadataRows(parsed);
    expect(rows.some((r) => r.key === 'Name' && r.value === parsed.name)).toBe(true);
    expect(rows.some((r) => r.key === 'Parts')).toBe(true);

    expect(buildIvPartMetadata(parsed.parts[0]).some((r) => r.key === 'Kind')).toBe(true);
    expect(buildIvAssemblyMetadata(parsed.assemblies[0]).some((r) => r.key === 'Instances')).toBe(true);
  });

  it('exports summary json and rows csv', () => {
    const file = createIvFileRecord(createSampleIvFile(), buildSampleIvBytes());
    const summary = exportIvSummaryJson(file);
    expect(summary).toContain('"parts"');
    expect(summary).toContain(file.parsed!.name);

    const rowsCsv = exportIvRowsCsv(file.parsed!);
    expect(rowsCsv.split('\n').length).toBe(file.parsed!.rows.length + 1);
  });

  it('soft-fails empty parseable dumps without crashing export guard', () => {
    const payload = '{"name":"Empty","parts":[],"assemblies":[],"instances":[]}';
    const emptyJson = new File([payload], 'empty.json', { lastModified: 1 });
    const bytes = new TextEncoder().encode(payload);
    const record = createIvFileRecord(emptyJson, bytes);
    expect(record.softFail).toBe(true);
    expect(canExportIv(record)).toBe(false);
  });

  it('resolves upload and error suggestions', () => {
    expect(resolveIvSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveIvSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveIvSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
