import {
  buildKmlStats,
  collectKmlWarnings,
  countFeaturesByKind,
  createKmlFileRecord,
  exportFeaturesCsv,
  filterKmlFeatures,
  filterValidKmlFiles,
  formatKmlFileSize,
  formatPropertyValue,
  parseKmlText,
  resolveKmlSuggestion,
  summarizeFeatures
} from './kml-viewer.utils';
import { KML_SAMPLE } from '../constants/kml-viewer.constants';

describe('kml-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatKmlFileSize(500)).toBe('500 B');
    expect(formatKmlFileSize(2048)).toBe('2.0 KB');

    const ok = new File(['<kml></kml>'], 'demo.kml', {
      type: 'application/vnd.google-earth.kml+xml'
    });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const empty = new File([], 'empty.kml', { type: 'application/vnd.google-earth.kml+xml' });
    const result = filterValidKmlFiles([ok, bad, empty]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((item) => item.name)).toEqual(
      expect.arrayContaining(['demo.txt', 'empty.kml'])
    );
  });

  it('parses sample KML via togeojson and summarizes features', async () => {
    const { data, documentTitle, warnings } = await parseKmlText(KML_SAMPLE);
    expect(data.type).toBe('FeatureCollection');
    expect(documentTitle).toBe('Sample Bay Area Tour');
    expect(data.features.length).toBe(4);
    expect(warnings.some((item) => /empty folder/i.test(item))).toBe(true);

    const features = summarizeFeatures(data);
    expect(features.length).toBe(4);
    expect(features.some((item) => item.kind === 'point')).toBe(true);
    expect(features.some((item) => item.kind === 'line')).toBe(true);
    expect(features.some((item) => item.kind === 'polygon')).toBe(true);
    expect(features.find((item) => item.name === 'Golden Gate Bridge')?.description).toContain(
      'suspension'
    );

    const stats = buildKmlStats(data, features, documentTitle);
    expect(stats.title).toBe('Sample Bay Area Tour');
    expect(stats.points).toBe(2);
    expect(stats.lines).toBe(1);
    expect(stats.polygons).toBe(1);
    expect(stats.bounds).not.toBeNull();

    const counts = countFeaturesByKind(features);
    expect(counts.all).toBe(4);
    expect(filterKmlFeatures(features, 'point', '').length).toBe(2);
    expect(filterKmlFeatures(features, 'all', 'ferry').length).toBeGreaterThan(0);

    const csv = exportFeaturesCsv(features);
    expect(csv).toContain('id,name,geometry_type,kind,description');
    expect(csv).toContain('Golden Gate Bridge');

    const record = createKmlFileRecord(
      new File([KML_SAMPLE], 'sample.kml', { lastModified: 0 }),
      KML_SAMPLE,
      data,
      documentTitle,
      warnings
    );
    expect(record.name).toBe('sample.kml');
    expect(record.id).toContain('sample.kml');
  });

  it('rejects invalid KML roots and empty feature sets', async () => {
    await expect(parseKmlText('')).rejects.toThrow(/empty/i);
    await expect(parseKmlText('<notkml></notkml>')).rejects.toThrow(/<kml>/i);
    await expect(
      parseKmlText(`<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document/></kml>`)
    ).rejects.toThrow(/no drawable features/i);
  });

  it('formats nested property values without [object Object]', () => {
    expect(formatPropertyValue({ a: 1 })).toBe('{"a":1}');
    expect(formatPropertyValue(['x'])).toBe('["x"]');
  });

  it('warns when styles are missing', () => {
    const doc = new DOMParser().parseFromString(
      `<?xml version="1.0"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><Folder><name>Empty</name></Folder></Document></kml>`,
      'application/xml'
    );
    const root = doc.documentElement;
    const warnings = collectKmlWarnings(root, 600);
    expect(warnings.some((item) => /no style/i.test(item))).toBe(true);
    expect(warnings.some((item) => /empty folder/i.test(item))).toBe(true);
    expect(warnings.some((item) => /large feature count/i.test(item))).toBe(true);
  });

  it('resolves suggestions by state', () => {
    expect(resolveKmlSuggestion({ hasFiles: false, hasError: false, featureCount: 0 })?.id).toBe(
      'kml-intro'
    );
    expect(resolveKmlSuggestion({ hasFiles: true, hasError: true, featureCount: 0 })?.id).toBe(
      'kml-fix'
    );
    expect(resolveKmlSuggestion({ hasFiles: true, hasError: false, featureCount: 800 })?.id).toBe(
      'kml-large'
    );
  });
});
