import {
  AL_ASCII_COPPER_SAMPLE,
  AL_ASCII_SAMPLE,
  AL_CSV_SAMPLE,
  AL_JSON_SAMPLE,
  AL_MARKDOWN_SAMPLE
} from '../constants/altium-pcb-viewer-sample.data';
import {
  buildSampleAlBytes,
  filterAlCoppers,
  filterAlDesignators,
  filterAlLayers,
  filterAlNets,
  filterAlRows,
  parseAlBytes,
  parseAlText
} from './altium-pcb-viewer-parse.utils';
import {
  buildAlCopperMetadata,
  buildAlDesMetadata,
  buildAlLayerMetadata,
  buildAlMetadataRows,
  buildAlNetMetadata,
  canExportAl,
  createAlFileRecord,
  createSampleAlFile,
  exportAlRowsCsv,
  exportAlSchemaCsv,
  exportAlSummaryJson,
  filterValidAlFiles,
  resolveAlSuggestion
} from './altium-pcb-viewer.utils';

describe('altium-pcb-viewer-parse.utils', () => {
  it('parses the power module Altium dump sample', () => {
    const parsed = parseAlBytes(buildSampleAlBytes(), 'power-module.pcbdoc');
    expect(parsed.sourceKind).toBe('altium');
    expect(parsed.name).toBe('Power Module');
    expect(parsed.altiumVer).toBe('24.0');
    expect(parsed.layers.some((l) => l.name === 'TopLayer' && l.function === 'copper')).toBe(true);
    expect(parsed.layers.some((l) => l.function === 'silk')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'GND' && n.netClass === 'ground')).toBe(true);
    expect(parsed.nets.some((n) => n.name === 'VOUT')).toBe(true);
    expect(parsed.coppers.some((c) => c.type === 'track' && c.net === 'GND')).toBe(true);
    expect(parsed.coppers.some((c) => c.type === 'via')).toBe(true);
    expect(parsed.coppers.some((c) => c.type === 'pad' && c.net === 'VIN')).toBe(true);
    expect(parsed.coppers.some((c) => c.type === 'zone' && c.points.length >= 4)).toBe(true);
    expect(parsed.designators.some((d) => d.type === 'designator' && d.name === 'U1')).toBe(true);
    expect(parsed.designators.some((d) => d.type === 'text' && d.text === 'POWER-MODULE')).toBe(true);
    expect(parsed.designators.some((d) => d.type === 'component' && d.name === 'U1')).toBe(true);
  });

  it('parses CopperLayer ASCII, JSON, CSV, and Markdown dumps', () => {
    const copper = parseAlText(AL_ASCII_COPPER_SAMPLE, 'shop.pcbdoc');
    expect(copper.sourceKind).toBe('altium');
    expect(copper.coppers.some((c) => c.type === 'track')).toBe(true);
    expect(copper.coppers.some((c) => c.type === 'via')).toBe(true);
    expect(copper.designators.some((d) => d.type === 'designator' && d.name === 'U1')).toBe(true);
    expect(copper.designators.some((d) => d.text === 'POWER-MODULE')).toBe(true);

    const json = parseAlText(AL_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'TopLayer')).toBe(true);
    expect(json.coppers.some((c) => c.name === 'via1' && c.type === 'via')).toBe(true);
    expect(json.designators.some((d) => d.name === 'U1' && d.type === 'designator')).toBe(true);

    const csv = parseAlText(AL_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.coppers.some((c) => c.type === 'track')).toBe(true);
    expect(csv.designators.some((d) => d.type === 'designator')).toBe(true);

    const md = parseAlText(AL_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.nets.some((n) => n.name === 'GND')).toBe(true);

    const ascii = parseAlText(AL_ASCII_SAMPLE, 'shop.pcbdoc');
    expect(ascii.sourceKind).toBe('altium');
    expect(ascii.coppers.some((c) => c.type === 'zone' && c.points.length >= 4)).toBe(true);
  });

  it('filters stack, nets, copper, designators, and rows', () => {
    const parsed = parseAlBytes(buildSampleAlBytes(), 'power-module.pcbdoc');
    expect(filterAlLayers(parsed.layers, 'layer:TopLayer').length).toBe(1);
    expect(filterAlNets(parsed.nets, 'net:GND').length).toBe(1);
    expect(filterAlCoppers(parsed.coppers, 'type:via').length).toBe(1);
    expect(filterAlDesignators(parsed.designators, 'des:U1').length).toBeGreaterThanOrEqual(1);
    expect(filterAlRows(parsed.rows, 'net:VIN').length).toBeGreaterThanOrEqual(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseAlText('')).toThrow(/empty/i);
    expect(() => parseAlText('hello world')).toThrow(/Not an Altium/i);
    expect(() => parseAlBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.pcbdoc')).toThrow(/compress/i);
    expect(() => parseAlBytes(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0x00]), 'board.pcbdoc')).toThrow(/binary|ASCII/i);
  });
});

