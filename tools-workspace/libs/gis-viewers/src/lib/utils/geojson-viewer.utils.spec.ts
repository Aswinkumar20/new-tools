import {
  buildGeoJsonStats,
  countFeaturesByKind,
  createGeoJsonFileRecord,
  exportFeaturesCsv,
  filterGeoJsonFeatures,
  filterValidGeoJsonFiles,
  formatGeoJsonFileSize,
  parseGeoJsonText,
  resolveGeoJsonSuggestion,
  summarizeFeatures
} from './geojson-viewer.utils';
import { GEOJSON_SAMPLE } from '../constants/geojson-viewer.constants';

describe('geojson-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatGeoJsonFileSize(500)).toBe('500 B');
    expect(formatGeoJsonFileSize(2048)).toBe('2.0 KB');

    const ok = new File(['{}'], 'demo.geojson', { type: 'application/geo+json' });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const result = filterValidGeoJsonFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].name).toBe('demo.txt');
  });

  it('parses sample GeoJSON and summarizes features', () => {
    const data = parseGeoJsonText(GEOJSON_SAMPLE);
    expect(data.type).toBe('FeatureCollection');

    const features = summarizeFeatures(data);
    expect(features.length).toBe(4);
    expect(features.some((item) => item.kind === 'point')).toBe(true);
    expect(features.some((item) => item.kind === 'line')).toBe(true);
    expect(features.some((item) => item.kind === 'polygon')).toBe(true);

    const stats = buildGeoJsonStats(data, features);
    expect(stats.title).toBe('Sample City Features');
    expect(stats.points).toBe(2);
    expect(stats.lines).toBe(1);
    expect(stats.polygons).toBe(1);
    expect(stats.bounds).not.toBeNull();

    const counts = countFeaturesByKind(features);
    expect(counts.all).toBe(4);
    expect(filterGeoJsonFeatures(features, 'point', '').length).toBe(2);
    expect(filterGeoJsonFeatures(features, 'all', 'ferry').length).toBeGreaterThan(0);

    const csv = exportFeaturesCsv(features);
    expect(csv).toContain('id,name,geometry_type,kind');
    expect(csv).toContain('City Hall');

    const record = createGeoJsonFileRecord(
      new File([GEOJSON_SAMPLE], 'sample.geojson'),
      GEOJSON_SAMPLE,
      data
    );
    expect(record.name).toBe('sample.geojson');
  });

  it('rejects non-GeoJSON JSON', () => {
    expect(() => parseGeoJsonText('{"employees":[]}')).toThrow(/not GeoJSON/i);
  });

  it('resolves suggestions by state', () => {
    expect(resolveGeoJsonSuggestion({ hasFiles: false, hasError: false, featureCount: 0 })?.id).toBe(
      'geojson-intro'
    );
    expect(resolveGeoJsonSuggestion({ hasFiles: true, hasError: true, featureCount: 0 })?.id).toBe(
      'geojson-fix'
    );
    expect(resolveGeoJsonSuggestion({ hasFiles: true, hasError: false, featureCount: 800 })?.id).toBe(
      'geojson-large'
    );
  });
});
