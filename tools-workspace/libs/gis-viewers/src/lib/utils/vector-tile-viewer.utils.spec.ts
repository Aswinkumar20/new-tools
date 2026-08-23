import { VECTOR_TILE_SAMPLE_BASE64 } from '../constants/vector-tile-viewer.constants';
import {
  base64ToUint8Array,
  createSampleVectorTileFile,
  filterValidVectorTileFiles,
  openAndParseMvtBytes,
  parseTileCoords,
  resolveVectorTileSuggestion,
  sampleTileCoords
} from './vector-tile-viewer.utils';

describe('vector-tile-viewer.utils', () => {
  it('accepts mvt/pbf/geojson and rejects others', () => {
    const { accepted, rejected } = filterValidVectorTileFiles([
      new File([new Uint8Array([1])], 'a.mvt'),
      new File(['{}'], 'b.geojson', { type: 'application/json' }),
      new File(['x'], 'notes.txt')
    ]);
    expect(accepted.map((f) => f.name)).toEqual(['a.mvt', 'b.geojson']);
    expect(rejected).toHaveLength(1);
  });

  it('parses missing tile coords as 0/0/0', () => {
    expect(parseTileCoords('', '', '')).toEqual({ z: 0, x: 0, y: 0, missing: true });
    expect(parseTileCoords(10, 163, 395)).toEqual({ z: 10, x: 163, y: 395, missing: false });
  });

  it('decodes embedded sample MVT', () => {
    const sample = createSampleVectorTileFile();
    expect(sample.lastModified).toBe(0);
    expect(sample.name).toBe('sample-landuse.mvt');
    const coords = sampleTileCoords();
    const bytes = base64ToUint8Array(VECTOR_TILE_SAMPLE_BASE64);
    const parsed = openAndParseMvtBytes(bytes, sample.name, coords.z, coords.x, coords.y, false);
    expect(parsed.layers[0].name).toBe('landuse');
    expect(parsed.geojson.features.length).toBe(1);
    expect(parsed.stats.featureCount).toBe(1);
  });

  it('resolves intro suggestion when empty', () => {
    expect(
      resolveVectorTileSuggestion({ hasFiles: false, hasError: false, featureCount: 0 })?.id
    ).toBe('vector-tile-intro');
  });
});
