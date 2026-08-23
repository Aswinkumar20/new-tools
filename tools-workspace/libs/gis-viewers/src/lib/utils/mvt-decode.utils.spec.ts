import {
  decodeGeometryCommands,
  decodeMvtTile,
  tilePixelToLonLat,
  tileToGeoJson,
  zigZagDecode
} from './mvt-decode.utils';

/** Sample MVT from /tmp/sample.mvt.b64 — landuse polygon "Park", extent 4096. */
const SAMPLE_MVT_B64 =
  'Gjt4AgoHbGFuZHVzZRIdCAESAgAAGAMiEwnADMAMIsAlAADAJb8lAAC/JQ8aBG5hbWUiBgoEUGFyayiAIA==';

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

describe('mvt-decode.utils', () => {
  it('zigZagDecode round-trips small integers', () => {
    expect(zigZagDecode(0)).toBe(0);
    expect(zigZagDecode(1)).toBe(-1);
    expect(zigZagDecode(2)).toBe(1);
    expect(zigZagDecode(3)).toBe(-2);
  });

  it('decodes sample MVT layers, keys, values, and polygon feature', () => {
    const tile = decodeMvtTile(base64ToBytes(SAMPLE_MVT_B64));
    expect(tile.layers).toHaveLength(1);
    const layer = tile.layers[0];
    expect(layer.name).toBe('landuse');
    expect(layer.extent).toBe(4096);
    expect(layer.keys).toEqual(['name']);
    expect(layer.values[0]).toEqual({ kind: 'string', value: 'Park' });
    expect(layer.features).toHaveLength(1);
    const feature = layer.features[0];
    expect(feature.id).toBe(1);
    expect(feature.type).toBe('Polygon');
    expect(feature.properties).toEqual({ name: 'Park' });
    expect(feature.geometry.length).toBeGreaterThan(0);
    expect(feature.geometry[0].length).toBeGreaterThanOrEqual(4);
  });

  it('converts sample tile to GeoJSON at z0/x0/y0', () => {
    const tile = decodeMvtTile(base64ToBytes(SAMPLE_MVT_B64));
    const fc = tileToGeoJson(tile, 0, 0, 0);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0];
    expect(f.properties['name']).toBe('Park');
    expect(f.properties['layer']).toBe('landuse');
    expect(f.geometry.type).toBe('Polygon');
    if (f.geometry.type === 'Polygon') {
      const ring = f.geometry.coordinates[0];
      expect(ring.length).toBeGreaterThanOrEqual(4);
      for (const [lon, lat] of ring) {
        expect(lon).toBeGreaterThanOrEqual(-180);
        expect(lon).toBeLessThanOrEqual(180);
        expect(lat).toBeGreaterThanOrEqual(-85.1);
        expect(lat).toBeLessThanOrEqual(85.1);
      }
    }
  });

  it('projects tile origin pixel to northwest corner of tile', () => {
    const [lon, lat] = tilePixelToLonLat(0, 0, 0, 0, 0, 4096);
    expect(lon).toBeCloseTo(-180, 5);
    expect(lat).toBeCloseTo(85.0511, 2);
  });

  it('decodes MoveTo/LineTo/ClosePath command stream', () => {
    // MoveTo 1 → (1,1), LineTo 2 → +(1,0) +(0,1), ClosePath
    const cmds = [
      (1 << 3) | 1,
      2,
      2, // MoveTo zigzag(1)=2
      (2 << 3) | 2,
      2,
      0,
      0,
      2, // LineTo (1,0) then (0,1)
      (1 << 3) | 7
    ];
    const rings = decodeGeometryCommands(cmds);
    expect(rings).toHaveLength(1);
    expect(rings[0][0]).toEqual([1, 1]);
    expect(rings[0][rings[0].length - 1]).toEqual([1, 1]);
  });
});
