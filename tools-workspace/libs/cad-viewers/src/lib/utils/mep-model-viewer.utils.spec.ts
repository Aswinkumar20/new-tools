import {
  ME_ASCII_SAMPLE,
  ME_CSV_SAMPLE,
  ME_JSON_SAMPLE,
  ME_MARKDOWN_SAMPLE,
  ME_STEP_SAMPLE
} from '../constants/mep-model-viewer-sample.data';
import {
  buildSampleMeBytes,
  filterMeDisciplines,
  filterMeElements,
  filterMeRows,
  filterMeSystems,
  parseMeBytes,
  parseMeText
} from './mep-model-viewer-parse.utils';
import { canExportMe, createMeFileRecord, createSampleMeFile, exportMeSchemaCsv, filterValidMeFiles } from './mep-model-viewer.utils';

describe('mep-model-viewer-parse.utils', () => {
  it('parses the hospital ME01 sample', () => {
    const parsed = parseMeBytes(buildSampleMeBytes(), 'hospital-hvac.ifc');
    expect(parsed.sourceKind).toBe('mep');
    expect(parsed.name).toBe('Hospital HVAC');
    expect(parsed.mepVer).toBe('1.0');
    expect(parsed.elements.some((e) => e.name === 'duct' && e.discipline === 'Mechanical')).toBe(true);
    expect(parsed.elements.some((e) => e.name === 'pipe' && e.discipline === 'Plumbing')).toBe(true);
    expect(parsed.elements.some((e) => e.name === 'tray' && e.system === 'Lighting')).toBe(true);
    expect(parsed.systems.some((s) => s.name === 'Lighting' && s.description.toLowerCase().includes('light'))).toBe(true);
    expect(parsed.disciplines.some((d) => d.name === 'Electrical')).toBe(true);
  });

  it('parses dump, STEP subset, JSON, CSV, and Markdown', () => {
    const ascii = parseMeText(ME_ASCII_SAMPLE, 'shop.ifc');
    expect(ascii.sourceKind).toBe('mep');
    expect(ascii.elements.some((e) => e.name === 'ahu')).toBe(true);
    expect(ascii.systems.some((s) => s.name === 'SupplyAir')).toBe(true);

    const step = parseMeText(ME_STEP_SAMPLE, 'shop.ifc');
    expect(step.sourceKind).toBe('mep');
    expect(step.elements.some((e) => e.name === 'duct')).toBe(true);
    expect(step.systems.some((s) => s.name === 'Lighting')).toBe(true);

    const json = parseMeText(ME_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.elements.length).toBe(4);

    const csv = parseMeText(ME_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.elements.some((e) => e.name === 'pipe')).toBe(true);
    expect(csv.disciplines.some((d) => d.name === 'Plumbing')).toBe(true);

    const md = parseMeText(ME_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.elements.some((e) => e.name === 'duct')).toBe(true);
  });

  it('filters elements, systems, disciplines, and rows', () => {
    const parsed = parseMeBytes(buildSampleMeBytes(), 'hospital-hvac.ifc');
    expect(filterMeElements(parsed.elements, 'disc:Mechanical').length).toBeGreaterThanOrEqual(1);
    expect(filterMeElements(parsed.elements, 'sys:Lighting').length).toBe(1);
    expect(filterMeSystems(parsed.systems, 'sys:SupplyAir').length).toBe(1);
    expect(filterMeDisciplines(parsed.disciplines, 'disc:Plumbing').length).toBe(1);
    expect(filterMeRows(parsed.rows, 'name:duct').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, zip, or unknown text', () => {
    expect(() => parseMeText('')).toThrow(/empty/i);
    expect(() => parseMeText('hello world')).toThrow(/Not an MEP/i);
    expect(() => parseMeBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.ifc')).toThrow(/compress/i);
    expect(() => parseMeBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]), 'model.ifc')).toThrow(/IFCZIP|ZIP/i);
  });
});

describe('mep-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleMeFile();
    expect(file.name).toBe('hospital-hvac.ifc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample MEP dump', () => {
    const file = createSampleMeFile();
    const record = createMeFileRecord(file, buildSampleMeBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.elements.some((e) => e.name === 'duct')).toBe(true);
    expect(canExportMe(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseMeBytes(buildSampleMeBytes(), 'hospital-hvac.ifc');
    const csv = exportMeSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,discipline,system,value');
    expect(csv).toContain('SupplyAir');
    expect(csv).toContain('Mechanical');
    expect(csv.split('\n').length).toBe(parsed.elements.length + parsed.systems.length + parsed.disciplines.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleMeFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidMeFiles([
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

describe('canExportMe guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportMe({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportMe(null)).toBe(false);
  });
});
