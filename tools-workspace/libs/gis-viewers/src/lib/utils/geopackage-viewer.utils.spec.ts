import {
  collectGeoPackageWarnings,
  filterValidGeoPackageFiles,
  formatGeoPackageFileSize,
  geometryKind,
  parseGeoPackageGeometry,
  resolveGeoPackageSuggestion,
  summarizeFeatures,
  filterGeoPackageFeatures,
  countFeaturesByKind,
  exportFeaturesCsv,
  buildAttributeTable
} from './geopackage-viewer.utils';
import type { GeoPackageFeature, GeoPackageLayerInfo } from '../types/geopackage-viewer.types';

function writeFloat64LE(view: DataView, offset: number, value: number): void {
  view.setFloat64(offset, value, true);
}

/** Build a minimal GeoPackageBinary Point blob (no envelope). */
function buildGpPoint(x: number, y: number, srsId = 4326): Uint8Array {
  const buf = new Uint8Array(8 + 5 + 16);
  const view = new DataView(buf.buffer);
  buf[0] = 0x47; // G
  buf[1] = 0x50; // P
  buf[2] = 0; // version
  buf[3] = 0x01; // flags: LE, no envelope
  view.setInt32(4, srsId, true);
  buf[8] = 1; // WKB LE
  view.setUint32(9, 1, true); // Point
  writeFloat64LE(view, 13, x);
  writeFloat64LE(view, 21, y);
  return buf;
}

function buildWkbLineString(coords: Array<[number, number]>): Uint8Array {
  const buf = new Uint8Array(5 + 4 + coords.length * 16);
  const view = new DataView(buf.buffer);
  buf[0] = 1;
  view.setUint32(1, 2, true);
  view.setUint32(5, coords.length, true);
  let offset = 9;
  for (const [x, y] of coords) {
    writeFloat64LE(view, offset, x);
    writeFloat64LE(view, offset + 8, y);
    offset += 16;
  }
  // Wrap in GP header
  const out = new Uint8Array(8 + buf.length);
  const outView = new DataView(out.buffer);
  out[0] = 0x47;
  out[1] = 0x50;
  out[2] = 0;
  out[3] = 0x01;
  outView.setInt32(4, 4326, true);
  out.set(buf, 8);
  return out;
}

function buildWkbPolygon(ring: Array<[number, number]>): Uint8Array {
  const buf = new Uint8Array(5 + 4 + 4 + ring.length * 16);
  const view = new DataView(buf.buffer);
  buf[0] = 1;
  view.setUint32(1, 3, true);
  view.setUint32(5, 1, true); // 1 ring
  view.setUint32(9, ring.length, true);
  let offset = 13;
  for (const [x, y] of ring) {
    writeFloat64LE(view, offset, x);
    writeFloat64LE(view, offset + 8, y);
    offset += 16;
  }
  const out = new Uint8Array(8 + buf.length);
  const outView = new DataView(out.buffer);
  out[0] = 0x47;
  out[1] = 0x50;
  out[2] = 0;
  out[3] = 0x01;
  outView.setInt32(4, 4326, true);
  out.set(buf, 8);
  return out;
}

