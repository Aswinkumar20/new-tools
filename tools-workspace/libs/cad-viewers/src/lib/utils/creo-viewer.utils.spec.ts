import { CR_ASCII_SAMPLE, CR_CSV_SAMPLE, CR_JSON_SAMPLE, CR_MARKDOWN_SAMPLE } from '../constants/creo-viewer-sample.data';
import {
  buildSampleCrBytes,
  filterCrAssemblies,
  filterCrParts,
  filterCrRows,
  parseCrBytes,
  parseCrText
} from './creo-viewer-parse.utils';
import {
  canExportCr,
  createCrFileRecord,
  createSampleCrFile,
  exportCrSchemaCsv,
  filterValidCrFiles
} from './creo-viewer.utils';

describe('creo-viewer-parse.utils', () => {
  it('parses the crank arm CR01 sample', () => {
    const parsed = parseCrBytes(buildSampleCrBytes(), 'crank-arm.prt');
    expect(parsed.sourceKind).toBe('creo');
    expect(parsed.name).toBe('Crank Arm');
    expect(parsed.parts.some((p) => p.name === 'arm' && p.kind === 'box')).toBe(true);
    expect(parsed.parts.some((p) => p.name === 'pin' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.assemblies.some((a) => a.name === 'CrankArm')).toBe(true);
    expect(parsed.instances.some((inst) => inst.part === 'pin')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII Creo', () => {
    const json = parseCrText(CR_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.parts.length).toBe(3);

    const csv = parseCrText(CR_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.assemblies.some((a) => a.name === 'CrankArm')).toBe(true);

    const md = parseCrText(CR_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.parts.some((p) => p.name === 'arm')).toBe(true);

    const ascii = parseCrText(CR_ASCII_SAMPLE, 'shop.prt');
    expect(ascii.sourceKind).toBe('creo');
    expect(ascii.version).toContain('11.0');
    expect(ascii.parts.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.assemblies.some((a) => a.name === 'CrankArm')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'arm-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseCrBytes(buildSampleCrBytes(), 'crank-arm.prt');
    expect(filterCrParts(parsed.parts, 'kind:cylinder').length).toBe(1);
    expect(filterCrAssemblies(parsed.assemblies, 'assy:CrankArm').length).toBe(1);
    expect(filterCrRows(parsed.rows, 'name:pin').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseCrText('')).toThrow(/empty/i);
    expect(() => parseCrText('hello world')).toThrow(/Not a Creo/i);
    expect(() => parseCrBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.prt')).toThrow(/compress/i);
    expect(() => parseCrBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.prt')).toThrow(/Binary Creo/i);
  });
});

describe('creo-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleCrFile();
    expect(file.name).toBe('crank-arm.prt');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Creo dump', () => {
    const file = createSampleCrFile();
    const record = createCrFileRecord(file, buildSampleCrBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.parts.some((p) => p.name === 'pin')).toBe(true);
    expect(canExportCr(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseCrBytes(buildSampleCrBytes(), 'crank-arm.prt');
    const csv = exportCrSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,part,assembly,value');
    expect(csv).toContain('CrankArm');
    expect(csv.split('\n').length).toBe(parsed.parts.length + parsed.assemblies.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleCrFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidCrFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.prt.gz', { lastModified: 2 }),
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

describe('canExportCr guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportCr({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportCr(null)).toBe(false);
  });
});
