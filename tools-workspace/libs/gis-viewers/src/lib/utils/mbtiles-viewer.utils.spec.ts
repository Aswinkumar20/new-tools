import {
  buildMbtilesStats,
  buildMbtilesWarnings,
  createSampleMbtilesFile,
  filterValidMbtilesFiles,
  formatMbtilesFileSize,
  isVectorTileFormat,
  mimeForMbtilesFormat,
  parseBoundsValue,
  parseCenterValue,
  parseMbtilesMetadataTable,
  resolveMbtilesSuggestion,
  tmsRowToXyzY,
  xyzYToTmsRow
} from './mbtiles-viewer.utils';
import { MBTILES_SAMPLE_BASE64 } from '../constants/mbtiles-viewer.constants';

describe('mbtiles-viewer.utils', () => {
  it('formats sizes and filters supported files', () => {
    expect(formatMbtilesFileSize(500)).toBe('500 B');
    expect(formatMbtilesFileSize(2048)).toBe('2.0 KB');

    const ok = new File([new Uint8Array([1, 2, 3])], 'demo.mbtiles');
    const bad = new File(['x'], 'demo.txt', { type: 'text/plain' });
    const result = filterValidMbtilesFiles([ok, bad]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejected[0].name).toBe('demo.txt');
  });

  it('flips TMS tile rows to XYZ y', () => {
    expect(tmsRowToXyzY(0, 2)).toBe(3);
    expect(xyzYToTmsRow(3, 2)).toBe(0);
    expect(xyzYToTmsRow(tmsRowToXyzY(1, 3), 3)).toBe(1);
  });

  it('parses metadata bounds, center, and format helpers', () => {
    expect(parseBoundsValue('-180,-85,180,85')).toEqual({
      west: -180,
      south: -85,
      east: 180,
      north: 85
    });
    expect(parseCenterValue('10,20,3')).toEqual({ lon: 10, lat: 20, zoom: 3 });
    expect(isVectorTileFormat('pbf')).toBe(true);
    expect(isVectorTileFormat('png')).toBe(false);
    expect(mimeForMbtilesFormat('jpg')).toBe('image/jpeg');
    expect(mimeForMbtilesFormat('png')).toBe('image/png');
  });

  it('builds stats and soft warnings', () => {
    const metadata = parseMbtilesMetadataTable({
      name: 'Demo',
      format: 'pbf',
      minzoom: '0',
      maxzoom: '4'
    });
    const stats = buildMbtilesStats(metadata, 0, { minZoom: 0, maxZoom: 4 });
    expect(stats.title).toBe('Demo');
    expect(stats.isVectorFormat).toBe(true);
    expect(stats.tileCount).toBe(0);

    const warnings = buildMbtilesWarnings(metadata, 0);
    expect(warnings.some((w) => /bounds/i.test(w))).toBe(true);
    expect(warnings.some((w) => /vector/i.test(w))).toBe(true);
    expect(warnings.some((w) => /empty/i.test(w))).toBe(true);
  });

  it('creates sample file from embedded base64 with lastModified 0', () => {
    expect(MBTILES_SAMPLE_BASE64.length).toBeGreaterThan(100);
    const sample = createSampleMbtilesFile();
    expect(sample.name).toBe('sample-world.mbtiles');
    expect(sample.lastModified).toBe(0);
    expect(sample.size).toBeGreaterThan(1000);
  });

  it('resolves suggestions by state', () => {
    expect(
      resolveMbtilesSuggestion({
        hasFiles: false,
        hasError: false,
        tileCount: 0,
        isVectorFormat: false
      })?.id
    ).toBe('mbtiles-intro');
    expect(
      resolveMbtilesSuggestion({
        hasFiles: true,
        hasError: true,
        tileCount: 0,
        isVectorFormat: false
      })?.id
    ).toBe('mbtiles-error');
    expect(
      resolveMbtilesSuggestion({
        hasFiles: true,
        hasError: false,
        tileCount: 10,
        isVectorFormat: true
      })?.id
    ).toBe('mbtiles-vector');
  });
});
