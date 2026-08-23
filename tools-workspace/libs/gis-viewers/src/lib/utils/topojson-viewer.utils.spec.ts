import {
  buildTopoJsonStats,
  collectTopoJsonWarnings,
  convertTopology,
  countFeaturesByKind,
  createTopoJsonFileRecord,
  exportConvertedGeoJson,
  exportFeaturesCsv,
  featuresForObjectFilter,
  filterTopoJsonFeatures,
  filterValidTopoJsonFiles,
  formatTopoJsonFileSize,
  parseAndConvertTopoJson,
  parseTopoJsonText,
  resolveTopoJsonSuggestion,
  summarizeFeatures
} from './topojson-viewer.utils';
import { TOPOJSON_SAMPLE } from '../constants/topojson-viewer.constants';

describe('topojson-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatTopoJsonFileSize(500)).toBe('500 B');
    expect(formatTopoJsonFileSize(2048)).toBe('2.0 KB');

    const ok = new File(['{}'], 'demo.topojson', { type: 'application/json' });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const empty = new File([], 'empty.json', { type: 'application/json' });
    const result = filterValidTopoJsonFiles([ok, bad, empty]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((item) => item.name)).toEqual(
      expect.arrayContaining(['demo.txt', 'empty.json'])
    );
  });

  it('parses sample Topology and converts features via topojson-client', async () => {
    const topology = parseTopoJsonText(TOPOJSON_SAMPLE);
    expect(topology.type).toBe('Topology');
    expect(Object.keys(topology.objects).length).toBe(4);
    expect(topology.arcs.length).toBe(2);

    const converted = await convertTopology(topology);
    expect(converted.combined.features.length).toBe(4);
    expect(converted.objectNames).toEqual(
      expect.arrayContaining(['landmarks', 'routes', 'parks', 'empty-layer'])
    );
    expect(converted.warnings.some((item) => /empty object/i.test(item))).toBe(true);
    expect(converted.warnings.some((item) => /no transform/i.test(item))).toBe(true);

    const record = createTopoJsonFileRecord(
      new File([TOPOJSON_SAMPLE], 'sample.topojson', { lastModified: 0 }),
      TOPOJSON_SAMPLE,
      topology,
      converted.objectNames,
      converted.objectInfo,
      converted.objectCollections,
      converted.combined,
      converted.warnings
    );

    const allFeatures = featuresForObjectFilter(record, 'all');
    expect(allFeatures.length).toBe(4);
    expect(featuresForObjectFilter(record, 'landmarks').length).toBe(2);
    expect(featuresForObjectFilter(record, 'routes').length).toBe(1);
    expect(featuresForObjectFilter(record, 'parks').length).toBe(1);
    expect(featuresForObjectFilter(record, 'empty-layer').length).toBe(0);

    const features = summarizeFeatures(allFeatures);
    expect(features.some((item) => item.kind === 'point')).toBe(true);
    expect(features.some((item) => item.kind === 'line')).toBe(true);
    expect(features.some((item) => item.kind === 'polygon')).toBe(true);
    expect(features.find((item) => item.name === 'City Hall')?.objectName).toBe('landmarks');

    const stats = buildTopoJsonStats(record, features, allFeatures);
    expect(stats.objects).toBe(4);
    expect(stats.arcs).toBe(2);
    expect(stats.points).toBe(2);
    expect(stats.lines).toBe(1);
    expect(stats.polygons).toBe(1);
    expect(stats.bounds).not.toBeNull();
    expect(stats.bbox).not.toBeNull();
    expect(stats.hasTransform).toBe(false);

    const counts = countFeaturesByKind(features);
    expect(counts.all).toBe(4);
    expect(filterTopoJsonFeatures(features, 'point', '').length).toBe(2);
    expect(filterTopoJsonFeatures(features, 'all', 'ferry').length).toBeGreaterThan(0);
    expect(filterTopoJsonFeatures(features, 'all', 'landmarks').length).toBe(2);

    const csv = exportFeaturesCsv(features);
    expect(csv).toContain('id,name,object,geometry_type,kind');
    expect(csv).toContain('City Hall');

    const geojson = JSON.parse(exportConvertedGeoJson(record, 'all'));
    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features.length).toBe(4);
  });

  it('parseAndConvertTopoJson loads the sample end-to-end', async () => {
    const result = await parseAndConvertTopoJson(TOPOJSON_SAMPLE);
    expect(result.topology.type).toBe('Topology');
    expect(result.combined.features.length).toBe(4);
  });

  it('rejects invalid Topology documents', async () => {
    expect(() => parseTopoJsonText('')).toThrow(/empty/i);
    expect(() => parseTopoJsonText('{"employees":[]}')).toThrow(/not Topology/i);
    expect(() => parseTopoJsonText('{"type":"Topology"}')).toThrow(/objects/i);
    expect(() =>
      parseTopoJsonText('{"type":"Topology","objects":{},"arcs":[]}')
    ).not.toThrow();
    await expect(
      convertTopology({ type: 'Topology', objects: {}, arcs: [] })
    ).rejects.toThrow(/empty/i);
    await expect(
      convertTopology({
        type: 'Topology',
        objects: { bare: { type: 'GeometryCollection', geometries: [] } },
        arcs: []
      })
    ).rejects.toThrow(/no convertible features/i);
  });

  it('collects soft warnings', () => {
    const warnings = collectTopoJsonWarnings(
      { type: 'Topology', objects: {}, arcs: [] },
      [{ name: 'empty-layer', featureCount: 0, empty: true }],
      600
    );
    expect(warnings.some((item) => /no transform/i.test(item))).toBe(true);
    expect(warnings.some((item) => /empty object/i.test(item))).toBe(true);
    expect(warnings.some((item) => /large feature count/i.test(item))).toBe(true);
  });

  it('resolves suggestions by state', () => {
    expect(
      resolveTopoJsonSuggestion({ hasFiles: false, hasError: false, featureCount: 0 })?.id
    ).toBe('topojson-intro');
    expect(
      resolveTopoJsonSuggestion({ hasFiles: true, hasError: true, featureCount: 0 })?.id
    ).toBe('topojson-fix');
    expect(
      resolveTopoJsonSuggestion({ hasFiles: true, hasError: false, featureCount: 800 })?.id
    ).toBe('topojson-large');
  });
});