describe('altium-pcb-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleAlFile();
    expect(file.name).toBe('power-module.pcbdoc');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Altium dump', () => {
    const file = createSampleAlFile();
    const record = createAlFileRecord(file, buildSampleAlBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.function === 'copper')).toBe(true);
    expect(record.parsed?.designators.some((d) => d.type === 'designator')).toBe(true);
    expect(canExportAl(record)).toBe(true);
  });

  it('marks unparseable bytes as soft-fail without throwing', () => {
    const file = new File([new Uint8Array([1, 2, 3])], 'broken.pcbdoc', { lastModified: 9 });
    const record = createAlFileRecord(file, new Uint8Array([1, 2, 3]));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(record.warnings.length).toBeGreaterThan(0);
    expect(canExportAl(record)).toBe(false);
  });

  it('builds overview and entity metadata rows', () => {
    const parsed = parseAlBytes(buildSampleAlBytes(), 'power-module.pcbdoc');
    const meta = buildAlMetadataRows(parsed);
    expect(meta.some((r) => r.key === 'Name' && r.value === 'Power Module')).toBe(true);
    expect(meta.some((r) => r.key === 'Copper')).toBe(true);

    const layer = buildAlLayerMetadata(parsed.layers[0]);
    expect(layer.some((r) => r.key === 'Name')).toBe(true);

    const net = buildAlNetMetadata(parsed.nets[0]);
    expect(net.some((r) => r.key === 'Class')).toBe(true);

    const copper = buildAlCopperMetadata(parsed.coppers[0]);
    expect(copper.some((r) => r.key === 'Type')).toBe(true);

    const des = buildAlDesMetadata(parsed.designators[0]);
    expect(des.some((r) => r.key === 'Text')).toBe(true);
  });

  it('exports schema csv, rows csv, and summary json', () => {
    const file = createSampleAlFile();
    const record = createAlFileRecord(file, buildSampleAlBytes());
    const parsed = record.parsed!;

    const schema = exportAlSchemaCsv(parsed);
    expect(schema).toContain('kind,name,type,layer,net,x');
    expect(schema).toContain('GND');
    expect(schema).toContain('designator');
    expect(schema.split('\n').length).toBe(
      parsed.layers.length + parsed.nets.length + parsed.coppers.length + parsed.designators.length + 1
    );

    const rows = exportAlRowsCsv(parsed);
    expect(rows.split('\n')[0]).toContain('name');
    expect(rows.split('\n').length).toBe(parsed.rows.length + 1);

    const summary = JSON.parse(exportAlSummaryJson(record));
    expect(summary.file).toBe(file.name);
    expect(summary.layers.length).toBe(parsed.layers.length);
    expect(summary.coppers.length).toBe(parsed.coppers.length);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleAlFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidAlFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.pcbdoc.gz', { lastModified: 2 }),
      empty,
      huge,
      new File(['x'], 'board.prjpcb', { lastModified: 5 })
    ]);
    expect(accepted.length).toBe(2);
    expect(accepted.some((f) => f.name.endsWith('.prjpcb'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Duplicate'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
    expect(rejected.some((item) => /empty/i.test(item.reason))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('too large'))).toBe(true);
  });

  it('resolves contextual suggestions', () => {
    expect(resolveAlSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveAlSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveAlSuggestion({ hasFiles: true, hasError: false })).toBeNull();
    expect(resolveAlSuggestion({ hasFiles: true, hasError: true })?.action).toBe('sample');
  });
});

describe('canExportAl guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportAl({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportAl(null)).toBe(false);
  });
});
