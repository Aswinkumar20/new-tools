import {
  GB_ASCII_SAMPLE,
  GB_CSV_SAMPLE,
  GB_JSON_SAMPLE,
  GB_MARKDOWN_SAMPLE,
  GB_RS274X_SAMPLE
} from '../constants/gerber-file-viewer-sample.data';
import {
  buildSampleGbBytes,
  filterGbFeatures,
  filterGbLayers,
  filterGbRows,
  parseGbBytes,
  parseGbText
} from './gerber-file-viewer-parse.utils';
import {
  buildGbFeatureMetadata,
  buildGbLayerMetadata,
  buildGbMetadataRows,
  canExportGb,
  createGbFileRecord,
  createSampleGbFile,
  exportGbRowsCsv,
  exportGbSchemaCsv,
  exportGbSummaryJson,
  filterValidGbFiles,
  resolveGbSuggestion
} from './gerber-file-viewer.utils';

describe('gerber-file-viewer-parse.utils', () => {
  it('parses the RF shield Gerber dump sample', () => {
    const parsed = parseGbBytes(buildSampleGbBytes(), 'rf-shield.gbr');
    expect(parsed.sourceKind).toBe('gerber');
    expect(parsed.name).toBe('RF Shield');
    expect(parsed.gerberVer).toBe('RS-274X');
    expect(parsed.layers.some((l) => l.name === 'TOP_COPPER' && l.function === 'copper')).toBe(true);
    expect(parsed.layers.some((l) => l.function === 'silk')).toBe(true);
    expect(parsed.layers.some((l) => l.function === 'mask')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'flash' && f.layer === 'TOP_COPPER')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'polygon')).toBe(true);
    expect(parsed.features.some((f) => f.type === 'text' && f.text === 'RF-SHIELD')).toBe(true);
  });

  it('parses RS-274X, JSON, CSV, and Markdown dumps', () => {
    const rs = parseGbText(GB_RS274X_SAMPLE, 'shop.gbr');
    expect(rs.sourceKind).toBe('gerber');
    expect(rs.features.some((f) => f.type === 'line')).toBe(true);
    expect(rs.features.some((f) => f.type === 'flash')).toBe(true);

    const json = parseGbText(GB_JSON_SAMPLE, 'shop.json');
    expect(json.sourceKind).toBe('json');
    expect(json.layers.some((l) => l.name === 'TOP_COPPER')).toBe(true);
    expect(json.features.some((f) => f.name === 'via1' && f.type === 'flash')).toBe(true);
    expect(json.features.some((f) => f.name === 'pour' && f.type === 'polygon')).toBe(true);

    const csv = parseGbText(GB_CSV_SAMPLE, 'shop.csv');
    expect(csv.sourceKind).toBe('csv');
    expect(csv.features.some((f) => f.type === 'line')).toBe(true);

    const md = parseGbText(GB_MARKDOWN_SAMPLE, 'shop.md');
    expect(md.sourceKind).toBe('markdown');
    expect(md.layers.some((l) => l.name === 'TOP_COPPER')).toBe(true);

    const ascii = parseGbText(GB_ASCII_SAMPLE, 'shop.gbr');
    expect(ascii.sourceKind).toBe('gerber');
    expect(ascii.features.some((f) => f.type === 'polygon' && f.points.length >= 4)).toBe(true);
  });

  it('filters layers, features, and rows', () => {
    const parsed = parseGbBytes(buildSampleGbBytes(), 'rf-shield.gbr');
    expect(filterGbLayers(parsed.layers, 'layer:TOP_COPPER').length).toBe(1);
    expect(filterGbLayers(parsed.layers, 'func:mask').length).toBe(1);
    expect(filterGbFeatures(parsed.features, 'type:flash').length).toBeGreaterThanOrEqual(1);
    expect(filterGbRows(parsed.rows, 'type:text').length).toBe(1);
  });

  it('rejects empty, gzip, or unknown text', () => {
    expect(() => parseGbText('')).toThrow(/empty/i);
    expect(() => parseGbText('hello world')).toThrow(/Not a Gerber/i);
    expect(() => parseGbBytes(new Uint8Array([0x1f, 0x8b, 0x08]), 'g.gbr')).toThrow(/compress/i);
  });
});

