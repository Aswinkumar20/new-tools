import { DX_ASCII_SAMPLE, DX_CSV_SAMPLE, DX_JSON_SAMPLE, DX_MARKDOWN_SAMPLE } from '../constants/dxf-viewer-sample.data';
import {
  buildSampleDxBytes,
  filterDxEntities,
  filterDxLayers,
  filterDxRows,
  parseDxBytes,
  parseDxText
} from './dxf-viewer-parse.utils';
import {
  canExportDx,
  createDxFileRecord,
  createSampleDxFile,
  exportDxSchemaCsv,
  filterValidDxFiles,
  resolveDxSuggestion
} from './dxf-viewer.utils';

describe('dxf-viewer-parse.utils', () => {
  it('parses the bracket-plate ASCII DXF sample', () => {
    const parsed = parseDxBytes(buildSampleDxBytes(), 'bracket-plate.dxf');
    expect(parsed.sourceKind).toBe('dxf');
    expect(parsed.name).toBe('Bracket Plate');
    expect(parsed.acadVer).toBe('AC1027');
    expect(parsed.layers.some((l) => l.name === 'OUTLINE')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'line' && e.layer === 'OUTLINE')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'circle')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'lwpolyline')).toBe(true);
    expect(parsed.entities.some((e) => e.type === 'text' && e.text === 'BRACKET-PLATE')).toBe(true);
    expect(parsed.units).toBe('m');
  });

  it('parses JSON, CSV, Markdown, and ASCII dumps', () => {
    const json = parseDxText(DX_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'OUTLINE')).toBe(true);
    expect(json.entities.some((e) => e.name === 'hole1' && e.type === 'circle')).toBe(true);
    expect(json.entities.some((e) => e.name === 'plate' && e.type === 'lwpolyline')).toBe(true);

    const csv = parseDxText(DX_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.entities.some((e) => e.type === 'line')).toBe(true);

    const md = parseDxText(DX_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'OUTLINE')).toBe(true);

    const ascii = parseDxText(DX_ASCII_SAMPLE, 'shop.dxf');
    expect(ascii.sourceKind).toBe('dxf');
    expect(ascii.entities.some((e) => e.type === 'lwpolyline' && e.points.length >= 4)).toBe(true);
  });

  it('filters layers, entities, and rows', () => {
    const parsed = parseDxBytes(buildSampleDxBytes(), 'bracket-plate.dxf');
    expect(filterDxLayers(parsed.layers, 'layer:OUTLINE').length).toBe(1);
    expect(filterDxEntities(parsed.entities, 'type:circle').length).toBe(1);
    expect(filterDxEntities(parsed.entities, 'type:lwpolyline').length).toBe(1);
    expect(filterDxRows(parsed.rows, 'type:text').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseDxText('')).toThrow(/empty/i);
    expect(() => parseDxText('hello world')).toThrow(/Not a DXF/i);
    expect(() => parseDxBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.dxf')).toThrow(/compress/i);
  });
});

describe('dxf-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleDxFile();
    expect(file.name).toBe('bracket-plate.dxf');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample DXF dump', () => {
    const file = createSampleDxFile();
    const record = createDxFileRecord(file, buildSampleDxBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.name === 'OUTLINE')).toBe(true);
    expect(record.parsed?.entities.some((e) => e.type === 'circle')).toBe(true);
    expect(record.parsed?.entities.some((e) => e.type === 'lwpolyline')).toBe(true);
    expect(canExportDx(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseDxBytes(buildSampleDxBytes(), 'bracket-plate.dxf');
    const csv = exportDxSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,x,y');
    expect(csv).toContain('OUTLINE');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.entities.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleDxFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidDxFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.dxf.gz', { lastModified: 2 }),
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

describe('canExportDx guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportDx({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportDx(null)).toBe(false);
  });
});

describe('resolveDxSuggestion', () => {
  it('returns upload-or-sample, sample-after-error, or null', () => {
    expect(resolveDxSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveDxSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveDxSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
