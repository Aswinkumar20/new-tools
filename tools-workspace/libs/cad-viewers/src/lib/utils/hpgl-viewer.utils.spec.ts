import { HG_ASCII_SAMPLE, HG_CSV_SAMPLE, HG_JSON_SAMPLE, HG_MARKDOWN_SAMPLE } from '../constants/hpgl-viewer-sample.data';
import {
  buildSampleHgBytes,
  filterHgCommands,
  filterHgLayers,
  filterHgRows,
  parseHgBytes,
  parseHgText
} from './hpgl-viewer-parse.utils';
import {
  buildHgCommandMetadata,
  buildHgLayerMetadata,
  buildHgMetadataRows,
  canExportHg,
  createHgFileRecord,
  createSampleHgFile,
  exportHgRowsCsv,
  exportHgSchemaCsv,
  exportHgSummaryJson,
  filterValidHgFiles,
  resolveHgSuggestion
} from './hpgl-viewer.utils';

describe('hpgl-viewer-parse.utils', () => {
  it('parses the outline ASCII HPGL sample', () => {
    const parsed = parseHgBytes(buildSampleHgBytes(), 'outline-plot.hpgl');
    expect(parsed.sourceKind).toBe('hpgl');
    expect(parsed.name).toBe('Outline Plot');
    expect(parsed.plotterVer).toBe('HPGL/2');
    expect(parsed.layers.some((l) => l.name === 'OUTLINE')).toBe(true);
    expect(parsed.commands.some((c) => c.type === 'polyline' && c.layer === 'OUTLINE')).toBe(true);
    expect(parsed.commands.some((c) => c.type === 'circle')).toBe(true);
    expect(parsed.commands.some((c) => c.type === 'text' && c.text === 'OUTLINE-PLOT')).toBe(true);
    expect(parsed.units).toBe('m');
  });

  it('parses JSON, CSV, Markdown, and ASCII dumps', () => {
    const json = parseHgText(HG_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'OUTLINE')).toBe(true);
    expect(json.commands.some((c) => c.name === 'hole1' && c.type === 'circle')).toBe(true);
    expect(json.commands.some((c) => c.name === 'pocket' && c.type === 'polyline')).toBe(true);

    const csv = parseHgText(HG_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.commands.some((c) => c.type === 'line')).toBe(true);

    const md = parseHgText(HG_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'OUTLINE')).toBe(true);

    const ascii = parseHgText(HG_ASCII_SAMPLE, 'shop.hpgl');
    expect(ascii.sourceKind).toBe('hpgl');
    expect(ascii.commands.some((c) => c.type === 'polyline' && c.points.length >= 4)).toBe(true);
  });

  it('filters layers, commands, and rows', () => {
    const parsed = parseHgBytes(buildSampleHgBytes(), 'outline-plot.hpgl');
    expect(filterHgLayers(parsed.layers, 'layer:OUTLINE').length).toBe(1);
    expect(filterHgCommands(parsed.commands, 'type:circle').length).toBe(1);
    expect(filterHgCommands(parsed.commands, 'type:polyline').length).toBeGreaterThanOrEqual(1);
    expect(filterHgRows(parsed.rows, 'type:text').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseHgText('')).toThrow(/empty/i);
    expect(() => parseHgText('hello world')).toThrow(/Not a HPGL/i);
    expect(() => parseHgBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.hpgl')).toThrow(/compress/i);
  });
});

describe('hpgl-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleHgFile();
    expect(file.name).toBe('outline-plot.hpgl');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample HPGL dump', () => {
    const file = createSampleHgFile();
    const record = createHgFileRecord(file, buildSampleHgBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.name === 'OUTLINE')).toBe(true);
    expect(record.parsed?.commands.some((c) => c.type === 'circle')).toBe(true);
    expect(record.parsed?.commands.some((c) => c.type === 'polyline')).toBe(true);
    expect(canExportHg(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseHgBytes(buildSampleHgBytes(), 'outline-plot.hpgl');
    const csv = exportHgSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,x,y');
    expect(csv).toContain('OUTLINE');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.commands.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleHgFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidHgFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.hpgl.gz', { lastModified: 2 }),
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

describe('canExportHg guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportHg({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportHg(null)).toBe(false);
  });
});

describe('hpgl-viewer metadata + exports + suggestions', () => {
  it('builds dataset and entity metadata rows', () => {
    const parsed = parseHgBytes(buildSampleHgBytes(), 'outline-plot.hpgl');
    const rows = buildHgMetadataRows(parsed);
    expect(rows.some((r) => r.key === 'Name' && r.value === parsed.name)).toBe(true);
    expect(rows.some((r) => r.key === 'Commands')).toBe(true);

    expect(buildHgLayerMetadata(parsed.layers[0]).some((r) => r.key === 'Color')).toBe(true);
    expect(buildHgCommandMetadata(parsed.commands[0]).some((r) => r.key === 'Type')).toBe(true);
  });

  it('exports summary json and rows csv', () => {
    const file = createHgFileRecord(createSampleHgFile(), buildSampleHgBytes());
    const summary = exportHgSummaryJson(file);
    expect(summary).toContain('"layers"');
    expect(summary).toContain(file.parsed!.name);

    const rowsCsv = exportHgRowsCsv(file.parsed!);
    expect(rowsCsv.split('\n').length).toBe(file.parsed!.rows.length + 1);
  });

  it('soft-fails empty parseable dumps without crashing export guard', () => {
    const payload = '{"name":"Empty","layers":[],"commands":[]}';
    const emptyJson = new File([payload], 'empty.json', { lastModified: 1 });
    const bytes = new TextEncoder().encode(payload);
    const record = createHgFileRecord(emptyJson, bytes);
    expect(record.softFail).toBe(true);
    expect(canExportHg(record)).toBe(false);
  });

  it('resolves upload and error suggestions', () => {
    expect(resolveHgSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveHgSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveHgSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