describe('gerber-file-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGbFile();
    expect(file.name).toBe('rf-shield.gbr');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample Gerber dump', () => {
    const file = createSampleGbFile();
    const record = createGbFileRecord(file, buildSampleGbBytes());
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.some((l) => l.function === 'copper')).toBe(true);
    expect(record.parsed?.features.some((f) => f.type === 'flash')).toBe(true);
    expect(canExportGb(record)).toBe(true);
  });

  it('exports schema csv', () => {
    const parsed = parseGbBytes(buildSampleGbBytes(), 'rf-shield.gbr');
    const csv = exportGbSchemaCsv(parsed);
    expect(csv).toContain('kind,name,type,layer,x,y');
    expect(csv).toContain('TOP_COPPER');
    expect(csv.split('\n').length).toBe(parsed.layers.length + parsed.features.length + 1);
  });

  it('rejects empty, huge, gzip, wrong extension, and duplicates', () => {
    const sample = createSampleGbFile();
    const empty = new File(['x'], sample.name, { lastModified: 3 });
    Object.defineProperty(empty, 'size', { value: 0 });
    const huge = new File(['x'], sample.name, { lastModified: 4 });
    Object.defineProperty(huge, 'size', { value: 65 * 1024 * 1024 });
    const { accepted, rejected } = filterValidGbFiles([
      sample,
      sample,
      new File(['x'], 'note.doc', { lastModified: 1 }),
      new File(['x'], 'plan.gbr.gz', { lastModified: 2 }),
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

describe('canExportGb guards', () => {
  it('disables export on soft-fail', () => {
    expect(canExportGb({ parsed: { name: 'x' }, softFail: true } as never)).toBe(false);
    expect(canExportGb(null)).toBe(false);
  });
});

describe('gerber-file-viewer metadata + exports + suggestions', () => {
  it('builds dataset and entity metadata rows', () => {
    const parsed = parseGbBytes(buildSampleGbBytes(), 'rf-shield.gbr');
    const rows = buildGbMetadataRows(parsed);
    expect(rows.some((r) => r.key === 'Name' && r.value === parsed.name)).toBe(true);
    expect(rows.some((r) => r.key === 'Features')).toBe(true);

    expect(buildGbLayerMetadata(parsed.layers[0]).some((r) => r.key === 'Function')).toBe(true);
    expect(buildGbFeatureMetadata(parsed.features[0]).some((r) => r.key === 'Type')).toBe(true);
  });

  it('exports summary json and rows csv', () => {
    const file = createGbFileRecord(createSampleGbFile(), buildSampleGbBytes());
    const summary = exportGbSummaryJson(file);
    expect(summary).toContain('"layers"');
    expect(summary).toContain(file.parsed!.name);

    const rowsCsv = exportGbRowsCsv(file.parsed!);
    expect(rowsCsv.split('\n').length).toBe(file.parsed!.rows.length + 1);
  });

  it('soft-fails empty parseable dumps without crashing export guard', () => {
    const payload = '{"name":"Empty","layers":[],"features":[]}';
    const emptyJson = new File([payload], 'empty.json', { lastModified: 1 });
    const bytes = new TextEncoder().encode(payload);
    const record = createGbFileRecord(emptyJson, bytes);
    expect(record.softFail).toBe(true);
    expect(canExportGb(record)).toBe(false);
  });

  it('resolves upload and error suggestions', () => {
    expect(resolveGbSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-or-sample');
    expect(resolveGbSuggestion({ hasFiles: false, hasError: true })?.id).toBe('sample-after-error');
    expect(resolveGbSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
