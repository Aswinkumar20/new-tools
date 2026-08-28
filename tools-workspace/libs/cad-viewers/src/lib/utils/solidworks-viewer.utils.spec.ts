import { SW_ASCII_SAMPLE, SW_CSV_SAMPLE, SW_JSON_SAMPLE, SW_MARKDOWN_SAMPLE } from '../constants/solidworks-viewer-sample.data';
import {
  buildSampleSwBytes,
  filterSwAssemblies,
  filterSwParts,
  filterSwRows,
  parseSwBytes,
  parseSwText
} from './solidworks-viewer-parse.utils';
import {
  canExportSw,
  createSwFileRecord,
  createSampleSwFile,
  exportSwSchemaCsv,
  filterValidSwFiles,
  resolveSwSuggestion
} from './solidworks-viewer.utils';

describe('solidworks-viewer-parse.utils', () => {
  it('parses the valve body SW01 sample', () => {
    const parsed = parseSwBytes(buildSampleSwBytes(), 'valve-body.sldprt');
    expect(parsed.sourceKind).toBe('solidworks');
    expect(parsed.name).toBe('Valve Body');
    expect(parsed.parts.some((p) => p.name === 'body' && p.kind === 'box')).toBe(true);
    expect(parsed.parts.some((p) => p.name === 'stem' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.assemblies.some((a) => a.name === 'ValveBody')).toBe(true);
    expect(parsed.instances.some((inst) => inst.part === 'stem')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII SolidWorks', () => {
    const json = parseSwText(SW_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.parts.length).toBe(3);

    const csv = parseSwText(SW_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.assemblies.some((a) => a.name === 'ValveBody')).toBe(true);

    const md = parseSwText(SW_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.parts.some((p) => p.name === 'body')).toBe(true);

    const ascii = parseSwText(SW_ASCII_SAMPLE, 'shop.sldprt');
    expect(ascii.sourceKind).toBe('solidworks');
    expect(ascii.version).toContain('2024');
    expect(ascii.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.assemblies.some((a) => a.name === 'ValveBody')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'body-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseSwBytes(buildSampleSwBytes(), 'valve-body.sldprt');
    expect(filterSwParts(parsed.parts, 'kind:cylinder').length).toBe(1);
    expect(filterSwAssemblies(parsed.assemblies, 'assy:ValveBody').length).toBe(1);
    expect(filterSwRows(parsed.rows, 'name:stem').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseSwText('')).toThrow(/empty/i);
    expect(() => parseSwText('hello world')).toThrow(/Not a SolidWorks/i);
    expect(() => parseSwBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.sldprt')).toThrow(/compress/i);
    expect(() => parseSwBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.sldprt')).toThrow(/Binary SolidWorks/i);
  });
});

describe('solidworks-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleSwFile();
    expect(file.name).toBe('valve-body.sldprt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample SolidWorks dump', () => {
    const file = createSampleSwFile();
    const record = createSwFileRecord(file, buildSampleSwBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.parts.some((p) => p.name === 'stem')).toBe(true);
    expect(canExportSw(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseSwBytes(buildSampleSwBytes(), 'valve-body.sldprt');
    const csv = exportSwSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,part,assembly,value');
    expect(csv).toContain('ValveBody');
    expect(csv.split('\n').length).toBe(parsed.parts.length + parsed.assemblies.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleSwFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidSwFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.sldprt.gz', { lastModified: 2 }),
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

describe('canExportSw guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportSw({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportSw(null)).toBe(false);
  });
});

describe('resolveSwSuggestion', () => {
  it('returns sample-after-error, upload-or-sample, or null', () => {
    expect(resolveSwSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveSwSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveSwSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
