import { RH_ASCII_SAMPLE, RH_CSV_SAMPLE, RH_JSON_SAMPLE, RH_MARKDOWN_SAMPLE } from '../constants/rhino-3dm-viewer-sample.data';
import {
  buildSampleRhBytes,
  filterRhLayers,
  filterRhSurfaces,
  filterRhRows,
  parseRhBytes,
  parseRhText
} from './rhino-3dm-viewer-parse.utils';
import {
  canExportRh,
  createRhFileRecord,
  createSampleRhFile,
  exportRhSchemaCsv,
  filterValidRhFiles,
  resolveRhSuggestion
} from './rhino-3dm-viewer.utils';

describe('rhino-3dm-viewer-parse.utils', () => {
  it('parses the faucet RH01 sample', () => {
    const parsed = parseRhBytes(buildSampleRhBytes(), 'faucet-body.3dm');
    expect(parsed.sourceKind).toBe('rhino');
    expect(parsed.name).toBe('Faucet Body');
    expect(parsed.surfaces.some((p) => p.name === 'bowl' && p.kind === 'box')).toBe(true);
    expect(parsed.surfaces.some((p) => p.name === 'aerator' && p.kind === 'cylinder')).toBe(true);
    expect(parsed.layers.some((a) => a.name === 'FaucetBody')).toBe(true);
    expect(parsed.instances.some((inst) => inst.surface === 'aerator')).toBe(true);
  });

  it('parses JSON, CSV, Markdown, and ASCII Rhino', () => {
    const json = parseRhText(RH_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.surfaces.length).toBe(3);

    const csv = parseRhText(RH_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.surfaces.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(csv.layers.some((a) => a.name === 'FaucetBody')).toBe(true);

    const md = parseRhText(RH_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.surfaces.some((p) => p.name === 'bowl')).toBe(true);

    const ascii = parseRhText(RH_ASCII_SAMPLE, 'shop.3dm');
    expect(ascii.sourceKind).toBe('rhino');
    expect(ascii.version).toContain('8.0');
    expect(ascii.surfaces.some((p) => p.kind === 'cylinder')).toBe(true);
    expect(ascii.layers.some((a) => a.name === 'FaucetBody')).toBe(true);
    expect(ascii.instances.some((inst) => inst.name === 'bowl-1')).toBe(true);
  });

  it('filters parts, assemblies, and rows', () => {
    const parsed = parseRhBytes(buildSampleRhBytes(), 'faucet-body.3dm');
    expect(filterRhSurfaces(parsed.surfaces, 'kind:cylinder').length).toBe(1);
    expect(filterRhLayers(parsed.layers, 'layer:FaucetBody').length).toBe(1);
    expect(filterRhRows(parsed.rows, 'name:aerator').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseRhText('')).toThrow(/empty/i);
    expect(() => parseRhText('hello world')).toThrow(/Not a Rhino/i);
    expect(() => parseRhBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.3dm')).toThrow(/compress/i);
    expect(() => parseRhBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0, 0, 0]), 'part.3dm')).toThrow(/Binary Rhino/i);
  });
});

describe('rhino-3dm-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleRhFile();
    expect(file.name).toBe('faucet-body.3dm');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Rhino dump', () => {
    const file = createSampleRhFile();
    const record = createRhFileRecord(file, buildSampleRhBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.surfaces.some((p) => p.name === 'aerator')).toBe(true);
    expect(canExportRh(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseRhBytes(buildSampleRhBytes(), 'faucet-body.3dm');
    const csv = exportRhSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,surface,layer,value');
    expect(csv).toContain('FaucetBody');
    expect(csv.split('\n').length).toBe(parsed.surfaces.length + parsed.layers.length + parsed.instances.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleRhFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidRhFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'part.3dm.gz', { lastModified: 2 }),
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

describe('canExportRh guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportRh({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportRh(null)).toBe(false);
  });
});

describe('resolveRhSuggestion', () => {
  it('prefers error sample, then upload-or-sample when empty', () => {
    expect(resolveRhSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveRhSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveRhSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
