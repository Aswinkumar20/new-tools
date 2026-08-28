import { GEO_MODEL_GMOD_SAMPLE, GEO_MODEL_SAMPLE } from '../constants/geological-model-sample.data';
import { parseGeologicalModelText } from './geological-model-parse.utils';
import {
  buildGeoModelMetadataRows,
  buildLayerMetadata,
  canExportGeoModel,
  createGeoModelFileRecord,
  createSampleGeoModelFile,
  exportGeoLayersCsv,
  exportGeoModelSummaryJson,
  exportGeoSectionCsv,
  filterGeoLayers,
  filterValidGeoModelFiles,
  resolveGeoModelSuggestion
} from './geological-model-viewer.utils';

describe('geological-model-parse.utils', () => {
  it('parses the sample JSON basin model', () => {
    const parsed = parseGeologicalModelText(GEO_MODEL_SAMPLE);
    expect(parsed.name).toContain('ETH Demo Basin');
    expect(parsed.sourceKind).toBe('json');
    expect(parsed.layers.length).toBe(6);
    expect(parsed.faults.length).toBe(2);
    expect(parsed.wells.map((w) => w.name)).toEqual(['ETH-1', 'ETH-2', 'ETH-3']);
    expect(parsed.layers[0].lithology).toBe('Sand');
  });

  it('parses GEOMODEL text', () => {
    const parsed = parseGeologicalModelText(GEO_MODEL_GMOD_SAMPLE);
    expect(parsed.sourceKind).toBe('gmod');
    expect(parsed.layers.length).toBe(3);
    expect(parsed.faults.length).toBe(1);
    expect(parsed.wells[0].name).toBe('ETH-1');
  });

  it('parses CSV stratigraphic columns', () => {
    const parsed = parseGeologicalModelText('layer,lithology,age,top,base,color\nSand,Sandstone,Q,0,50,#eab308\nShale,Shale,K,50,120,#64748b\n');
    expect(parsed.sourceKind).toBe('csv');
    expect(parsed.layers.map((l) => l.name)).toEqual(['Sand', 'Shale']);
    expect(parsed.warnings.some((w) => /CSV/i.test(w))).toBe(true);
  });

  it('rejects empty or unknown text', () => {
    expect(() => parseGeologicalModelText('')).toThrow(/empty/i);
    expect(() => parseGeologicalModelText('hello world')).toThrow(/Unrecognized|geological model/i);
  });
});

describe('geological-model-viewer.utils', () => {
  it('creates sample file with lastModified 0', () => {
    const file = createSampleGeoModelFile();
    expect(file.name).toBe('sample-basin.json');
    expect(file.lastModified).toBe(0);
  });

  it('creates a loaded file record from sample text', () => {
    const file = createSampleGeoModelFile();
    const record = createGeoModelFileRecord(file, new TextEncoder().encode(GEO_MODEL_SAMPLE));
    expect(record.softFail).toBe(false);
    expect(record.parsed?.layers.length).toBe(6);
    expect(canExportGeoModel(record)).toBe(true);
  });

  it('filters layers and exports csv', () => {
    const parsed = parseGeologicalModelText(GEO_MODEL_SAMPLE);
    expect(filterGeoLayers(parsed.layers, 'shale').some((l) => /shale/i.test(l.name))).toBe(true);
    const csv = exportGeoLayersCsv(parsed);
    expect(csv).toContain('id,name,lithology');
    expect(csv.split('\n').length).toBe(parsed.layers.length + 1);
  });

  it('rejects unsupported gzip and unknown files', () => {
    const sample = createSampleGeoModelFile();
    const { accepted, rejected } = filterValidGeoModelFiles([
      sample,
      new File(['x'], 'basin.sgy', { type: 'application/octet-stream', lastModified: 1 }),
      new File(['x'], 'basin.json.gz', { type: 'application/gzip', lastModified: 2 })
    ]);
    expect(accepted.length).toBe(1);
    expect(rejected.some((item) => item.reason.includes('Unsupported'))).toBe(true);
    expect(rejected.some((item) => item.reason.includes('gz') || item.reason.includes('Compressed'))).toBe(true);
  });

  it('soft-fails unparseable text and disables export', () => {
    const file = new File(['hello world'], 'bad.json', { lastModified: 3 });
    const record = createGeoModelFileRecord(file, new TextEncoder().encode('hello world'));
    expect(record.softFail).toBe(true);
    expect(record.parsed).toBeNull();
    expect(canExportGeoModel(record)).toBe(false);
  });

  it('builds metadata, summary, and section csv exports', () => {
    const file = createSampleGeoModelFile();
    const record = createGeoModelFileRecord(file, new TextEncoder().encode(GEO_MODEL_SAMPLE));
    expect(buildGeoModelMetadataRows(record.parsed!).some((r) => r.key === 'Layers')).toBe(true);
    expect(buildLayerMetadata(record.parsed!.layers[0]).some((r) => r.key === 'Name')).toBe(true);
    const summary = exportGeoModelSummaryJson(record);
    expect(summary).toContain('sample-basin.json');
    const section = exportGeoSectionCsv(record.parsed!);
    expect(section.split('\n').length).toBeGreaterThan(2);
  });

  it('resolves upload and sample suggestions', () => {
    expect(resolveGeoModelSuggestion({ hasFiles: false, hasError: false })?.id).toBe('upload-model');
    expect(resolveGeoModelSuggestion({ hasFiles: false, hasError: true })?.id).toBe('try-sample');
    expect(resolveGeoModelSuggestion({ hasFiles: true, hasError: false })).toBeNull();
  });
});
