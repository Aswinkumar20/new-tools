import { IG_ASCII_SAMPLE, IG_CSV_SAMPLE, IG_JSON_SAMPLE, IG_MARKDOWN_SAMPLE } from '../constants/iges-viewer-sample.data';
import {
  buildSampleIgBytes,
  filterIgEntities,
  filterIgRows,
  filterIgSurfaces,
  parseIgBytes,
  parseIgText
} from './iges-viewer-parse.utils';
import {
  canExportIg,
  createIgFileRecord,
  createSampleIgFile,
  exportIgSchemaCsv,
  filterValidIgFiles
} from './iges-viewer.utils';

describe('iges-viewer-parse.utils', () => {
  it('parses the impeller hub IG01 sample', () => {
    const parsed = parseIgBytes(buildSampleIgBytes(), 'impeller-hub.iges');
    expect(parsed.sourceKind).toBe('iges');
    expect(parsed.name).toBe('Impeller Hub');
    expect(parsed.surfaces.some((s) => s.name === 'hub' && s.kind === 'plane')).toBe(true);
    expect(parsed.surfaces.some((s) => s.name === 'bore' && s.kind === 'cylinder')).toBe(true);
    expect(parsed.entities.some((e) => e.text === 'ImpelHub01')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII IGES', () => {
    const json = parseIgText(IG_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.surfaces.length).toBe(4);

    const csv = parseIgText(IG_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.surfaces.some((s) => s.kind === 'cylinder')).toBe(true);

    const md = parseIgText(IG_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.surfaces.some((s) => s.name === 'hub')).toBe(true);

    const ascii = parseIgText(IG_ASCII_SAMPLE, 'shop.iges');
    expect(ascii.sourceKind).toBe('iges');
    expect(ascii.surfaces.some((s) => s.kind === 'cylinder')).toBe(true);
    expect(ascii.entities.some((e) => e.type === 'line')).toBe(true);
  });

  it('filters surfaces, entities, and rows', () => {
    const parsed = parseIgBytes(buildSampleIgBytes(), 'impeller-hub.iges');
    expect(filterIgSurfaces(parsed.surfaces, 'kind:cylinder').length).toBe(1);
    expect(filterIgEntities(parsed.entities, 'type:point').length).toBe(1);
    expect(filterIgRows(parsed.rows, 'name:bore').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseIgText('')).toThrow(/empty/i);
    expect(() => parseIgText('hello world')).toThrow(/Not an IGES/i);
    expect(() => parseIgBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.iges')).toThrow(/compress/i);
  });
});

describe('iges-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleIgFile();
    expect(file.name).toBe('impeller-hub.iges');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample IGES dump', () => {
    const file = createSampleIgFile();
    const record = createIgFileRecord(file, buildSampleIgBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.surfaces.some((s) => s.name === 'bore')).toBe(true);
    expect(canExportIg(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseIgBytes(buildSampleIgBytes(), 'impeller-hub.iges');
    const csv = exportIgSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,surface,x,y');
    expect(csv).toContain('bore');
    expect(csv.split('\n').length).toBe(parsed.surfaces.length + parsed.entities.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleIgFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidIgFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.iges.gz', { lastModified: 2 }),
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

describe('canExportIg guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportIg({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportIg(null)).toBe(false);
  });
});
