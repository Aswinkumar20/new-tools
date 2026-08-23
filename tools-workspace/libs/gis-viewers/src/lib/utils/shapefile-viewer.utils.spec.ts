import {
  SHAPEFILE_LARGE_FEATURE_WARNING,
  SHAPEFILE_SAMPLE_ZIP_BASE64
} from '../constants/shapefile-viewer.constants';
import {
  buildAttributeTable,
  buildShapefileStats,
  collectParseWarnings,
  countFeaturesByKind,
  createSampleShapefileZip,
  createShapefileFileRecord,
  exportFeaturesCsv,
  filterShapefileFeatures,
  filterValidShapefileFiles,
  formatPropertyValue,
  formatShapefileFileSize,
  normalizeShpjsResult,
  partitionShapefileSelection,
  resolveShapefileSuggestion,
  summarizeFeatures
} from './shapefile-viewer.utils';
import type { ShapefileFeatureCollection } from '../types/shapefile-viewer.types';

describe('shapefile-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatShapefileFileSize(500)).toBe('500 B');
    expect(formatShapefileFileSize(2048)).toBe('2.0 KB');

    const ok = new File([new Uint8Array([1, 2, 3])], 'demo.zip', { type: 'application/zip' });
    const empty = new File([], 'empty.shp', { type: 'application/octet-stream' });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const result = filterValidShapefileFiles([ok, empty, bad, ok]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.some((item) => item.name === 'demo.txt')).toBe(true);
    expect(result.rejected.some((item) => /empty/i.test(item.reason) || item.name === 'empty.shp')).toBe(
      true
    );
    expect(result.rejected.some((item) => /Duplicate/i.test(item.reason))).toBe(true);
  });

  it('partitions zip and part groups', () => {
    const zip = new File([new Uint8Array([1])], 'layer.zip', { type: 'application/zip' });
    const shp = new File([new Uint8Array([1])], 'roads.shp');
    const dbf = new File([new Uint8Array([1])], 'roads.dbf');
    const orphan = new File([new Uint8Array([1])], 'lonely.dbf');
    const { zips, groups, orphanErrors } = partitionShapefileSelection([zip, shp, dbf, orphan]);
    expect(zips).toHaveLength(1);
    expect(groups).toHaveLength(1);
    expect(groups[0].baseName).toBe('roads');
    expect(groups[0].files.shp?.name).toBe('roads.shp');
    expect(orphanErrors.some((item) => /require a \.shp/i.test(item.reason))).toBe(true);
  });

  it('formats property values without [object Object]', () => {
    expect(formatPropertyValue({ a: 1 })).toBe('{"a":1}');
    expect(formatPropertyValue(null)).toBe('');
    expect(formatPropertyValue('hi')).toBe('hi');
  });

  it('normalizes, summarizes, filters, and builds stats/table', () => {
    const data: ShapefileFeatureCollection = {
      type: 'FeatureCollection',
      fileName: 'sample_city',
      features: [
        {
          type: 'Feature',
          properties: { name: 'City Hall', category: 'civic', meta: { nested: true } },
          geometry: { type: 'Point', coordinates: [-122.4, 37.7] }
        },
        {
          type: 'Feature',
          properties: { name: 'Park', category: 'park' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-122.5, 37.7],
                [-122.4, 37.7],
                [-122.4, 37.8],
                [-122.5, 37.8],
                [-122.5, 37.7]
              ]
            ]
          }
        },
        {
          type: 'Feature',
          properties: { name: 'Route', category: 'route' },
          geometry: {
            type: 'LineString',
            coordinates: [
              [-122.4, 37.7],
              [-122.39, 37.79]
            ]
          }
        }
      ]
    };

    const features = summarizeFeatures(data);
    expect(features).toHaveLength(3);
    expect(features[0].preview).toContain('civic');
    expect(features[0].preview).not.toContain('[object Object]');

    const counts = countFeaturesByKind(features);
    expect(counts.point).toBe(1);
    expect(counts.line).toBe(1);
    expect(counts.polygon).toBe(1);
    expect(filterShapefileFeatures(features, 'point', '').length).toBe(1);
    expect(filterShapefileFeatures(features, 'all', 'ferry').length).toBe(0);
    expect(filterShapefileFeatures(features, 'all', 'city').length).toBe(1);

    const record = createShapefileFileRecord({
      name: 'sample.zip',
      size: 100,
      data,
      warnings: [],
      sourceKind: 'zip',
      hadDbf: true,
      hadPrj: true
    });
    const stats = buildShapefileStats(record, features);
    expect(stats.layerName).toBe('sample_city');
    expect(stats.points).toBe(1);
    expect(stats.bounds).not.toBeNull();

    const table = buildAttributeTable(features);
    expect(table.columns.length).toBeGreaterThan(0);
    expect(table.columns.length).toBeLessThanOrEqual(8);
    expect(table.rows.length).toBe(3);

    const csv = exportFeaturesCsv(features);
    expect(csv).toContain('id,name,geometry_type,kind');
    expect(csv).toContain('City Hall');
  });

  it('collects soft warnings for missing sidecars and large layers', () => {
    const soft = collectParseWarnings({
      featureCount: SHAPEFILE_LARGE_FEATURE_WARNING,
      hadDbf: false,
      hadPrj: false,
      sourceKind: 'parts'
    });
    expect(soft.some((w) => /dbf/i.test(w))).toBe(true);
    expect(soft.some((w) => /prj/i.test(w))).toBe(true);
    expect(soft.some((w) => /Large feature count/i.test(w))).toBe(true);
  });

  it('normalizes multi-layer shpjs results', () => {
    const merged = normalizeShpjsResult([
      {
        type: 'FeatureCollection',
        fileName: 'a',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [0, 0] }
          }
        ]
      },
      {
        type: 'FeatureCollection',
        fileName: 'b',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Point', coordinates: [1, 1] }
          }
        ]
      }
    ]);
    expect(merged.features).toHaveLength(2);
    expect(merged.fileName).toContain('a');
  });

  it('creates a non-empty sample shapefile zip blob', async () => {
    expect(SHAPEFILE_SAMPLE_ZIP_BASE64.length).toBeGreaterThan(100);
    const blob = await createSampleShapefileZip();
    expect(blob.size).toBeGreaterThan(100);
    expect(blob.type).toContain('zip');
  });

  it('builds a loaded record from a FeatureCollection parse result', () => {
    const data = normalizeShpjsResult({
      type: 'FeatureCollection',
      fileName: 'sample_city',
      features: [
        {
          type: 'Feature',
          properties: { name: 'City Hall', category: 'civic' },
          geometry: { type: 'Point', coordinates: [-122.4194, 37.7793] }
        }
      ]
    });
    const features = summarizeFeatures(data);
    expect(features[0].name).toBe('City Hall');
    const record = createShapefileFileRecord({
      name: 'sample-city.zip',
      size: 1200,
      data,
      warnings: collectParseWarnings({
        featureCount: features.length,
        hadDbf: true,
        hadPrj: true,
        sourceKind: 'zip'
      }),
      sourceKind: 'zip',
      hadDbf: true,
      hadPrj: true
    });
    expect(record.geojsonText).toContain('FeatureCollection');
    expect(record.layerName).toBe('sample_city');
  });

  it('resolves suggestions by state', () => {
    expect(
      resolveShapefileSuggestion({ hasFiles: false, hasError: false, featureCount: 0 })?.id
    ).toBe('shapefile-intro');
    expect(
      resolveShapefileSuggestion({ hasFiles: true, hasError: true, featureCount: 0 })?.id
    ).toBe('shapefile-fix');
    expect(
      resolveShapefileSuggestion({ hasFiles: true, hasError: false, featureCount: 800 })?.id
    ).toBe('shapefile-large');
  });
});