describe('geopackage-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatGeoPackageFileSize(500)).toBe('500 B');
    expect(formatGeoPackageFileSize(2048)).toBe('2.0 KB');

    const ok = new File([new Uint8Array([1, 2, 3])], 'demo.gpkg', {
      type: 'application/geopackage+sqlite3'
    });
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const empty = new File([], 'empty.gpkg', { type: 'application/geopackage+sqlite3' });
    const dup = new File([new Uint8Array([1, 2, 3])], 'demo.gpkg', {
      type: 'application/geopackage+sqlite3',
      lastModified: ok.lastModified
    });
    // Force same lastModified for dup key
    Object.defineProperty(dup, 'lastModified', { value: ok.lastModified });
    Object.defineProperty(dup, 'size', { value: ok.size });

    const result = filterValidGeoPackageFiles([ok, bad, empty, dup]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected.map((item) => item.name)).toEqual(
      expect.arrayContaining(['demo.txt', 'empty.gpkg', 'demo.gpkg'])
    );
  });

  it('parses GeoPackage Point / LineString / Polygon blobs', () => {
    const point = parseGeoPackageGeometry(buildGpPoint(-122.4194, 37.7793));
    expect(point).toEqual({
      type: 'Point',
      coordinates: [-122.4194, 37.7793]
    });

    const line = parseGeoPackageGeometry(
      buildWkbLineString([
        [-122.42, 37.78],
        [-122.41, 37.79]
      ])
    );
    expect(line?.type).toBe('LineString');
    expect((line as GeoJSON.LineString).coordinates).toHaveLength(2);

    const polygon = parseGeoPackageGeometry(
      buildWkbPolygon([
        [0, 0],
        [1, 0],
        [1, 1],
        [0, 1],
        [0, 0]
      ])
    );
    expect(polygon?.type).toBe('Polygon');
    expect((polygon as GeoJSON.Polygon).coordinates[0]).toHaveLength(5);
  });

  it('parses MultiPoint / MultiLineString / MultiPolygon blobs', () => {
    // MultiPoint: GP header + WKB MultiPoint with 2 embedded points
    const mp = new Uint8Array(8 + 5 + 4 + 2 * (1 + 4 + 16));
    const mpView = new DataView(mp.buffer);
    mp[0] = 0x47;
    mp[1] = 0x50;
    mp[3] = 0x01;
    mpView.setInt32(4, 4326, true);
    mp[8] = 1;
    mpView.setUint32(9, 4, true);
    mpView.setUint32(13, 2, true);
    let o = 17;
    for (const [x, y] of [
      [1, 2],
      [3, 4]
    ] as Array<[number, number]>) {
      mp[o] = 1;
      mpView.setUint32(o + 1, 1, true);
      writeFloat64LE(mpView, o + 5, x);
      writeFloat64LE(mpView, o + 13, y);
      o += 21;
    }
    const multiPoint = parseGeoPackageGeometry(mp);
    expect(multiPoint?.type).toBe('MultiPoint');
    expect((multiPoint as GeoJSON.MultiPoint).coordinates).toEqual([
      [1, 2],
      [3, 4]
    ]);

    // MultiLineString with one line of 2 points
    const mlsBodyLen = 5 + 4 + 1 + 4 + 4 + 2 * 16;
    const mls = new Uint8Array(8 + mlsBodyLen);
    const mlsView = new DataView(mls.buffer);
    mls[0] = 0x47;
    mls[1] = 0x50;
    mls[3] = 0x01;
    mlsView.setInt32(4, 4326, true);
    mls[8] = 1;
    mlsView.setUint32(9, 5, true);
    mlsView.setUint32(13, 1, true);
    mls[17] = 1;
    mlsView.setUint32(18, 2, true);
    mlsView.setUint32(22, 2, true);
    writeFloat64LE(mlsView, 26, 0);
    writeFloat64LE(mlsView, 34, 0);
    writeFloat64LE(mlsView, 42, 1);
    writeFloat64LE(mlsView, 50, 1);
    expect(parseGeoPackageGeometry(mls)?.type).toBe('MultiLineString');

    // MultiPolygon with one square
    const ring = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0]
    ] as Array<[number, number]>;
    const mpgBuf = new Uint8Array(8 + 5 + 4 + (1 + 4 + 4 + 4 + ring.length * 16));
    const mpgView = new DataView(mpgBuf.buffer);
    mpgBuf[0] = 0x47;
    mpgBuf[1] = 0x50;
    mpgBuf[3] = 0x01;
    mpgView.setInt32(4, 4326, true);
    mpgBuf[8] = 1;
    mpgView.setUint32(9, 6, true);
    mpgView.setUint32(13, 1, true);
    mpgBuf[17] = 1;
    mpgView.setUint32(18, 3, true);
    mpgView.setUint32(22, 1, true);
    mpgView.setUint32(26, ring.length, true);
    let po = 30;
    for (const [x, y] of ring) {
      writeFloat64LE(mpgView, po, x);
      writeFloat64LE(mpgView, po + 8, y);
      po += 16;
    }
    expect(parseGeoPackageGeometry(mpgBuf)?.type).toBe('MultiPolygon');
  });

  it('skips unsupported and invalid geometry gracefully', () => {
    expect(parseGeoPackageGeometry(new Uint8Array([1, 2, 3]))).toBeNull();
    expect(parseGeoPackageGeometry(new Uint8Array(0))).toBeNull();

    // GeometryCollection (type 7) unsupported
    const buf = new Uint8Array(8 + 5);
    buf[0] = 0x47;
    buf[1] = 0x50;
    buf[2] = 0;
    buf[3] = 0x01;
    new DataView(buf.buffer).setInt32(4, 4326, true);
    buf[8] = 1;
    new DataView(buf.buffer).setUint32(9, 7, true);
    expect(parseGeoPackageGeometry(buf)).toBeNull();
  });

  it('summarizes, filters, and exports features', () => {
    const features: GeoPackageFeature[] = [
      {
        type: 'Feature',
        id: 1,
        layerName: 'landmarks',
        geometry: { type: 'Point', coordinates: [-122.4, 37.7] },
        properties: { name: 'City Hall', category: 'civic' }
      },
      {
        type: 'Feature',
        id: 2,
        layerName: 'landmarks',
        geometry: { type: 'Point', coordinates: [-122.3, 37.8] },
        properties: { name: 'Ferry Building', category: 'landmark' }
      },
      {
        type: 'Feature',
        id: 3,
        layerName: 'routes',
        geometry: {
          type: 'LineString',
          coordinates: [
            [-122.4, 37.7],
            [-122.3, 37.8]
          ]
        },
        properties: { name: 'Market Street Corridor', category: 'route' }
      }
    ];

    const summaries = summarizeFeatures(features);
    expect(summaries).toHaveLength(3);
    expect(summaries.find((item) => item.name === 'City Hall')?.kind).toBe('point');
    expect(geometryKind('MultiPolygon')).toBe('polygon');

    const counts = countFeaturesByKind(summaries);
    expect(counts.point).toBe(2);
    expect(counts.line).toBe(1);
    expect(filterGeoPackageFeatures(summaries, 'point', '').length).toBe(2);
    expect(filterGeoPackageFeatures(summaries, 'all', 'ferry').length).toBe(1);

    const csv = exportFeaturesCsv(summaries);
    expect(csv).toContain('id,name,layer,geometry_type,kind');
    expect(csv).toContain('City Hall');

    const table = buildAttributeTable(summaries);
    expect(table.columns).toEqual(expect.arrayContaining(['name', 'category']));
    expect(table.rows.length).toBe(3);
  });

  it('collects soft warnings', () => {
    const emptyFeatures: GeoPackageLayerInfo[] = [];
    const tileLayer: GeoPackageLayerInfo = {
      tableName: 'basemap',
      dataType: 'tiles',
      identifier: 'basemap',
      description: '',
      srsId: 3857,
      minX: null,
      minY: null,
      maxX: null,
      maxY: null,
      geometryColumn: null,
      geometryTypeName: null,
      featureCount: 0
    };

    const tileOnly = collectGeoPackageWarnings({
      featureLayers: emptyFeatures,
      tileLayers: [tileLayer],
      totalFeatureCount: 0,
      truncated: false,
      unparseableGeometryCount: 0
    });
    expect(tileOnly.some((item) => /no feature layers/i.test(item))).toBe(true);
    expect(tileOnly.some((item) => /tile-only/i.test(item))).toBe(true);

    const large = collectGeoPackageWarnings({
      featureLayers: [
        {
          ...tileLayer,
          tableName: 'big',
          dataType: 'features',
          geometryColumn: 'geom',
          featureCount: 5000
        }
      ],
      tileLayers: [],
      totalFeatureCount: 5000,
      truncated: true,
      unparseableGeometryCount: 2
    });
    expect(large.some((item) => /large feature count/i.test(item))).toBe(true);
    expect(large.some((item) => /unparseable/i.test(item))).toBe(true);
  });

  it('resolves suggestions by state', () => {
    expect(
      resolveGeoPackageSuggestion({
        hasFiles: false,
        hasError: false,
        featureCount: 0,
        tileOnly: false
      })?.id
    ).toBe('geopackage-intro');
    expect(
      resolveGeoPackageSuggestion({
        hasFiles: true,
        hasError: true,
        featureCount: 0,
        tileOnly: false
      })?.id
    ).toBe('geopackage-fix');
    expect(
      resolveGeoPackageSuggestion({
        hasFiles: true,
        hasError: false,
        featureCount: 0,
        tileOnly: true
      })?.id
    ).toBe('geopackage-tiles');
    expect(
      resolveGeoPackageSuggestion({
        hasFiles: true,
        hasError: false,
        featureCount: 800,
        tileOnly: false
      })?.id
    ).toBe('geopackage-large');
  });
});
